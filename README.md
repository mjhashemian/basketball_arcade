# Basketball Arcade

Open `index.html` in a browser. No build step and no dependencies.
Optional physics tests: `node tests/physics.test.js`.

Drag a ball and flick it at the hoop. You have 60 seconds. Press M to mute.

## Tuning the feel
- `js/physics.js`, the `C` object:
  - `GRAVITY`: arc speed.
  - `LAUNCH_ANGLE`: arc height. Steeper arcs are more forgiving.
  - `SP_IDEAL`: the flick speed that hits dead centre.
  - `POWER_GAIN` and `AIM_GAIN`: how forgiving power and aim are (1 = raw).
  - `REST_RIM`, `REST_BOARD` and `REST_FLOOR`: bounciness.
  - `RIM_R`: hoop size.
- `js/game.js`, `RULES`: points, bonus time, and when the hoop starts moving (`HOOP_MOVE_SCORE`).
