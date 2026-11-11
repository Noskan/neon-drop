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
  const bannerDisplay = () => page.evaluate(() => getComputedStyle(document.getElementById('aimlab-banner-overlay')).display);
  ok((await bannerDisplay()) === 'flex' && /Rank C/.test(await page.textContent('#aimlab-banner-desc')) && /1\.35s/.test(await page.textContent('#aimlab-banner-desc')),
    'intro banner is visible and states that every rank pays (C proportionally)', await page.textContent('#aimlab-banner-desc'));
  await page.click('#aimlab-start-gridshot-btn');
  await until(() => page.evaluate(() => gridshotActive));
  ok((await bannerDisplay()) === 'none', 'banner is hidden during the round by the class alone (no inline style)');
  await page.evaluate(() => { endGridshotChallenge(); });
  await until(async () => /NÃO VALIDADA/.test(await page.textContent('#aimlab-banner-title')));
  await p.idle();
  await bridge.sql(`UPDATE public.profiles SET next_gridshot_allowed_at = now() WHERE id = $1`, [uid]);
  await bridge.sql(`DELETE FROM public.gridshot_sessions WHERE user_id = $1`, [uid]);
  await page.clock.runFor(16000);
  ok((await bannerDisplay()) === 'flex', 'banner comes back when the round ends');
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
  // The balance also carries idle income accrued meanwhile, so the exact figure is the one stored on the session
  const paid = (await one(bridge, `SELECT reward_paid::float8 AS paid FROM public.gridshot_sessions WHERE user_id = $1 AND NOT flagged_cheat AND completed_at IS NOT NULL`, [uid])).paid;
  ok(Math.abs(paid - expected) < 0.011 && after.balance - before.balance >= expected - 0.01, 'server paid the round reward with the weapon multiplier', `${paid} vs ${expected} (balance moved ${after.balance - before.balance})`);
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

  // third round: the device sleeps. 45 s of real time pass in a single jump (timers fire once)
  backdate = true;
  await bridge.sql(`UPDATE public.profiles SET next_gridshot_allowed_at = now() WHERE id = $1`, [uid]);
  await page.clock.runFor(16000);
  const submitsBefore = calls(bridge, 'submit_gridshot_rpc').length;
  await page.click('#aimlab-start-gridshot-btn');
  await until(() => page.evaluate(() => gridshotActive));
  await page.clock.runFor(100);
  for (let i = 0; i < 3; i++) { await hit(false); await page.clock.runFor(120); }
  await page.clock.fastForward(45000);
  const paused = await banner(/INTERROMPIDA/);
  await p.idle();
  await until(async () => (await page.evaluate(() => state.stats.targetsHit)) === 15);
  ok(!!paused && !(await page.evaluate(() => gridshotActive)), 'the round ends by the wall clock even when the timers were frozen', paused || await page.textContent('#aimlab-banner-title'));
  ok(calls(bridge, 'submit_gridshot_rpc').length === submitsBefore && (await one(bridge, `SELECT count(*)::int n FROM public.gridshot_sessions WHERE user_id = $1 AND flagged_cheat`, [uid])).n === 1,
    'a round that lasted 45 s of real time is discarded by the client: nothing sent, no session flagged');
  ok(/Nenhuma recompensa/.test(await page.textContent('#aimlab-banner-desc')) && (await page.evaluate(() => state.stats.targetsHit)) === 15 && (await page.evaluate(() => state.xp)) === end.xp,
    'the player is told why, and the on-screen preview is rolled back');
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
// D. Local mode only for a database without the game schema; other boot failures block
// ===========================================================================
{
  const label = 'database still on the previous schema';
  const bridge = await createBridge([PREV_SCHEMA]);
  const p = await player(bridge);
  const { page } = p;
  ok(await page.evaluate(() => server.mode) === 'legacy' && (await page.evaluate(() => document.getElementById('server-overlay').classList.contains('hidden'))), `${label}: game falls back to local mode`);
  ok(await p.openCase(), `${label}: opening a case works locally`);

  // the page is closed with the reward still on screen: the paid item must not vanish
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('neondrop_save_v3')).pendingBatch.length);
  await p.reload();
  const kept = await page.evaluate(() => ({ inv: state.inventory.length, pending: state.pendingBatch.length, opened: state.stats.casesOpened, bal: state.balance }));
  ok(pending === 1 && kept.inv === 1 && kept.pending === 0 && kept.opened === 1 && kept.bal < 500, `${label}: an item paid for but not yet confirmed survives a reload`, JSON.stringify({ pending, kept }));
  const save = await until(() => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('neondrop_save_v3')); return s.inventory.length === 1 && s.pendingBatch.length === 0 ? s : null; }), 6000);
  ok(save && save.balance < 500 && p.errors.length === 0, `${label}: progress is saved in the browser as before, no JS errors`, p.errors.join(' | '));

  // idle income follows real time, not the number of timer ticks
  const idle = await page.evaluate(async () => {
    state.inventory.push(generateItemInstance(ALL_CASES.find((c) => c.id === 'nx_t6_3'), 'gold'));
    const rate = computePassiveIncome().ratePerSec;
    await new Promise((r) => setTimeout(r, 300));
    const b0 = state.balance;
    lastIdleTickAt = Date.now() - 10000; // the tab was throttled for 10 s
    await new Promise((r) => setTimeout(r, 700));
    return { rate, gained: state.balance - b0 };
  });
  ok(idle.rate > 0 && idle.gained >= idle.rate * 10 - 0.011 && idle.gained <= idle.rate * 11.5 + 0.011, `${label}: a 10 s gap between ticks pays 10 s of income`, JSON.stringify(idle));

  // trade-up: the forged item comes from the inputs' case, not from the case on screen
  const forged = await page.evaluate(() => {
    const base = generateItemInstance(ALL_CASES.find((c) => c.id === 'nx_t1_2'), 'blue');
    const five = Array.from({ length: 5 }, (_, i) => ({ ...base, uid: 'tu_' + i }));
    state.inventory.push(...five);
    jumpToCaseAndOpenTab('nx_t6_3');
    tradeUpSelection = five;
    const btn = document.getElementById('execute-tradeup-btn');
    btn.disabled = false;
    btn.click();
    const out = currentUnboxedBatch[0];
    return { active: activeCase.id, caseId: out?.caseId, rarity: out?.rarity, pending: state.pendingBatch.length, left: state.inventory.filter((i) => String(i.uid).startsWith('tu_')).length };
  });
  ok(forged.active === 'nx_t6_3' && forged.caseId === 'nx_t1_2' && forged.rarity === 'purple' && forged.pending === 1 && forged.left === 0,
    `${label}: five cheap items forge an item of their own case while the $65,000 case is on screen`, JSON.stringify(forged));
  await page.click('#modal-keep-btn');
  ok(await page.evaluate(() => state.pendingBatch.length === 0 && state.inventory.some((i) => i.caseId === 'nx_t1_2' && i.rarity === 'purple')), `${label}: keeping the forged item clears the pending list`);

  await p.tab('leaderboard');
  await sleep(400);
  ok(p.errors.length === 0, `${label}: leaderboard tab opens without errors`, p.errors.join(' | '));
  await p.ctx.close();
}
{
  const overlayTitle = (page, re) => until(async () => { const t = await page.evaluate(() => document.getElementById('server-overlay-title')?.textContent || ''); return re.test(t) ? t : null; }, 15000);
  const blocked = async (page) => (await page.evaluate(() => server.mode)) === 'booting' && (await page.isVisible('#server-overlay-retry')) && (await page.evaluate(() => localStorage.getItem('neondrop_save_v3'))) === null;

  // a first-time visitor whose account cannot be created (sign-up refused / rate limited)
  const bridge = await createBridge([NEW_SCHEMA]);
  bridge.anonEnabled = false;
  const p = await player(bridge, { noLoad: true });
  const { page } = p;
  await page.goto(ORIGIN + '/index.html', { waitUntil: 'load' });
  const t1 = await overlayTitle(page, /CONTA DE JOGO INDISPONÍVEL/);
  ok(!!t1 && (await blocked(page)), 'sign-up refused on a first visit: blocking screen with retry, no throwaway local game', t1 || '');
  bridge.anonEnabled = true;
  await page.evaluate(() => { window.neonBackend.signupBlockedUntil = 0; });
  await page.click('#server-overlay-retry');
  await p.ready();
  ok((await page.evaluate(() => server.mode)) === 'authoritative', 'retry once the server accepts sign-ups enters server mode');
  await p.ctx.close();

  // a first-time visitor while the database answers with an error
  const bridge2 = await createBridge([NEW_SCHEMA]);
  bridge2.failWith = (method, url) => (url.pathname.endsWith('/rpc/get_my_state_rpc') ? { status: 400, body: { code: 'XX000', message: 'internal error' } } : null);
  const p2 = await player(bridge2, { noLoad: true });
  await p2.page.goto(ORIGIN + '/index.html', { waitUntil: 'load' });
  const t2 = await overlayTitle(p2.page, /SERVIDOR INDISPONÍVEL/);
  ok(!!t2 && (await blocked(p2.page)), 'server error on a first visit: blocking screen as well', t2 || '');
  bridge2.failWith = null;
  await p2.page.click('#server-overlay-retry');
  await p2.ready();
  ok((await p2.page.evaluate(() => server.mode)) === 'authoritative' && p2.errors.length === 0, 'retry after the server recovers enters server mode', p2.errors.join(' | '));
  await p2.ctx.close();
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

  // connection that accepts the request and never answers
  bridge.down = false;
  bridge.hang = true;
  await page.evaluate(() => { window.neonBackend.requestTimeoutMs = 600; });
  await until(async () => !(await p.toast()), 8000);
  const sentBefore = calls(bridge, 'open_case_rpc').length;
  await page.click('#open-case-btn');
  const hung = await until(() => p.toast(), 6000);
  const free = await until(() => page.evaluate(() => !isSpinning && !server.busy), 6000);
  const hungState = { free: !!free, btnDisabled: await page.isDisabled('#open-case-btn'), answered: calls(bridge, 'open_case_rpc').length - sentBefore, inv: await page.evaluate(() => state.inventory.length) };
  ok(/Sem resposta do servidor/.test(hung || '') && hungState.free && !hungState.btnDisabled && hungState.answered === 0 && hungState.inv === 1,
    'a request that never gets an answer is given up after the timeout and the game is usable again', `${hung} ${JSON.stringify(hungState)}`);
  const deadlines = await page.evaluate(async () => {
    const time = async (fn) => { const t0 = performance.now(); const code = await fn().then(() => 'ok', (e) => e.code); return { ms: Math.round(performance.now() - t0), code }; };
    return { sell: await time(() => window.neonBackend.sellDuplicates()), imp: await time(() => window.neonBackend.importLegacySave({})) };
  });
  ok(deadlines.sell.code === 'NETWORK' && deadlines.sell.ms < 1500 && deadlines.imp.code === 'NETWORK' && deadlines.imp.ms > 2200 && deadlines.imp.ms < 4000,
    'the legacy-save upload gets four times the deadline of an ordinary action', JSON.stringify(deadlines));
  bridge.hang = false;

  // headers arrive, then the body stalls / arrives cut
  const hideToast = () => page.evaluate(() => document.getElementById('nd-toast')?.classList.remove('visible'));
  await page.evaluate(() => {
    const real = window.fetch;
    window.__bodyFault = null;
    window.fetch = (url, opts = {}) => {
      if (!window.__bodyFault || !String(url).includes('/rpc/open_case_rpc')) return real(url, opts);
      const head = new TextEncoder().encode('{"items":[');
      const body = window.__bodyFault === 'cut' ? head : new ReadableStream({
        start(c) {
          c.enqueue(head);
          opts.signal?.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')));
        },
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
    };
  });
  for (const [fault, label] of [['stall', 'a response whose body stalls after the headers is given up as well'], ['cut', 'a 200 with a truncated body is reported as a connection problem, not as a refusal']]) {
    await until(() => page.evaluate(() => !server.busy && !isSpinning), 6000);
    await hideToast();
    await page.evaluate((f) => { window.__bodyFault = f; }, fault);
    await page.click('#open-case-btn');
    const t = await until(() => p.toast(), 6000);
    await page.evaluate(() => { window.__bodyFault = null; });
    const free = await until(() => page.evaluate(() => !isSpinning && !server.busy), 6000);
    ok(/Sem resposta do servidor/.test(t || '') && !!free && !(await page.isDisabled('#open-case-btn')), label, t || 'no notice (still waiting)');
    if (!free) { await p.reload(); await page.evaluate(() => { window.neonBackend.requestTimeoutMs = 600; }); break; } // stuck for good: start over so the rest can run
  }
  bridge.down = true;

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

// ===========================================================================
// F. Page behaviour fixed after the index.html review
// ===========================================================================
{
  const bridge = await createBridge([NEW_SCHEMA]);
  const p = await player(bridge);
  const { page } = p;
  const uid = await p.uid();
  const opened = async () => (await one(bridge, `SELECT cases_opened FROM public.profiles WHERE id = $1`, [uid])).cases_opened;

  // static facts come from the game constants
  const facts = await page.evaluate(() => ({
    tiers: [...document.querySelectorAll('#tier-filter-select option')].map((o) => o.textContent),
    tierAuto: document.getElementById('tier-filter-select').getAttribute('autocomplete'),
    odds: [...document.querySelectorAll('#odds-pills .pill')].map((o) => o.textContent),
    badge: document.getElementById('api-status-badge').textContent,
    pill: document.getElementById('catalog-facts-pill').textContent,
    combo: document.getElementById('aimlab-combo-label').textContent,
    filters: [...document.querySelectorAll('#collection-filter-group .col-filter-btn')].map((b) => b.textContent),
    xp: document.getElementById('top-xp-text').textContent,
    preconnect: [...document.querySelectorAll('link[rel="preconnect"]')].map((l) => l.getAttribute('href')),
  }));
  ok(facts.tiers.length === 7 && facts.tiers[4] === 'Tier 4 — Comandante ($2,400 – $4,200)' && facts.tiers[6] === 'Tier 6 — Lenda ($38,000 – $65,000)' && facts.tierAuto === 'off',
    'tier filter options are built from the catalog, in the same number format as the prices', JSON.stringify(facts.tiers));
  ok(facts.odds.join(' | ') === 'Padrão 75% | Tático 16% | Protótipo 5.5% | Relíquia 2.5% | ★ Apex Mítico 1%', 'odds pills are rendered from RARITIES', facts.odds.join(' | '));
  ok(/18 Caixas.*252 Skins/.test(facts.badge) && /16 Silhuetas/.test(facts.pill) && /MÁX 2\.0x/.test(facts.combo) && facts.xp === '0 / 168 XP', 'counts, combo cap and XP label come from the game data', JSON.stringify([facts.badge, facts.pill, facts.combo, facts.xp]));
  ok(facts.filters.join('/') === 'Obtidas/Faltando/Todas', 'collection filter buttons are in Portuguese', facts.filters.join('/'));
  ok(facts.preconnect.includes(SUPA), 'the page preconnects to the same Supabase origin the adapter uses', facts.preconnect.join(','));

  // reward modal: background inert, focus inside, no second opening behind it
  ok(await p.openCase(), 'case opened');
  const modalState = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    shell: document.querySelector('.app-shell').inert,
    topbar: document.querySelector('.topbar').inert,
  }));
  ok(modalState.focus === 'modal-keep-btn' && modalState.shell && modalState.topbar, 'with the reward modal open the page behind is inert and focus is on "Guardar"', JSON.stringify(modalState));
  await page.evaluate(() => { document.getElementById('open-case-btn').click(); spinRoulette(); });
  await sleep(500);
  ok((await opened()) === 1 && !(await page.evaluate(() => isSpinning)) && (await page.evaluate(() => currentUnboxedBatch.length)) === 1, 'ABRIR cannot fire again behind the modal (nothing spent, drop not discarded)');
  await page.keyboard.press('Enter');
  await sleep(300);
  ok((await page.evaluate(() => document.getElementById('reward-modal').classList.contains('hidden'))) && (await opened()) === 1 && !(await page.evaluate(() => document.querySelector('.app-shell').inert)) && (await page.textContent('#inv-count')) === '1',
    'Enter keeps the item, closes the modal and re-enables the page — without opening another case');

  // tier filter stays consistent
  await page.selectOption('#tier-filter-select', '1');
  await page.evaluate(() => jumpToCaseAndOpenTab('nx_t5_2'));
  const jump = await page.evaluate(() => ({ tier: document.getElementById('tier-filter-select').value, sel: document.getElementById('all-cases-select').value, active: activeCase.id, title: document.getElementById('active-case-title').textContent, opts: document.getElementById('all-cases-select').options.length }));
  ok(jump.tier === '5' && jump.sel === 'nx_t5_2' && jump.active === 'nx_t5_2' && jump.opts === 3, '"Ir para Caixa" on a case of another tier moves the tier filter with it', JSON.stringify(jump));
  await p.reload();
  const afterReload = await page.evaluate(() => ({ tier: document.getElementById('tier-filter-select').value, active: activeCase.id, opts: document.getElementById('all-cases-select').options.length, scope: document.getElementById('inv-case-select').value }));
  ok(afterReload.tier === 'ALL' && afterReload.opts === 18 && afterReload.scope === 'ALL', 'after a reload the tier filter and the case list both start on "all"', JSON.stringify(afterReload));
  ok(p.errors.length === 0, 'no JS errors', p.errors.join(' | '));
  await p.ctx.close();
}

