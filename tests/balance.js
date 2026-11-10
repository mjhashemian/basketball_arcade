// Success rate vs how well the player leads a moving hoop. node balance.js [leadAssist]
const P = require('../js/physics.js'); const C = P.C;
if (process.argv[2]) C.LEAD_ASSIST = parseFloat(process.argv[2]);
function trial(amp, speed, leadFactor, powerNoise, aimNoisePx) {
  const w = P.createWorld({}); let made = 0; w.balls.forEach(() => 0);
  const w2 = P.createWorld({ score: () => made++ });
  w2.setHoopMotion(amp, speed);
  const warm = Math.random() * 12; for (let t = 0; t < warm; t += C.FIXED_DT) w2.step(C.FIXED_DT);
  const b = w2.balls[Math.floor(Math.random() * 5)], h = w2.hoop;
  const T = 1.15;
  const futureX = amp * Math.sin(h.phase + speed * T);
  const targetX = h.x + (futureX - h.x) * leadFactor;
  const hs = P.project(targetX, h.y, h.z), bs = P.project(b.x, b.y, b.z);
  const nz = () => (Math.random() - 0.5) * 2;
  const dx = hs.x - bs.x + nz() * aimNoisePx, dy = hs.y - bs.y, l = Math.hypot(dx, dy);
  const sp = C.SP_IDEAL * (1 + nz() * powerNoise);
  const v = P.launchVelocity(b, h, dx / l * sp, dy / l * sp);
  w2.launch(b, v);
  for (let t = 0; t < 4; t += C.FIXED_DT) w2.step(C.FIXED_DT);
  return made > 0;
}
const N = 400, AN = parseFloat(process.env.AIMNOISE || 15);
const rate = (amp, speed, lead, pn, an) => { let k = 0; for (let i = 0; i < N; i++) if (trial(amp, speed, lead, pn, an)) k++; return Math.round(100 * k / N); };
console.log('LEAD_ASSIST', C.LEAD_ASSIST, ' (success %, human noise: power ±8%, aim ±' + AN + 'px)');
console.log('level                      no lead | half lead | full lead');
const cfgs = JSON.parse(process.argv[3] || '[]');
for (const [name, amp, sp] of cfgs) {
  console.log(name.padEnd(26), String(rate(amp, sp, 0, .08, AN)).padStart(5) + '% ', String(rate(amp, sp, .5, .08, AN)).padStart(8) + '% ', String(rate(amp, sp, 1, .08, AN)).padStart(8) + '%');
}
