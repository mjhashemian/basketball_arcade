// Monkey test: random taps/drags/button presses for N seconds; invariants checked continuously.
// Usage: node tests/e2e/monkey.js [seconds]   (needs Chrome; set CHROME=<path> if not default)
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '../..'), SECS = parseInt(process.argv[2] || '60', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((q, s) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (q.url.startsWith('/?') || q.url === '/') f = path.join(ROOT, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
}).listen(8128);
const chrome = cp.spawn((process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9338', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'mk-')), '--mute-audio', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
(async () => {
  let t; for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9338/json')).json(); if (t.find(x => x.type === 'page')) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errors = [];
  ws.onmessage = m => { const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) errors.push('CONSOLE ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200));
  };
  let lastAction = 'start';
  // watchdog: a page that stops answering (frozen game loop) must fail the test, not hang it
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id; const tm = setTimeout(() => reject(new Error(`PAGE UNRESPONSIVE (20 s) after action: ${lastAction}`)), 20000);
    pend.set(i, d => { clearTimeout(tm); resolve(d); }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:8128/index.html?debug' }); await sleep(1200);
  await ev(`localStorage.clear(); localStorage.setItem('basketballarcade.save.v1', JSON.stringify({coins:5000,tutorialDone:true,settings:{lang:'en',sound:true,vibration:true}})); 0`);
  await send('Page.reload'); await sleep(1200);
  const rect = await ev(`(()=>{const r=document.getElementById('stage').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}})()`);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const bad = [], hist = {};
  const end = Date.now() + SECS * 1000; let acts = 0, rounds = 0;
  while (Date.now() < end) {
    const r = Math.random(); acts++; lastAction = 'roll ' + r.toFixed(3);
    if (r < 0.2) {                                                    // press a random visible button
      await ev(`(()=>{const bs=[...document.querySelectorAll('#ui button')].filter(b=>b.offsetParent&&!b.closest('.hidden'));if(bs.length)bs[Math.floor(Math.random()*bs.length)].click()})()`);
    } else if (r < 0.7) {                                             // drag on the canvas in a random direction/speed
      const x = rect.l + rnd(0.05, 0.95) * rect.w, y = rect.t + rnd(0.5, 0.97) * rect.h, ang = rnd(-0.6, 0.6), sp = rnd(300, 6000);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      const t0 = Date.now(), dur = rnd(30, 250);
      for (let el = 0; el < dur; el = Date.now() - t0) { const s = sp * el / 1000 * rect.w / 600; await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + Math.sin(ang) * s, y: y - Math.cos(ang) * s, button: 'left', buttons: 1 }); }
      if (Math.random() < 0.9) await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    } else if (r < 0.72) { await ev(`BA.back()`); }
    else if (r < 0.73) { await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); }
    else if (r < 0.74) { await ev(`window.dispatchEvent(new Event('blur'))`); }
    else if (r < 0.84) { await ev(`(()=>{const g=__hoops.g;if(g.phase==='playing'){if(g.mode.timer)g.clock+=8+Math.random()*30;else g.lives=1;}})()`); }
    else { await ev(`(()=>{const g=__hoops.g;if(g.phase==='menu'||g.phase==='over')__hoops.startMode(['classic','rush','sudden','moving'][Math.floor(Math.random()*4)])})()`); }
    await sleep(rnd(0, 120));
    const st = await ev(`(()=>{const g=__hoops.g,w=__hoops.world;const held=w.balls.filter(b=>b.state==='held').length;
      return JSON.stringify({ph:g.phase,coins:__hoops.Save.data.coins,lives:g.lives,score:g.score,held,fin:w.balls.every(b=>isFinite(b.x+b.y+b.z)&&Math.abs(b.x)<50&&b.z<50&&b.y<200),
        screens:[...document.querySelectorAll('#ui .screen.shown')].map(e=>e.id).join(','), hoop:isFinite(w.hoop.x)})})()`);
    const s = JSON.parse(st);
    if (!['menu', 'countdown', 'playing', 'paused', 'ending', 'over'].includes(s.ph)) bad.push('phase ' + s.ph);
    if (!(s.coins >= 0) || !s.fin || !s.hoop) bad.push('state ' + st);
    if (s.screens.split(',').filter(Boolean).length > 1) bad.push('two screens at once: ' + s.screens);
    if (s.lives < 0) bad.push('negative lives');
    hist[s.ph] = (hist[s.ph] || 0) + 1; if (s.ph === 'over') rounds++;
  }
  // everything must be recoverable: no held balls once all pointers are up
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 10, y: 10, button: 'left', clickCount: 1 });
  await sleep(800);
  const held = await ev(`__hoops.world.balls.filter(b=>b.state==='held').length`);
  console.log('phases seen:', JSON.stringify(hist));
  console.log(`monkey: ${acts} actions in ${SECS}s, rounds finished ${rounds}, held balls at end ${held}`);
  console.log(bad.length ? 'INVARIANT FAILURES:\n ' + [...new Set(bad)].slice(0, 8).join('\n ') : 'invariants OK');
  console.log(errors.length ? 'ERRORS:\n ' + [...new Set(errors)].slice(0, 8).join('\n ') : 'no console errors');
  ws.close(); chrome.kill(); server.close(); process.exit(bad.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); chrome.kill(); server.close(); process.exit(1); });
