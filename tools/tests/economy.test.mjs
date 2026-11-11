// Server-authoritative economy tests for supabase/schema.sql, run in PGlite (Postgres in WASM).
// Applies the schemas a database may already have (commits 1dd96b7 and f2dedb4), then the
// current schema twice, and exercises every RPC the way PostgREST does (role + JWT subject).
//
//   cd tools/tests && npm install && npm run test:sql
//
// Keep it green whenever a game formula changes in app.js: the parity checks below are what
// guarantees the server pays exactly what the client displays.
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaAt = (rev) => execFileSync('git', ['show', `${rev}:supabase/schema.sql`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const db = new PGlite({ extensions: { citext, pgcrypto } });
let failures = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) failures++;
  if (!cond || process.env.VERBOSE) console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  -> ' + extra : ''}`);
  else console.log(`PASS  ${label}`);
};

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

async function as(role, uid, sql, params = []) {
  await db.exec(`RESET ROLE;`);
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  await db.exec(`SET ROLE ${role};`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec(`RESET ROLE;`); }
}
const rpc = async (uid, call, params = []) => {
  const r = await as('authenticated', uid, `SELECT public.${call} AS r`, params);
  return r.error ? { error: r.error } : r.rows[0].r;
};
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const newUser = async () => (await q(`INSERT INTO auth.users DEFAULT VALUES RETURNING id`))[0].id;
const num = (v) => Number(v);

// ---------------------------------------------------------------------------
// 0. Upgrade path: live schema -> auth-binding schema -> new schema (twice)
// ---------------------------------------------------------------------------
await db.exec(schemaAt('1dd96b7'));
await as('anon', null, `SELECT public.sync_operator_leaderboard_rpc('test_op','Operador-TEST',0,1,0,500,0.15,0,0,0,0,0,0)`);
await db.exec(schemaAt('f2dedb4'));
const newSql = readFileSync(join(REPO, 'supabase', 'schema.sql'), 'utf8');
for (const label of ['NEW schema applies over the previous ones', 'NEW schema re-applies (idempotent)']) {
  try { await db.exec(newSql); ok(true, label); } catch (e) { ok(false, label, e.message); }
}
ok((await q(`SELECT count(*)::int n FROM public.profiles`))[0].n === 0, 'legacy/test rows removed');
ok((await q(`SELECT count(*)::int n FROM public.item_catalog`))[0].n === 252 && (await q(`SELECT count(*)::int n FROM public.case_catalog`))[0].n === 18, 'catalog seeded: 18 cases / 252 items');
ok((await q(`SELECT count(*)::int n FROM pg_proc WHERE proname = 'sync_operator_leaderboard_rpc'`))[0].n === 0, 'client-trusting leaderboard RPC is gone');
const importUntil = (await q(`SELECT value FROM public.app_settings WHERE key = 'legacy_import_until'`))[0].value;

const catalog = await q(`SELECT template_id, case_id, rarity, base_price::float8 AS base FROM public.item_catalog`);
const catById = new Map(catalog.map((c) => [c.template_id, c]));
const cases = await q(`SELECT id, tier, price::float8 AS price FROM public.case_catalog ORDER BY price`);

// ---------------------------------------------------------------------------
// 1. Level curve parity with the client
// ---------------------------------------------------------------------------
const jsLevel = (xp) => { let rem = Math.max(0, Math.floor(xp)), l = 1; while (l < 55) { const n = Math.round(140 + Math.pow(l, 1.55) * 28); if (rem >= n) { rem -= n; l++; } else break; } return l; };
{
  const samples = [0, 1, 167, 168, 169, 500, 5000, 20000, 100000, 250000, 300000, 400000];
  let bound = 0; for (let l = 1; l < 55; l++) { bound += Math.round(140 + Math.pow(l, 1.55) * 28); samples.push(bound - 1, bound); }
  const rows = await q(`SELECT x, public._mil_level(x) AS lvl FROM unnest($1::bigint[]) AS x`, [samples]);
  const bad = rows.filter((r) => r.lvl !== jsLevel(Number(r.x)));
  ok(bad.length === 0, `military level curve matches the client on ${rows.length} XP values (incl. every level boundary)`, JSON.stringify(bad.slice(0, 3)));
}

// ---------------------------------------------------------------------------
// 2. Boot, open case, validation
// ---------------------------------------------------------------------------
const A = await newUser(), B = await newUser();
let st = await rpc(A, `get_my_state_rpc()`);
ok(num(st.profile.balance) === 500 && st.inventory.length === 0 && st.profile.player_id === A && st.legacy_import_open === true, 'first contact creates a $500 profile bound to the account', JSON.stringify(st.error || st.profile.balance));
ok((await as('anon', null, `SELECT public.get_my_state_rpc()`)).error?.includes('permission denied'), 'anon cannot call game RPCs');

