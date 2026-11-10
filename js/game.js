/* game.js — state machine, modes, progression, main loop. */
(() => {
  'use strict';
  const tr = (k, v) => I18n.t(k, v);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const END_GRACE_MAX = 3;   // after the buzzer, balls already in the air may still score for up to this long

  const g = {
    phase: 'menu',          // menu | countdown | playing | paused | ending | over
    mode: Content.mode(Save.data.lastMode),
    score: 0, streak: 0, maxStreak: 0, shots: 0, made: 0, swishes: 0,
    clock: 0, added: 0, lives: 0, cd: 0, cdShown: 0, endT: 0, endReason: 'time',
    bonus: false, lastTick: -1, hoopLevel: -1, t: 0, timeFlash: 0, hint: false, lastResult: null,
  };

  // ---- apply saved cosmetics before the first frame ----
  Renderer.setBall(Save.data.equipped.ball);
  Renderer.setCourt(Save.data.equipped.court);
  const canvas = document.getElementById('game');
  Renderer.init(canvas);

  const timeLeft = () => (g.mode.timer ? g.mode.time + g.added - g.clock : Infinity);

  // ------------------------------------------------------------------ world + input
  const world = Physics.createWorld({
    rim(v) { Sfx.rim(v); },
    board(v) { Sfx.board(v); Renderer.fx.shake(Math.min(3, v * 0.25)); },
    floor(v) { Sfx.floor(v); },
    miss: onMiss,
    score: onScore,
  });

  const input = Input.init(canvas, world, {
    canGrab: () => g.phase === 'playing',
    onRelease(ball, fx, fy) {
      const v = g.phase === 'playing' ? Physics.launchVelocity(ball, world.hoop, fx, fy) : null;
      if (!v) { world.sendHome(ball, true); return; }       // too weak / wrong direction / round over
      g.shots++;
      world.launch(ball, v);
      Sfx.throw(v.power); Haptics.v(8);
      if (!Save.data.tutorialDone) { Save.data.tutorialDone = true; g.hint = false; Save.commit(); }
    },
  });

  // ------------------------------------------------------------------ gameplay events
  function onMiss(b) {
    if (g.phase !== 'playing' && g.phase !== 'ending') return;
    g.streak = 0;
    if (g.phase === 'playing' && g.mode.lives) {
      g.lives = Math.max(0, g.lives - 1);
      const p = Physics.project(b.x, b.y, b.z);
      Renderer.fx.popup(tr('pop.miss'), clamp(p.x, 70, 530), clamp(p.y - 30, 220, 640), '#ff5a4d', 44, 0.9);
      Renderer.fx.flash('#ff2020', 0.2); Renderer.fx.shake(3);
      Sfx.miss(); Haptics.v(60);
      if (g.lives <= 0) endRound('lives');
    }
  }

  function onScore(info) {
    if (g.phase !== 'playing' && g.phase !== 'ending') return;
    const swish = info.kind === 'swish';
    g.streak++; g.made++; if (swish) g.swishes++;
    g.maxStreak = Math.max(g.maxStreak, g.streak);
    const pts = Rules.points(g.mode, info.kind, g.streak, g.bonus);
    g.score += pts;

    let addedSecs = 0;
    if (g.phase === 'playing') {
      const add = Rules.timeAdd(g.mode, info.kind);
      if (add) { addedSecs = Math.max(0, Math.min(add, g.mode.maxTime - timeLeft())); g.added += addedSecs; g.timeFlash = 1; }
    }

    const hs = Physics.project(world.hoop.x, world.hoop.y, world.hoop.z);
    const fx = Renderer.fx;
    const palette = g.bonus ? ['#ff2e93', '#ffe14d', '#ffffff'] : swish ? ['#19f0ff', '#ffffff', '#ffe14d'] : ['#ffb000', '#ff6a2a', '#ffffff'];
    fx.burst(hs.x, hs.y + 20, 22 + Math.min(g.streak, 8) * 4, palette, 380);
    fx.ring(hs.x, hs.y + 10, palette[0]);
    fx.popup('+' + pts, hs.x, hs.y - 70, g.bonus ? '#ff7ac8' : '#ffd23f', 62);
    fx.popup(tr(swish ? 'pop.swish' : info.kind === 'bank' ? 'pop.bank' : 'pop.rim'), hs.x, hs.y - 28, swish ? '#19f0ff' : '#ffffff', 28, 0.9);
    if (addedSecs) fx.popup(tr('pop.time', { n: addedSecs }), hs.x, hs.y + 60, '#3df5c1', 34, 0.9);
    if (g.streak === 3) fx.popup(tr('pop.s3'), 300, 330, '#ffe14d', 46, 1.2);
    if (g.streak === 5) fx.popup(tr('pop.s5'), 300, 330, '#ff7a2a', 56, 1.3);
    if (g.streak === 8) fx.popup(tr('pop.s8'), 300, 330, '#ff2e93', 52, 1.4);
    fx.flash(g.bonus ? '#ff2e93' : swish ? '#19f0ff' : '#ffffff', swish ? 0.3 : 0.18);
    fx.shake(swish ? 1.5 : 4);
    if (swish) Sfx.swish();
    Sfx.score(g.streak, swish || g.streak >= 3);
    Haptics.v(swish ? 25 : 15);
  }

  // ------------------------------------------------------------------ flow
  function resetStats() {
    g.score = g.streak = g.maxStreak = g.shots = g.made = g.swishes = 0;
    g.clock = g.added = 0; g.lives = g.mode.lives; g.bonus = false; g.lastTick = -1;
    g.hoopLevel = -1; g.endT = 0; g.timeFlash = 0; g.hint = !Save.data.tutorialDone;
    world.reset();
    Renderer.fx.reset();
  }

  function startMode(id) {
    if (g.phase !== 'menu' && g.phase !== 'over' && g.phase !== 'paused') return;
    Sfx.unlock(); Sfx.coin();
    g.mode = Content.mode(id);
    resetStats();
    g.phase = 'countdown'; g.cd = 3; g.cdShown = 0;
    UI.setPauseButton(false);
  }

  function beginPlay() {
    g.phase = 'playing'; g.clock = 0;
    UI.showCountdown(tr('count.go'), true); Sfx.countdown(0);
    UI.setPauseButton(true);
    setTimeout(() => { if (UI.current === 'count') UI.screen(null); }, 650);
  }

  function endRound(reason) {
    if (g.phase !== 'playing') return;
    g.phase = 'ending'; g.endT = 0; g.endReason = reason;
    input.cancelAll();
    UI.setPauseButton(false);
    if (reason === 'lives') { Sfx.gameover(); UI.banner(tr('ban.over'), 'cyan'); }
    else { Sfx.buzzer(); UI.banner(tr('ban.time'), 'cyan'); }
    Haptics.v(200);
    Renderer.fx.flash('#ffffff', 0.5);
    Renderer.fx.shake(6);
  }

  function finish() {
    g.phase = 'over';
    const d = Save.data, s = d.stats;
    const round = { mode: g.mode.id, score: g.score, maxStreak: g.maxStreak, made: g.made, shots: g.shots, swishes: g.swishes };
    s.games++; s.shots += g.shots; s.made += g.made; s.swishes += g.swishes;
    s.bestStreak = Math.max(s.bestStreak, g.maxStreak); s.totalScore += g.score;

    const isBest = g.score > 0 && g.score > (d.best[g.mode.id] || 0);
    if (isBest) d.best[g.mode.id] = g.score;
    let coins = Rules.coins(g.mode, round);
    d.coins += coins;
    const trophies = Rules.newTrophies(Content, d, round);
    trophies.forEach(a => { d.ach[a.id] = true; d.coins += a.reward; coins += a.reward; });
    d.lastMode = g.mode.id;
    Save.commit();

    g.lastResult = Object.assign({ best: d.best[g.mode.id], isBest, coins }, round);
    if (isBest) setTimeout(Sfx.fanfare, 250);
    trophies.forEach((a, i) => setTimeout(() => { UI.toast(tr('tro.unlocked', { name: tr('ach.' + a.id) })); Sfx.score(3, true); }, 900 + i * 1300));
    UI.showOver({ reason: g.endReason, mode: g.mode.id, score: g.score, best: d.best[g.mode.id], isBest, made: g.made, shots: g.shots, maxStreak: g.maxStreak, coins });
  }

  function pause() {
    if (g.phase !== 'playing') return;
    g.phase = 'paused';
    input.cancelAll();
    UI.setPauseButton(false);
    UI.screen('pause');
  }
  function resume() {
    if (g.phase !== 'paused') return;
    g.phase = 'playing';
    UI.screen(null); UI.setPauseButton(true);
  }
  function goHome() {
    g.phase = 'menu';
    input.cancelAll();
    world.reset(); Renderer.fx.reset();
    UI.setPauseButton(false);
    UI.screen('home');
  }

  // Android back button / Escape key. Returns true when the app handled it (false = let the OS close the app).
  function back() {
    switch (g.phase) {
      case 'playing': pause(); return true;
      case 'paused': resume(); return true;
      case 'countdown': case 'over': goHome(); return true;
      case 'ending': return true;
      default:
        if (UI.current && UI.current !== 'home') { UI.screen('home'); return true; }
        return false;
    }
  }

  function updateHoop() {
    const lvl = Rules.hoopLevel(g.mode, g.score);
    if (lvl === g.hoopLevel) return;
    const up = lvl > g.hoopLevel;
    g.hoopLevel = lvl;
    if (lvl < 0) { world.setHoopMotion(0, 0); return; }
    const h = g.mode.hoop[lvl];
    world.setHoopMotion(h.amp, h.speed);
    if (up) UI.banner(tr(lvl === 0 ? 'ban.move' : 'ban.fast'), 'cyan small-banner');
  }

  // ------------------------------------------------------------------ sharing
  function copyText(text) {
    const done = () => UI.toast(tr('copied'), false);
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;user-select:text';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove(); done();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function share() {
    const r = g.lastResult; if (!r) return;
    const text = tr('share.text', { score: r.score, mode: tr('mode.' + r.mode + '.name') });
    try {
      if (window.AndroidApp && window.AndroidApp.share) { window.AndroidApp.share(text); return; }
      if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    } catch (e) { /* fall through */ }
    copyText(text);
  }

  function dailyBonus() {
    const r = Rules.daily(Save.data.daily, new Date());
    if (r.grant <= 0) return;
    Save.data.coins += r.grant; Save.data.daily = { last: r.today, streak: r.streak };
    Save.commit();
    setTimeout(() => { UI.toast(tr('daily', { n: r.grant }), false); UI.updateCoins(); }, 700);
  }

  // Never leave a round running while the player is away.
  window.addEventListener('blur', () => { input.cancelAll(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { input.cancelAll(); pause(); } });

  // ------------------------------------------------------------------ main loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0;
    const cdt = Math.min(dt, 0.25);       // a hidden tab pauses the round instead of draining it
    g.t += cdt;
    g.timeFlash = Math.max(0, g.timeFlash - cdt * 2);

    if (g.phase === 'countdown') {
      g.cd -= cdt;
      const n = Math.ceil(g.cd);
      if (n !== g.cdShown && n > 0) { g.cdShown = n; UI.showCountdown(String(n), false); Sfx.countdown(n); }
      if (g.cd <= 0) beginPlay();
    } else if (g.phase === 'playing') {
      g.clock += cdt;
      const left = timeLeft();
      if (g.mode.timer) {
        if (!g.bonus && Rules.bonusActive(g.mode, left)) {
          g.bonus = true; Sfx.bonus(); Haptics.v(80);
          UI.banner(tr('ban.bonus'), '');
          Renderer.fx.flash('#ff2e93', 0.45);
        }
        if (left <= 5 && left > 0) {
          const sec = Math.ceil(left);
          if (sec !== g.lastTick) { g.lastTick = sec; Sfx.tick(); }
        }
      }
      updateHoop();
      if (g.mode.timer && left <= 0) endRound('time');
    } else if (g.phase === 'ending') {
      g.endT += cdt;
      const inAir = world.balls.some(b => b.state === 'flight');
      if (g.endT > END_GRACE_MAX || (!inAir && g.endT > 1.0)) finish();
    }

    if (g.phase !== 'paused') world.update(dt);

    const left = timeLeft();
    Renderer.draw({
      world, mode: g.mode, phase: g.phase, score: g.score, streak: g.streak, bonus: g.bonus, t: g.t,
      best: Math.max(Save.data.best[g.mode.id] || 0, g.score), lives: g.lives, timeFlash: g.timeFlash,
      hint: g.hint, fire: g.streak >= 5,
      timeLeft: g.phase === 'menu' || g.phase === 'countdown' ? g.mode.time : (g.phase === 'over' || g.phase === 'ending' && left < 0 ? 0 : Math.max(0, left)),
    }, g.phase === 'paused' ? 0 : Math.min(dt, 0.05));
  }

  UI.init({
    onFit: w => Renderer.resize(w),
    onStartMode: startMode,
    onPause: pause, onResume: resume,
    onRestart: () => startMode(g.mode.id),
    onQuit: goHome,
    onShare: share,
    onBack: back,
    onPauseKey: () => (g.phase === 'playing' ? pause() : g.phase === 'paused' ? resume() : undefined),
    onEquip: (kind, id) => (kind === 'ball' ? Renderer.setBall(id) : Renderer.setCourt(id)),
    onReset: () => {
      Renderer.setBall(Save.data.equipped.ball); Renderer.setCourt(Save.data.equipped.court);
      Sfx.setMuted(!Save.data.settings.sound); g.mode = Content.mode('classic');
    },
  });
  UI.screen('home');
  dailyBonus();
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });

  window.BA = { back };                      // used by the Android wrapper's back button
  if (/[?&#]debug/.test(location.href)) window.__hoops = { g, world, Save, startMode, Physics, Content, Rules, UI, Renderer };
})();
