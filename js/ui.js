/* ui.js — DOM overlays (start / countdown / banner / game over), sizing, mute button. */
const UI = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = $('game');
  const el = {
    start: $('screen-start'), count: $('screen-count'), over: $('screen-over'),
    num: $('count-num'), banner: $('banner'), mute: $('mute'),
  };
  let onFit = null, bannerTimer = 0;

  // Fit the 2:3 stage into the window; em-based CSS scales with it.
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const wide = vw > 700 && vh > 500;                 // leave a margin on desktop
    const availW = wide ? vw - 24 : vw, availH = wide ? vh - 24 : vh;
    const w = Math.max(200, Math.floor(Math.min(availW, availH * 600 / 900)));
    const h = Math.floor(w * 1.5);
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.fontSize = (w / 60) + 'px';            // 1em = 10 logical px
    if (onFit) onFit(w);
  }

  function show(node) { node.classList.remove('hidden'); node.classList.add('shown'); }
  function hide(node) { node.classList.add('hidden'); node.classList.remove('shown'); }

  function syncMute() {
    el.mute.textContent = Sfx.muted ? 'SND OFF' : 'SND ON';
    el.mute.classList.toggle('off', Sfx.muted);
  }

  return {
    init(handlers) {
      onFit = handlers.onFit;
      window.addEventListener('resize', fit);
      window.addEventListener('orientationchange', fit);
      fit();
      $('btn-start').addEventListener('click', handlers.onStart);
      $('btn-again').addEventListener('click', handlers.onStart);
      el.mute.addEventListener('click', () => { Sfx.setMuted(!Sfx.muted); syncMute(); });
      window.addEventListener('keydown', e => {
        if (e.key === 'm' || e.key === 'M') { Sfx.setMuted(!Sfx.muted); syncMute(); }
      });
      syncMute();
    },

    showStart(best) {
      $('start-best').textContent = best;
      hide(el.over); hide(el.count); show(el.start);
      $('btn-start').focus({ preventScroll: true });
    },
    hideStart() { hide(el.start); },

    showCountdown(txt) {
      hide(el.start); hide(el.over); show(el.count);
      el.num.textContent = txt;
      el.num.classList.remove('pop'); void el.num.offsetWidth; el.num.classList.add('pop');
      el.count.querySelector('.get-ready').style.visibility = txt === 'GO!' ? 'hidden' : 'visible';
      el.num.style.fontSize = txt === 'GO!' ? '20em' : '';
    },
    hideCountdown() { hide(el.count); },

    banner(text, kind) {
      const b = el.banner;
      b.textContent = text;
      b.className = kind || '';
      void b.offsetWidth;
      b.classList.add('show');
    },

    showGameOver(r) {
      hide(el.start); hide(el.count);
      $('over-score').textContent = r.score;
      $('over-best').textContent = r.best;
      $('over-new').classList.toggle('hidden', !r.isBest);
      $('st-made').textContent = r.made;
      $('st-acc').textContent = r.shots ? Math.round(100 * r.made / r.shots) + '%' : '--';
      $('st-streak').textContent = r.maxStreak;
      $('over-tag').textContent = r.score >= 60 ? 'ARCADE LEGEND' : r.score >= 35 ? 'NICE SHOOTING' : r.score >= 15 ? 'NOT BAD' : 'KEEP PRACTISING';
      show(el.over);
      $('btn-again').focus({ preventScroll: true });
    },
  };
})();