let r = await rpc(A, `open_case_rpc('nx_t1_1', 2)`);
ok(!r.error && r.items.length === 2 && num(r.profile.balance) >= 450 && num(r.profile.balance) < 450.2 && r.profile.cases_opened === 2, 'opening 2x T1 debits $50 and returns 2 items', r.error || `${r.profile.balance}`);
ok(r.items.every((i) => catById.get(i.template_id)?.case_id === 'nx_t1_1' && /^[0-9a-f-]{36}$/.test(i.uid)), 'items belong to the opened case and carry server UUIDs');
ok(/INVALID_COUNT/.test((await rpc(A, `open_case_rpc('nx_t1_1', 4)`)).error || ''), 'count other than 1/2/3/5 rejected');
ok(/INVALID_COUNT/.test((await rpc(A, `open_case_rpc('nx_t1_1', 500)`)).error || ''), 'huge count rejected');
ok(/UNKNOWN_CASE/.test((await rpc(A, `open_case_rpc('nope', 1)`)).error || ''), 'unknown case rejected');
ok(/INSUFFICIENT_BALANCE/.test((await rpc(A, `open_case_rpc('nx_t6_3', 1)`)).error || ''), 'cannot open a $65,000 case with $450');
st = await rpc(A, `get_my_state_rpc()`);
ok(st.inventory.length === 2 && st.profile.cases_opened === 2, 'failed attempts changed nothing');

// ---------------------------------------------------------------------------
// 3. Odds, prices, XP over a large sample
// ---------------------------------------------------------------------------
await q(`UPDATE public.profiles SET balance = 90000000 WHERE id = $1`, [B]).catch(() => {});
await rpc(B, `get_my_state_rpc()`);
await q(`UPDATE public.profiles SET balance = 90000000 WHERE id = $1`, [B]);
const N_OPEN = Number(process.env.N_OPEN || 2400); // x5 = 12,000 rolls
const counts = { blue: 0, purple: 0, pink: 0, red: 0, gold: 0 };
let stCount = 0, priceMismatch = 0, xpExpected = 0, rolls = 0;
const wearMult = (f) => (f < 0.07 ? 1.45 : f < 0.15 ? 1.2 : f < 0.38 ? 1 : f < 0.45 ? 0.85 : 0.72);
const xpBy = { blue: 25, purple: 60, pink: 150, red: 400, gold: 1200 };
const tplSeen = new Map();
const t0 = Date.now();
await db.exec(`SELECT set_config('request.jwt.claim.sub', '${B}', false); SET ROLE authenticated;`);
for (let n = 0; n < N_OPEN; n++) {
  const res = (await db.query(`SELECT public.open_case_rpc('nx_t1_2', 5) AS r`)).rows[0].r;
  let batchXp = 0;
  for (const it of res.items) {
    const c = catById.get(it.template_id);
    counts[c.rarity]++; rolls++;
    if (it.stat_trak) stCount++;
    tplSeen.set(it.template_id, (tplSeen.get(it.template_id) || 0) + 1);
    const expect = c.base * wearMult(num(it.float)) * (it.stat_trak ? 1.85 : 1);
    if (Math.abs(expect - num(it.price)) > 0.0051) priceMismatch++;
    batchXp += xpBy[c.rarity] * 1; // tier 1 -> x1
  }
  xpExpected += Math.round(batchXp);
}
await db.exec(`RESET ROLE;`);
const pct = (k) => (counts[k] / rolls) * 100;
console.log(`      ${rolls} rolls in ${((Date.now() - t0) / 1000).toFixed(1)}s -> blue ${pct('blue').toFixed(2)}% purple ${pct('purple').toFixed(2)}% pink ${pct('pink').toFixed(2)}% red ${pct('red').toFixed(2)}% gold ${pct('gold').toFixed(2)}% | SyncTrack ${(stCount / rolls * 100).toFixed(2)}%`);
// tolerance = ~4 standard deviations of a binomial at this sample size
const within = (k, p) => Math.abs(pct(k) - p) < 4 * Math.sqrt((p * (100 - p)) / rolls);
ok(within('blue', 75) && within('purple', 16) && within('pink', 5.5) && within('red', 2.5) && within('gold', 1), 'rarity odds match the published 75 / 16 / 5.5 / 2.5 / 1 %');
ok(Math.abs(stCount / rolls - 0.10) < 4 * Math.sqrt(0.09 / rolls), 'SyncTrack chance is 10% at Prestige 0');
ok(priceMismatch === 0, 'every price = base x wear x SyncTrack, computed by the server', String(priceMismatch));
ok(tplSeen.size === 14, 'all 14 skins of the case can drop', String(tplSeen.size));
const pB = (await q(`SELECT xp::int, cases_opened, golds_unboxed, total_spent::float8 ts, best_drop_value::float8 bd FROM public.profiles WHERE id = $1`, [B]))[0];
ok(pB.xp === xpExpected && pB.cases_opened === N_OPEN * 5 && pB.golds_unboxed === counts.gold && Math.abs(pB.ts - N_OPEN * 5 * 35) < 0.01, 'XP, case count, gold count and total spent are tracked server-side', JSON.stringify(pB));

