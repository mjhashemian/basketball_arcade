/* game.js — state machine, scoring rules, main loop. */
(() => {
  'use strict';
  const C = Physics.C;

  // ---- game rules (tweak freely) ----
  const RULES = {
    ROUND_TIME: 60,          // seconds
    BONUS_TIME: 10,          // last N seconds are worth double
    COUNTDOWN: 3,
    BASE_POINTS: 2,
    SWISH_POINTS: 3,         // clean shot, no rim/board contact
    STREAK_BONUS_AT: [3, 6], // streak thresholds that add +1, +2 points
    HOOP_MOVE_SCORE: 30,     // hoop starts sliding at this score (Infinity = never)
    HOOP_FAST_SCORE: 70,     // ...and speeds up here
    HOOP_AMP: [0.8, 1.0],    // sweep half-width in metres
    HOOP_SPEED: [1.1, 1.9],  // rad/s
    END_GRACE_MAX: 3,        // after the buzzer, balls in the air may still score for up to this long
  };

  const KEY = 'basketballarcade.best';
  const loadBest = () => { try { return parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) { return 0; } };
  const saveBest = v => { try { localStorage.setItem(KEY, String(v)); } catch (e) { /* ignore */ } };

  const g = {
    phase: 'menu',        // menu | countdown | playing | ending | over
    score: 0, best: loadBest(), streak: 0, maxStreak: 0, shots: 0, made: 0,
    clock: 0, cd: 0, cdShown: 0, endT: 0, bonus: false, lastTick: -1, hoopLevel: 0, t: 0,
  };

  const canvas = document.getElementById('game');
  Renderer.init(canvas);

  const world = Physics.createWorld({
    rim(v) { Sfx.rim(v); },
    board(v) { Sfx.board(v); Renderer.fx.shake(Math.min(3, v * 0.25)); },
    floor(v) { Sfx.floor(v); },
    miss() { if (g.phase === 'playing' || g.phase === 'ending') g.streak = 0; },
    score: onScore,
  });

  const input = Input.init(canvas, world, {
    canGrab: () => g.phase === 'playing',
    onRelease(ball, fx, fy) {
      const v = g.phase === 'playing' ? Physics.launchVelocity(ball, world.hoop, fx, fy) : null;
      if (!v) { world.sendHome(ball, true); return; }       // too weak / wrong direction / round over
      g.shots++;
      world.launch(ball, v);
      Sfx.throw(v.power);
    },
  });

  function onScore(info) {
    if (g.phase !== 'playing' && g.phase !== 'ending') return;
    g.streak++; g.made++;
    g.maxStreak = Math.max(g.maxStreak, g.streak);
    const [t1, t2] = RULES.STREAK_BONUS_AT;
    let pts = (info.kind === 'swish' ? RULES.SWISH_POINTS : RULES.BASE_POINTS) + (g.streak >= t2 ? 2 : g.streak >= t1 ? 1 : 0);
    if (g.bonus) pts *= 2;
    g.score += pts;

    const hs = Physics.project(world.hoop.x, world.hoop.y, world.hoop.z);
    const fx = Renderer.fx;
    const swish = info.kind === 'swish';
    const palette = g.bonus ? ['#ff2e93', '#ffe14d', '#ffffff'] : swish ? ['#19f0ff', '#ffffff', '#ffe14d'] : ['#ffb000', '#ff6a2a', '#ffffff'];
    fx.burst(hs.x, hs.y + 20, 22 + Math.min(g.streak, 8) * 4, palette, 380);
    fx.ring(hs.x, hs.y + 10, palette[0]);
    fx.popup('+' + pts, hs.x, hs.y - 70, g.bonus ? '#ff7ac8' : '#ffd23f', 62);
    fx.popup(swish ? 'SWISH!' : info.kind === 'bank' ? 'BANK SHOT!' : 'RATTLED IN!', hs.x, hs.y - 28, swish ? '#19f0ff' : '#ffffff', 28, 0.9);
    if (g.streak === 3) fx.popup('HEATING UP!', 300, 330, '#ffe14d', 46, 1.2);
    if (g.streak === 5) fx.popup('ON FIRE!', 300, 330, '#ff7a2a', 56, 1.3);
    if (g.streak === 8) fx.popup('UNSTOPPABLE!', 300, 330, '#ff2e93', 52, 1.4);
    fx.flash(g.bonus ? '#ff2e93' : swish ? '#19f0ff' : '#ffffff', swish ? 0.3 : 0.18);
    fx.shake(swish ? 1.5 : 4);
    if (swish) Sfx.swish();
    Sfx.score(g.streak, swish || g.streak >= 3);
  }

  function resetStats() {
    g.score = g.streak = g.maxStreak = g.shots = g.made = 0;
    g.clock = 0; g.bonus = false; g.lastTick = -1; g.hoopLevel = 0; g.endT = 0;
    world.reset();
    Renderer.fx.reset();
  }

  function startGame() {
    if (g.phase === 'countdown' || g.phase === 'playing' || g.phase === 'ending') return;
    Sfx.unlock(); Sfx.coin();
    resetStats();
    g.phase = 'countdown'; g.cd = RULES.COUNTDOWN; g.cdShown = 0;
  }

  function beginPlay() {
    g.phase = 'playing'; g.clock = 0;
    UI.showCountdown('GO!'); Sfx.countdown(0);
    setTimeout(() => { if (g.phase === 'playing') UI.hideCountdown(); }, 650);
  }

  function endRound() {
    g.phase = 'ending'; g.endT = 0;
    input.cancelAll();
    Sfx.buzzer();
    UI.banner("TIME'S UP!", 'cyan');
    Renderer.fx.flash('#ffffff', 0.5);
    Renderer.fx.shake(6);
  }

  function finish() {
    g.phase = 'over';
    const isBest = g.score > g.best;
    if (isBest) { g.best = g.score; saveBest(g.best); setTimeout(Sfx.fanfare, 250); }
    UI.showGameOver({ score: g.score, best: g.best, isBest: isBest && g.score > 0, made: g.made, shots: g.shots, maxStreak: g.maxStreak });
  }

  function updateHoop() {
    const lvl = g.score >= RULES.HOOP_FAST_SCORE ? 2 : g.score >= RULES.HOOP_MOVE_SCORE ? 1 : 0;
    if (lvl === g.hoopLevel) return;
    g.hoopLevel = lvl;
    world.setHoopMotion(RULES.HOOP_AMP[lvl - 1], RULES.HOOP_SPEED[lvl - 1]);
    UI.banner(lvl === 1 ? 'HOOP ON THE MOVE!' : 'HOOP GOING WILD!', 'cyan small-banner');
  }

  // ---------------------------------------------------------------- main loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0;
    g.t += Math.min(dt, 0.25);
    const clockDt = Math.min(dt, 0.25);   // a hidden tab pauses the round instead of draining it

    if (g.phase === 'countdown') {
      g.cd -= clockDt;
      const n = Math.ceil(g.cd);
      if (n !== g.cdShown && n > 0) { g.cdShown = n; UI.showCountdown(String(n)); Sfx.countdown(n); }
      if (g.cd <= 0) beginPlay();
    } else if (g.phase === 'playing') {
      g.clock += clockDt;
      const left = RULES.ROUND_TIME - g.clock;
      if (!g.bonus && left <= RULES.BONUS_TIME) {
        g.bonus = true;
        Sfx.bonus();
        UI.banner('BONUS TIME  x2', '');
        Renderer.fx.flash('#ff2e93', 0.45);
      }
      if (g.bonus) {
        const sec = Math.ceil(left);
        if (sec !== g.lastTick && sec <= 5 && sec > 0) { g.lastTick = sec; Sfx.tick(); }
      }
      updateHoop();
      if (left <= 0) endRound();
    } else if (g.phase === 'ending') {
      g.endT += clockDt;
      const inAir = world.balls.some(b => b.state === 'flight');
      if (g.endT > RULES.END_GRACE_MAX || (!inAir && g.endT > 1.0)) finish();
    }

    world.update(dt);
    Renderer.draw({
      world, phase: g.phase, score: g.score, best: g.best, streak: g.streak, bonus: g.bonus, t: g.t,
      timeLeft: g.phase === 'playing' ? Math.max(0, RULES.ROUND_TIME - g.clock) :
        (g.phase === 'ending' || g.phase === 'over') ? 0 : RULES.ROUND_TIME,
    }, Math.min(dt, 0.05));
  }

  UI.init({ onFit: w => Renderer.resize(w), onStart: startGame });
  UI.showStart(g.best);
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });

  // tiny hook for debugging / automated playtests
  window.__hoops = { g, world, RULES, startGame, Physics };
})();
