/* content.js — game modes, ball skins, court themes and trophies (pure data + tiny predicates). */
const Content = (() => {
  'use strict';

  // hoop speeds were tuned with tests/balance.js: ~20% hit rate if you ignore the motion, ~47% half-leading, ~63% leading well.
  // hoop: list of steps; the last step whose `score` threshold is reached is active.
  const MODES = [
    { id: 'classic', time: 60, timer: true, bonusTime: 10, lives: 0, coinMult: 1,
      hoop: [{ score: 30, amp: 0.6, speed: 0.9 }, { score: 70, amp: 0.8, speed: 1.2 }] },
    { id: 'rush', time: 30, timer: true, bonusTime: 0, lives: 0, coinMult: 1.2,
      addTime: { swish: 3, other: 2 }, maxTime: 60,
      hoop: [{ score: 25, amp: 0.6, speed: 0.9 }, { score: 60, amp: 0.7, speed: 1.0 }] },
    { id: 'sudden', time: 0, timer: false, bonusTime: 0, lives: 3, coinMult: 1.3,
      hoop: [{ score: 12, amp: 0.6, speed: 0.9 }, { score: 30, amp: 0.7, speed: 1.0 }, { score: 55, amp: 0.8, speed: 1.2 }] },
    { id: 'moving', time: 60, timer: true, bonusTime: 10, lives: 0, coinMult: 1.5,
      hoop: [{ score: 0, amp: 0.7, speed: 1.0 }, { score: 30, amp: 0.8, speed: 1.2 }, { score: 60, amp: 0.9, speed: 1.5 }] },
  ];

  const BALLS = [
    { id: 'classic', price: 0,   hi: '#ffb066', mid: '#f26a14', lo: '#8a2c04', seam: '#1b0a02' },
    { id: 'neon',    price: 150, hi: '#b8fbff', mid: '#19c8e6', lo: '#07586a', seam: '#02222a' },
    { id: 'bubble',  price: 150, hi: '#ffc9e8', mid: '#ff4fa8', lo: '#8f1357', seam: '#3a0a24' },
    { id: 'gold',    price: 300, hi: '#fff3b0', mid: '#ffc21a', lo: '#8a5d00', seam: '#3a2600' },
    { id: 'galaxy',  price: 300, hi: '#dcbcff', mid: '#7a2fe0', lo: '#2a0a63', seam: '#12042e' },
    { id: 'chrome',  price: 450, hi: '#c9d0e0', mid: '#4a5163', lo: '#10131a', seam: '#e6ecf8' },
    { id: 'lava',    price: 600, hi: '#fff0a0', mid: '#ff3b00', lo: '#5a0d00', seam: '#240500', fire: true },
  ];

  const COURTS = [
    { id: 'neon', price: 0, p: {
      wall: ['#0d041c', '#25093f', '#4a1370'], glow: 'rgba(255,46,147,0.45)', glow2: 'rgba(120,40,200,0.18)', ray: 'rgba(255,120,220,0.045)',
      grid: 'rgba(160,110,255,0.10)', stripeA: '#19f0ff', stripeB: '#ff2e93', floor: ['#3b1062', '#1c0a38', '#0a0418'],
      floorGrid: 'rgba(25,240,255,0.2)', lane: '#ff2e93', laneFill: 'rgba(255,46,147,0.14)', cage: 'rgba(25,240,255,0.16)', cageGlow: '#19f0ff',
      tray: ['#3a1a66', '#10061f'], trayEdge: '#ff2e93', trayLine: 'rgba(25,240,255,0.55)' } },
    { id: 'sunset', price: 250, p: {
      wall: ['#240a3a', '#9c2a5a', '#ff8a3d'], glow: 'rgba(255,190,80,0.55)', glow2: 'rgba(255,90,90,0.2)', ray: 'rgba(255,220,150,0.06)',
      grid: 'rgba(255,200,140,0.10)', stripeA: '#ffd23f', stripeB: '#ff4d7a', floor: ['#5a1b3a', '#2a0c28', '#12061a'],
      floorGrid: 'rgba(255,200,100,0.22)', lane: '#ffd23f', laneFill: 'rgba(255,210,63,0.12)', cage: 'rgba(255,200,120,0.16)', cageGlow: '#ffd23f',
      tray: ['#5a2548', '#1a0a1f'], trayEdge: '#ffd23f', trayLine: 'rgba(255,140,90,0.6)' } },
    { id: 'arctic', price: 350, p: {
      wall: ['#041a33', '#0f4a7d', '#3a9ccc'], glow: 'rgba(170,235,255,0.5)', glow2: 'rgba(80,150,255,0.2)', ray: 'rgba(200,240,255,0.06)',
      grid: 'rgba(190,235,255,0.12)', stripeA: '#ffffff', stripeB: '#6fe3ff', floor: ['#14577f', '#0a2c4a', '#04101f'],
      floorGrid: 'rgba(200,240,255,0.25)', lane: '#9be8ff', laneFill: 'rgba(155,232,255,0.14)', cage: 'rgba(200,240,255,0.18)', cageGlow: '#9be8ff',
      tray: ['#1b5f8a', '#071a2e'], trayEdge: '#9be8ff', trayLine: 'rgba(255,255,255,0.5)' } },
    { id: 'matrix', price: 450, p: {
      wall: ['#010a05', '#06301a', '#0d5a2d'], glow: 'rgba(60,255,140,0.4)', glow2: 'rgba(0,120,60,0.2)', ray: 'rgba(120,255,170,0.05)',
      grid: 'rgba(80,255,150,0.12)', stripeA: '#39ff88', stripeB: '#19f0ff', floor: ['#0c4a26', '#052313', '#010a05'],
      floorGrid: 'rgba(60,255,140,0.22)', lane: '#39ff88', laneFill: 'rgba(57,255,136,0.12)', cage: 'rgba(60,255,140,0.16)', cageGlow: '#39ff88',
      tray: ['#0f4a2a', '#03120a'], trayEdge: '#39ff88', trayLine: 'rgba(25,240,255,0.5)' } },
  ];

  // Trophies. `s` = { stats (already updated with this round), round: {mode,score,maxStreak,made,shots,swishes} }
  const ACH = [
    { id: 'first',    reward: 20,  test: s => s.stats.made >= 1 },
    { id: 'swish10',  reward: 40,  test: s => s.stats.swishes >= 10 },
    { id: 'swish100', reward: 150, test: s => s.stats.swishes >= 100 },
    { id: 'streak5',  reward: 40,  test: s => s.round.maxStreak >= 5 },
    { id: 'streak10', reward: 120, test: s => s.round.maxStreak >= 10 },
    { id: 'score40',  reward: 60,  test: s => s.round.score >= 40 },
    { id: 'score80',  reward: 200, test: s => s.round.score >= 80 },
    { id: 'games10',  reward: 50,  test: s => s.stats.games >= 10 },
    { id: 'sharp',    reward: 80,  test: s => s.round.shots >= 10 && s.round.made / s.round.shots >= 0.7 },
    { id: 'rush40',   reward: 100, test: s => s.round.mode === 'rush' && s.round.score >= 40 },
    { id: 'sudden25', reward: 100, test: s => s.round.mode === 'sudden' && s.round.score >= 25 },
    { id: 'moving30', reward: 100, test: s => s.round.mode === 'moving' && s.round.score >= 30 },
  ];

  const by = list => id => list.find(x => x.id === id) || list[0];
  return { MODES, BALLS, COURTS, ACH, mode: by(MODES), ball: by(BALLS), court: by(COURTS) };
})();

if (typeof module !== 'undefined') module.exports = Content;