// ---------------------------------------------------------------------------
// 4. Passive income parity with the client formula
// ---------------------------------------------------------------------------
function clientRate(profile, inv) {
  const owned = new Set(inv.map((i) => i.template_id));
  const mastery = new Map();
  for (const c of cases) {
    const items = catalog.filter((x) => x.case_id === c.id);
    const w = items.filter((x) => x.rarity !== 'gold'), g = items.filter((x) => x.rarity === 'gold');
    const wDone = w.every((x) => owned.has(x.template_id)), gDone = g.every((x) => owned.has(x.template_id));
    mastery.set(c.id, wDone && gDone ? 2 : wDone ? 1 : 0);
  }
  const groups = new Map();
  inv.forEach((i) => { if (!groups.has(i.template_id)) groups.set(i.template_id, []); groups.get(i.template_id).push(i); });
  const kept = [];
  groups.forEach((list) => {
    list.sort((a, b) => (b.is_heirloom ? 1 : 0) - (a.is_heirloom ? 1 : 0) || num(b.price) - num(a.price));
    kept.push(list[0]); list.slice(1).forEach((e) => { if (e.is_heirloom) kept.push(e); });
  });
  const mult = (s) => (s === 2 ? 2.0 : s === 1 ? 1.25 : 1.0);
  const skins = kept.reduce((sum, it) => sum + Number((Math.max(0.005, num(it.price) * 0.0004) * mult(mastery.get(it.case_id))).toFixed(3)), 0);
  let bonus = 0;
  if (profile.cases_opened >= 10) bonus += 5;
  if (kept.length >= 25) bonus += 10;
  if (profile.tradeups_done >= 1) bonus += 10;
  if (profile.golds_unboxed >= 1) bonus += 15;
  if ([...mastery.values()].some((s) => s >= 1)) bonus += 15;
  if ([...mastery.values()].some((s) => s === 2)) bonus += 25;
  return { rate: Number(((0.15 + skins) * (1 + bonus / 100) * (1 + profile.prestige_level * 0.5)).toFixed(2)), kept: kept.length, plat: [...mastery.values()].filter((s) => s === 2).length };
}
const parity = async (uid, label) => {
  const s = await rpc(uid, `get_my_state_rpc()`);
  const c = clientRate(s.profile, s.inventory);
  ok(Math.abs(c.rate - num(s.profile.passive_rate_per_sec)) <= 0.011 && c.kept === s.profile.unique_skins_count && c.plat === s.profile.platinum_cases_count,
    `${label}: server $/s, unique skins and platinum count equal the client formula`, `client ${c.rate}/${c.kept}/${c.plat} vs server ${s.profile.passive_rate_per_sec}/${s.profile.unique_skins_count}/${s.profile.platinum_cases_count}`);
  return s;
};
st = await parity(B, `after ${rolls} drops (platinum T1 case, ${counts.gold} golds)`);
ok(st.profile.platinum_cases_count === 1, 'the fully collected case counts as platinum');

// ---------------------------------------------------------------------------
// 5. Selling
// ---------------------------------------------------------------------------
const before = st;
const dupesJs = (() => {
  const groups = new Map();
  before.inventory.forEach((i) => { if (!groups.has(i.template_id)) groups.set(i.template_id, []); groups.get(i.template_id).push(i); });
  let n = 0, val = 0; groups.forEach((l) => { l.sort((a, b) => num(b.price) - num(a.price)); l.slice(1).forEach((x) => { n++; val += num(x.price); }); });
  return { n, val };
})();
r = await rpc(B, `sell_duplicates_rpc()`);
ok(!r.error && r.removed.length === dupesJs.n && Math.abs(num(r.gained) - dupesJs.val) < 0.01, 'sell duplicates keeps the most valuable copy of each skin and pays the rest', r.error || `${r.removed.length} sold for ${r.gained}`);
st = await parity(B, 'after selling duplicates');
ok(st.inventory.length === 14, 'one copy of each of the 14 skins remains');
const victim = st.inventory[0];
r = await rpc(A, `sell_items_rpc($1::uuid[])`, [[victim.uid]]);
ok(!r.error && r.removed.length === 0 && num(r.gained) === 0, "A cannot sell B's item");
r = await rpc(B, `sell_items_rpc($1::uuid[])`, [[victim.uid, victim.uid]]);
ok(!r.error && r.removed.length === 1 && Math.abs(num(r.gained) - num(victim.price)) < 0.001, 'own item sold once even if listed twice');
r = await rpc(B, `sell_items_rpc($1::uuid[])`, [[victim.uid]]);
ok(num(r.gained) === 0, 'an item cannot be sold twice');

