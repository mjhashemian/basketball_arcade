/* rules.js — pure scoring / progression rules (no DOM), unit-tested in Node. */
const Rules = (() => {
  'use strict';
  const BASE = 2, SWISH = 3, STREAK_AT = [3, 6];

  // kind: 'swish' | 'bank' | 'rim'
  function points(mode, kind, streak, bonus) {
    let p = (kind === 'swish' ? SWISH : BASE) + (streak >= STREAK_AT[1] ? 2 : streak >= STREAK_AT[0] ? 1 : 0);
    if (bonus) p *= 2;
    return p;
  }

  const bonusActive = (mode, timeLeft) => mode.bonusTime > 0 && timeLeft <= mode.bonusTime;

  // index of the active hoop step for this score, or -1 when the hoop stays still
  function hoopLevel(mode, score) {
    let lvl = -1;
    mode.hoop.forEach((h, i) => { if (score >= h.score) lvl = i; });
    return lvl;
  }

  // seconds added to the clock by a basket (Beat the Clock)
  const timeAdd = (mode, kind) => (mode.addTime ? (kind === 'swish' ? mode.addTime.swish : mode.addTime.other) : 0);

  function coins(mode, r) {
    if (r.score <= 0) return 0;
    return Math.max(1, Math.round((r.score * 0.5 + r.maxStreak) * mode.coinMult));
  }

  // Returns trophies newly unlocked by this round (does not mutate `save`).
  function newTrophies(content, save, round) {
    const ctx = { stats: save.stats, round };
    return content.ACH.filter(a => !save.ach[a.id] && a.test(ctx));
  }

  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // daily login bonus. today = Date. Returns { grant, streak } (grant 0 if already claimed today)
  function daily(state, today) {
    const t = ymd(today);
    if (state.last === t) return { grant: 0, streak: state.streak };
    const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const streak = state.last === ymd(y) ? Math.min(state.streak + 1, 99) : 1;
    return { grant: 50 + 25 * Math.min(streak - 1, 4), streak, today: t };
  }

  return { BASE, SWISH, STREAK_AT, points, bonusActive, hoopLevel, timeAdd, coins, newTrophies, daily };
})();

if (typeof module !== 'undefined') module.exports = Rules;