// ===========================================================================
// G. Behaviour fixed after the app.js review: nothing else runs over a spinning roulette
// ===========================================================================
{
  const bridge = await createBridge([NEW_SCHEMA]);
  const p = await player(bridge);
  const { page } = p;
  const uid = await p.uid();
  await seed(bridge, uid, `template_id = 'nx_t1_2_b2'`, 6);
  await seed(bridge, uid, `template_id = 'nx_t1_1_b1'`, 1);
  await p.reload();
  const inv = async () => (await one(bridge, `SELECT count(*)::int n FROM public.inventory_items WHERE user_id = $1`, [uid])).n;
  const spare = await page.evaluate(() => state.inventory.find((i) => i.templateId === 'nx_t1_1_b1').uid);

  await p.tab('tradeup');
  await page.click('#autofill-dupes-btn');
  ok((await page.evaluate(() => tradeUpSelection.length)) === 5, 'five inputs selected for the contract');

  // slow roulette, then everything that used to interfere with it
  await p.tab('cases');
  await page.uncheck('#fast-mode-checkbox');
  await page.click('#open-case-btn');
  await until(() => page.evaluate(() => isSpinning && currentUnboxedBatch.length === 1 && !server.busy));
  const spun = await page.evaluate(() => currentUnboxedBatch[0].uid);
  await page.evaluate(() => { document.querySelector('.roulette-strip').dataset.mark = 'spin'; });

  await page.evaluate(() => document.getElementById('execute-tradeup-btn').click());
  const wait = await until(() => p.toast());
  await sleep(300);
  ok(/Aguarde a roleta/.test(wait || '') && calls(bridge, 'execute_tradeup_rpc').length === 0 && (await page.evaluate(() => tradeUpSelection.length)) === 5 && (await page.evaluate((u) => currentUnboxedBatch[0].uid === u, spun)),
    'the contract is refused while the roulette spins (drop on screen untouched)', wait || '');

  const selects = await page.evaluate(() => {
    const tier = document.getElementById('tier-filter-select');
    const cases = document.getElementById('all-cases-select');
    const before = { tier: tier.value, c: cases.value, opts: cases.options.length };
    tier.value = '5'; tier.dispatchEvent(new Event('change', { bubbles: true }));
    cases.value = cases.options[cases.options.length - 1].value; cases.dispatchEvent(new Event('change', { bubbles: true }));
    return { before, tier: tier.value, c: cases.value, opts: cases.options.length, active: activeCase.id, applied: appliedTierFilter };
  });
  ok(selects.tier === selects.before.tier && selects.c === selects.before.c && selects.c === selects.active && selects.opts === selects.before.opts && selects.applied === 'ALL',
    'tier and case selectors snap back to what is in effect when changed mid-spin', JSON.stringify(selects));

  await page.evaluate((u) => sellItemByUid(u), spare);
  await until(async () => (await inv()) === 7);
  await p.idle();
  ok((await page.evaluate(() => isSpinning && document.querySelector('.roulette-strip')?.dataset.mark === 'spin')) && (await page.evaluate(() => document.querySelectorAll('.roulette-strip > *').length)) > 20,
    'selling an item mid-spin does not rebuild the roulette that is moving');

  ok(await until(() => page.evaluate(() => !document.getElementById('reward-modal').classList.contains('hidden')), 15000), 'the spin finishes and shows its reward');
  const shown = await page.evaluate((u) => ({ same: currentUnboxedBatch.length === 1 && currentUnboxedBatch[0].uid === u, copies: state.inventory.filter((i) => i.uid === u).length, n: state.inventory.length }), spun);
  ok(shown.same && shown.copies === 1 && shown.n === (await inv()), 'the modal shows the item of this spin, stored exactly once', JSON.stringify(shown));
  await page.click('#modal-keep-btn');

  // leaderboard read fails: the open ntfy.sh topic is never used as a substitute
  const rival = (await one(bridge, `INSERT INTO auth.users DEFAULT VALUES RETURNING id`)).id;
  await bridge.sql(`INSERT INTO public.profiles (id, player_id, cases_opened) VALUES ($1, 'op_rival', 3) ON CONFLICT (id) DO UPDATE SET cases_opened = 3`, [rival]);
  await p.tab('leaderboard');
  await page.evaluate(() => fetchGlobalLeaderboard());
  await until(async () => /Atualizado/.test(await page.textContent('#lb-sync-status')));
  const boardBefore = await page.evaluate(() => Object.keys(lbPlayersMap).length);
  const profileReads = calls(bridge, '/rest/v1/profiles').length;
  bridge.failWith = (method, url) => (url.pathname.endsWith('/leaderboard_global_view') ? { status: 503, body: { message: 'upstream unavailable' } } : null);
  await page.evaluate(() => fetchGlobalLeaderboard());
  const lbStatus = await until(async () => { const t = await page.textContent('#lb-sync-status'); return /indisponível/.test(t) ? t : null; });
  ok(!!lbStatus && !p.external.some((u) => /ntfy\.sh/.test(u)), 'when the ranking cannot be read nothing is fetched from ntfy.sh', lbStatus || p.external.join(','));
  ok(boardBefore === 2 && (await page.evaluate(() => Object.keys(lbPlayersMap).length)) === 2 && calls(bridge, '/rest/v1/profiles').length === profileReads,
    'a passing error on the ranking view keeps the board: the own-row-only profiles table is not read in its place', `${boardBefore} rows, ${calls(bridge, '/rest/v1/profiles').length - profileReads} table reads`);
  bridge.failWith = null;
  ok(p.errors.length === 0, 'no JS errors', p.errors.join(' | '));
  await p.ctx.close();
}