// ---------------------------------------------------------------------------
// 6. Heirloom
// ---------------------------------------------------------------------------
st = await rpc(B, `get_my_state_rpc()`);
r = await rpc(B, `set_heirloom_rpc($1, true)`, [st.inventory[0].uid]);
ok(!r.error && r.updated[0].is_heirloom === true, 'first heirloom slot locks');
r = await rpc(B, `set_heirloom_rpc($1, true)`, [st.inventory[1].uid]);
ok(/HEIRLOOM_LIMIT/.test(r.error || ''), 'Prestige 0 has a single heirloom slot');
r = await rpc(B, `sell_items_rpc($1::uuid[])`, [[st.inventory[0].uid]]);
ok(r.removed.length === 0, 'heirloom items cannot be sold');
r = await rpc(A, `set_heirloom_rpc($1, true)`, [st.inventory[1].uid]);
ok(/ITEM_NOT_FOUND/.test(r.error || ''), "cannot lock someone else's item");

// ---------------------------------------------------------------------------
// 7. Trade-up
// ---------------------------------------------------------------------------
const C = await newUser();
await rpc(C, `get_my_state_rpc()`);
const give = async (uid, tpl, n = 1, extra = {}) => {
  for (let i = 0; i < n; i++) {
    await q(`INSERT INTO public.inventory_items (user_id, template_id, case_id, name, rarity, shape, c1, c2, pattern, float_val, wear_short, stat_trak, price)
             SELECT $1, template_id, case_id, name, rarity, shape, c1, c2, pattern, 0.2, 'FT', $3, base_price FROM public.item_catalog WHERE template_id = $2`, [uid, tpl, !!extra.statTrak]);
  }
};
await give(C, 'nx_t1_1_b1', 3); await give(C, 'nx_t6_3_b1', 2); await give(C, 'nx_t1_1_p1', 1); await give(C, 'nx_t1_1_g1', 5);
st = await rpc(C, `get_my_state_rpc()`);
const blues = st.inventory.filter((i) => catById.get(i.template_id).rarity === 'blue').map((i) => i.uid);
const purple = st.inventory.find((i) => i.template_id === 'nx_t1_1_p1').uid;
const golds = st.inventory.filter((i) => i.template_id === 'nx_t1_1_g1').map((i) => i.uid);
ok(/TRADEUP_INVALID/.test((await rpc(C, `execute_tradeup_rpc($1::uuid[])`, [blues.slice(0, 4)])).error || ''), 'trade-up needs exactly 5 items');
ok(/TRADEUP_INVALID/.test((await rpc(C, `execute_tradeup_rpc($1::uuid[])`, [[...blues.slice(0, 4), blues[0]]])).error || ''), 'the same item cannot be listed twice');
ok(/TRADEUP_INVALID/.test((await rpc(C, `execute_tradeup_rpc($1::uuid[])`, [[...blues.slice(0, 4), purple]])).error || ''), 'mixed rarities rejected');
ok(/TRADEUP_INVALID/.test((await rpc(C, `execute_tradeup_rpc($1::uuid[])`, [golds])).error || ''), 'gold items cannot be traded up');
ok(/TRADEUP_INVALID/.test((await rpc(A, `execute_tradeup_rpc($1::uuid[])`, [blues])).error || ''), "cannot consume someone else's items");
r = await rpc(C, `execute_tradeup_rpc($1::uuid[])`, [blues]);
const forged = r.items?.[0];
ok(!r.error && r.removed.length === 5 && catById.get(forged.template_id).rarity === 'purple' && ['nx_t1_1', 'nx_t6_3'].includes(forged.case_id) && r.profile.tradeups_done === 1,
  'valid contract: 5 blues -> 1 purple from the case of one of the inputs', r.error || forged.case_id);
