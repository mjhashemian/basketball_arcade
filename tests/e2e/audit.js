// Production audit: drives the real game in headless Chrome (needs Chrome; set CHROME=<path> if not default).
// Usage: node tests/e2e/audit.js
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((q, s) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (q.url.startsWith('/?') || q.url === '/') f = path.join(ROOT, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
}).listen(8127);
const chrome = cp.spawn((process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9337', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'au-')), '--mute-audio', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  let t; for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9337/json')).json(); if (t.find(x => x.type === 'page')) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); let errors = [];
  ws.onmessage = m => { const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) errors.push('CONSOLE ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) { errors.push('EVALERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300)); } return r.result.result?.value; };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
  const click = id => ev(`document.getElementById('${id}').click()`);
  const viewport = (w, h, dsf = 2) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile: w < 700 });
  const load = async (save) => {
    await send('Page.navigate', { url: 'http://localhost:8127/index.html?debug' }); await sleep(900);
    await ev(`localStorage.clear(); ${save ? `localStorage.setItem('basketballarcade.save.v1', ${JSON.stringify(JSON.stringify(save))});` : ''} 0`);
    await send('Page.reload'); await sleep(1100);
  };
  const G = e => ev(`(()=>{const g=__hoops.g,w=__hoops.world;return ${e}})()`);
  // real mouse flick through the real input pipeline
  const flick = async (slot, speed, aimPx = 0, tilt = 0) => {
    const i = await ev(`(()=>{const w=__hoops.world,P=__hoops.Physics,b=w.balls[${slot}],s=P.project(b.x,b.y,b.z),hs=P.project(w.hoop.x,w.hoop.y,w.hoop.z),r=document.getElementById('game').getBoundingClientRect();return {sx:s.x,sy:s.y,hx:hs.x,hy:hs.y,l:r.left,t:r.top,k:r.width/600,st:b.state}})()`);
    if (i.st !== 'ready') return false;
    const dx = i.hx + aimPx - i.sx, dy = i.hy - i.sy, len = Math.hypot(dx, dy);
    const sp2 = speed * 1.13; // the browser pipeline reads ~12% below the true speed of synthetic moves
    const pos = secs => ({ x: i.l + (i.sx + dx / len * sp2 * secs) * i.k, y: i.t + (i.sy + dy / len * sp2 * secs) * i.k });
    let p = pos(0);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    const t0 = Date.now();
    // position follows REAL elapsed time, so the flick really has the requested speed
    for (let el = 0; el < 0.1; el = (Date.now() - t0) / 1000) { p = pos(el); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 }); }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    return true;
  };
  const waitPhase = async (ph, ms = 15000) => { for (let i = 0; i < ms / 100; i++) { if ((await G('g.phase')) === ph) return true; await sleep(100); } return false; };
  const startMode = async id => { await ev(`__hoops.UI.screen('modes'); document.querySelectorAll('#mode-list .card')[${['classic', 'rush', 'sudden', 'moving'].indexOf(id)}].click()`); return waitPhase('playing', 8000); };

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await viewport(360, 540);

  // ===== A. boot, tutorial, real input =====
  await load();
  ok((await G('g.phase')) === 'menu' && (await G(`document.getElementById('screen-home').classList.contains('shown')`)), 'A1 boots to the home screen');
  ok((await G('Save.data.coins')) === 50, 'A2 first launch grants the 50-coin daily bonus');
  await ev(`__hoops.UI.screen('home'); document.getElementById('btn-play').click()`); await sleep(200);
  ok(await G(`document.getElementById('screen-modes').classList.contains('shown')`), 'A3 PLAY opens the mode list with 4 cards: ' + (await G(`document.querySelectorAll('#mode-list .card').length`)));
  ok(await startMode('classic'), 'A4 choosing Classic runs the countdown and starts play');
  ok((await G('g.hint')) === true, 'A5 first-run coach hint is showing');
  let thrown = await flick(2, 1900);
  await sleep(300);
  ok(thrown && (await G('g.shots')) === 1, 'A6 a real mouse flick throws a ball (shots=1)');
  ok((await G('g.hint')) === false && (await G('Save.data.tutorialDone')) === true, 'A7 hint disappears after the first throw and is remembered');
  // tap without flick must not throw
  await sleep(1800);
  const before = await G('g.shots');
  const i2 = await ev(`(()=>{const w=__hoops.world,P=__hoops.Physics,b=w.balls[0],s=P.project(b.x,b.y,b.z),r=document.getElementById('game').getBoundingClientRect();return {x:r.left+s.x*r.width/600,y:r.top+s.y*r.width/600}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: i2.x, y: i2.y, button: 'left', clickCount: 1 });
  await sleep(120); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: i2.x, y: i2.y, button: 'left', clickCount: 1 }); await sleep(400);
  ok((await G('g.shots')) === before && (await G(`w.balls[0].state`)) !== 'held', 'A8 a tap (no flick) does not throw and does not leave the ball stuck');

  // ===== B. pause / back button =====
  const x0 = await G('JSON.stringify(w.balls.map(b=>[b.x,b.y,b.z,b.state]))');
  ok((await ev('BA.back()')) === true && (await G('g.phase')) === 'paused', 'B1 back during play pauses');
  const c0 = await G('g.clock'); await sleep(700);
  ok(Math.abs((await G('g.clock')) - c0) < 0.001, 'B2 the clock is frozen while paused');
  ok(await G(`document.getElementById('screen-pause').classList.contains('shown')`), 'B3 pause menu is visible');
  ok((await ev('BA.back()')) === true && (await G('g.phase')) === 'playing', 'B4 back again resumes');
  await click('btn-pause'); ok((await G('g.phase')) === 'paused', 'B5 on-screen pause button works');
  await click('btn-restart'); await waitPhase('playing', 8000);
  ok((await G('g.score')) === 0 && (await G('g.shots')) === 0, 'B6 restart gives a fresh round');
  await click('btn-pause'); await click('btn-quit');
  ok((await G('g.phase')) === 'menu' && (await ev('BA.back()')) === false, 'B7 quit returns home; back on home lets Android close the app (returns false)');

  // ===== C. Classic full round with real play =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, coins: 0, tutorialDone: true, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await startMode('classic');
  const t0 = Date.now(); const clk0 = await G('g.clock');
  await sleep(3000);
  const drift = ((await G('g.clock')) - clk0) * 1000 - (Date.now() - t0);
  ok(Math.abs(drift) < 250, `C1 round clock tracks real time (drift ${drift.toFixed(0)} ms over 3 s)`);
  for (let i = 0; i < 12; i++) { for (const s of [0, 1, 2, 3, 4]) { if (await flick(s, 1900 * (0.9 + Math.random() * 0.2), (Math.random() - .5) * 50)) break; } await sleep(450); }
  const made = await G('g.made'), shots = await G('g.shots');
  ok(shots >= 8 && made >= 1, `C2 real flicks score: ${made}/${shots}`);
  const score = await G('g.score');
  await ev('__hoops.g.clock = 59.97');
  ok(await waitPhase('over', 10000), 'C3 round ends at 0 and reaches Game Over');
  const d = await G('JSON.stringify(Save.data)'); const sv = JSON.parse(d);
  const exp = Math.max(score > 0 ? 1 : 0, Math.round((await G('g.score') * 0.5 + await G('g.maxStreak')) * 1)) ;
  ok(sv.stats.games === 1 && sv.best.classic === (await G('g.score')) && sv.coins >= exp, `C4 progress saved: score ${sv.best.classic}, coins ${sv.coins}, games ${sv.stats.games}`);
  ok((await G(`document.getElementById('screen-over').classList.contains('shown')`)) && (await G(`document.getElementById('over-score').textContent`)) === String(await G('g.score')), 'C5 game-over screen shows the final score');
  await shot('over-en');
  await send('Page.reload'); await sleep(1100);
  ok((await G('Save.data.best.classic')) === sv.best.classic && (await G('Save.data.coins')) === sv.coins, 'C6 best score and coins survive a reload');

  // ===== D. Sudden Death =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, tutorialDone: true, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await startMode('sudden');
  ok((await G('g.lives')) === 3, 'D1 sudden death starts with 3 lives');
  for (let n = 0; n < 3; n++) { await ev(`(()=>{const w=__hoops.world,b=w.balls.find(b=>b.state==='ready');__hoops.g.shots++;w.launch(b,{vx:1.2,vy:6,vz:1});})()`); await sleep(1500); }
  ok((await G('g.lives')) === 0 && ['ending', 'over'].includes(await G('g.phase')), 'D2 three misses end the round (lives=' + (await G('g.lives')) + ')');
  ok(await waitPhase('over', 8000), 'D3 reaches Game Over');
  ok((await G(`document.getElementById('over-title').textContent`)) === 'GAME OVER', 'D4 shows the GAME OVER title');
  // a made basket must not cost a life
  await click('btn-again'); await waitPhase('playing', 8000);
  await ev(`(()=>{const w=__hoops.world,b=w.balls[2];b.x=0;b.y=4;b.z=w.hoop.z;__hoops.g.shots++;w.launch(b,{vx:0,vy:0,vz:0});})()`); await sleep(1800);
  ok((await G('g.lives')) === 3 && (await G('g.made')) === 1, 'D5 a basket costs no life');

  // ===== E. Beat the Clock =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, tutorialDone: true, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await startMode('rush');
  const tl0 = await G('g.mode.time + g.added - g.clock');
  await ev(`(()=>{const w=__hoops.world,b=w.balls[2];b.x=0;b.y=4;b.z=w.hoop.z;__hoops.g.shots++;w.launch(b,{vx:0,vy:0,vz:0});})()`); await sleep(1500);
  const tl1 = await G('g.mode.time + g.added - g.clock');
  ok((await G('g.added')) === 3 && tl1 > tl0 + 0.5, `E1 a swish adds 3 s (added=${await G('g.added')}, time left ${tl0.toFixed(1)} -> ${tl1.toFixed(1)} after ~1.5 s elapsed)`);
  await ev('__hoops.g.added = 29 + __hoops.g.clock'); await ev(`(()=>{const w=__hoops.world,b=w.balls[1];b.x=0;b.y=4;b.z=w.hoop.z;__hoops.g.shots++;w.launch(b,{vx:0,vy:0,vz:0});})()`); await sleep(1500);
  ok((await G('g.mode.time + g.added - g.clock')) <= 60.2, 'E2 time is capped at 60 s');
  ok((await G('g.bonus')) === false, 'E3 no double-points bonus in this mode');

  // ===== F. Moving Hoop =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, tutorialDone: true, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await startMode('moving'); await sleep(2500);
  const hx = []; for (let i = 0; i < 6; i++) { hx.push(await G('w.hoop.x')); await sleep(300); }
  ok(Math.max(...hx) - Math.min(...hx) > 0.1, 'F1 the hoop moves from the start (' + hx.map(v => v.toFixed(2)).join(',') + ')');
  // a ball launched by the real pipeline at a moving hoop still aims sensibly
  let mk = 0; for (let i = 0; i < 24; i++) { const lead = await G('w.hoop.vx * 1.15 * 0.5 * __hoops.Physics.project(0,w.hoop.y,w.hoop.z).s'); for (const s of [2, 1, 3, 0, 4]) { if (await flick(s, 1900, lead)) break; } await sleep(420); }
  mk = await G('g.made'); ok(mk >= 1, `F2 moving hoop is beatable when you half-lead it (${mk}/${await G('g.shots')})`);

  // ===== G. Shop =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, tutorialDone: true, coins: 160, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await click('btn-shop'); await sleep(200);
  const items = await G(`document.querySelectorAll('#shop-grid .item').length`);
  await ev(`document.querySelectorAll('#shop-grid .item')[1].click()`); await sleep(150);
  ok((await G('Save.data.coins')) === 10 && (await G('Save.data.equipped.ball')) === 'neon' && (await G(`Save.data.owned.balls.includes('neon')`)), `G1 buying the Neon ball spends 150 coins and equips it (${items} items)`);
  await ev(`document.querySelectorAll('#shop-grid .item')[3].click()`); await sleep(150);
  ok((await G('Save.data.coins')) === 10 && !(await G(`Save.data.owned.balls.includes('gold')`)), 'G2 cannot buy what you cannot afford');
  await ev(`document.querySelectorAll('#shop-grid .item')[0].click()`); await sleep(100);
  ok((await G('Save.data.equipped.ball')) === 'classic', 'G3 re-equipping an owned item is free');
  await click('tab-courts'); await ev('Save.data.coins = 1000'); await ev(`document.querySelectorAll('#shop-grid .item')[1].click()`); await sleep(300);
  ok((await G('Save.data.equipped.court')) === 'sunset' && (await G('Save.data.coins')) === 750, 'G4 buying a court works and applies');
  await shot('court-sunset-shop');
  await send('Page.reload'); await sleep(1100);
  ok((await G('Save.data.equipped.court')) === 'sunset' && (await G(`Save.data.owned.balls.includes('neon')`)), 'G5 purchases persist across reload');
  await startMode('classic'); await sleep(3600); await shot('court-sunset-play');

  // ===== H. Fire / lava / all skins and courts render without errors =====
  const errBefore = errors.length;
  for (const b of ['classic', 'neon', 'bubble', 'gold', 'galaxy', 'chrome', 'lava']) {
    await ev(`__hoops.Renderer.setBall('${b}'); __hoops.g.streak = 6; (()=>{const w=__hoops.world,x=w.balls.find(b=>b.state==='ready');if(x){__hoops.g.shots++;w.launch(x,{vx:0,vy:7,vz:3});}})()`); await sleep(350);
  }
  for (const c of ['neon', 'sunset', 'arctic', 'matrix']) { await ev(`__hoops.Renderer.setCourt('${c}')`); await sleep(250); if (c === 'matrix' || c === 'arctic') await shot('court-' + c); }
  ok(errors.length === errBefore, 'H1 every ball skin (incl. fire trail) and court renders without errors');

  // ===== I. trophies =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, tutorialDone: true, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await startMode('classic');
  await ev(`(()=>{const w=__hoops.world,b=w.balls[2];b.x=0;b.y=4;b.z=w.hoop.z;__hoops.g.shots++;w.launch(b,{vx:0,vy:0,vz:0});})()`); await sleep(1500);
  await ev('__hoops.g.clock = 59.97'); await waitPhase('over', 10000); await sleep(1500);
  ok((await G('!!Save.data.ach.first')) && (await G('Save.data.coins')) >= 20, 'I1 "First Bucket" trophy unlocks and pays its reward');
  ok((await G(`document.querySelectorAll('.toast').length`)) >= 1, 'I2 a trophy toast is shown');
  await shot('over-trophy');

  // ===== J. localisation and layout =====
  const screens = [['home', null], ['modes', 'btn-play'], ['shop', 'btn-shop'], ['trophies', 'btn-trophies'], ['settings', 'btn-settings']];
  const sizes = [[320, 568], [360, 800], [412, 915], [768, 1024], [1280, 720], [1920, 1080]];
  let layoutBad = [], untranslated = [];
  for (const lang of ['en', 'fa', 'es']) {
    await load({ settings: { lang, sound: true, vibration: true }, tutorialDone: true, coins: 123, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
    ok((await ev('document.documentElement.dir')) === (lang === 'fa' ? 'rtl' : 'ltr') && (await ev('document.documentElement.lang')) === lang, `J1 ${lang}: lang/dir attributes`);
    for (const [w, h] of sizes) {
      await viewport(w, h, 1); await sleep(250);
      for (const [name, btn] of screens) {
        await ev(`__hoops.UI.screen('${name}')`); await sleep(60);
        const r = await ev(`(()=>{const sc=document.getElementById('screen-${name}'),st=document.getElementById('stage').getBoundingClientRect();
          const bad=[];const stageR=st;
          sc.querySelectorAll('*').forEach(e=>{const cs=getComputedStyle(e);if(cs.display==='none'||cs.position==='absolute')return;const r=e.getBoundingClientRect();if(!r.width||!r.height)return;
            const inScroll=e.closest('.scroll');const dx=(r.right>stageR.right+1)||(r.left<stageR.left-1);const dy=!inScroll&&((r.bottom>stageR.bottom+1)||(r.top<stageR.top-1));
            if(dx||dy)bad.push(e.tagName+'.'+e.className+':'+(e.textContent||'').slice(0,18));});
          const txt=sc.innerText;const keys=(txt.match(/\\b(?:mode|ach|ball|court|pop|ban|over|set|stat|shop|tro|hud|pause|count)\\.[a-z0-9.]+/g)||[]);
          return {bad:bad.slice(0,3),keys};})()`);
        if (r.bad.length) layoutBad.push(`${lang} ${w}x${h} ${name}: ${r.bad.join(' | ')}`);
        if (r.keys.length) untranslated.push(`${lang} ${name}: ${r.keys}`);
      }
    }
    await viewport(360, 540, 2);
  }
  ok(!layoutBad.length, 'J2 no clipped / overflowing UI in 3 languages x 6 screen sizes x 5 screens' + (layoutBad.length ? '\n   ' + layoutBad.slice(0, 8).join('\n   ') : ''));
  ok(!untranslated.length, 'J3 no raw translation keys visible' + (untranslated.length ? ' ' + untranslated.join(';') : ''));

  // game-over / pause / countdown layouts in every language at the smallest phone size
  let overBad = [];
  for (const lang of ['en', 'fa', 'es']) {
    await load({ settings: { lang, sound: true, vibration: true }, tutorialDone: true, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
    await viewport(320, 568, 2); await sleep(200);
    await startMode('sudden'); await sleep(300);
    await ev(`__hoops.g.score=128;__hoops.g.coins=0;__hoops.g.phase='ending';__hoops.g.endT=2;__hoops.g.endReason='lives'`); await waitPhase('over', 8000);
    await ev(`document.getElementById('over-new').classList.remove('hidden')`);
    const r = await ev(`(()=>{const sc=document.getElementById('screen-over'),st=document.getElementById('stage').getBoundingClientRect();const bad=[];sc.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width)return;if(r.right>st.right+1||r.left<st.left-1||r.bottom>st.bottom+1||r.top<st.top-1)bad.push(e.tagName+'.'+e.className)});return bad.slice(0,4)})()`);
    if (r.length) overBad.push(lang + ': ' + r.join(','));
    await shot('over-' + lang + '-320');
    await ev(`__hoops.UI.screen('pause')`); await sleep(100); await shot('pause-' + lang + '-320');
    await viewport(360, 540, 2);
  }
  ok(!overBad.length, 'J4 game-over screen fits the smallest phone in all languages' + (overBad.length ? ' ' + overBad.join(';') : ''));

  // ===== K. reset progress =====
  await load({ settings: { lang: 'en', sound: true, vibration: true }, tutorialDone: true, coins: 999, best: { classic: 50 }, daily: { last: new Date().toLocaleDateString('en-CA'), streak: 1 } });
  await click('btn-settings'); await click('btn-reset'); await click('btn-reset-no');
  ok((await G('Save.data.coins')) === 999, 'K1 cancelling reset keeps progress');
  await click('btn-reset'); await click('btn-reset-yes'); await sleep(200);
  ok((await G('Save.data.coins')) === 0 && (await G('Save.data.best.classic')) === 0 && (await G('Save.data.tutorialDone')) === false, 'K2 confirming reset wipes coins, records and tutorial flag');

  // ===== L. audio + haptics API survive being called (headless has WebAudio) =====
  const aerr = errors.length;
  await ev(`(()=>{Sfx.unlock();['throw','rim','board','floor','swish','score','coin','countdown','tick','bonus','buzzer','fanfare','click','error','miss','gameover'].forEach(n=>{try{Sfx[n](3,true)}catch(e){console.error('SFX '+n+' '+e.message)}});Haptics.v(20);return 1})()`);
  ok(errors.length === aerr, 'L1 all 16 sound effects and haptics run without errors');
  ok(await ev(`(()=>{Sfx.setMuted(true);const a=Save.data.settings.sound===false;Sfx.setMuted(false);return a&&Save.data.settings.sound===true})()`), 'L2 mute setting round-trips through the save file');

  // ===== M. corrupt save file =====
  await send('Page.navigate', { url: 'http://localhost:8127/index.html?debug' }); await sleep(800);
  await ev(`localStorage.setItem('basketballarcade.save.v1','{not json'); 0`); await send('Page.reload'); await sleep(1000);
  ok((await G('g.phase')) === 'menu' && (await G('typeof Save.data.coins')) === 'number', 'M1 a corrupt save file falls back to defaults instead of crashing');
  await ev(`localStorage.setItem('basketballarcade.save.v1', JSON.stringify({coins:-5,equipped:{ball:'hacked',court:'neon'},owned:{balls:['x'],courts:[]},best:{classic:'abc'}})); 0`); await send('Page.reload'); await sleep(1000);
  ok((await G('Save.data.coins')) >= 0 && (await G('Save.data.equipped.ball')) === 'classic' && (await G(`typeof Save.data.best.classic`)) === 'number', 'M2 tampered save values are sanitised');

  ok(!errors.length, 'Z  no console errors / exceptions during the whole audit' + (errors.length ? '\n   ' + [...new Set(errors)].slice(0, 6).join('\n   ') : ''));
  console.log(fails ? `\n${fails} FAILED` : '\nALL AUDIT CHECKS PASSED');
  ws.close(); chrome.kill(); server.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); chrome.kill(); server.close(); process.exit(1); });
