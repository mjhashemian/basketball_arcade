# Basketball Arcade

Plain HTML/CSS/JS canvas arcade basketball game (4 modes, shop, trophies, 3 languages), plus a no-Gradle Android WebView wrapper.
No frameworks, no build step, no external assets. Open `index.html` to run it.

## Layout
- `index.html`, `style.css`: page and DOM screens (home, modes, shop, trophies, settings, countdown, pause, game over). Sized in `em` (1em = 10 logical px; `ui.js` sets the stage font-size). Buttons must keep `font-size: inherit` or every em inside them is wrong.
- `js/` is loaded as classic `<script>` tags in this order (ES modules would break `file://`): `content` → `rules` → `i18n` → `storage` → `audio` → `physics` → `input` → `render` → `ui` → `game`. Each exposes one global (`Content`, `Rules`, `I18n`, `Save`, `Sfx`/`Haptics`, `Physics`, `Input`, `Renderer`, `UI`).
- `js/content.js` (modes, balls, courts, trophies) and `js/rules.js` (points, coins, trophies, daily bonus) are pure data/functions and are unit-tested in Node. Put game rules there, not in `game.js`.
- `js/physics.js`: real 3D world (sphere ball, torus rim, rectangle backboard) drawn with a perspective camera. Fixed 240 Hz step in an accumulator. No DOM access. All feel constants are in the `C` object. Emits `score` and `miss` (a miss fires as soon as a ball falls past the net, not when it stops rolling; Sudden Death depends on this).
- `js/game.js`: state machine (menu → countdown → playing ⇄ paused → ending → over), mode logic, progression, main loop. `window.BA.back()` is called by the Android Back button. `window.__hoops` (debug hook for tests) exists only when the URL contains `?debug`.
- `js/storage.js`: one versioned save object (`basketballarcade.save.v1`); sanitises corrupt or tampered data on load.
- `js/i18n.js`: English, Persian (RTL) and Spanish. Every key must exist in all three.
- `tests/`: `e2e/audit.js` (full browser audit: real input, all modes, shop, i18n, layouts, corrupt saves) and `e2e/monkey.js` (random-input crash test; both need Chrome), `physics.test.js`, `logic.test.js` (rules, content, i18n parity, save, miss detection), `balance.js` (hit-rate tool for hoop speeds).
- `android/`: WebView wrapper, package `com.basketballarcade.game`. `android/assets/` holds store images and `store-listing.md` only; they are not packaged into the APK.

## Rules to keep
- A basket counts only on a downward crossing of the rim plane. A ball that goes up through the hoop is disqualified for that flight (`tainted`). Do not weaken this; the test suite checks it.
- Throw feel is tuned by `LAUNCH_ANGLE`, `SP_IDEAL`, `POWER_SWAY`, `AIM_GAIN`, `LEAD_ASSIST`. Power is automatic (the throw is solved to reach the hoop; swipe speed only shifts it by +-`POWER_SWAY`), so skill is aim. After changing any, run both physics/logic tests and `node tests/balance.js`: with `AIMNOISE=30 node tests/balance.js` a static hoop should score ~85% (about 60% at AIMNOISE=50) and the moving stage ~35% with a half lead, moving stages ~55-65% when the hoop is led well and ~10-25% when it is ignored.
- Persian is RTL: no letter-spacing, skew or text-stroke on Arabic script (see the `html[lang="fa"]` block in `style.css`), and canvas numbers like `+4` are drawn LTR.
- Never add network calls, analytics or extra permissions: the store listing promises none (only `VIBRATE`).
- Keep the logical canvas 600×900 (2:3). Pointer coordinates are converted to it in `input.js`.
- The round clock accumulates clamped frame time, so a hidden tab pauses it.
- Keep it dependency-free and file://-friendly: no modules, no fetch of local files.
- Progress (coins, unlocks, bests) lives only in the save file. Anything that changes it must call `Save.commit()`.

## Android build
```bash
powershell -File android\build.ps1
```
- Uses the SDK/JDK in `D:\SENAEI-DNS\.local\android` (read-only). It does not need Gradle: aapt2 → javac → d8 → zipalign → apksigner.
- Output: `android/BasketballArcade.apk`. Bump `-VersionCode` on every upload (current default: 3 / "2.0"); the package ID is permanent once published.
- The script normalises aapt2's backslash asset paths and aborts if `assets/www/index.html` or `classes.dex` is missing from the APK. Keep that check: without it the app installs but shows "ERR_FILE_NOT_FOUND".
- Launcher icon: adaptive (`res/mipmap-anydpi-v26`, gradient background + `drawable-nodpi/ic_launcher_foreground.png`) plus legacy PNGs in `res/mipmap-*dpi`. The WebView only loads `file:///android_asset/` URLs.
- Always install and launch the built APK on the emulator (`D:\SENAEI-DNS\.local\android\avd`, AVD `damavand_test`) after changing the build script; a green build does not prove the game loads.
- `android/keystore/` (`release.jks`, `keystore.pw`) is the release signing key. It is gitignored. Never commit it, never print its password, and never regenerate it; losing it means no more updates. The key alias is still `turbohoops`, which is intentional.
- The script copies `index.html`, `style.css` and `js/` into the APK, so rebuild after any web change.
- Google Play needs an `.aab`; this script only makes an `.apk`.

## Testing in a browser
Serve the folder over HTTP (for example `python -m http.server 8123`), open it with `?debug`, and use `__hoops.startMode('classic')`, `__hoops.world`, `__hoops.g`, `__hoops.Save` to drive it. The preview pane must be visible, or `requestAnimationFrame` stops.