st = await parity(C, 'after a trade-up');
ok(st.inventory.length === 7 && st.profile.xp === 180, 'inputs consumed, +180 XP');
// output case is drawn among the inputs, never chosen by the caller
const caseHits = { nx_t1_1: 0, nx_t6_3: 0 };
for (let i = 0; i < 60; i++) {
  await q(`DELETE FROM public.inventory_items WHERE user_id = $1`, [C]);
  await give(C, 'nx_t1_1_b1', 3); await give(C, 'nx_t6_3_b1', 2);
  const inv = (await rpc(C, `get_my_state_rpc()`)).inventory.map((i) => i.uid);
  caseHits[(await rpc(C, `execute_tradeup_rpc($1::uuid[])`, [inv])).items[0].case_id]++;
}
ok(caseHits.nx_t1_1 > caseHits.nx_t6_3 && caseHits.nx_t6_3 > 5, 'output case is weighted by the inputs (3 cheap : 2 expensive)', JSON.stringify(caseHits));

// ---------------------------------------------------------------------------
// 8. Idle income on the server clock
// ---------------------------------------------------------------------------
const D = await newUser();
await rpc(D, `get_my_state_rpc()`);
await give(D, 'nx_t3_1_r1', 1);
st = await rpc(D, `get_my_state_rpc()`);
const rate = num(st.profile.passive_rate_per_sec), bal0 = num(st.profile.balance);
await q(`UPDATE public.profiles SET last_claimed_at = now() - interval '100 seconds' WHERE id = $1`, [D]);
st = await rpc(D, `get_my_state_rpc()`);
ok(Math.abs(num(st.profile.balance) - bal0 - rate * 100) < 0.02 && st.offline.elapsed_sec === 100 && Math.abs(num(st.offline.earned) - rate * 100) < 0.02, '100s away credits exactly 100s of income', `${st.profile.balance} (rate ${rate})`);
const bal1 = num(st.profile.balance);
await q(`UPDATE public.profiles SET last_claimed_at = now() - interval '5 days' WHERE id = $1`, [D]);
st = await rpc(D, `get_my_state_rpc()`);
ok(Math.abs(num(st.profile.balance) - bal1 - rate * 43200) < 0.02 && st.offline.elapsed_sec === 43200, '5 days away is capped at 12h');
const bal2 = num(st.profile.balance);
await as('service_role', null, `SELECT public.grant_vip_days_admin($1, 30)`, [D]);
await q(`UPDATE public.profiles SET last_claimed_at = now() - interval '5 days' WHERE id = $1`, [D]);
st = await rpc(D, `get_my_state_rpc()`);
ok(Math.abs(num(st.profile.balance) - bal2 - rate * 86400) < 0.02 && st.profile.is_vip === true && st.profile.offline_cap_sec === 86400, 'VIP cap is 24h');
// income is credited at the OLD rate before an action changes the rate
await q(`UPDATE public.profiles SET last_claimed_at = now() - interval '1000 seconds', balance = 1000 WHERE id = $1`, [D]);
r = await rpc(D, `sell_items_rpc($1::uuid[])`, [[st.inventory[0].uid]]);
ok(Math.abs(num(r.profile.balance) - (1000 + rate * 1000 + num(st.inventory[0].price))) < 0.02 && num(r.profile.passive_rate_per_sec) === 0.15, 'selling the only skin pays the income earned so far at the old rate, then drops the rate to base');
const xpBefore = r.profile.xp;
r = await rpc(D, `open_case_rpc('nx_t1_1', 1)`);
const gained = r.profile.xp - xpBefore, baseXp = xpBy[catById.get(r.items[0].template_id).rarity];
ok(gained === Math.round(baseXp * 1.25), 'VIP gets +25% XP', `${gained} vs base ${baseXp}`);

