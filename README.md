# Basketball Arcade

Flick the ball, sink the hoop, beat the clock. A neon arcade basketball game for the web and Android.
Plain HTML/CSS/JS on a canvas. No frameworks, no build step, no external assets, no network access.

**Play:** open `index.html` in a browser (works from disk, phones and tablets included).

## Features
- **4 game modes**, each with its own high score
  - **Classic** — 60 s, the last 10 s are double points
  - **Beat the Clock** — start with 30 s, every basket adds time (swish +3 s)
  - **Sudden Death** — 3 misses and it is over, the hoop gets wilder as you score
  - **Moving Hoop** — 60 s with a moving hoop, 50% more coins
- Real 3D ball physics (sphere vs. torus rim, backboard, net), swishes, bank shots, streaks, fire ball
- **Progression:** coins for every round, daily login bonus, 12 trophies, lifetime stats
- **Shop:** 7 ball skins and 4 court themes (Neon Night, Sunset Beach, Arctic Ice, Matrix)
- English, **Persian (RTL)** and Spanish; follows the device language
- Pause (button, `Esc`/`P`, Android Back), haptics, sound effects synthesised with Web Audio
- Reduced-motion support, first-run tutorial hint, progress saved on the device

## Controls
Drag a ball and flick it up at the hoop. A faster flick throws harder; the direction you flick is where it goes.
Keys: `Esc` back/pause, `P` pause, `M` mute.

## Project layout
| Path | What |
|---|---|
| `index.html`, `style.css` | page and DOM screens (em-based, scales with the canvas) |
| `js/content.js` | modes, balls, courts, trophies (data) |
| `js/rules.js` | scoring, coins, trophies, daily bonus (pure functions) |
| `js/i18n.js`, `js/storage.js` | translations; versioned save file |
| `js/physics.js` | 3D physics and the flick-to-throw mapping (all feel constants in `C`) |
| `js/input.js`, `js/render.js`, `js/audio.js`, `js/ui.js`, `js/game.js` | input, canvas drawing, sound, screens, game loop |
| `tests/` | `node tests/physics.test.js`, `node tests/logic.test.js`, `node tests/balance.js` |
| `android/` | WebView wrapper and no-Gradle build script (see below) |

## Tuning
- Feel: `js/physics.js` → `C` (`GRAVITY`, `LAUNCH_ANGLE`, `SP_IDEAL`, `POWER_GAIN`, `AIM_GAIN`, `LEAD_ASSIST`, ...).
- Modes, prices, hoop speeds: `js/content.js`. Run `node tests/balance.js 1 '[["name",amp,speed]]'` to see hit rates for a hoop setting.
- Points and coin formulas: `js/rules.js`.
- Add a language: add a block in `js/i18n.js` with every key (the tests fail if a key is missing).

## Android
```bash
powershell -File android\build.ps1        # -> android\BasketballArcade.apk (signed)
```
Needs a JDK 17 and the Android SDK (build-tools + a platform); see `CLAUDE.md`. Store art is in `android/assets`
(icon, feature graphic, screenshots in en/fa/es) and store text in `android/assets/store-listing.md`.
The game uses no permissions except `VIBRATE`, collects no data and makes no network requests.
