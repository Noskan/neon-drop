// A local stand-in for the Supabase project: GoTrue (anonymous sign-up / refresh) and
// PostgREST (RPC + the two reads the client makes) answered by PGlite running the real
// supabase/schema.sql. Nothing here talks to the network.
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createHash } from 'node:crypto';

// `schemaSqls`: SQL texts applied in order (e.g. an older schema, then supabase/schema.sql)
export async function createBridge(schemaSqls) {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- What a Supabase project does for every object created in schema public
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  `);
  for (const sql of schemaSqls) await db.exec(sql);

  const bridge = {
    db,
    anonEnabled: true,
    down: false, // true = every request fails at the network level
    hang: false, // true = requests are accepted and never answered
    expiresIn: 3600, // access token lifetime the fake Auth announces
    // Fake "Sign in with Google": the consent page answers at once as `googleAccount`
    // (null = the person cancels at Google)
    oauth: { manualLinking: true, googleAccount: null, flows: new Map(), codes: new Map(), identities: new Map(), emails: new Map() },
    failWith: null, // (method, url) => { status, body } to answer instead of the database
    log: [],
    tokens: new Map(), // access token -> user id
    refresh: new Map(), // refresh token -> user id
    beforeRpc: null, // async (fn, body, uid) => void — lets a test move the server clock
    seq: 0,
    lock: Promise.resolve(),
  };

  // PGlite is one connection and SET ROLE is session state: run requests one at a time
  const exclusive = (fn) => {
    const run = bridge.lock.then(fn, fn);
    bridge.lock = run.catch(() => {});
    return run;
  };
  bridge.sql = (text, params = []) => exclusive(async () => (await db.query(text, params)).rows);

  async function asRole(uid, text, params) {
    await db.exec(`RESET ROLE;`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
    await db.exec(`SET ROLE ${uid ? 'authenticated' : 'anon'};`);
    try {
      return { rows: (await db.query(text, params)).rows };
    } catch (e) {
      return { error: e };
    } finally {
      await db.exec(`RESET ROLE;`);
    }
  }

  const issue = (uid) => {
    const n = ++bridge.seq;
    bridge.tokens.set(`tok${n}`, uid);
    bridge.refresh.set(`ref${n}`, uid);
    const email = bridge.oauth.emails.get(uid) || null;
    return { access_token: `tok${n}`, refresh_token: `ref${n}`, expires_in: bridge.expiresIn, user: { id: uid, email, is_anonymous: !email } };
  };
  // What the provider's consent page ends in: a redirect back to the game with a code or an error
  const consent = async (flow) => {
    const back = new URL(flow.redirectTo);
    const fail = (error, code, description) => {
      back.searchParams.set('error', error);
      if (code) back.searchParams.set('error_code', code);
      back.searchParams.set('error_description', description);
      return { status: 302, location: back.toString() };
    };
    const email = bridge.oauth.googleAccount;
    if (!email) return fail('access_denied', null, 'The user denied the request');
    const owner = bridge.oauth.identities.get(email) || null;
    let target = owner;
    if (flow.mode === 'link') {
      if (owner && owner !== flow.uid) return fail('server_error', 'identity_already_exists', 'Identity is already linked to another user');
      target = flow.uid;
    } else if (!owner) {
      target = (await db.query(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`)).rows[0].id;
    }
    bridge.oauth.identities.set(email, target);
    bridge.oauth.emails.set(target, email);
    const code = `code${++bridge.seq}`;
    bridge.oauth.codes.set(code, { uid: target, challenge: flow.challenge });
    back.searchParams.set('code', code);
    return { status: 302, location: back.toString() };
  };
  const startFlow = (mode, uid, url) => {
    const id = `flow${++bridge.seq}`;
    bridge.oauth.flows.set(id, { mode, uid, challenge: url.searchParams.get('code_challenge'), redirectTo: url.searchParams.get('redirect_to') });
    return `${url.origin}/auth/v1/fake-consent?flow=${id}`;
  };

  // Returns { status, body }
  bridge.handle = (method, url, headers, body) => exclusive(async () => {
    const auth = headers['authorization'] || null;
    const uid = auth ? bridge.tokens.get(auth.replace('Bearer ', '')) || null : null;
    bridge.log.push({ method, path: url.pathname, auth, body, uid });

    if (url.pathname === '/auth/v1/signup') {
      if (!bridge.anonEnabled) return { status: 422, body: { error_code: 'anonymous_provider_disabled', msg: 'Anonymous sign-ins are disabled' } };
      const id = (await db.query(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`)).rows[0].id;
      return { status: 200, body: issue(id) };
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const grant = bridge.oauth.codes.get(body.auth_code);
      bridge.oauth.codes.delete(body.auth_code);
      const challenge = createHash('sha256').update(String(body.code_verifier || '')).digest('base64url');
      if (!grant) return { status: 404, body: { code: 404, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' } };
      if (grant.challenge !== challenge) return { status: 400, body: { code: 400, error_code: 'bad_code_verifier', msg: 'code challenge does not match previously saved code verifier' } };
      return { status: 200, body: issue(grant.uid) };
    }
    if (url.pathname === '/auth/v1/authorize') {
      if (url.searchParams.get('provider') !== 'google') return { status: 400, body: { error_code: 'validation_failed', msg: 'Unsupported provider' } };
      // Answered in one hop: a redirect to another URL on this host would not be intercepted again
      return consent({ mode: 'signin', uid: null, challenge: url.searchParams.get('code_challenge'), redirectTo: url.searchParams.get('redirect_to') });
    }
    if (url.pathname === '/auth/v1/user/identities/authorize') {
      if (!uid) return { status: 401, body: { code: 401, error_code: 'no_authorization', msg: 'This endpoint requires a Bearer token' } };
      if (!bridge.oauth.manualLinking) return { status: 404, body: { code: 404, error_code: 'manual_linking_disabled', msg: 'Manual linking is disabled' } };
      return { status: 200, body: { url: startFlow('link', uid, url) } };
    }
    if (url.pathname === '/auth/v1/fake-consent') {
      const flow = bridge.oauth.flows.get(url.searchParams.get('flow'));
      if (!flow) return { status: 400, body: { msg: 'unknown flow' } };
      bridge.oauth.flows.delete(url.searchParams.get('flow'));
      return consent(flow);
    }
    if (url.pathname === '/auth/v1/logout') {
      if (auth) bridge.tokens.delete(auth.replace('Bearer ', ''));
      for (const [ref, owner] of bridge.refresh) if (owner === uid) bridge.refresh.delete(ref);
      return { status: 204, body: null };
    }
    if (url.pathname === '/auth/v1/token') {
      const owner = bridge.refresh.get(body.refresh_token);
      if (!owner) return { status: 400, body: { error_code: 'refresh_token_not_found' } };
      bridge.refresh.delete(body.refresh_token);
      return { status: 200, body: issue(owner) };
    }
    if (auth && !uid) return { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } };

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop();
      const sig = (await db.query(
        `SELECT p.oid::regprocedure::text AS proc, p.proargnames AS names, (SELECT array_agg(t::regtype::text ORDER BY ord) FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS x(t, ord)) AS types
         FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = $1`, [fn])).rows;
      const keys = Object.keys(body || {});
      const match = sig.find((s) => keys.every((k) => (s.names || []).includes(k)));
      if (!match) return { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache` } };
      if (bridge.beforeRpc) await bridge.beforeRpc(fn, body, uid);
      const args = [], params = [];
      keys.forEach((k) => {
        const type = match.types[match.names.indexOf(k)];
        let v = body[k];
        if (type === 'jsonb' || type === 'json') v = JSON.stringify(v);
        params.push(v);
        args.push(`${k} => $${params.length}::${type}`);
      });
      const r = await asRole(uid, `SELECT public.${fn}(${args.join(', ')}) AS r`, params);
      if (r.error) {
        const msg = r.error.message || String(r.error);
        if (/permission denied/.test(msg)) return { status: uid ? 403 : 401, body: { code: '42501', message: msg } };
        return { status: 400, body: { code: r.error.code || 'P0001', message: msg } };
      }
      return { status: 200, body: r.rows[0].r ?? null };
    }

    const rel = url.pathname.replace('/rest/v1/', '');
    if (method === 'GET' && (rel === 'leaderboard_global_view' || rel === 'profiles')) {
      const exists = (await db.query(`SELECT to_regclass($1) AS c`, [`public.${rel}`])).rows[0].c;
      if (!exists) return { status: 404, body: { code: 'PGRST205', message: `Could not find the table 'public.${rel}' in the schema cache` } };
      const cols = (url.searchParams.get('select') || '*').split(',');
      if (!cols.every((c) => /^[a-z_*]+$/.test(c))) return { status: 400, body: { message: 'bad select' } };
      const where = url.searchParams.get('or') === '(callsign.not.is.null,cases_opened.gt.0)' ? 'WHERE callsign IS NOT NULL OR cases_opened > 0' : '';
      const order = (url.searchParams.get('order') || '').split(',').filter(Boolean).map((o) => {
        const [c, dir] = o.split('.');
        return /^[a-z_]+$/.test(c) ? `${c} ${dir === 'desc' ? 'DESC' : 'ASC'}` : null;
      }).filter(Boolean);
      const limit = Math.min(1000, Number(url.searchParams.get('limit')) || 1000);
      const r = await asRole(uid, `SELECT ${cols.join(', ')} FROM public.${rel} ${where} ${order.length ? 'ORDER BY ' + order.join(', ') : ''} LIMIT ${limit}`, []);
      if (r.error) {
        const msg = r.error.message || String(r.error);
        if (/does not exist/.test(msg)) return { status: 400, body: { code: '42703', message: msg } };
        return { status: /permission denied/.test(msg) ? 401 : 400, body: { code: '42501', message: msg } };
      }
      return { status: 200, body: r.rows };
    }
    return { status: 404, body: {} };
  });

  // Wires the bridge into a Playwright browser context
  bridge.attach = async (ctx, { supaOrigin, appOrigin, external }) => {
    await ctx.route((url) => url.origin !== appOrigin, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== supaOrigin) {
        external.push(req.url());
        if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        return route.abort();
      }
      if (bridge.down) return route.abort('internetdisconnected');
      if (bridge.hang) return; // left pending until the page gives up
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
      const body = req.postData() ? JSON.parse(req.postData()) : {};
      const forced = bridge.failWith ? bridge.failWith(req.method(), url) : null;
      if (forced) return route.fulfill({ status: forced.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(forced.body || {}) });
      const out = await bridge.handle(req.method(), url, req.headers(), body);
      if (out.location) return route.fulfill({ status: out.status, headers: { ...cors, location: out.location } });
      if (out.body === null) return route.fulfill({ status: out.status, headers: cors });
      return route.fulfill({ status: out.status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(out.body) });
    });
  };

  return bridge;
}
