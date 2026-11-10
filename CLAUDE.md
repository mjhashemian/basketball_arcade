# Basketball Arcade

Plain HTML/CSS/JS canvas arcade basketball game (60-second rounds), plus a no-Gradle Android WebView wrapper.
No frameworks, no build step, no external assets. Open `index.html` to run it.

## Layout
- `index.html`, `style.css`: page and DOM overlays (start / countdown / game over). Sized in `em`; `ui.js` sets the stage font-size so 1em = 10 logical px.
- `js/` is loaded as classic `<script>` tags in this order (ES modules would break `file://`): `audio` → `physics` → `input` → `render` → `ui` → `game`. Each exposes one global (`Sfx`, `Physics`, `Input`, `Renderer`, `UI`).
- `js/physics.js`: real 3D world (sphere ball, torus rim, rectangle backboard) drawn with a perspective camera. Fixed 240 Hz step in an accumulator. No DOM access, so Node can load it. All feel constants are in the `C` object at the top.
- `js/game.js`: state machine (menu → countdown → playing → ending → over), scoring `RULES`, main loop. Exposes `window.__hoops` for debugging and automated playtests.
- `tests/physics.test.js`: headless checks. Run `node tests/physics.test.js` after any physics change.
- `android/`: WebView wrapper, package `com.basketballarcade.game`. `android/assets/` holds store images only; they are not packaged into the APK.

## Rules to keep
- A basket counts only on a downward crossing of the rim plane. A ball that goes up through the hoop is disqualified for that flight (`tainted`). Do not weaken this; the test suite checks it.
- Throw feel is tuned by `LAUNCH_ANGLE`, `SP_IDEAL`, `POWER_GAIN`, `AIM_GAIN`. After changing any, re-run the tests: the ±10% flick-speed check must stay above 80% scoring.
- Keep the logical canvas 600×900 (2:3). Pointer coordinates are converted to it in `input.js`.
- The round clock accumulates clamped frame time, so a hidden tab pauses it.
- Keep it dependency-free and file://-friendly: no modules, no fetch of local files.

## Android build
```bash
powershell -File android\build.ps1
```
- Uses the SDK/JDK in `D:\SENAEI-DNS\.local\android` (read-only). It does not need Gradle: aapt2 → javac → d8 → zipalign → apksigner.
- Output: `android/BasketballArcade.apk`. Bump `-VersionCode` on every upload; the package ID is permanent once published.
- `android/keystore/` (`release.jks`, `keystore.pw`) is the release signing key. It is gitignored. Never commit it, never print its password, and never regenerate it; losing it means no more updates. The key alias is still `turbohoops`, which is intentional.
- The script copies `index.html`, `style.css` and `js/` into the APK, so rebuild after any web change.
- Google Play needs an `.aab`; this script only makes an `.apk`.

## Testing in a browser
Serve the folder over HTTP (for example `python -m http.server 8123`) and use `__hoops.startGame()`, `__hoops.world` and `__hoops.g` to drive it. The preview pane must be visible, or `requestAnimationFrame` stops.
