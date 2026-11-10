// Headless physics checks.  Run:  node tests/physics.test.js
const P = require('../js/physics.js');
const C = P.C;
let failed = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failed++; };

function newWorld() {
  const log = { scores: [], rim: 0, board: 0, miss: 0 };
  const w = P.createWorld({
    score: (i) => log.scores.push(i.kind),
    rim: () => log.rim++, board: () => log.board++, miss: () => log.miss++,
  });
  return { w, log };
}
function run(w, seconds) { for (let t = 0; t < seconds; t += C.FIXED_DT) w.step(C.FIXED_DT); }

// Simulate a "perfect human" flick: aimed at hoop from ball b, speed ratio k, yaw offset (screen px).
function shoot(w, b, k, aimOffsetPx) {
  const bs = P.project(b.x, b.y, b.z), hs = P.project(w.hoop.x, w.hoop.y, w.hoop.z);
  const dx = hs.x + (aimOffsetPx || 0) - bs.x, dy = hs.y - bs.y;
  const len = Math.hypot(dx, dy);
  const sp = C.SP_IDEAL * k;
  const v = P.launchVelocity(b, w.hoop, dx / len * sp, dy / len * sp);
  if (!v) return false;
  w.launch(b, v);
  return true;
}

// 1) Scoring can NOT be triggered from below -------------------------------
{
  const { w, log } = newWorld();
  const b = w.balls[2];
  // directly under the hoop, thrown straight up through the net and back down
  b.x = 0; b.y = 1.2; b.z = w.hoop.z; b.state = 'flight';
  w.launch(b, { vx: 0, vy: 11, vz: 0 });
  run(w, 4);
  ok(log.scores.length === 0, 'ball shot up through the hoop from below never scores (even when it falls back down)');
}
{
  const { w, log } = newWorld();
  const b = w.balls[0];
  b.x = 0.1; b.y = 1.0; b.z = w.hoop.z - 0.1;
  w.launch(b, { vx: 0, vy: 12, vz: 0.5 });
  run(w, 4);
  ok(log.scores.length === 0, 'up-and-through off-centre shot does not score');
}
// ... but a normal downward pass does
{
  const { w, log } = newWorld();
  const b = w.balls[2];
  b.x = 0; b.y = 4; b.z = w.hoop.z; w.launch(b, { vx: 0, vy: 0, vz: 0 });
  run(w, 2);
  ok(log.scores.length === 1 && log.scores[0] === 'swish', 'dropping a ball straight down through the hoop scores a swish exactly once');
}
// ball dropped beside the rim does not score
{
  const { w, log } = newWorld();
  const b = w.balls[2];
  b.x = 0.7; b.y = 4; b.z = w.hoop.z; w.launch(b, { vx: 0, vy: 0, vz: 0 });
  run(w, 2);
  ok(log.scores.length === 0, 'ball falling outside the rim does not score');
}

// 2) Ideal flick scores from every rack slot --------------------------------
{
  let all = true;
  for (let i = 0; i < 5; i++) {
    const { w, log } = newWorld();
    shoot(w, w.balls[i], 1.0, 0);
    run(w, 4);
    if (log.scores.length !== 1) all = false;
  }
  ok(all, 'ideal-power flick aimed at the hoop scores from all 5 slots');
}

// 3) How forgiving are power and aim? ---------------------------------------
function window1d(fn, lo, hi, step) {
  const hits = [];
  for (let k = lo; k <= hi + 1e-9; k += step) hits.push(fn(k) ? 1 : 0);
  return hits;
}
function span(hits, lo, step) {
  const idx = hits.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return 'none';
  return `${(lo + idx[0] * step).toFixed(2)}..${(lo + idx[idx.length - 1] * step).toFixed(2)} (${idx.length} hits of ${hits.length})`;
}
for (const slot of [0, 2]) {
  const step = 0.01, lo = 0.6;
  const hits = window1d(k => {
    const { w, log } = newWorld(); shoot(w, w.balls[slot], k, 0); run(w, 4); return log.scores.length > 0;
  }, lo, 1.5, step);
  console.log(`  slot ${slot}: flick-speed ratio that scores: ${span(hits, lo, step)}`);
  if (slot === 2) {
    const around = hits.slice(Math.round((0.9 - lo) / step), Math.round((1.1 - lo) / step) + 1);
    const rate = around.reduce((a, b) => a + b, 0) / around.length;
    ok(rate > 0.8, `±10% flick speed around ideal scores ${(rate * 100).toFixed(0)}% of the time (want >80%)`);
  }
}
{
  const step = 4, lo = -80;
  const hits = window1d(a => {
    const { w, log } = newWorld(); shoot(w, w.balls[2], 1.0, a); run(w, 4); return log.scores.length > 0;
  }, lo, 80, step);
  console.log(`  aim offset (screen px at hoop height) that scores: ${span(hits, lo, step)}`);
}
// Power is automatic: any normal swipe speed, soft or hard, scores when aimed well
{
  let all = true;
  for (const k of [0.4, 0.6, 1.0, 1.5, 2.0, 2.6]) for (const slot of [0, 1, 2, 3, 4]) {
    const { w, log } = newWorld(); shoot(w, w.balls[slot], k, 0); run(w, 4);
    if (log.scores.length !== 1) { all = false; console.log('  no score at speed ratio', k, 'slot', slot); }
  }
  ok(all, 'soft and hard swipes (0.4x-2.6x) aimed at the hoop all score from every slot');
}
// Too-weak flick is rejected (ball just goes back to the rack)
{
  const { w } = newWorld();
  ok(P.launchVelocity(w.balls[2], w.hoop, 0, -100) === null, 'tiny flick is ignored');
  ok(P.launchVelocity(w.balls[2], w.hoop, 0, 2000) === null, 'downward flick is ignored');
}

// 4) Entry angle of ideal shot ---------------------------------------------
{
  const { w } = newWorld();
  const b = w.balls[2];
  shoot(w, b, 1.0, 0);
  let prev = null, ang = null;
  for (let t = 0; t < 3 && b.state === 'flight'; t += C.FIXED_DT) {
    const py = b.y; w.step(C.FIXED_DT);
    if (py > w.hoop.y && b.y <= w.hoop.y) ang = Math.atan2(-b.vy, Math.hypot(b.vx, b.vz)) * 180 / Math.PI;
  }
  ok(ang > 40, `ideal shot enters hoop descending at ${ang && ang.toFixed(1)}° (want >40°)`);
}

// 5) Balls always come back --------------------------------------------------
{
  const { w } = newWorld();
  for (let i = 0; i < 5; i++) shoot(w, w.balls[i], 0.8 + i * 0.1, i * 6 - 12);
  run(w, 12);
  ok(w.balls.every(b => b.state === 'ready'), 'all balls return to the rack within 12 s');
}

// 6) Frame-rate independence: 60 Hz vs 144 Hz updates give the same result ---
{
  const A = newWorld(), B = newWorld();
  shoot(A.w, A.w.balls[1], 1.03, 5); shoot(B.w, B.w.balls[1], 1.03, 5);
  for (let t = 0; t < 3; t += 1 / 60) A.w.update(1 / 60);
  for (let t = 0; t < 3; t += 1 / 144) B.w.update(1 / 144);
  ok(JSON.stringify(A.log) === JSON.stringify(B.log), `same outcome at 60Hz and 144Hz (${JSON.stringify(A.log)})`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
