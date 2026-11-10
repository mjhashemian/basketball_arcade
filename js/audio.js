/* audio.js — every sound is synthesised with the Web Audio API (no files). */
const Sfx = (() => {
  'use strict';
  let ctx = null, master = null, noiseBuf = null;
  let muted = !Save.data.settings.sound;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.7;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 1;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(g, t0, attack, dur, vol) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function tone(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    env(g, t0, o.attack || 0.005, o.dur, o.vol == null ? 0.25 : o.vol);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }

  function noise(o) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const g = ctx.createGain();
    env(g, t0, o.attack || 0.005, o.dur, o.vol == null ? 0.2 : o.vol);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.dur + 0.05);
  }

  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      Save.data.settings.sound = !m; Save.commit();
      if (master) master.gain.value = m ? 0 : 0.7;
    },

    throw(power) {
      const p = Math.min(1, Math.max(0, power || 0.5));
      noise({ filter: 'bandpass', f0: 500, f1: 2200 + 1200 * p, q: 0.9, dur: 0.2, attack: 0.03, vol: 0.12 + 0.12 * p });
    },
    rim(v) {
      const vol = Math.min(0.32, 0.06 + v * 0.03), j = 0.97 + Math.random() * 0.06;
      tone({ type: 'triangle', f0: 920 * j, f1: 880 * j, dur: 0.32, vol });
      tone({ type: 'square', f0: 1480 * j, f1: 1400 * j, dur: 0.12, vol: vol * 0.35 });
      tone({ type: 'sine', f0: 410 * j, dur: 0.4, vol: vol * 0.6 });
      noise({ filter: 'highpass', f0: 3000, dur: 0.03, vol: vol * 0.6 });
    },
    board(v) {
      const vol = Math.min(0.5, 0.1 + v * 0.04);
      tone({ type: 'sine', f0: 170, f1: 60, dur: 0.18, vol });
      noise({ filter: 'lowpass', f0: 900, dur: 0.07, vol: vol * 0.7 });
    },
    floor(v) {
      const vol = Math.min(0.25, 0.04 + v * 0.02);
      tone({ type: 'sine', f0: 120, f1: 50, dur: 0.12, vol });
    },
    swish() {
      noise({ filter: 'bandpass', f0: 2200, f1: 5200, q: 0.7, dur: 0.42, attack: 0.05, vol: 0.34 });
      noise({ filter: 'highpass', f0: 5000, dur: 0.25, attack: 0.06, vol: 0.1, delay: 0.05 });
    },
    score(streak, big) {
      const base = 76 + Math.min(streak, 6) * 1;           // pitch climbs with the streak
      const notes = big ? [0, 4, 7, 12] : [0, 7];
      notes.forEach((n, i) => tone({ type: 'square', f0: NOTE(base + n), dur: 0.16, vol: 0.09, delay: i * 0.065 }));
      tone({ type: 'sine', f0: NOTE(base + 12), dur: 0.35, vol: 0.12, delay: notes.length * 0.065 });
    },
    coin() {
      tone({ type: 'square', f0: NOTE(83), dur: 0.09, vol: 0.14 });
      tone({ type: 'square', f0: NOTE(88), dur: 0.5, vol: 0.14, delay: 0.09 });
      tone({ type: 'sine', f0: NOTE(100), dur: 0.5, vol: 0.06, delay: 0.09 });
    },
    countdown(n) {
      if (n > 0) tone({ type: 'square', f0: 440, dur: 0.18, vol: 0.18 });
      else {
        tone({ type: 'square', f0: 880, dur: 0.5, vol: 0.2 });
        tone({ type: 'square', f0: 1320, dur: 0.5, vol: 0.1 });
      }
    },
    tick() { tone({ type: 'square', f0: 1300, dur: 0.04, vol: 0.06 }); },
    bonus() {
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) =>
        tone({ type: 'sawtooth', f0: NOTE(60 + n), dur: 0.14, vol: 0.11, delay: i * 0.07 }));
      tone({ type: 'sawtooth', f0: 200, f1: 1600, dur: 0.6, vol: 0.07 });
    },
    buzzer() {
      tone({ type: 'sawtooth', f0: 118, dur: 1.2, attack: 0.01, vol: 0.34 });
      tone({ type: 'square', f0: 122, dur: 1.2, attack: 0.01, vol: 0.2 });
    },
    fanfare() {
      [0, 4, 7, 12, 7, 12, 16].forEach((n, i) =>
        tone({ type: 'square', f0: NOTE(72 + n), dur: 0.2, vol: 0.11, delay: i * 0.11 }));
    },
    click() { tone({ type: 'square', f0: 700, dur: 0.05, vol: 0.08 }); },
    error() { tone({ type: 'square', f0: 180, dur: 0.14, vol: 0.12 }); tone({ type: 'square', f0: 140, dur: 0.2, vol: 0.12, delay: 0.1 }); },
    miss() { tone({ type: 'sine', f0: 220, f1: 110, dur: 0.22, vol: 0.14 }); },
    gameover() {
      [0, -3, -5, -9].forEach((n, i) => tone({ type: 'sawtooth', f0: NOTE(64 + n), dur: 0.3, vol: 0.12, delay: i * 0.18 }));
    },
  };
})();

/* Haptics: Android bridge when running inside the app, navigator.vibrate on the web. */
const Haptics = (() => {
  'use strict';
  return {
    v(ms) {
      if (!Save.data.settings.vibration) return;
      try {
        if (window.AndroidApp && window.AndroidApp.vibrate) window.AndroidApp.vibrate(ms);
        else if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms);
      } catch (e) { /* unsupported */ }
    },
  };
})();