// ===========================================================================
// H. Session handling fixed after the backend-adapter.js review
// ===========================================================================
{
  const KEY = 'neondrop_sb_session_v1';
  const bridge = await createBridge([NEW_SCHEMA]);
  const p = await player(bridge);
  const { page } = p;
  const uid = await p.uid();
  ok(await p.openCase(), 'baseline: case opened');
  await page.click('#modal-keep-btn');
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  const hideToast = (pg = page) => pg.evaluate(() => document.getElementById('nd-toast')?.classList.remove('visible'));
  const signups = () => calls(bridge, '/auth/v1/signup').length;
  const refreshes = () => calls(bridge, '/auth/v1/token').length;
  const overlayTitle = (re) => until(async () => { const t = await page.evaluate(() => document.getElementById('server-overlay-title')?.textContent || ''); return re.test(t) ? t : null; }, 15000);

  // 1. the refresh is refused for a reason that says nothing about the refresh token
  const first = await stored();
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.expires_at_ms = 0; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  bridge.failWith = (method, url) => (url.pathname === '/auth/v1/token' ? { status: 401, body: { message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' } } : null);
  await page.reload({ waitUntil: 'load' });
  const t1 = await overlayTitle(/CONTA DE JOGO INDISPONÍVEL/);
  ok(!!t1 && signups() === 1 && (await stored())?.refresh_token === first.refresh_token, 'a refresh refused with "Invalid API key" keeps the account: no new sign-up, credential still stored', `${t1} signups=${signups()}`);
  bridge.failWith = null;
  await page.click('#server-overlay-retry');
  await p.ready();
  ok((await p.uid()) === uid && (await page.evaluate(() => state.inventory.length)) === 1 && signups() === 1, 'once the Auth answers again the same account and its inventory come back');

  // 4. two tabs, the server stops accepting the access token before its local expiry
  const pageB = await p.ctx.newPage();
  await pageB.goto(ORIGIN + '/index.html', { waitUntil: 'load' });
  await until(() => pageB.evaluate(() => typeof server !== 'undefined' && server.mode === 'authoritative' && !server.busy));
  await until(() => page.evaluate(() => !server.busy));
  const refreshBefore = refreshes();
  bridge.tokens.clear();
  const bState = await pageB.evaluate(() => window.neonBackend.getMyState().then((s) => s.profile.player_id, (e) => e.code));
  const afterB = await stored();
  await page.check('#fast-mode-checkbox');
  await page.click('#open-case-btn');
  const openedA = await until(() => page.evaluate(() => !document.getElementById('reward-modal').classList.contains('hidden')), 9000);
  const afterA = await stored();
  ok(bState === uid && !!openedA && refreshes() === refreshBefore + 1 && signups() === 1 && afterA.refresh_token === afterB.refresh_token && afterA.access_token === afterB.access_token,
    'tab A picks up the session tab B renewed instead of overwriting it with its stale one', JSON.stringify({ bState, openedA: !!openedA, refreshes: refreshes() - refreshBefore, signups: signups() }));
  await page.click('#modal-keep-btn');
  await pageB.close();

  // 6. token rejected and the renewal cannot reach the Auth
  await p.idle();
  await hideToast();
  bridge.tokens.clear();
  bridge.failWith = (method, url) => (url.pathname === '/auth/v1/token' ? { status: 503, body: {} } : null);
  const opensBefore = calls(bridge, 'open_case_rpc').length;
  const keep = await stored();
  await page.click('#open-case-btn');
  const t6 = await until(() => p.toast(), 6000);
  await until(() => page.evaluate(() => !server.busy && !isSpinning), 6000);
  ok(/Sem resposta do servidor/.test(t6 || '') && calls(bridge, 'open_case_rpc').length === opensBefore + 1 && (await stored())?.refresh_token === keep.refresh_token,
    'rejected token + renewal unreachable: reported as a connection problem, the call is not repeated without a token', `${t6} calls=${calls(bridge, 'open_case_rpc').length - opensBefore}`);
  bridge.failWith = null;
  await page.evaluate(() => resyncServerState());
  await p.idle();

  // 1b. the Auth says the session no longer exists: a new account, and the pending action is not replayed on it
  await hideToast();
  bridge.tokens.clear();
  bridge.refresh.clear();
  const opens2 = calls(bridge, 'open_case_rpc').length;
  await page.click('#open-case-btn');
  const t7 = await until(() => p.toast(), 6000);
  await until(() => page.evaluate(() => !server.busy && !isSpinning), 6000);
  const newUid = (await stored())?.user_id;
  const newOpened = newUid ? await one(bridge, `SELECT cases_opened FROM public.profiles WHERE id = $1`, [newUid]) : null;
  ok(/Recarregue a página/.test(t7 || '') && signups() === 2 && newUid && newUid !== uid && calls(bridge, 'open_case_rpc').length === opens2 + 1 && !(newOpened?.cases_opened > 0),
    'session revoked for real: a new account is created, the action is not run on it, the player is told to reload', `${t7} signups=${signups()} calls=${calls(bridge, 'open_case_rpc').length - opens2}`);
  ok(p.errors.length === 0, 'no JS errors', p.errors.join(' | '));
  await p.ctx.close();

  // 8. project configured with a short access-token lifetime
  const bridge2 = await createBridge([NEW_SCHEMA]);
  bridge2.expiresIn = 45;
  const p2 = await player(bridge2);
  const fresh = await p2.page.evaluate(() => ({ mode: server.mode, fresh: window.neonBackend.hasFreshSession() }));
  ok(fresh.mode === 'authoritative' && fresh.fresh && (await p2.openCase()) && calls(bridge2, '/auth/v1/token').length === 0 && p2.errors.length === 0,
    'a 45-second access token is used until it nears expiry instead of being refreshed on every call', JSON.stringify(fresh));
  await p2.ctx.close();
}

await browser.close();
stat.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
