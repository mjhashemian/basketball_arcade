// Rules, content, i18n and save-file checks.  Run: node tests/logic.test.js
const Content = require('../js/content.js');
const Rules = require('../js/rules.js');
const I18n = require('../js/i18n.js');
const Save = require('../js/storage.js');
const P = require('../js/physics.js');
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };
const classic = Content.mode('classic'), rush = Content.mode('rush'), sudden = Content.mode('sudden'), moving = Content.mode('moving');

// ---- scoring ----
ok(Rules.points(classic, 'rim', 1, false) === 2, 'plain basket = 2');
ok(Rules.points(classic, 'bank', 1, false) === 2, 'bank shot = 2');
ok(Rules.points(classic, 'swish', 1, false) === 3, 'swish = 3');
ok(Rules.points(classic, 'swish', 3, false) === 4, 'streak of 3 adds +1');
ok(Rules.points(classic, 'swish', 6, false) === 5, 'streak of 6 adds +2');
ok(Rules.points(classic, 'rim', 1, true) === 4 && Rules.points(classic, 'swish', 6, true) === 10, 'bonus time doubles everything');

// ---- bonus time / modes ----
ok(Rules.bonusActive(classic, 10) && !Rules.bonusActive(classic, 10.01), 'classic bonus starts at exactly 10 s left');
ok(!Rules.bonusActive(rush, 5) && !Rules.bonusActive(sudden, 0), 'rush / sudden death have no bonus time');
ok(Rules.bonusActive(moving, 9), 'moving hoop keeps bonus time');
ok(Rules.timeAdd(rush, 'swish') === 3 && Rules.timeAdd(rush, 'rim') === 2 && Rules.timeAdd(classic, 'swish') === 0, 'only Beat the Clock adds time');
ok(sudden.lives === 3 && !sudden.timer && classic.timer && rush.time === 30, 'mode setup (lives / timer / start time)');

// ---- hoop ramps ----
ok(Rules.hoopLevel(classic, 29) === -1 && Rules.hoopLevel(classic, 30) === 0 && Rules.hoopLevel(classic, 70) === 1, 'classic hoop starts moving at 30 and speeds up at 70');
ok(Rules.hoopLevel(moving, 0) === 0, 'moving-hoop mode moves from the first second');
ok(Rules.hoopLevel(sudden, 11) === -1 && Rules.hoopLevel(sudden, 55) === 2, 'sudden death has 3 hoop steps');
for (const m of Content.MODES) {
  const sorted = m.hoop.every((h, i) => i === 0 || h.score > m.hoop[i - 1].score);
  ok(sorted && m.hoop.every(h => h.amp > 0 && h.amp <= 1.1 && h.speed > 0), `${m.id}: hoop steps ascending and sane`);
}

// ---- coins ----
ok(Rules.coins(classic, { score: 0, maxStreak: 0 }) === 0, 'no coins for a zero score');
ok(Rules.coins(classic, { score: 1, maxStreak: 0 }) === 1, 'at least 1 coin for any score');
ok(Rules.coins(classic, { score: 40, maxStreak: 4 }) === 24, '40 pts + streak 4 = 24 coins');
ok(Rules.coins(moving, { score: 40, maxStreak: 4 }) === 36, 'moving hoop pays 1.5x');
const cheapest = Math.min(...Content.BALLS.concat(Content.COURTS).filter(i => i.price > 0).map(i => i.price));
ok(cheapest <= 150, `first unlock is affordable (${cheapest} coins = a handful of games)`);

// ---- trophies ----
{
  const save = Save.defaults();
  save.stats = { games: 1, shots: 12, made: 9, swishes: 4, bestStreak: 5, totalScore: 40 };
  const round = { mode: 'classic', score: 41, maxStreak: 5, made: 9, shots: 12, swishes: 4 };
  const ids = Rules.newTrophies(Content, save, round).map(a => a.id);
  ok(['first', 'streak5', 'score40', 'sharp'].every(i => ids.includes(i)), 'trophies unlock from a good round: ' + ids.join(','));
  ok(!ids.includes('rush40') && !ids.includes('swish10') && !ids.includes('score80'), 'wrong-mode / not-yet trophies stay locked');
  save.ach.first = true;
  ok(!Rules.newTrophies(Content, save, round).some(a => a.id === 'first'), 'already unlocked trophies are not re-awarded');
  ok(Content.ACH.every(a => a.reward > 0), 'every trophy has a reward');
}

// ---- daily bonus ----
{
  const d = (y, m, dd) => new Date(y, m - 1, dd);
  let r = Rules.daily({ last: '', streak: 0 }, d(2026, 11, 10));
  ok(r.grant === 50 && r.streak === 1, 'first day grants 50');
  r = Rules.daily({ last: '2026-11-10', streak: 1 }, d(2026, 11, 10));
  ok(r.grant === 0, 'no second grant on the same day');
  r = Rules.daily({ last: '2026-11-10', streak: 1 }, d(2026, 11, 11));
  ok(r.grant === 75 && r.streak === 2, 'consecutive day grows the bonus');
  r = Rules.daily({ last: '2026-11-10', streak: 4 }, d(2026, 11, 14));
  ok(r.grant === 50 && r.streak === 1, 'a gap resets the streak');
  r = Rules.daily({ last: '2026-02-28', streak: 9 }, d(2026, 3, 1));
  ok(r.streak === 10 && r.grant === 150, 'month rollover keeps the streak; bonus caps at 150');
}

