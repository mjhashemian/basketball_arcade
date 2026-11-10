/* input.js — pointer (mouse + touch + pen) drag-and-flick handling.
 * Several fingers can each hold a different ball at once. */
const Input = (() => {
  'use strict';
  const { W, H, project, unproject } = Physics;
  const C = Physics.C;
  const VEL_WINDOW = 110;                // ms of pointer history used for the flick

  function init(canvas, world, h) {
    const drags = new Map();             // pointerId -> {ball, offX, offY, samples}

    function logical(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    }

    function pickBall(px, py) {
      let best = null, bd = 1e9;
      for (const b of world.balls) {
        if (b.state !== 'ready') continue;
        const s = project(b.x, b.y, b.z);
        const r = C.BALL_R * s.s;
        const d = Math.hypot(px - s.x, py - s.y);
        if (d < r + 55 && d < bd) { bd = d; best = b; }   // generous touch slop
      }
      return best;
    }

    function moveBall(d, p) {
      const x = Math.min(W - 25, Math.max(25, p.x + d.offX));
      const y = Math.min(H - 20, Math.max(340, p.y + d.offY));
      const w = unproject(x, y, d.ball.home.z);
      d.ball.x = w.x; d.ball.y = w.y; d.ball.z = w.z;
      d.ball.rot += (x - d.lastX) * 0.02; d.lastX = x;
    }

    function addSample(d, e) {
      const p = logical(e);
      d.samples.push({ x: p.x, y: p.y, t: e.timeStamp });
      if (d.samples.length > 40) d.samples.shift();
      moveBall(d, p);
    }

    function flick(samples, tRel) {
      const n = samples.length;
      if (n < 2) return { vx: 0, vy: 0 };
      const last = samples[n - 1];
      let j = n - 1;
      while (j > 0 && tRel - samples[j - 1].t <= VEL_WINDOW) j--;
      if (j === n - 1) j = n - 2;
      const a = samples[j];
      // dividing by time-to-release means pausing before letting go kills the throw
      const dt = Math.max(tRel - a.t, 16) / 1000;
      return { vx: (last.x - a.x) / dt, vy: (last.y - a.y) / dt };
    }

    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (!h.canGrab()) return;
      const p = logical(e);
      const b = pickBall(p.x, p.y);
      if (!b) return;
      const s = project(b.x, b.y, b.z);
      world.hold(b);
      const d = { ball: b, offX: s.x - p.x, offY: s.y - p.y, samples: [], lastX: s.x };
      drags.set(e.pointerId, d);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      d.samples.push({ x: p.x, y: p.y, t: e.timeStamp });
      moveBall(d, p);
    });

    canvas.addEventListener('pointermove', e => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      e.preventDefault();
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (list && list.length) list.forEach(ce => addSample(d, ce)); else addSample(d, e);
    });

    function release(e, cancelled) {
      const d = drags.get(e.pointerId);
      if (!d) return;
      drags.delete(e.pointerId);
      const f = cancelled ? { vx: 0, vy: 0 } : flick(d.samples, e.timeStamp);
      h.onRelease(d.ball, f.vx, f.vy);
    }
    canvas.addEventListener('pointerup', e => release(e, false));
    canvas.addEventListener('pointercancel', e => release(e, true));
    // If the browser takes the pointer away (alt-tab, system gesture) never leave a ball stuck in the hand.
    canvas.addEventListener('lostpointercapture', e => release(e, true));
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    return {
      // called when the round ends: put every held ball back
      cancelAll() {
        for (const d of drags.values()) h.onRelease(d.ball, 0, 0);
        drags.clear();
      },
    };
  }

  return { init };
})();
