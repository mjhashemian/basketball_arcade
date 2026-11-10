/* render.js — all canvas drawing: cabinet scene, hoop/net, balls, LED HUD, particles. */
const Renderer = (() => {
  'use strict';
  const { W, H, project: P, CAM } = Physics;
  const C = Physics.C;
  const TAU = Math.PI * 2;
  const NET_ROWS = 5, NET_COLS = 12;
  const WALL_Z = 9.6;
  const FONT = '"Impact","Haettenschweiler","Arial Narrow Bold","Arial Black",sans-serif';

  const COL = {
    led: { score: '#ffd23f', time: '#ff4d3d', best: '#3df5c1' },
    cyan: '#19f0ff', magenta: '#ff2e93', amber: '#ffb000',
  };

  let canvas, ctx, bg, scale = 1;
  const fx = { particles: [], popups: [], rings: [], flash: 0, flashColor: '#fff', shake: 0 };

  // ------------------------------------------------------------------ setup
  function init(cv) { canvas = cv; ctx = cv.getContext('2d'); }

  function resize(cssWidth) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssWidth * 1.5 * dpr);
    scale = canvas.width / W;
    bg = document.createElement('canvas');
    bg.width = canvas.width; bg.height = canvas.height;
    const g = bg.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    paintBackground(g);
  }

  function line3(g, x0, y0, z0, x1, y1, z1) {
    const a = P(x0, y0, z0), b = P(x1, y1, z1);
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
  }

  // ------------------------------------------------------- static background
  function paintBackground(g) {
    const baseY = P(0, 0, WALL_Z).y;

    // back wall
    let gr = g.createLinearGradient(0, 0, 0, baseY);
    gr.addColorStop(0, '#0d041c'); gr.addColorStop(0.5, '#25093f'); gr.addColorStop(1, '#4a1370');
    g.fillStyle = gr; g.fillRect(0, 0, W, baseY);

    // glow behind the hoop
    const hs = P(0, C.HOOP_Y, WALL_Z);
    gr = g.createRadialGradient(hs.x, hs.y, 10, hs.x, hs.y, 320);
    gr.addColorStop(0, 'rgba(255,46,147,0.45)'); gr.addColorStop(0.5, 'rgba(120,40,200,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, baseY);

    // sunburst rays
    g.save();
    g.beginPath(); g.rect(0, 0, W, baseY); g.clip();
    for (let i = 0; i < 14; i++) {
      const a0 = i * TAU / 14, a1 = a0 + TAU / 28;
      g.fillStyle = 'rgba(255,120,220,0.045)';
      g.beginPath(); g.moveTo(hs.x, hs.y);
      g.lineTo(hs.x + Math.cos(a0) * 900, hs.y + Math.sin(a0) * 900);
      g.lineTo(hs.x + Math.cos(a1) * 900, hs.y + Math.sin(a1) * 900);
      g.fill();
    }
    g.restore();

    // wall grid
    g.strokeStyle = 'rgba(160,110,255,0.10)'; g.lineWidth = 1;
    g.beginPath();
    for (let x = -4; x <= 4; x += 0.5) line3(g, x, 0, WALL_Z, x, 7, WALL_Z);
    for (let y = 0; y <= 7; y += 0.5) line3(g, -4, y, WALL_Z, 4, y, WALL_Z);
    g.stroke();

    // neon stripes on the wall
    const stripe = (y, col, w) => {
      g.save(); g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = 14;
      g.beginPath(); line3(g, -4, y, WALL_Z, 4, y, WALL_Z); g.stroke(); g.restore();
    };
    stripe(0.55, COL.cyan, 3); stripe(0.75, COL.magenta, 3);

    // floor
    gr = g.createLinearGradient(0, baseY, 0, H);
    gr.addColorStop(0, '#3b1062'); gr.addColorStop(0.35, '#1c0a38'); gr.addColorStop(1, '#0a0418');
    g.fillStyle = gr; g.fillRect(0, baseY, W, H - baseY);

    // key / lane
    g.save();
    g.fillStyle = 'rgba(255,46,147,0.14)'; g.strokeStyle = 'rgba(255,46,147,0.7)'; g.lineWidth = 2.5;
    g.shadowColor = COL.magenta; g.shadowBlur = 10;
    const k = [[-1.0, 3.4], [1.0, 3.4], [1.0, WALL_Z], [-1.0, WALL_Z]].map(([x, z]) => P(x, 0, z));
    g.beginPath(); k.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
    g.fill(); g.stroke();
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * i / 40, p = P(Math.cos(a) * 1.0, 0, 3.4 + Math.sin(a) * 1.0);
      i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
    }
    g.stroke();
    g.restore();

    // floor grid
    g.strokeStyle = 'rgba(25,240,255,0.2)'; g.lineWidth = 1.2;
    g.beginPath();
    for (let z = 1.3; z <= WALL_Z; z += 0.65) line3(g, -6, 0, z, 6, 0, z);
    for (let x = -6; x <= 6; x += 0.5) line3(g, x, 0, 1.3, x, 0, WALL_Z);
    g.stroke();

    // cage side panels
    g.strokeStyle = 'rgba(25,240,255,0.16)'; g.lineWidth = 1;
    g.beginPath();
    for (const sx of [-C.WALL_X, C.WALL_X]) {
      for (let z = 1.3; z <= WALL_Z; z += 0.6) line3(g, sx, 0, z, sx, 6, z);
      for (let y = 0; y <= 6; y += 0.5) line3(g, sx, y, 1.3, sx, y, WALL_Z);
    }
    g.stroke();
    g.save(); g.strokeStyle = COL.cyan; g.lineWidth = 3; g.shadowColor = COL.cyan; g.shadowBlur = 10;
    g.beginPath();
    for (const sx of [-C.WALL_X, C.WALL_X]) { line3(g, sx, 0, 1.3, sx, 0, WALL_Z); line3(g, sx, 6, 1.3, sx, 6, WALL_Z); }
    g.stroke(); g.restore();

    // ball-return tray
    g.save();
    gr = g.createLinearGradient(0, 660, 0, H);
    gr.addColorStop(0, '#3a1a66'); gr.addColorStop(1, '#10061f');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(40, 672); g.lineTo(W - 40, 672); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.strokeStyle = COL.magenta; g.lineWidth = 4; g.shadowColor = COL.magenta; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(40, 672); g.lineTo(W - 40, 672); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(25,240,255,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(34, 686); g.lineTo(W - 34, 686); g.stroke();
    // cups
    for (const sx of C.SLOTS_X) {
      const s = P(sx, C.SLOT_Y, C.SLOT_Z), r = C.BALL_R * s.s;
      g.fillStyle = '#07030f';
      g.beginPath(); g.ellipse(s.x, s.y + r * 0.62, r * 1.18, r * 0.45, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(s.x, s.y + r * 0.62, r * 1.18, r * 0.45, 0, 0, TAU); g.stroke();
    }
    g.restore();
  }

  // ---------------------------------------------------------------- hoop bits
  function drawBoard(world) {
    const h = world.hoop, zb = world.zBoard();
    const x0 = h.x - C.BOARD_HALF_W, x1 = h.x + C.BOARD_HALF_W;
    const y0 = h.y - C.BOARD_DOWN, y1 = h.y + C.BOARD_UP;
    const a = P(x0, y1, zb), b = P(x1, y1, zb), c = P(x1, y0, zb), d = P(x0, y0, zb);
    const s = a.s;

    // support arm to the wall
    const m = P(h.x, y0, zb), w = P(h.x, y0 - 0.5, WALL_Z);
    ctx.fillStyle = '#1a0d33';
    ctx.beginPath(); ctx.moveTo(m.x - 0.08 * s, m.y); ctx.lineTo(m.x + 0.08 * s, m.y);
    ctx.lineTo(w.x + 0.05 * w.s, w.y); ctx.lineTo(w.x - 0.05 * w.s, w.y); ctx.closePath(); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    const gr = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
    gr.addColorStop(0, 'rgba(190,235,255,0.34)'); gr.addColorStop(0.5, 'rgba(120,190,255,0.16)'); gr.addColorStop(1, 'rgba(190,150,255,0.26)');
    ctx.fillStyle = gr; ctx.fill();
    // glass glare
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * 0.1, a.y); ctx.lineTo(a.x + (b.x - a.x) * 0.3, a.y);
    ctx.lineTo(d.x + (c.x - d.x) * 0.15, d.y); ctx.lineTo(d.x - (c.x - d.x) * 0.05, d.y); ctx.closePath(); ctx.fill();
    ctx.restore();
    // frame (the glare clip above replaced the current path, so rebuild it)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.05 * s; ctx.lineJoin = 'round';
    ctx.shadowColor = COL.cyan; ctx.shadowBlur = 16; ctx.stroke();
    ctx.shadowBlur = 0;
    // shooter's square
    const q0 = P(h.x - 0.32, h.y + 0.02, zb), q1 = P(h.x + 0.32, h.y + 0.5, zb);
    ctx.strokeStyle = '#ff6a2a'; ctx.lineWidth = 0.035 * s;
    ctx.strokeRect(q0.x, q1.y, q1.x - q0.x, q0.y - q1.y);
    ctx.restore();
  }

  function ringPath(h, a0, a1) {
    ctx.beginPath();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const p = P(h.x + Math.cos(a) * C.RIM_R, h.y, h.z + Math.sin(a) * C.RIM_R);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
  }

  function drawRim(h, back, t) {
    const s = P(h.x, h.y, h.z).s;
    ctx.save();
    ctx.lineCap = 'round';
    if (back) {
      // bracket joining rim to backboard
      const p = P(h.x, h.y, h.z + C.RIM_R), q = P(h.x, h.y, h.z + C.RIM_R + C.BOARD_GAP);
      ctx.fillStyle = '#ff5a1f'; ctx.fillRect(p.x - 0.06 * s, q.y - 0.02 * s, 0.12 * s, 0.05 * s);
      ringPath(h, 0, Math.PI);
    } else ringPath(h, Math.PI, TAU);
    ctx.strokeStyle = '#d63a10'; ctx.lineWidth = C.RIM_TUBE * 2.6 * s; ctx.stroke();
    ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = C.RIM_TUBE * 1.8 * s;
    ctx.shadowColor = '#ff5a1f'; ctx.shadowBlur = 8 + 14 * h.shake; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,230,190,0.7)'; ctx.lineWidth = C.RIM_TUBE * 0.5 * s;
    ctx.translate(0, -C.RIM_TUBE * 0.5 * s); ctx.stroke();
    ctx.restore();
  }

  // Net nodes are recomputed every frame: sway after a swish + bulge around balls.
  const nodes = [];
  for (let i = 0; i <= NET_ROWS; i++) { nodes.push([]); for (let j = 0; j <= NET_COLS; j++) nodes[i].push({ x: 0, y: 0, z: 0, sx: 0, sy: 0 }); }

  function updateNet(world, t) {
    const h = world.hoop;
    for (let i = 0; i <= NET_ROWS; i++) {
      const f = i / NET_ROWS, rad = C.RIM_R * (1 - 0.38 * f), y = h.y - f * C.NET_DEPTH;
      for (let j = 0; j <= NET_COLS; j++) {
        const a = j * TAU / NET_COLS, n = nodes[i][j];
        const sway = h.swing * Math.sin(t * 17 - i * 1.1) * 0.07 * f;
        n.x = h.x + Math.cos(a) * rad + sway; n.y = y - h.swing * 0.04 * f * Math.sin(t * 9); n.z = h.z + Math.sin(a) * rad + sway * 0.4;
        for (const b of world.balls) {
          if (b.state !== 'flight') continue;
          const dy = b.y - n.y, R = C.BALL_R + 0.025;
          if (Math.abs(dy) >= R || b.y > h.y + 0.3 || Math.hypot(b.x - h.x, b.z - h.z) > C.RIM_R) continue;
          const need = Math.sqrt(R * R - dy * dy);
          const dx = n.x - b.x, dz = n.z - b.z, len = Math.hypot(dx, dz);
          if (len < need && len > 1e-4) { n.x = b.x + dx / len * need; n.z = b.z + dz / len * need; }
        }
        const p = P(n.x, n.y, n.z); n.sx = p.x; n.sy = p.y; n.s = p.s;
      }
    }
  }

  function drawNet(h, back) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = back ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, 0.012 * P(h.x, h.y, h.z).s);
    ctx.beginPath();
    const seg = (a, b) => {
      const isBack = (a.z + b.z) * 0.5 > h.z;
      if (isBack !== back) return;
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
    };
    for (let i = 0; i < NET_ROWS; i++) {
      for (let j = 0; j < NET_COLS; j++) {
        seg(nodes[i][j], nodes[i + 1][j + 1]);
        seg(nodes[i][j + 1], nodes[i + 1][j]);
      }
    }
    for (let j = 0; j < NET_COLS; j++) seg(nodes[NET_ROWS][j], nodes[NET_ROWS][j + 1]);
    ctx.stroke();
    ctx.restore();
  }

  // -------------------------------------------------------------------- balls
  function drawBall(b, glow) {
    const p = P(b.x, b.y, b.z), r = C.BALL_R * p.s;
    // contact shadow on the floor
    const sh = P(b.x, 0, b.z), air = Math.max(0, b.y - C.BALL_R), k = 1 / (1 + air * 0.7);
    ctx.fillStyle = `rgba(0,0,0,${0.38 * k})`;
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * k, r * k * 0.3, 0, 0, TAU); ctx.fill();

    ctx.save();
    if (glow) { ctx.shadowColor = 'rgba(255,160,60,0.9)'; ctx.shadowBlur = 18; }
    const gr = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    gr.addColorStop(0, '#ffb066'); gr.addColorStop(0.55, '#f26a14'); gr.addColorStop(1, '#8a2c04');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // seams
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.clip();
    ctx.translate(p.x, p.y); ctx.rotate(b.rot);
    ctx.strokeStyle = '#1b0a02'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.7, -r * 0.7); ctx.quadraticCurveTo(-r * 0.25, 0, -r * 0.7, r * 0.7);
    ctx.moveTo(r * 0.7, -r * 0.7); ctx.quadraticCurveTo(r * 0.25, 0, r * 0.7, r * 0.7);
    ctx.stroke();
    ctx.restore();
    // specular
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x - r * 0.35, p.y - r * 0.45, r * 0.22, r * 0.13, -0.7, 0, TAU); ctx.fill();
  }

  // ------------------------------------------------------------------ LED HUD
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function led(str, x, y, h, color, on) {
    const w = h * 0.52, th = h * 0.13, gap = h * 0.2;
    const segs = {
      a: [0, 0, 1, 0], b: [1, 0, 1, 1], c: [1, 1, 1, 2], d: [0, 2, 1, 2], e: [0, 1, 0, 2], f: [0, 0, 0, 1], g: [0, 1, 1, 1],
    };
    ctx.save(); ctx.lineCap = 'round';
    let cx = x;
    for (const ch of str) {
      if (ch === '.') {
        ctx.fillStyle = on ? color : 'rgba(255,255,255,0.08)';
        if (on) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
        ctx.beginPath(); ctx.arc(cx + th, y + h, th * 0.7, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
        cx += th * 3; continue;
      }
      for (const k of 'abcdefg') {
        const s = segs[k], lit = on && SEG[ch] && SEG[ch].includes(k);
        const x0 = cx + s[0] * w + (s[0] === s[2] ? 0 : th * 0.9), y0 = y + s[1] * h / 2 + (s[1] === s[3] ? 0 : th * 0.9);
        const x1 = cx + s[2] * w - (s[0] === s[2] ? 0 : th * 0.9), y1 = y + s[3] * h / 2 - (s[1] === s[3] ? 0 : th * 0.9);
        ctx.strokeStyle = lit ? color : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = th;
        if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 12; } else ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      cx += w + gap;
    }
    ctx.restore();
  }
  const ledWidth = (n, h) => n * (h * 0.52 + h * 0.2) - h * 0.2;

  function ledBox(label, str, x, y, w, h, color, blinkOn, labelCol) {
    ctx.save();
    ctx.fillStyle = '#07030f';
    ctx.strokeStyle = labelCol || color; ctx.lineWidth = 2.5; ctx.shadowColor = labelCol || color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = labelCol || color; ctx.font = `15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + w / 2, y + 19);
    const dh = h - 40, lw = ledWidth(str.replace('.', '').length + (str.includes('.') ? 0.4 : 0), dh);
    led(str, x + (w - lw) / 2, y + 28, dh, color, blinkOn);
  }

  function drawHUD(s) {
    // header panel
    const gr = ctx.createLinearGradient(0, 0, 0, 122);
    gr.addColorStop(0, '#1d0b38'); gr.addColorStop(1, '#0d041c');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 122);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, W, 3);

    const blink = !(s.timeLeft <= 10 && s.phase === 'playing' && Math.floor(s.t * 4) % 2 === 0 && s.timeLeft <= 5);
    const sc = String(Math.min(999, s.score)).padStart(3, ' ');
    const best = String(Math.min(999, s.best)).padStart(3, ' ');
    const secs = Math.max(0, s.timeLeft);
    const tStr = s.timeLeft <= 10 && s.phase !== 'menu' && s.phase !== 'countdown'
      ? Math.min(9.9, secs).toFixed(1).padStart(4, ' ')
      : String(Math.ceil(secs)).padStart(2, ' ');
    ledBox('SCORE', sc, 14, 10, 180, 84, COL.led.score, true);
    const tCol = s.bonus ? '#ff2e93' : COL.led.time;
    ledBox(s.bonus ? 'BONUS x2' : 'TIME', tStr, 206, 10, 188, 84, tCol, blink, s.bonus ? '#ff2e93' : '#ff8f7a');
    ledBox('BEST', best, 406, 10, 180, 84, COL.led.best, true);

    // time bar
    const frac = Math.max(0, Math.min(1, s.timeLeft / 60));
    ctx.fillStyle = '#07030f'; ctx.fillRect(14, 100, W - 28, 8);
    const bc = s.bonus ? '#ff2e93' : (frac < 0.25 ? '#ff4d3d' : '#ffb000');
    ctx.save(); ctx.fillStyle = bc; ctx.shadowColor = bc; ctx.shadowBlur = 8; ctx.fillRect(14, 100, (W - 28) * frac, 8); ctx.restore();

    // chase lights
    const speed = s.bonus ? 14 : 5;
    for (let i = 0; i < 30; i++) {
      const on = Math.floor(s.t * speed - i * 0.5) % 3 === 0;
      ctx.fillStyle = on ? (i % 2 ? '#ffe14d' : '#ff7ac8') : 'rgba(255,255,255,0.12)';
      if (on) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(20 + i * 20.4, 116, 3.2, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function drawBadges(s) {
    if (s.phase !== 'playing' && s.phase !== 'ending') return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (s.streak >= 2) {
      const pulse = 1 + 0.06 * Math.sin(s.t * 12);
      const hot = s.streak >= 5;
      ctx.translate(18, 168); ctx.scale(pulse, pulse);
      ctx.font = `34px ${FONT}`; ctx.textAlign = 'left';
      ctx.lineWidth = 6; ctx.strokeStyle = '#1a0630'; ctx.lineJoin = 'round';
      const txt = (hot ? 'ON FIRE ' : 'STREAK ') + 'x' + s.streak;
      ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = hot ? '#ff7a2a' : '#ffe14d'; ctx.shadowColor = hot ? '#ff3b00' : '#ffb000'; ctx.shadowBlur = hot ? 18 : 8;
      ctx.fillText(txt, 0, 0);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ effects
  const rnd = (a, b) => a + Math.random() * (b - a);
  const FXAPI = {
    burst(x, y, n, colors, speed, life) {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), v = rnd(0.25, 1) * (speed || 360);
        fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rnd(0.5, 1) * (life || 0.9), max: life || 0.9, size: rnd(3, 7), col: colors[i % colors.length] });
      }
    },
    popup(text, x, y, color, size, life) { fx.popups.push({ text, x, y, color, size: size || 44, life: life || 1.0, max: life || 1.0 }); },
    ring(x, y, color) { fx.rings.push({ x, y, r: 10, life: 0.5, max: 0.5, color }); },
    flash(color, a) { fx.flash = a; fx.flashColor = color; },
    shake(a) { fx.shake = Math.max(fx.shake, a); },
    reset() { fx.particles.length = fx.popups.length = fx.rings.length = 0; fx.flash = fx.shake = 0; },
  };

  function updateFx(dt) {
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i]; p.life -= dt;
      if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = fx.popups.length - 1; i >= 0; i--) { const p = fx.popups[i]; p.life -= dt; p.y -= 55 * dt; if (p.life <= 0) fx.popups.splice(i, 1); }
    for (let i = fx.rings.length - 1; i >= 0; i--) { const r = fx.rings[i]; r.life -= dt; r.r += 330 * dt; if (r.life <= 0) fx.rings.splice(i, 1); }
    fx.flash = Math.max(0, fx.flash - dt * 2.4);
    fx.shake = Math.max(0, fx.shake - dt * 30);
  }

  function drawFx() {
    for (const r of fx.rings) {
      ctx.strokeStyle = r.color; ctx.globalAlpha = Math.max(0, r.life / r.max); ctx.lineWidth = 5 * (r.life / r.max) + 1;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.55, 0, 0, TAU); ctx.stroke();
    }
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const p of fx.popups) {
      const age = 1 - p.life / p.max;
      const pop = age < 0.12 ? 0.6 + age / 0.12 * 0.6 : 1.2 - Math.min(0.2, (age - 0.12) * 0.5);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pop, pop);
      ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.35));
      ctx.font = `${p.size}px ${FONT}`;
      ctx.lineWidth = p.size * 0.2; ctx.strokeStyle = '#1a0630'; ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 14; ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------------------------- draw
  function draw(s, dt) {
    updateFx(dt);
    const w = s.world, h = w.hoop;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.save();
    if (fx.shake > 0) ctx.translate(rnd(-1, 1) * fx.shake, rnd(-1, 1) * fx.shake);
    ctx.drawImage(bg, 0, 0, W, H);

    if (s.bonus) {
      ctx.fillStyle = `rgba(255,30,140,${0.07 + 0.05 * Math.sin(s.t * 8)})`;
      ctx.fillRect(0, 0, W, H);
    }

    const zb = w.zBoard();
    const flying = w.balls.filter(b => b.state !== 'held' || true);
    const behindBoard = [], mid = [], front = [];
    for (const b of flying) {
      if (b.z > zb) behindBoard.push(b);
      else if (b.z > h.z - 0.18) mid.push(b);
      else front.push(b);
    }
    const byDepth = (a, b) => b.z - a.z;
    behindBoard.sort(byDepth); mid.sort(byDepth); front.sort(byDepth);
    const ready = s.phase === 'playing';

    behindBoard.forEach(b => drawBall(b));

    ctx.save();
    ctx.translate(0, Math.sin(s.t * 70) * h.shake * 3);
    drawBoard(w);
    updateNet(w, s.t);
    drawRim(h, true, s.t);
    drawNet(h, true);
    mid.forEach(b => drawBall(b, ready && b.state === 'ready'));
    drawNet(h, false);
    drawRim(h, false, s.t);
    ctx.restore();

    front.forEach(b => drawBall(b, ready && b.state === 'ready'));

    ctx.restore();   // end of shake

    drawFx();
    if (fx.flash > 0) { ctx.globalAlpha = Math.min(0.5, fx.flash) ; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawHUD(s);
    drawBadges(s);
  }

  return { init, resize, draw, fx: FXAPI };
})();