// ---- i18n: every language has every key, placeholders match ----
{
  const en = I18n.LANGS.en.s;
  for (const code of Object.keys(I18n.LANGS)) {
    const s = I18n.LANGS[code].s;
    const missing = Object.keys(en).filter(k => !(k in s)), extra = Object.keys(s).filter(k => !(k in en));
    ok(!missing.length && !extra.length, `${code}: same keys as English` + (missing.length ? ' missing ' + missing : '') + (extra.length ? ' extra ' + extra : ''));
    const badPh = Object.keys(en).filter(k => (en[k].match(/\{\w+\}/g) || []).sort().join() !== ((s[k] || '').match(/\{\w+\}/g) || []).sort().join());
    ok(!badPh.length, `${code}: placeholders match English` + (badPh.length ? ' ' + badPh : ''));
    ok(Object.values(s).every(v => typeof v === 'string' && v.trim().length), `${code}: no empty strings`);
  }
  const needed = [];
  Content.MODES.forEach(m => needed.push(`mode.${m.id}.name`, `mode.${m.id}.desc`));
  Content.BALLS.forEach(b => needed.push('ball.' + b.id));
  Content.COURTS.forEach(c => needed.push('court.' + c.id));
  Content.ACH.forEach(a => needed.push('ach.' + a.id, 'ach.' + a.id + '.d'));
  ok(needed.every(k => k in en), 'every mode / ball / court / trophy has a translation key');
  I18n.setLang('fa'); ok(I18n.dir === 'rtl' && I18n.t('over.coins', { n: 5 }) === '+5 سکه', 'Persian is RTL and formats placeholders');
  I18n.setLang('xx'); ok(I18n.lang === 'en', 'unknown language falls back to English');
}

// ---- content sanity ----
ok(Content.BALLS[0].price === 0 && Content.COURTS[0].price === 0, 'default ball and court are free');
ok(new Set(Content.BALLS.map(b => b.id)).size === Content.BALLS.length && new Set(Content.COURTS.map(c => c.id)).size === Content.COURTS.length, 'unique item ids');
ok(Content.COURTS.every(c => ['wall', 'floor', 'tray'].every(k => Array.isArray(c.p[k]) && c.p[k].length >= 2) && c.p.stripeA && c.p.lane), 'every court defines a full palette');

// ---- save file robustness ----
{
  const d = Save.defaults();
  ok(d.owned.balls.includes('classic') && d.equipped.ball === 'classic', 'defaults own the free items');
  const s = Save.load();   // no localStorage in Node => defaults, must not throw
  ok(s.coins === 0 && s.settings.sound === true, 'load() survives missing storage');
}

// ---- misses are reported once, immediately, and never for baskets ----
{
  const run = (setup, secs = 5) => {
    const log = { miss: 0, score: 0, missAt: -1 }; let t = 0;
    const w = P.createWorld({ miss: () => { log.miss++; if (log.missAt < 0) log.missAt = t; }, score: () => log.score++ });
    const b = w.balls[2]; setup(w, b);
    for (; t < secs; t += P.C.FIXED_DT) w.step(P.C.FIXED_DT);
    return log;
  };
  const shoot = (k) => (w, b) => {
    const bs = P.project(b.x, b.y, b.z), hs = P.project(w.hoop.x, w.hoop.y, w.hoop.z);
    const dx = hs.x - bs.x, dy = hs.y - bs.y, l = Math.hypot(dx, dy);
    const v = P.launchVelocity(b, w.hoop, dx / l * P.C.SP_IDEAL, dy / l * P.C.SP_IDEAL);
    w.launch(b, { vx: v.vx * k, vy: v.vy * k, vz: v.vz * k });   // power is automatic now, so scale the velocity itself for short / long throws
  };
  let r = run(shoot(1.0)); ok(r.score === 1 && r.miss === 0, 'a made basket is never also a miss');
  r = run(shoot(0.5)); ok(r.miss === 1 && r.score === 0, 'a short throw is exactly one miss');
  ok(r.missAt > 0 && r.missAt < 2.2, `...reported while still in the air (${r.missAt.toFixed(2)} s after launch)`);
  r = run(shoot(1.6)); ok(r.miss === 1, 'an airball over the board is exactly one miss');
  r = run((w, b) => { b.x = 0.7; b.y = 4; b.z = w.hoop.z; w.launch(b, { vx: 0, vy: 0, vz: 0 }); }); ok(r.miss === 1, 'a ball dropping outside the rim is one miss');
  r = run((w, b) => { b.x = 0; b.y = 1.2; b.z = w.hoop.z; w.launch(b, { vx: 0, vy: 11, vz: 0 }); }, 6);
  ok(r.score === 0 && r.miss === 1, 'shot up through the net: no score, one miss');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
