/* physics.js — ball physics + throw mapping.
 *
 * The world is real 3D (x right, y up, z away from the player, metres-ish)
 * rendered with a simple perspective camera. Ball = sphere, rim = torus,
 * backboard = finite rectangle. No DOM access, so it also runs in Node
 * (see tests/physics.test.js).
 */
const Physics = (() => {
  'use strict';

  // ------------------------------------------------------------------
  // TUNABLES — change these to alter the feel of the game
  // ------------------------------------------------------------------
  const C = {
    GRAVITY: 15,            // m/s^2. Higher = faster, snappier arcs.
    BALL_R: 0.15,
    RIM_R: 0.30,               // rim radius (ball:rim diameter ratio = 1:2)
    RIM_TUBE: 0.025,
    HOOP_Y: 2.8,
    HOOP_Z: 6.0,
    BOARD_GAP: 0.07,        // gap between back of rim and backboard
    BOARD_HALF_W: 0.95,
    BOARD_DOWN: 0.30,       // board extends this far below rim height
    BOARD_UP: 0.85,         // ... and this far above
    REST_RIM: 0.58,         // bounciness of rim   (0 = dead, 1 = perfect)
    REST_BOARD: 0.55,       // bounciness of backboard
    REST_FLOOR: 0.55,
    REST_WALL: 0.50,
    WALL_X: 2.1,            // invisible cage walls
    BACK_Z: 9.4,
    FRONT_Z: 1.3,
    NET_DEPTH: 0.5,
    MISS_DEPTH: 0.7,        // a ball falling this far below the rim without scoring is a miss
    NET_DRAG: 2.2,          // how much the net slows a falling ball
    // --- throw mapping ---
    LAUNCH_ANGLE: 68 * Math.PI / 180, // fixed elevation of every throw
    SP_IDEAL: 1900,         // flick speed (logical px/s) that hits dead centre
    SP_MIN: 380,            // slower than this = ball is just put back
    SP_MAX: 5200,
    POWER_SWAY: 0.012,       // swipe speed barely matters: the throw is auto-powered to reach the hoop; a full-range swipe only shifts power by +-1.2%
    AIM_GAIN: 0.9,         // same idea for left/right aim assist
    AIM_BAND: 0.25,         // radians
    LEAD_ASSIST: 0.5,       // how much of a moving hoop's lead is done for you (1 = aims at where it will be)
    AIM_DIST_BIAS: 1.03,    // >1 aims a little long (more backboard)
    // --- rack / return ---
    SLOTS_X: [-0.68, -0.34, 0, 0.34, 0.68],
    SLOT_Y: 0.30,
    SLOT_Z: 2.4,
    FIXED_DT: 1 / 240,
    MAX_FLIGHT: 7,          // seconds before a stuck ball is force-returned
  };

  const W = 600, H = 900;   // logical canvas size
  const CAM = { x: 0, y: 1.0, z: 0, f: 800, cx: 300, cy: 500 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function project(x, y, z, out) {
    const s = CAM.f / (z - CAM.z);
    out = out || {};
    out.x = CAM.cx + (x - CAM.x) * s;
    out.y = CAM.cy - (y - CAM.y) * s;
    out.s = s;
    return out;
  }
  function unproject(sx, sy, z) {
    const s = CAM.f / (z - CAM.z);
    return { x: CAM.x + (sx - CAM.cx) / s, y: CAM.y - (sy - CAM.cy) / s, z };
  }

  // Flattens response near the sweet spot but stays 1:1 far from it.
  function soften(d, gain, band) {
    const k = Math.min(1, Math.abs(d) / band);
    return d * (gain + (1 - gain) * k * k);
  }

  // Launch speed that makes a ball at p pass through (tx,ty,tz) at fixed elevation.
  function idealSpeed(px, py, pz, tx, ty, tz, phi) {
    const dh = Math.hypot(tx - px, tz - pz) * C.AIM_DIST_BIAS;
    const dy = ty - py;
    const c = Math.cos(phi), t = Math.tan(phi);
    const den = 2 * c * c * (dh * t - dy);
    if (den <= 0) return null;
    const v = Math.sqrt(C.GRAVITY * dh * dh / den);
    return { v, T: dh / (v * c) };
  }

  /**
   * Convert a flick (screen velocity in logical px/s) to a 3D launch velocity.
   * p = ball world position. Returns null when the flick is too weak / not upward.
   */
  function launchVelocity(p, hoop, fx, fy) {
    let sp = Math.hypot(fx, fy);
    if (fy >= 0 || sp < C.SP_MIN) return null;
    sp = Math.min(sp, C.SP_MAX);
    const phi = C.LAUNCH_ANGLE;

    // --- aim: where on screen the flick line crosses the hoop's height ---
    const th = clamp(Math.atan2(fx, -fy), -1.2, 1.2);
    const hs = project(hoop.x, hoop.y, hoop.z);
    const bs = project(p.x, p.y, p.z);
    const sx = bs.x + Math.tan(th) * (bs.y - hs.y);
    const X = CAM.x + (sx - CAM.cx) / hs.s;
    const yawRaw = Math.atan2(X - p.x, hoop.z - p.z);

    // assist target = hoop position part-way into its motion
    let id = idealSpeed(p.x, p.y, p.z, hoop.x, hoop.y, hoop.z, phi);
    if (!id) return null;
    const tx = hoop.x + (hoop.vx || 0) * id.T * C.LEAD_ASSIST;
    const yawT = Math.atan2(tx - p.x, hoop.z - p.z);
    const yaw = yawT + soften(yawRaw - yawT, C.AIM_GAIN, C.AIM_BAND);

    // --- power ---
    id = idealSpeed(p.x, p.y, p.z, tx, hoop.y, hoop.z, phi);
    // power is automatic: a hard or soft swipe only nudges it, so the player concentrates on aim
    const r = 1 + clamp(sp / C.SP_IDEAL - 1, -1, 1) * C.POWER_SWAY;
    const v = id.v * r;

    const ch = Math.cos(phi);
    return {
      vx: v * ch * Math.sin(yaw),
      vy: v * Math.sin(phi),
      vz: v * ch * Math.cos(yaw),
      power: clamp(sp / (C.SP_IDEAL * 1.6), 0, 1),
    };
  }

  // ------------------------------------------------------------------
  // World
  // ------------------------------------------------------------------
  function createWorld(events) {
    const ev = events || {};
    const emit = (n, a, b) => { if (ev[n]) ev[n](a, b); };

    const hoop = {
      x: 0, y: C.HOOP_Y, z: C.HOOP_Z, vx: 0,
      phase: 0, amp: 0, ampTarget: 0, speed: 0, speedTarget: 0,
      shake: 0, swing: 0,
    };
    const balls = C.SLOTS_X.map((sx, i) => ({
      id: i,
      home: { x: sx, y: C.SLOT_Y, z: C.SLOT_Z },
      x: sx, y: C.SLOT_Y, z: C.SLOT_Z,
      vx: 0, vy: 0, vz: 0,
      state: 'ready',          // ready | held | flight | return
      rot: 0, spin: 0,
      thrown: false, scored: false, tainted: false, missed: false,
      touchedRim: false, touchedBoard: false,
      bounces: 0, flightT: 0,
      rt: 0, rdur: 0.5, from: null, cancelled: false,
    }));

    let acc = 0;
    const zBoard = () => hoop.z + C.RIM_R + C.BOARD_GAP;

    function setHome(b) {
      b.x = b.home.x; b.y = b.home.y; b.z = b.home.z;
      b.vx = b.vy = b.vz = 0;
    }

    function reset() {
      for (const b of balls) {
        setHome(b);
        b.state = 'ready'; b.thrown = b.scored = b.tainted = b.missed = false;
        b.touchedRim = b.touchedBoard = false; b.bounces = 0; b.flightT = 0;
      }
      hoop.x = hoop.vx = hoop.phase = hoop.amp = hoop.ampTarget = 0;
      hoop.speed = hoop.speedTarget = hoop.shake = hoop.swing = 0;
    }

    function setHoopMotion(amp, speed) { hoop.ampTarget = amp; hoop.speedTarget = speed; }

    function hold(b) { b.state = 'held'; }

    // Send a ball back to its rack slot (cancelled throw or end of flight).
    function sendHome(b, quick) {
      b.state = 'return';
      b.rt = 0;
      b.from = { x: b.x, y: b.y, z: b.z };
      const d = Math.hypot(b.from.x - b.home.x, b.from.z - b.home.z);
      b.rdur = quick ? 0.25 : clamp(0.4 + d * 0.11, 0.5, 0.95);
    }

    function markMiss(b) {
      if (b.thrown && !b.scored && !b.missed) { b.missed = true; emit('miss', b); }
    }

    function endFlight(b) {
      sendHome(b, false);
      markMiss(b);          // safety net: a ball that never fell past the net (timeout, stuck on the rim)
    }

    function launch(b, v) {
      b.state = 'flight';
      b.vx = v.vx; b.vy = v.vy; b.vz = v.vz;
      b.thrown = true; b.scored = b.tainted = b.missed = false;
      b.touchedRim = b.touchedBoard = false;
      b.bounces = 0; b.flightT = 0;
      b.spin = (Math.random() - 0.5) * 6 + v.vx * 2;
    }

    // ---- collisions ----
    function collideRim(b) {
      const R = C.RIM_R, minD = C.BALL_R + C.RIM_TUBE;
      let dx = b.x - hoop.x, dz = b.z - hoop.z;
      let L = Math.hypot(dx, dz);
      if (L < 1e-6) { dx = 0; dz = -1; L = 1; }
      const qx = hoop.x + dx / L * R, qz = hoop.z + dz / L * R;
      const nx = b.x - qx, ny = b.y - hoop.y, nz = b.z - qz;
      const d = Math.hypot(nx, ny, nz);
      if (d >= minD || d < 1e-9) return;
      const ux = nx / d, uy = ny / d, uz = nz / d;
      const pen = minD - d;
      b.x += ux * pen; b.y += uy * pen; b.z += uz * pen;
      const vn = (b.vx - hoop.vx) * ux + b.vy * uy + b.vz * uz;
      if (vn < 0) {
        const j = -(1 + C.REST_RIM) * vn;
        b.vx += ux * j; b.vy += uy * j; b.vz += uz * j;
        // a little rolling friction so the ball "rattles" and settles
        b.vx *= 0.985; b.vz *= 0.985;
        if (-vn > 0.5) {
          b.touchedRim = true;
          hoop.shake = Math.min(1, Math.max(hoop.shake, -vn / 9));
          emit('rim', -vn, b);
        }
      }
    }

    function collideBoard(b) {
      const zb = zBoard();
      const x0 = hoop.x - C.BOARD_HALF_W, x1 = hoop.x + C.BOARD_HALF_W;
      const y0 = hoop.y - C.BOARD_DOWN, y1 = hoop.y + C.BOARD_UP;
      const cx = clamp(b.x, x0, x1), cy = clamp(b.y, y0, y1);
      const dx = b.x - cx, dy = b.y - cy, dz = b.z - zb;
      const d = Math.hypot(dx, dy, dz);
      if (d >= C.BALL_R) return;
      let ux, uy, uz;
      if (d < 1e-9) { ux = 0; uy = 0; uz = b.z < zb ? -1 : 1; }
      else { ux = dx / d; uy = dy / d; uz = dz / d; }
      const pen = C.BALL_R - d;
      b.x += ux * pen; b.y += uy * pen; b.z += uz * pen;
      const vn = (b.vx - hoop.vx) * ux + b.vy * uy + b.vz * uz;
      if (vn < 0) {
        const j = -(1 + C.REST_BOARD) * vn;
        b.vx += ux * j; b.vy += uy * j; b.vz += uz * j;
        b.vx *= 0.97; b.vy *= 0.97;
        if (-vn > 0.5) {
          b.touchedBoard = true;
          emit('board', -vn, b);
        }
      }
    }

    function netEffects(b, dt) {
      const dx = b.x - hoop.x, dz = b.z - hoop.z;
      if (b.y < hoop.y + 0.02 && b.y > hoop.y - C.NET_DEPTH - 0.1 &&
          dx * dx + dz * dz < C.RIM_R * C.RIM_R) {
        b.vy *= Math.exp(-C.NET_DRAG * dt * (b.vy < 0 ? 1 : 0.3));
        b.vx *= Math.exp(-3 * dt); b.vz *= Math.exp(-3 * dt);
        b.vx -= dx * 18 * dt; b.vz -= dz * 18 * dt;   // net funnels toward the centre
      }
    }

    function stepBall(b, dt) {
      const pxp = b.x, pyp = b.y, pzp = b.z;
      b.flightT += dt;
      b.vy -= C.GRAVITY * dt;
      netEffects(b, dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.rot += b.spin * dt;

      collideBoard(b);
      collideRim(b);

      // cage walls
      const wx = C.WALL_X - C.BALL_R;
      if (b.x > wx) { b.x = wx; b.vx = -Math.abs(b.vx) * C.REST_WALL; }
      else if (b.x < -wx) { b.x = -wx; b.vx = Math.abs(b.vx) * C.REST_WALL; }
      if (b.z > C.BACK_Z - C.BALL_R) { b.z = C.BACK_Z - C.BALL_R; b.vz = -Math.abs(b.vz) * 0.2; }
      if (b.z < C.FRONT_Z) { b.z = C.FRONT_Z; b.vz = Math.abs(b.vz) * C.REST_WALL; }

      // ---- scoring / disqualification (uses swept crossing of the rim plane) ----
      const hy = hoop.y;
      if (pyp > hy && b.y <= hy) {                      // crossed DOWNWARD
        const t = (pyp - hy) / (pyp - b.y);
        const cx = pxp + (b.x - pxp) * t - hoop.x;
        const cz = pzp + (b.z - pzp) * t - hoop.z;
        if (!b.scored && !b.tainted && cx * cx + cz * cz < C.RIM_R * C.RIM_R) {
          b.scored = true;
          hoop.swing = 1;
          emit('score', {
            ball: b,
            kind: b.touchedRim ? 'rim' : (b.touchedBoard ? 'bank' : 'swish'),
          });
        }
      } else if (pyp < hy && b.y >= hy) {               // crossed UPWARD
        const cx = pxp + (b.x - pxp) - hoop.x, cz = pzp + (b.z - pzp) - hoop.z;
        if (cx * cx + cz * cz < (C.RIM_R + C.BALL_R) * (C.RIM_R + C.BALL_R)) b.tainted = true;
      }

      // fell past the net without scoring => miss (reported immediately, not when it finally stops rolling)
      if (!b.scored && b.vy < 0 && b.y < hy - C.MISS_DEPTH) markMiss(b);

      // floor
      if (b.y < C.BALL_R) {
        b.y = C.BALL_R;
        if (b.vy < 0) {
          const impact = -b.vy;
          b.vy = impact * C.REST_FLOOR;
          if (impact < 1.4) b.vy = 0;
          b.vx *= 0.88; b.vz *= 0.88;
          b.bounces++;
          if (impact > 1.2) emit('floor', impact, b);
        }
        const k = Math.exp(-2.0 * dt); b.vx *= k; b.vz *= k;
      }

      const onFloor = b.y <= C.BALL_R + 1e-4;
      const hs = Math.hypot(b.vx, b.vz);
      if ((onFloor && (b.bounces >= 2 || hs < 0.5) && b.vy < 0.5) ||
          b.flightT > C.MAX_FLIGHT) endFlight(b);
    }

    function stepReturn(b, dt) {
      b.rt += dt;
      const u = clamp(b.rt / b.rdur, 0, 1);
      const e = u * u * (3 - 2 * u);
      const f = b.from;
      b.x = f.x + (b.home.x - f.x) * e;
      b.z = f.z + (b.home.z - f.z) * e;
      const yFloor = Math.max(C.BALL_R, Math.min(f.y, b.home.y));
      b.y = (f.y > b.home.y ? f.y : yFloor) + (b.home.y - (f.y > b.home.y ? f.y : yFloor)) * e;
      b.rot += dt * 9;
      if (u >= 1) {
        setHome(b);
        b.state = 'ready';
        emit('ready', b);
      }
    }

    function step(dt) {
      hoop.amp += (hoop.ampTarget - hoop.amp) * Math.min(1, dt * 1.2);
      hoop.speed += (hoop.speedTarget - hoop.speed) * Math.min(1, dt * 1.2);
      if (hoop.amp > 0.0005) {
        hoop.phase += hoop.speed * dt;
        hoop.x = hoop.amp * Math.sin(hoop.phase);
        hoop.vx = hoop.amp * hoop.speed * Math.cos(hoop.phase);
      } else { hoop.x = 0; hoop.vx = 0; }
      hoop.shake *= Math.exp(-6 * dt);
      hoop.swing *= Math.exp(-1.6 * dt);
      for (const b of balls) {
        if (b.state === 'flight') stepBall(b, dt);
        else if (b.state === 'return') stepReturn(b, dt);
      }
    }

    // Variable frame time in, fixed 240 Hz steps out => identical on 60/120/144 Hz.
    function update(dt) {
      acc += Math.min(dt, 0.1);
      while (acc >= C.FIXED_DT) { step(C.FIXED_DT); acc -= C.FIXED_DT; }
    }

    return { hoop, balls, reset, setHoopMotion, hold, sendHome, launch, update, step, zBoard };
  }

  return { C, CAM, W, H, project, unproject, createWorld, launchVelocity, idealSpeed, soften };
})();

if (typeof module !== 'undefined') module.exports = Physics;