// ---------------------------------------------------------------------------
// 9. Gridshot
// ---------------------------------------------------------------------------
const E = await newUser();
await rpc(E, `get_my_state_rpc()`);
await give(E, 'nx_t1_1_r1', 1, { statTrak: true });
st = await rpc(E, `get_my_state_rpc()`);
const gun = st.inventory[0];
const startRound = async (uid, secondsAgo) => {
  await q(`UPDATE public.profiles SET next_gridshot_allowed_at = now() WHERE id = $1`, [uid]);
  const sid = await rpc(uid, `start_gridshot_rpc()`);
  await q(`UPDATE public.gridshot_sessions SET started_at = now() - make_interval(secs => $2) WHERE id = $1`, [sid, secondsAgo]);
  return sid;
};
let sid = await startRound(E, 0);
r = await rpc(E, `submit_gridshot_rpc($1, 5000, 40, 45, 5, NULL)`, [sid]);
ok(r.ok === false && r.error === 'INVALID_SESSION_TIME' && (await q(`SELECT flagged_cheat f FROM public.gridshot_sessions WHERE id = $1`, [sid]))[0].f, 'instant submission refused and flagged');
sid = await startRound(E, 41);
ok((await rpc(E, `submit_gridshot_rpc($1, 5000, 40, 45, 5, NULL)`, [sid])).error === 'INVALID_SESSION_TIME', 'submission after 40s refused (window is 28-40s)');
sid = await startRound(E, 30);
ok((await rpc(E, `submit_gridshot_rpc($1, 8001, 40, 45, 0, NULL)`, [sid])).error === 'TELEMETRY_ANOMALY', 'score above 40 hits x 100 x 2.0 refused');
sid = await startRound(E, 30);
ok((await rpc(E, `submit_gridshot_rpc($1, 100, 136, 140, 0, NULL)`, [sid])).error === 'TELEMETRY_ANOMALY', 'more than 135 hits refused');
sid = await startRound(E, 30);
ok((await rpc(E, `submit_gridshot_rpc($1, 100, 10, 12, 11, NULL)`, [sid])).error === 'TELEMETRY_ANOMALY', 'more bullseyes than hits refused');
sid = await startRound(E, 30);
const pre = (await rpc(E, `get_my_state_rpc()`)).profile;
r = await rpc(E, `submit_gridshot_rpc($1, 6200, 40, 45, 10, $2)`, [sid, gun.uid]);
// rank S: max(35, rate*22) x round(1.75*1.15, 2)
const expReward = Number((Math.max(35, num(pre.passive_rate_per_sec) * 22) * Number((1.75 * 1.15).toFixed(2))).toFixed(2));
ok(r.ok && Math.abs(num(r.reward) - expReward) < 0.011 && r.best_gridshot_score === 6200 && r.updated[0].kills === 40 && r.profile.xp - pre.xp === 30 * 2 + 10 * 4 && Number(r.profile.targets_hit) === 40,
  'valid round: rank S reward x weapon multiplier, +XP, SyncTrack kills, record set', r.error || `${r.reward} vs ${expReward}`);
ok(Math.abs(num(r.profile.balance) - num(pre.balance) - num(r.reward)) < 0.02, 'reward credited to the server balance');
ok(/GRIDSHOT_INVALID_SESSION/.test((await rpc(E, `submit_gridshot_rpc($1, 6200, 40, 45, 10, NULL)`, [sid])).error || ''), 'replay of the same session refused');
ok(/GRIDSHOT_COOLDOWN/.test((await rpc(E, `start_gridshot_rpc()`)).error || ''), 'server cooldown applies');
sid = await startRound(E, 30);
r = await rpc(E, `submit_gridshot_rpc($1, 3000, 25, 30, 0, $2)`, [sid, (await rpc(B, `get_my_state_rpc()`)).inventory[0].uid]);
ok(r.ok && Math.abs(num(r.reward) - Math.max(15, num(r.profile.passive_rate_per_sec) * 9)) < 0.5, "equipping someone else's weapon gives no multiplier");
sid = await startRound(E, 30);
ok(/GRIDSHOT_INVALID_SESSION/.test((await rpc(A, `submit_gridshot_rpc($1, 100, 2, 2, 0, NULL)`, [sid])).error || ''), "cannot submit someone else's session");

// ---------------------------------------------------------------------------
// 10. Prestige
// ---------------------------------------------------------------------------
const F = await newUser();
await rpc(F, `get_my_state_rpc()`);
r = await rpc(F, `prestige_up_rpc()`);
ok(/PRESTIGE_REQUIREMENTS/.test(r.error || ''), 'prestige refused without the requirements');
// 7 full cases = 98 unique skins, 7 platinum; level 55
await q(`INSERT INTO public.inventory_items (user_id, template_id, case_id, name, rarity, shape, c1, c2, pattern, float_val, wear_short, price)
         SELECT $1, template_id, case_id, name, rarity, shape, c1, c2, pattern, 0.2, 'FT', base_price FROM public.item_catalog
         WHERE case_id IN (SELECT id FROM public.case_catalog ORDER BY price LIMIT 7)`, [F]);
await q(`UPDATE public.profiles SET xp = 250000 WHERE id = $1`, [F]);
r = await rpc(F, `prestige_up_rpc()`);
ok(/PRESTIGE_REQUIREMENTS/.test(r.error || ''), 'level 54 is not enough', r.error);
await q(`UPDATE public.profiles SET xp = 400000 WHERE id = $1`, [F]);
st = await parity(F, 'with 7 platinum cases');
const top = [...st.inventory].sort((a, b) => num(b.price) - num(a.price))[0];
r = await rpc(F, `prestige_up_rpc()`);
ok(!r.error && r.profile.prestige_level === 1 && r.profile.xp === 0 && num(r.profile.balance) === 1500 && r.inventory.length === 1 && r.inventory[0].uid === top.uid && r.inventory[0].is_heirloom,
  'Prestige I: level/XP reset, $1,500 start, only the most valuable skin kept as heirloom', r.error || JSON.stringify(r.profile.prestige_level));
