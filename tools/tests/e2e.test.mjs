// End-to-end: the real game in headless Chromium against the real supabase/schema.sql
// running in PGlite (see supa-bridge.mjs). The production project is never contacted:
// every request to the Supabase host is intercepted and answered locally.
//
//   cd tools/tests && npm install && npx playwright install chromium-headless-shell
//   npm run test:e2e
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createBridge } from './supa-bridge.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NEW_SCHEMA = readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8');
// The schema before the economy moved to the server (no get_my_state_rpc)
const PREV_SCHEMA = execFileSync('git', ['show', 'f2dedb4:supabase/schema.sql'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// Must match SUPABASE_URL in backend-adapter.js
const SUPA = new Function('window', readFileSync(join(ROOT, 'backend-adapter.js'), 'utf8').split('const NEON_DROP_SESSION_KEY')[0] + 'return window.NEON_DROP_BACKEND_CONFIG.SUPABASE_URL;')({});
let failures = 0;
const ok = (c, label, extra = '') => { if (!c) failures++; console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${!c && extra !== '' ? '  -> ' + extra : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, timeout = 12000, step = 80) => {
  const end = Date.now() + timeout;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (e) { /* page navigating */ }
    if (Date.now() > end) return null;
    await sleep(step);
  }
};

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const stat = http.createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
});
await new Promise((r) => stat.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${stat.address().port}`;
const browser = await chromium.launch();

async function player(bridge, opts = {}) {
  const ctx = await browser.newContext();
  if (opts.initScript) await ctx.addInitScript(opts.initScript);
  const page = await ctx.newPage();
  const errors = [], dialogs = [], external = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  await bridge.attach(ctx, { supaOrigin: SUPA, appOrigin: ORIGIN, external });
  if (opts.clock) await page.clock.install();
  const p = { ctx, page, errors, dialogs, external };
  p.ready = () => until(() => page.evaluate(() => typeof server !== 'undefined' && server.mode !== 'booting' && !server.busy));
  p.idle = () => until(() => page.evaluate(() => !server.busy));
  p.load = async () => { await page.goto(ORIGIN + '/index.html', { waitUntil: 'load' }); await p.ready(); };
  p.reload = async () => { await page.reload({ waitUntil: 'load' }); await p.ready(); };
  p.uid = () => page.evaluate(() => state.playerId);
  p.tab = (t) => page.click(`.tab-btn[data-tab="${t}"]`);
  p.toast = () => page.evaluate(() => { const el = document.getElementById('nd-toast'); return el && el.classList.contains('visible') ? el.textContent : ''; });
  p.openCase = async () => {
    await page.check('#fast-mode-checkbox');
    await page.click('#open-case-btn');
    return until(() => page.evaluate(() => !document.getElementById('reward-modal').classList.contains('hidden')), 9000);
  };
  if (!opts.noLoad) await p.load();
  return p;
}
const calls = (bridge, frag) => bridge.log.filter((l) => l.path.includes(frag));
const one = async (bridge, sql, params) => (await bridge.sql(sql, params))[0];
const seed = async (bridge, uid, where, copies = 1, extra = '') => {
  for (let i = 0; i < copies; i++) {
    await bridge.sql(`INSERT INTO public.inventory_items (user_id, template_id, case_id, name, rarity, shape, c1, c2, pattern, float_val, wear_short, stat_trak, price)
      SELECT $1, template_id, case_id, name, rarity, shape, c1, c2, pattern, 0.2, 'FT', ${extra === 'st' ? 'TRUE' : 'FALSE'}, base_price FROM public.item_catalog WHERE ${where}`, [uid]);
  }
  await bridge.sql(`SELECT public._recompute_profile($1)`, [uid]);
};

// ===========================================================================
// A. Full session against the migrated database
// ===========================================================================
{
  const bridge = await createBridge([NEW_SCHEMA]);
  const p1 = await player(bridge);
  const { page } = p1;
  const uid = await p1.uid();
  const inv = async () => (await one(bridge, `SELECT count(*)::int n FROM public.inventory_items WHERE user_id = $1`, [uid])).n;
  const prof = () => one(bridge, `SELECT balance::float8 AS balance, passive_rate_per_sec::float8 AS rate, cases_opened, tradeups_done, prestige_level, callsign::text AS callsign, xp::int AS xp FROM public.profiles WHERE id = $1`, [uid]);

  ok(await page.evaluate(() => server.mode) === 'authoritative' && p1.errors.length === 0, 'boots in server-authoritative mode with no JS errors', p1.errors.join(' | '));
  ok(await page.evaluate(() => document.getElementById('server-overlay').classList.contains('hidden')), 'connection overlay is dismissed');
  ok((await page.textContent('#balance-display')).startsWith('$500.'), 'balance shown comes from the server ($500 start)', await page.textContent('#balance-display'));
  ok(calls(bridge, '/auth/v1/signup').length === 1 && /^[0-9a-f-]{36}$/.test(uid), 'one anonymous account is created and the client uses its ID');

  // --- open 1x
  ok(await p1.openCase(), 'opening a case reaches the reward modal');
  let st = await page.evaluate(() => ({ inv: state.inventory.map((i) => ({ uid: i.uid, price: i.price, name: i.name })), bal: state.balance }));
  const dbItems = await bridge.sql(`SELECT uid, price::float8 AS price, name FROM public.inventory_items WHERE user_id = $1`, [uid]);
  ok(dbItems.length === 1 && st.inv.length === 1 && st.inv[0].uid === dbItems[0].uid && st.inv[0].price === dbItems[0].price && st.inv[0].name === dbItems[0].name,
    'the item on screen is the row the server created (same uid, price and name)', JSON.stringify({ st: st.inv, dbItems }));
  let pr = await prof();
  ok(pr.cases_opened === 1 && pr.balance >= 475 && pr.balance < 476 && Math.abs(st.bal - pr.balance) < 1, 'server debited $25; screen balance follows it', `${pr.balance} vs ${st.bal}`);
  await page.click('#modal-keep-btn');
  ok((await page.textContent('#inv-count')) === '1', 'keeping the item just closes the modal (already stored)');

  // --- tampering with the local balance buys nothing
  await page.evaluate(() => { state.balance = 1e9; server.balanceBase = 1e9; });
  await page.selectOption('#all-cases-select', 'nx_t6_3');
  await page.click('#open-case-btn');
  const toast = await until(() => p1.toast());
  await until(async () => (await page.evaluate(() => state.balance)) < 1000);
  ok(/saldo insuficiente/i.test(toast || '') && (await inv()) === 1 && (await page.evaluate(() => state.balance)) < 1000 && !(await page.evaluate(() => isSpinning)),
    'editing the balance in the console: server refuses the $65,000 case and the screen snaps back', `${toast} / ${await page.evaluate(() => state.balance)}`);
  const code = await page.evaluate(() => window.neonBackend.openCase('nx_t1_1', 500).then(() => 'accepted', (e) => e.code));
  ok(code === 'INVALID_COUNT', 'hand-made RPC call with 500 cases is rejected with a typed error', code);

  // --- open 5x and sell everything from the modal
  await page.selectOption('#all-cases-select', 'nx_t1_1');
  await page.click('.multi-btn[data-count="5"]');
  ok(await p1.openCase(), '5x opening reaches the reward modal');
  const batchSum = await page.evaluate(() => currentUnboxedBatch.reduce((a, i) => a + i.price, 0));
  ok((await inv()) === 6 && (await page.evaluate(() => currentUnboxedBatch.length)) === 5, 'five items were created on the server');
  const balBefore = (await prof()).balance;
  await page.click('#modal-sell-btn');
  await p1.idle(); await sleep(150);
  pr = await prof();
  ok((await inv()) === 1 && pr.balance - balBefore >= batchSum - 0.01 && pr.balance - balBefore < batchSum + 4 && (await page.textContent('#inv-count')) === '1',
    '"sell all" sells the five on the server and credits their value', `${pr.balance - balBefore} vs ${batchSum}`);
  await page.click('.multi-btn[data-count="1"]');

  // --- reload: same account, state restored; formula parity on a big collection
  await seed(bridge, uid, `case_id = 'nx_t1_2'`);
  await seed(bridge, uid, `template_id = 'nx_t1_2_b1'`, 5);
  bridge.log.length = 0;
  await p1.reload();
  ok(calls(bridge, '/auth/v1/').length === 0 && (await p1.uid()) === uid && (await page.evaluate(() => state.inventory.length)) === (await inv()),
    'after a reload the stored session is reused and the inventory comes back from the server');
  const parity = await page.evaluate(() => {
    const official = server.rate;
    server.mode = 'legacy';
    const local = computePassiveIncome();
    server.mode = 'authoritative';
    return { official, local: local.ratePerSec, skins: local.uniqueSkinsCount };
  });
  ok(Math.abs(parity.official - parity.local) <= 0.011 && parity.skins === 15, 'the $/s the server pays equals the formula the game displays (platinum case + achievements)', JSON.stringify(parity));
  ok(await page.evaluate(() => localStorage.getItem('neondrop_save_v3')) === null, 'nothing is written to the old local save');

  // --- heirloom + single sale from the collection
  await p1.tab('inventory');
  await page.selectOption('#inv-case-select', 'ALL');
  await page.click('.toggle-heirloom-btn');
  await p1.idle(); await sleep(100);
  ok((await one(bridge, `SELECT count(*)::int n FROM public.inventory_items WHERE user_id = $1 AND is_heirloom`, [uid])).n === 1 && (await page.evaluate(() => state.heirloomUids.length)) === 1,
    'heirloom lock is stored on the server');
  await page.click('.toggle-heirloom-btn:not(.locked)');
  await sleep(200);
  ok(p1.dialogs.some((d) => /Limite de Herança/.test(d)) && (await page.evaluate(() => state.heirloomUids.length)) === 1, 'second heirloom is refused at Prestige 0');
  const before = await inv();
  await page.click('.sell-single-btn:not([disabled])');
  await p1.idle(); await sleep(100);
  ok((await inv()) === before - 1 && (await page.evaluate(() => state.inventory.length)) === before - 1, 'selling one item from the collection removes it on the server');

  // --- item already gone on the server (sold from another device)
  const ghost = await page.evaluate(() => state.inventory.find((i) => !state.heirloomUids.includes(i.uid)).uid);
  await bridge.sql(`DELETE FROM public.inventory_items WHERE uid = $1`, [ghost]);
  const balGhost = (await prof()).balance;
  await page.evaluate((u) => sellItemByUid(u), ghost);
  await until(async () => !(await page.evaluate((u) => state.inventory.some((i) => i.uid === u), ghost)));
  ok(!(await page.evaluate((u) => state.inventory.some((i) => i.uid === u), ghost)) && (await prof()).balance - balGhost < 1,
    'selling an item that no longer exists pays nothing and refreshes the collection');

  // --- trade-up
  await seed(bridge, uid, `template_id = 'nx_t1_2_b2'`, 6);
  await p1.reload();
  await p1.tab('tradeup');
  await page.click('#autofill-dupes-btn');
  const inputs = await page.evaluate(() => tradeUpSelection.map((i) => i.uid));
  const beforeTrade = await inv();
  await page.click('#execute-tradeup-btn');
  ok(await until(() => page.evaluate(() => !document.getElementById('reward-modal').classList.contains('hidden'))), 'trade-up shows the forged item');
  const forged = await page.evaluate(() => currentUnboxedBatch[0]);
  const forgedDb = await one(bridge, `SELECT rarity, case_id FROM public.inventory_items WHERE uid = $1`, [forged.uid]);
  const leftovers = (await one(bridge, `SELECT count(*)::int n FROM public.inventory_items WHERE uid = ANY($1::uuid[])`, [inputs])).n;
  ok(inputs.length === 5 && leftovers === 0 && (await inv()) === beforeTrade - 4 && forgedDb?.rarity === 'purple' && forgedDb.case_id === 'nx_t1_2' && (await prof()).tradeups_done === 1,
    'contract consumed the 5 inputs on the server and forged a purple from the inputs\' case', JSON.stringify({ leftovers, forgedDb }));
  await page.click('#modal-keep-btn');
  ok(/caixa de um dos 5 itens/.test(await page.textContent('#tab-tradeup')), 'trade-up panel explains where the forged item comes from');

  // --- sell duplicates
  await p1.tab('inventory');
  ok(Number(await page.textContent('#dupes-count')) > 0, 'duplicates are detected');
  await page.click('#sell-dupes-btn');
  await p1.idle(); await sleep(100);
  const dup = await one(bridge, `SELECT count(*)::int total, count(DISTINCT template_id)::int uniq FROM public.inventory_items WHERE user_id = $1 AND NOT is_heirloom`, [uid]);
  ok(dup.total === dup.uniq && (await page.evaluate(() => state.inventory.length)) === (await inv()) && (await page.textContent('#dupes-count')) === '0', 'sell duplicates leaves one copy of each skin, on both sides', JSON.stringify(dup));

  // --- callsign + leaderboard, second player
  await p1.tab('leaderboard');
  await page.fill('#lb-callsign-input', 'Ghost');
  await page.click('#lb-sync-btn');
  await until(async () => (await prof()).callsign === 'Ghost');
  await p1.idle(); await sleep(300);
  ok((await prof()).callsign === 'Ghost' && (await page.isDisabled('#lb-callsign-input')), 'callsign is registered on the server and locked in the UI');
  ok(calls(bridge, 'sync_operator_leaderboard_rpc').length === 0, 'the client no longer pushes leaderboard numbers');

  const p2 = await player(bridge);
  const uid2 = await p2.uid();
  await p2.tab('leaderboard');
  await until(async () => /Ghost/.test(await p2.page.textContent('#lb-table-body')));
  ok(/Ghost/.test(await p2.page.textContent('#lb-table-body')), 'another player sees Ghost on the public leaderboard');
  await p2.page.fill('#lb-callsign-input', 'gHOST');
  await p2.page.click('#lb-sync-btn');
  await until(() => p2.dialogs.some((d) => /já está em uso/.test(d)));
  ok(p2.dialogs.some((d) => /já está em uso/.test(d)) && !(await p2.page.isDisabled('#lb-callsign-input')), 'duplicate callsign (different case) is refused; input stays editable');
  await p2.page.fill('#lb-callsign-input', 'Rival');
  await p2.page.click('#lb-sync-btn');
  await until(async () => (await one(bridge, `SELECT callsign::text c FROM public.profiles WHERE id = $1`, [uid2])).c === 'Rival');
  await bridge.db.exec(`SET ROLE service_role; SELECT public.grant_vip_days_admin('${uid2}', 30); RESET ROLE;`);
  await page.click('#lb-refresh-btn');
  const board = await until(async () => {
    const rows = await page.evaluate(() => [...document.querySelectorAll('#lb-table-body tr')].map((tr) => ({ text: tr.textContent.replace(/\s+/g, ' '), vip: !!tr.querySelector('.vip-badge'), me: tr.classList.contains('is-me-row') })));
    return rows.some((r) => /Rival/.test(r.text) && r.vip) ? rows : null;
  });
  ok(board && board.length === 2 && board.filter((r) => r.me).length === 1 && board.find((r) => /Ghost/.test(r.text)).me && !board.find((r) => /Ghost/.test(r.text)).vip,
    'leaderboard lists both operators once, marks me, and shows the VIP badge only on the VIP', JSON.stringify(board));
  await p2.ctx.close();

  // --- prestige
  await bridge.sql(`DELETE FROM public.inventory_items WHERE user_id = $1`, [uid]);
  await bridge.sql(`UPDATE public.profiles SET xp = 400000 WHERE id = $1`, [uid]);
  await seed(bridge, uid, `case_id IN (SELECT id FROM public.case_catalog ORDER BY price LIMIT 7)`);
  await p1.reload();
  await p1.tab('stats');
  ok(!(await page.isDisabled('#prestige-btn')), 'prestige button unlocks when the server state meets the requirements');
  await page.click('#prestige-btn');
  await until(async () => (await prof()).prestige_level === 1);
  await p1.idle(); await sleep(200);
  pr = await prof();
  ok(pr.prestige_level === 1 && pr.xp === 0 && pr.balance >= 1500 && pr.balance < 1501 && (await inv()) === 1, 'Prestige I applied on the server: XP reset, $1,500, one heirloom kept', JSON.stringify(pr));
  ok(/Prestígio I/.test(await page.textContent('#top-rank-title')) && (await page.evaluate(() => state.inventory.length === 1 && state.heirloomUids.length === 1)), 'and the screen shows it');

  // --- reset
  await page.click('#reset-save-btn');
  await until(async () => (await inv()) === 0);
  await p1.idle(); await sleep(200);
  pr = await prof();
  ok((await inv()) === 0 && pr.balance >= 500 && pr.balance < 501 && pr.callsign === 'Ghost' && (await page.evaluate(() => state.inventory.length)) === 0, 'reset wipes the server progress and keeps the callsign', JSON.stringify(pr));

  ok(p1.errors.length === 0, 'no JS errors in the whole session', p1.errors.join(' | '));
  ok(!p1.external.some((u) => !/fonts\./.test(u)), 'nothing but Google Fonts is requested outside Supabase', [...new Set(p1.external.map((u) => new URL(u).hostname))].join(','));
  await p1.ctx.close();
}

// ===========================================================================
// B. Gridshot: accepted round, then a round the server refuses
// ===========================================================================
{
  const bridge = await createBridge([NEW_SCHEMA]);
  let backdate = true;
  bridge.beforeRpc = async (fn, body) => {
    // The browser's 30 s run on a fake clock; move the server-side start to match
    if (fn === 'submit_gridshot_rpc' && backdate) await bridge.db.query(`UPDATE public.gridshot_sessions SET started_at = now() - interval '30 seconds' WHERE id = $1`, [body.p_session_id]);
  };
  const p = await player(bridge, { clock: true });
  const { page } = p;
  const uid = await p.uid();
  await seed(bridge, uid, `template_id = 'nx_t1_1_r1'`, 1, 'st');
  await p.reload();
  const gun = await page.evaluate(() => state.inventory[0].uid);
  const prof = () => one(bridge, `SELECT balance::float8 AS balance, best_gridshot_score AS best, targets_hit::int AS hits, xp::int AS xp, passive_rate_per_sec::float8 AS rate FROM public.profiles WHERE id = $1`, [uid]);
  const hit = (crit) => page.evaluate((c) => {
    const t = document.querySelector('.aimlab-target');
    (c ? t.querySelector('.aimlab-bullseye') : t).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, crit);
  const round = async (normal, crits) => {
    await page.click('#aimlab-start-gridshot-btn');
    if (!(await until(() => page.evaluate(() => gridshotActive)))) return false;
    await page.clock.runFor(100);
    for (let i = 0; i < normal; i++) { await hit(false); await page.clock.runFor(120); }
    for (let i = 0; i < crits; i++) { await hit(true); await page.clock.runFor(120); }
    for (let i = 0; i < 31; i++) await page.clock.runFor(1000);
    return true;
  };
  const banner = (re) => until(async () => { const t = await page.textContent('#aimlab-banner-title'); return re.test(t) ? t : null; });

  await p.tab('aimlab');
  await page.clock.runFor(200);
  const before = await prof();
  ok(await round(12, 3), 'round starts only after the server opened a session');
  ok((await one(bridge, `SELECT count(*)::int n FROM public.gridshot_sessions WHERE user_id = $1`, [uid])).n === 1, 'session row exists on the server');
  const title = await banner(/NOVO RECORDE|FIM DO GRIDSHOT/);
  await p.idle();
  const sub = calls(bridge, 'submit_gridshot_rpc').at(-1)?.body;
  const after = await prof();
  const score = await page.evaluate(() => gridshotScore);
  // reward table of the game: seconds of income (with a floor) by rank, x weapon (red 1.75 x SyncTrack 1.15)
  const [secs, floor] = score >= 6000 ? [22, 35] : score >= 4000 ? [15, 25] : score >= 2000 ? [9, 15] : [4 * (score / 2000), Number((5 * (score / 2000)).toFixed(2))];
  const expected = Number((Math.max(floor, before.rate * secs) * Number((1.75 * 1.15).toFixed(2))).toFixed(2));
  console.log(`      round score ${score} -> expected reward $${expected}`);
  ok(!!title && sub && sub.p_hits === 15 && sub.p_crits === 3 && sub.p_equipped_uid === gun && sub.p_score === score, 'telemetry sent: hits, bullseyes, score and the equipped weapon', JSON.stringify(sub));
  ok(after.best === score && after.hits === 15 && after.xp - before.xp === 12 * 2 + 3 * 4, 'server recorded the score, the 15 targets and the XP', JSON.stringify(after));
  ok(after.balance - before.balance >= expected - 0.01 && after.balance - before.balance < expected + 0.5, 'server paid the round reward with the weapon multiplier', `${after.balance - before.balance} vs ${expected}`);
  ok(/validado pelo servidor/.test(await page.textContent('#aimlab-banner-desc')) && (await page.textContent('#aimlab-banner-desc')).includes(expected.toFixed(2)), 'banner shows the reward the server paid', await page.textContent('#aimlab-banner-desc'));
  ok((await one(bridge, `SELECT kills FROM public.inventory_items WHERE uid = $1`, [gun])).kills === 15 && (await page.evaluate(() => state.inventory[0].kills)) === 15, 'SyncTrack kill counter saved on the server');

  // second round: the server sees ~0 s between start and submit
  backdate = false;
  await bridge.sql(`UPDATE public.profiles SET next_gridshot_allowed_at = now() WHERE id = $1`, [uid]);
  await page.clock.runFor(16000);
  ok(await round(4, 0), 'second round starts after the cooldown');
  const refused = await banner(/NÃO VALIDADA/);
  await until(async () => (await page.evaluate(() => state.stats.targetsHit)) === 15);
  const end = await prof();
  ok(!!refused && end.best === score && end.hits === 15 && end.xp === after.xp, 'a round outside the 28-40 s window earns nothing on the server', JSON.stringify(end));
  ok((await page.evaluate(() => state.stats.targetsHit === 15 && state.xp)) === after.xp, 'and the on-screen preview of XP / targets is rolled back');
  ok((await one(bridge, `SELECT count(*)::int n FROM public.gridshot_sessions WHERE user_id = $1 AND flagged_cheat`, [uid])).n === 1, 'the refused session is flagged');
  ok(p.errors.length === 0, 'no JS errors during the rounds', p.errors.join(' | '));
  await p.ctx.close();
}

// ===========================================================================
// C. One-time import of the old localStorage save
// ===========================================================================
{
  const bridge = await createBridge([NEW_SCHEMA]);
  const legacy = {
    playerId: 'op_oldsave', callsign: 'OldTimer', callsignLocked: true, equippedUid: 'itm_1', balance: 2345.67, lastSavedAt: Date.now(), prestigeLevel: 0, xp: 900,
    heirloomUids: ['itm_1'],
    inventory: [
      { uid: 'itm_1', templateId: 'nx_t1_1_g1', rarity: 'gold', float: 0.03, statTrak: true, kills: 7, price: 99999999, caseId: 'nx_t1_1' },
      { uid: 'itm_2', templateId: 'nx_t1_1_b1', rarity: 'blue', float: 0.5, statTrak: false, price: 1, caseId: 'nx_t1_1' },
    ],
    stats: { casesOpened: 12, totalSpent: 300, totalEarned: 50, goldsUnboxed: 1, bestDropValue: 99999999, tradeUpsDone: 0, targetsHit: 40, bestGridshotScore: 99999 },
  };
  const p = await player(bridge, {
    initScript: `if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('neondrop_save_v3', ${JSON.stringify(JSON.stringify(legacy))}); }`,
  });
  const { page } = p;
  const uid = await p.uid();
  const rows = await bridge.sql(`SELECT template_id, price::float8 AS price, is_heirloom, stat_trak, kills FROM public.inventory_items WHERE user_id = $1 ORDER BY price DESC`, [uid]);
  const base = (await one(bridge, `SELECT base_price::float8 b FROM public.item_catalog WHERE template_id = 'nx_t1_1_g1'`)).b;
  const pr = await one(bridge, `SELECT balance::float8 AS balance, cases_opened, callsign::text AS callsign, best_gridshot_score AS best, legacy_imported FROM public.profiles WHERE id = $1`, [uid]);
  ok(await page.evaluate(() => server.mode) === 'authoritative' && rows.length === 2 && rows[0].template_id === 'nx_t1_1_g1' && rows[0].is_heirloom && rows[0].stat_trak && rows[0].kills === 7,
    'old local save is imported into the new server account (items, heirloom, SyncTrack kills)', JSON.stringify(rows));
  ok(Math.abs(rows[0].price - base * 1.45 * 1.85) < 0.01, 'prices are recomputed by the server, not taken from the save', `${rows[0].price}`);
  ok(pr.balance >= 2345.67 && pr.balance < 2347 && pr.cases_opened === 12 && pr.best === 0 && pr.legacy_imported, 'balance and counters imported; gridshot record is not', JSON.stringify(pr));
  ok(pr.callsign === 'OldTimer' && (await page.evaluate(() => state.callsign)) === 'OldTimer', 'the locked callsign comes along');
  ok(/migrado/.test((await until(() => p.toast())) || ''), 'player is told the progress was migrated');
  ok(await p.openCase(), 'playing after the import works');
  await page.click('#modal-keep-btn');
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('neondrop_save_v3')));
  ok(local.playerId === 'op_oldsave' && local.inventory.length === 2, 'the old local save is left untouched as a backup');
  await p.reload();
  ok(calls(bridge, 'import_legacy_save_rpc').length === 1 && (await page.evaluate(() => state.inventory.length)) === 3, 'reloading does not import again');
  ok(p.errors.length === 0, 'no JS errors', p.errors.join(' | '));
  await p.ctx.close();
}

// ===========================================================================
// D. Database not migrated yet / anonymous sign-in off -> old local mode
// ===========================================================================
for (const [label, make] of [
  ['database still on the previous schema', async () => createBridge([PREV_SCHEMA])],
  ['anonymous sign-in disabled (today\'s live state)', async () => { const b = await createBridge([NEW_SCHEMA]); b.anonEnabled = false; return b; }],
]) {
  const bridge = await make();
  const p = await player(bridge);
  const { page } = p;
  ok(await page.evaluate(() => server.mode) === 'legacy' && (await page.evaluate(() => document.getElementById('server-overlay').classList.contains('hidden'))), `${label}: game falls back to local mode`);
  ok(await p.openCase(), `${label}: opening a case works locally`);
  await page.click('#modal-keep-btn');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('neondrop_save_v3')));
  ok(save && save.inventory.length === 1 && save.balance < 500 && p.errors.length === 0, `${label}: progress is saved in the browser as before, no JS errors`, p.errors.join(' | '));
  await p.tab('leaderboard');
  await sleep(400);
  ok(p.errors.length === 0, `${label}: leaderboard tab opens without errors`, p.errors.join(' | '));
  await p.ctx.close();
}

// ===========================================================================
// E. Server unreachable for a browser that already plays on the server
// ===========================================================================
{
  const bridge = await createBridge([NEW_SCHEMA]);
  const p = await player(bridge);
  const { page } = p;
  ok(await p.openCase(), 'baseline: case opened online');
  await page.click('#modal-keep-btn');

  bridge.down = true;
  await page.click('#open-case-btn');
  const toast = await until(() => p.toast());
  ok(/Sem resposta do servidor/.test(toast || '') && !(await page.evaluate(() => isSpinning)) && !(await page.isDisabled('#open-case-btn')) && (await page.evaluate(() => state.inventory.length)) === 1,
    'connection lost mid-session: the action is refused with a notice, nothing is invented locally', toast);

  await page.reload({ waitUntil: 'load' });
  const overlay = await until(async () => { const t = await page.evaluate(() => document.getElementById('server-overlay-title')?.textContent || ''); return /SEM CONEXÃO/.test(t) ? t : null; }, 15000);
  ok(!!overlay && (await page.evaluate(() => server.mode)) === 'booting' && (await page.isVisible('#server-overlay-retry')), 'reload while offline: blocking screen with retry instead of a local game', overlay);
  ok(await page.evaluate(() => localStorage.getItem('neondrop_save_v3')) === null, 'no local save is created while offline');
  bridge.down = false;
  await page.click('#server-overlay-retry');
  await p.ready();
  ok((await page.evaluate(() => server.mode)) === 'authoritative' && (await page.evaluate(() => state.inventory.length)) === 1, 'retry reconnects and restores the server state');
  ok(p.errors.length === 0, 'no JS errors', p.errors.join(' | '));
  await p.ctx.close();
}

await browser.close();
stat.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
