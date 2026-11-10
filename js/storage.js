/* storage.js — one versioned save object in localStorage (coins, bests, unlocks, stats, settings). */
const Save = (() => {
  'use strict';
  const KEY = 'basketballarcade.save.v1';

  const defaults = () => ({
    v: 1,
    coins: 0,
    best: { classic: 0, rush: 0, sudden: 0, moving: 0 },
    lastMode: 'classic',
    owned: { balls: ['classic'], courts: ['neon'] },
    equipped: { ball: 'classic', court: 'neon' },
    stats: { games: 0, shots: 0, made: 0, swishes: 0, bestStreak: 0, totalScore: 0 },
    ach: {},
    settings: { sound: true, vibration: true, lang: null },
    tutorialDone: false,
    daily: { last: '', streak: 0 },
  });

  // copy known keys of `src` over `base`, recursively, ignoring wrong types
  function merge(base, src) {
    if (!src || typeof src !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (!(k in src)) continue;
      const b = base[k], s = src[k];
      if (Array.isArray(b)) { if (Array.isArray(s)) base[k] = s.filter(x => typeof x === 'string'); }
      else if (b && typeof b === 'object') base[k] = merge(b, s);
      else if (typeof b === typeof s || b === null) base[k] = s;
    }
    if (base.ach !== undefined && src.ach && typeof src.ach === 'object') base.ach = Object.assign({}, src.ach);
    return base;
  }

  let data = defaults();

  function load() {
    data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = merge(data, JSON.parse(raw));
      else {                                      // migrate the pre-2.0 keys
        const best = parseInt(localStorage.getItem('basketballarcade.best'), 10);
        if (best > 0) data.best.classic = best;
        if (localStorage.getItem('basketballarcade.muted') === '1') data.settings.sound = false;
      }
    } catch (e) { data = defaults(); }
    // never trust the file: unlocked items must exist, equipped items must be owned
    if (!data.owned.balls.includes('classic')) data.owned.balls.push('classic');
    if (!data.owned.courts.includes('neon')) data.owned.courts.push('neon');
    if (!data.owned.balls.includes(data.equipped.ball)) data.equipped.ball = 'classic';
    if (!data.owned.courts.includes(data.equipped.court)) data.equipped.court = 'neon';
    data.coins = Math.max(0, Math.floor(data.coins) || 0);
    return data;
  }

  function commit() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode / quota */ }
  }

  function reset() {
    const keep = data.settings;
    data = defaults(); data.settings = keep;
    commit();
  }

  load();
  return { get data() { return data; }, load, commit, reset, defaults };
})();

if (typeof module !== 'undefined') module.exports = Save;