st = await parity(F, 'after prestige (x1.5 multiplier)');
r = await rpc(F, `open_case_rpc('nx_t1_1', 1)`);
ok(Math.abs(1500 - num(r.profile.balance) - 24.75) < 0.2, 'Prestige I gives the 1% case discount ($24.75)', String(r.profile.balance));
r = await rpc(F, `set_heirloom_rpc($1, true)`, [r.items[0].uid]);
ok(!r.error, 'Prestige I unlocks a second heirloom slot');

// ---------------------------------------------------------------------------
// 11. Callsign, leaderboard view, RLS
// ---------------------------------------------------------------------------
r = await rpc(A, `register_unique_callsign_rpc('Ghost')`);
ok(r.ok && r.profile.callsign === 'Ghost' && r.profile.callsign_locked, 'callsign registered');
ok(/CALLSIGN_TAKEN/.test((await rpc(B, `register_unique_callsign_rpc('gHOST')`)).error || ''), 'case-insensitive duplicate refused');
ok(/CALLSIGN_LOCKED/.test((await rpc(A, `register_unique_callsign_rpc('Other')`)).error || ''), 'callsign cannot be changed');
ok(/CALLSIGN_INVALID/.test((await rpc(B, `register_unique_callsign_rpc('Operador-9')`)).error || ''), 'placeholder-style names refused');
r = await as('anon', null, `SELECT * FROM public.leaderboard_global_view WHERE callsign = 'Ghost'`);
ok(!r.error && r.rows.length === 1 && !('balance' in r.rows[0]) && !('id' in r.rows[0]) && 'net_worth' in r.rows[0] && r.rows[0].is_vip === false, 'public leaderboard view works for anon and hides balance / internal id', r.error);
r = await as('anon', null, `SELECT count(*)::int n FROM public.profiles`);
ok(/permission denied/.test(r.error || ''), 'anon cannot read the profiles table', JSON.stringify(r));
// The leaderboard view is auto-updatable and runs with its owner's rights: it must be read-only
for (const role of ['anon', 'authenticated']) {
  r = await as(role, role === 'anon' ? null : B, `UPDATE public.leaderboard_global_view SET net_worth = 999999999, xp = 999999, callsign = 'pwned' WHERE callsign = 'Ghost' RETURNING player_id`);
  ok(/permission denied/.test(r.error || ''), `${role} cannot write to profiles through the leaderboard view`, JSON.stringify(r));
  r = await as(role, role === 'anon' ? null : B, `DELETE FROM public.leaderboard_global_view`);
  ok(/permission denied/.test(r.error || ''), `${role} cannot delete profiles through the leaderboard view`, JSON.stringify(r));
}
ok((await q(`SELECT callsign::text c, xp::int xp FROM public.profiles WHERE id = $1`, [A]))[0].c === 'Ghost', 'Ghost profile is intact');
for (const stmt of [`TRUNCATE public.inventory_items`, `DELETE FROM public.inventory_items`, `UPDATE public.app_settings SET value = '2999-01-01'`, `INSERT INTO public.payment_ledger DEFAULT VALUES`]) {
  r = await as('authenticated', A, stmt);
  ok(/permission denied/.test(r.error || ''), `players cannot run: ${stmt.slice(0, 40)}`, JSON.stringify(r));
}
r = await as('authenticated', A, `SELECT id FROM public.profiles`);
ok(r.rows?.length === 1 && r.rows[0].id === A, 'a player reads only their own profile row');
r = await as('authenticated', A, `SELECT count(*)::int n FROM public.inventory_items WHERE user_id <> $1`, [A]);
ok(r.rows?.[0].n === 0, "a player cannot read other inventories");
r = await as('authenticated', A, `UPDATE public.profiles SET balance = 1e9 WHERE id = $1 RETURNING id`, [A]);
ok(/permission denied/.test(r.error || ''), 'direct UPDATE of own balance is denied', JSON.stringify(r));
r = await as('authenticated', A, `INSERT INTO public.inventory_items (user_id, template_id, case_id, name, rarity, shape, c1, c2, pattern, float_val, wear_short, price) VALUES ($1,'x','x','x','gold','x','x','x','x',0.1,'FN',1e6)`, [A]);
ok(!!r.error, 'direct INSERT of an item rejected', r.error);
r = await as('authenticated', A, `SELECT count(*)::int n FROM public.item_catalog`);
ok(/permission denied/.test(r.error || ''), 'catalog and settings tables are not exposed', JSON.stringify(r));
for (const fn of [`_grant_item($1, 'nx_t6_3', 'gold', 1)`, `sync_lazy_idle_income($1)`, `_recompute_profile($1)`, `grant_vip_days_admin($1, 30)`]) {
  r = await as('authenticated', A, `SELECT public.${fn}`, [A]);
  ok(/permission denied/.test(r.error || ''), `players cannot call ${fn.split('(')[0]}`, r.error);
}

// ---------------------------------------------------------------------------
// 12. Legacy save import
// ---------------------------------------------------------------------------
const G = await newUser();
st = await rpc(G, `get_my_state_rpc()`);
const save = {
  balance: 1234.56, prestige_level: 1, xp: 5000, cases_opened: 40, golds_unboxed: 1, tradeups_done: 2, targets_hit: 300, total_spent: 9000, total_earned: 4000,
  best_gridshot_score: 99999,
  inventory: [
    { template_id: 'nx_t1_1_g1', float: 0.01, stat_trak: true, kills: 12, is_heirloom: true, price: 999999999 },
    { template_id: 'nx_t1_1_b1', float: 0.5, stat_trak: false, is_heirloom: true },
    { template_id: 'nx_t1_1_b2', float: 0.2, is_heirloom: true },
    { template_id: 'does_not_exist', float: 0.1, price: 1e9 },
    { template_id: 'nx_t1_1_b3', float: 'garbage', stat_trak: 'yes' },
  ],
};
r = await rpc(G, `import_legacy_save_rpc($1::jsonb)`, [JSON.stringify(save)]);
const gi = r.inventory || [];
const gold = gi.find((i) => i.template_id === 'nx_t1_1_g1');
ok(!r.error && gi.length === 4 && Math.abs(num(gold.price) - catById.get('nx_t1_1_g1').base * 1.45 * 1.85) < 0.01, 'import keeps catalog items only and recomputes prices on the server', r.error || String(gold?.price));
ok(gi.filter((i) => i.is_heirloom).length === 2 && num(gi.find((i) => i.template_id === 'nx_t1_1_b3').float) === 0.22, 'heirlooms trimmed to the prestige limit; garbage fields fall back to defaults');
ok(num(r.profile.balance) === 1234.56 && r.profile.prestige_level === 1 && r.profile.cases_opened === 40 && r.profile.best_gridshot_score === 0, 'profile numbers imported, gridshot record is not');
ok(/IMPORT_NOT_ALLOWED/.test((await rpc(G, `import_legacy_save_rpc($1::jsonb)`, [JSON.stringify(save)])).error || ''), 'import works once per account');
ok(/IMPORT_NOT_ALLOWED/.test((await rpc(B, `import_legacy_save_rpc($1::jsonb)`, [JSON.stringify(save)])).error || ''), 'accounts with server progress cannot import');
await parity(G, 'after import');
const H = await newUser();
await rpc(H, `get_my_state_rpc()`);
r = await rpc(H, `import_legacy_save_rpc($1::jsonb)`, [JSON.stringify({ balance: 1e30, prestige_level: 99, xp: -5, inventory: 'nope' })]);
ok(!r.error && num(r.profile.balance) === 1e9 && r.profile.prestige_level === 10 && r.profile.xp === 0, 'absurd values are clamped', r.error);
await db.exec(newSql);
ok((await q(`SELECT value FROM public.app_settings WHERE key = 'legacy_import_until'`))[0].value === importUntil, 're-running the schema does not extend the import window');
await q(`UPDATE public.app_settings SET value = (now() - interval '1 minute')::text WHERE key = 'legacy_import_until'`);
const I = await newUser();
st = await rpc(I, `get_my_state_rpc()`);
ok(st.legacy_import_open === false && /IMPORT_CLOSED/.test((await rpc(I, `import_legacy_save_rpc('{}'::jsonb)`)).error || ''), 'import refused once the window is closed');

// ---------------------------------------------------------------------------
// 13. Reset
// ---------------------------------------------------------------------------
r = await rpc(A, `reset_progress_rpc()`);
ok(!r.error && r.inventory.length === 0 && num(r.profile.balance) === 500 && r.profile.cases_opened === 0 && r.profile.callsign === 'Ghost', 'reset wipes progress but keeps the callsign');
st = await rpc(A, `get_my_state_rpc()`);
ok(st.legacy_import_open === false, 'reset does not reopen the legacy import');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
