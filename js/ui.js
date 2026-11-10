/* ui.js — DOM screens: home, mode select, shop, trophies, settings, pause, game over, toasts. */
const UI = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tr = (k, v) => I18n.t(k, v);
  const stage = $('stage');
  const NAMES = ['home', 'modes', 'shop', 'trophies', 'settings', 'count', 'pause', 'over'];
  const ICONS = {
    classic: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 3h6"/>',
    rush: '<path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z"/>',
    sudden: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>',
    moving: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8"/>',
  };
  let H = {}, onFit = null, shopTab = 'balls', current = null, uid = 0;

  const svg = (inner, cls) => `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''}>${inner}</svg>`;
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function ballSvg(b) {
    const id = 'bg' + (++uid);
    return `<svg class="ball" viewBox="-50 -50 100 100"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="80%">` +
      `<stop offset="0" stop-color="${b.hi}"/><stop offset=".55" stop-color="${b.mid}"/><stop offset="1" stop-color="${b.lo}"/></radialGradient>` +
      `<clipPath id="${id}c"><circle r="46"/></clipPath></defs><circle r="46" fill="url(#${id})"/>` +
      `<g clip-path="url(#${id}c)" stroke="${b.seam}" stroke-width="4" fill="none" stroke-linecap="round"><path d="M-46 0H46M0-46V46"/>` +
      `<path d="M-32-32Q-11 0-32 32M32-32Q11 0 32 32"/></g><ellipse cx="-16" cy="-21" rx="10" ry="6" transform="rotate(-40 -16 -21)" fill="#fff" opacity=".35"/></svg>`;
  }

  // ------------------------------------------------------------ layout
  // Fit the 2:3 stage into the window; em-based CSS scales with it.
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const wide = vw > 700 && vh > 500;                 // leave a margin on desktop
    const availW = wide ? vw - 24 : vw, availH = wide ? vh - 24 : vh;
    const w = Math.max(200, Math.floor(Math.min(availW, availH * 600 / 900)));
    stage.style.width = w + 'px'; stage.style.height = Math.floor(w * 1.5) + 'px';
    stage.style.fontSize = (w / 60) + 'px';            // 1em = 10 logical px
    if (onFit) onFit(w);
  }

  // ------------------------------------------------------------ screens
  const RENDER = { home: renderHome, modes: renderModes, shop: renderShop, trophies: renderTrophies, settings: renderSettings };

  function screen(name) {
    if (name && RENDER[name]) RENDER[name]();
    NAMES.forEach(n => {
      const e = $('screen-' + n), on = n === name;
      e.classList.toggle('hidden', !on); e.classList.toggle('shown', on);
    });
    current = name;
    if (name) {
      const f = $('screen-' + name).querySelector('.arcade-btn, .back-btn');
      if (f) f.focus({ preventScroll: true });
    }
  }

  function updateCoins() { document.querySelectorAll('[data-coins]').forEach(e => { e.textContent = Save.data.coins; }); }

  function renderHome() {
    updateCoins();
    $('home-best').textContent = Math.max(0, ...Object.values(Save.data.best));
  }

  function renderModes() {
    const list = $('mode-list'); list.textContent = '';
    Content.MODES.forEach(m => {
      const b = el('button', 'card'); b.type = 'button';
      const ic = el('span', 'ic'); ic.innerHTML = svg(ICONS[m.id]);
      const tx = el('span', 'txt');
      tx.append(el('span', 'n', tr(`mode.${m.id}.name`)), el('span', 'd', tr(`mode.${m.id}.desc`)));
      const bs = el('span', 'b'); bs.append(el('span', null, tr('best')), el('b', null, String(Save.data.best[m.id] || 0)));
      b.append(ic, tx, bs);
      b.addEventListener('click', () => H.onStartMode(m.id));
      list.appendChild(b);
    });
  }

  function onItem(kind, it, node) {
    const d = Save.data, owned = d.owned[kind + 's'];
    if (!owned.includes(it.id)) {
      if (d.coins < it.price) {
        node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake');
        toast(tr('shop.need'), false); Sfx.error(); Haptics.v(40);
        return;
      }
      d.coins -= it.price; owned.push(it.id);
      Sfx.coin(); toast(tr('shop.unlocked'), false);
    } else Sfx.click();
    d.equipped[kind] = it.id;
    Save.commit();
    H.onEquip(kind, it.id);
    renderShop(); updateCoins();
  }

  function renderShop() {
    updateCoins();
    $('tab-balls').classList.toggle('on', shopTab === 'balls');
    $('tab-courts').classList.toggle('on', shopTab === 'courts');
    const grid = $('shop-grid'); grid.textContent = '';
    const kind = shopTab === 'balls' ? 'ball' : 'court';
    const items = kind === 'ball' ? Content.BALLS : Content.COURTS;
    items.forEach(it => {
      const owned = Save.data.owned[kind + 's'].includes(it.id), eq = Save.data.equipped[kind] === it.id;
      const b = el('button', 'item' + (owned ? ' owned' : '') + (eq ? ' equipped' : '')); b.type = 'button';
      if (kind === 'ball') { const pv = el('span'); pv.innerHTML = ballSvg(it); b.appendChild(pv.firstChild); }
      else {
        const p = it.p, d = el('div', 'court-prev');
        d.style.background = `linear-gradient(to bottom, ${p.wall[0]}, ${p.wall[1]} 35%, ${p.wall[2]} 58%, ${p.floor[0]} 58%, ${p.floor[2]})`;
        const s1 = el('i'), s2 = el('i'); s1.style.top = '42%'; s1.style.background = p.stripeA; s2.style.top = '50%'; s2.style.background = p.stripeB;
        d.append(s1, s2); b.appendChild(d);
      }
      b.appendChild(el('span', 'nm', tr(`${kind}.${it.id}`)));
      const st = el('span', 'st');
      if (eq) st.textContent = tr('shop.equipped');
      else if (owned) st.textContent = tr('shop.owned');
      else { st.append(el('span', 'coin'), document.createTextNode(String(it.price))); }
      b.appendChild(st);
      b.addEventListener('click', () => onItem(kind, it, b));
      grid.appendChild(b);
    });
  }

  function renderTrophies() {
    const s = Save.data.stats;
    const g = $('stats-grid'); g.textContent = '';
    [['stat.games', s.games], ['stat.baskets', s.made], ['stat.swishes', s.swishes], ['stat.streak', s.bestStreak]].forEach(([k, v]) => {
      const d = el('div'); d.append(el('b', null, String(v)), el('span', null, tr(k))); g.appendChild(d);
    });
    const list = $('ach-list'); list.textContent = '';
    Content.ACH.forEach(a => {
      const done = !!Save.data.ach[a.id];
      const row = el('div', 'ach' + (done ? ' done' : ''));
      const tro = el('span', 'tr'); tro.innerHTML = svg(ICONS.trophy);
      const tx = el('div', 'tx'); tx.append(el('b', null, tr('ach.' + a.id)), el('span', null, tr('ach.' + a.id + '.d')));
      const rw = el('span', 'rw'); rw.append(el('span', 'coin'), document.createTextNode('+' + a.reward));
      row.append(tro, tx, rw); list.appendChild(row);
    });
  }

  function setToggle(btn, on) {
    btn.textContent = tr(on ? 'on' : 'off');
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function renderSettings() {
    const s = Save.data.settings;
    setToggle($('set-sound'), s.sound); setToggle($('set-vib'), s.vibration);
    const seg = $('set-lang'); seg.textContent = '';
    Object.keys(I18n.LANGS).forEach(code => {
      const b = el('button', null, I18n.LANGS[code].name); b.type = 'button';
      b.setAttribute('aria-pressed', I18n.lang === code ? 'true' : 'false');
      b.addEventListener('click', () => { Save.data.settings.lang = code; Save.commit(); I18n.setLang(code); refresh(); Sfx.click(); });
      seg.appendChild(b);
    });
    $('reset-confirm').classList.add('hidden'); $('btn-reset').classList.remove('hidden');
  }

  function refresh() {
    I18n.apply();
    if (current && RENDER[current]) RENDER[current]();
    else renderHome();
    updateCoins();
  }

  // ------------------------------------------------------------ overlays
  function toast(text, icon) {
    const t = el('div', 'toast');
    if (icon !== false) { const w = el('span'); w.innerHTML = svg(ICONS.trophy); t.appendChild(w.firstChild); }
    t.appendChild(document.createTextNode(text));
    $('toasts').appendChild(t);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => t.remove(), 3300);
  }

  function banner(text, kind) {
    const b = $('banner');
    b.textContent = text; b.className = kind || '';
    void b.offsetWidth; b.classList.add('show');
  }

  function showCountdown(txt, go) {
    screen('count');
    const n = $('count-num');
    n.textContent = txt;
    n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    $('screen-count').querySelector('.get-ready').style.visibility = go ? 'hidden' : 'visible';
    n.style.fontSize = go ? '20em' : '';
  }

  function showOver(r) {
    $('over-title').textContent = tr(r.reason === 'lives' ? 'over.lives' : 'over.time');
    $('over-mode').textContent = tr(`mode.${r.mode}.name`);
    $('over-tag').textContent = tr('over.t' + (r.score >= 60 ? 3 : r.score >= 35 ? 2 : r.score >= 15 ? 1 : 0));
    $('over-score').textContent = r.score;
    $('over-best').textContent = r.best;
    $('over-new').classList.toggle('hidden', !r.isBest);
    $('over-coins').textContent = tr('over.coins', { n: r.coins });
    $('over-coins').parentNode.classList.toggle('hidden', !r.coins);
    $('st-made').textContent = r.made;
    $('st-acc').textContent = r.shots ? Math.round(100 * r.made / r.shots) + '%' : '--';
    $('st-streak').textContent = r.maxStreak;
    screen('over');
    $('btn-again').focus({ preventScroll: true });
  }

  const setPauseButton = on => $('btn-pause').classList.toggle('hidden', !on);

  // ------------------------------------------------------------ wiring
  function init(handlers) {
    H = handlers; onFit = handlers.onFit;
    I18n.setLang(Save.data.settings.lang || I18n.detect());
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    fit();

    $('btn-play').addEventListener('click', () => { Sfx.unlock(); Sfx.click(); screen('modes'); });
    $('btn-shop').addEventListener('click', () => { Sfx.click(); screen('shop'); });
    $('btn-trophies').addEventListener('click', () => { Sfx.click(); screen('trophies'); });
    $('btn-settings').addEventListener('click', () => { Sfx.click(); screen('settings'); });
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Sfx.click(); screen('home'); }));
    $('tab-balls').addEventListener('click', () => { shopTab = 'balls'; Sfx.click(); renderShop(); });
    $('tab-courts').addEventListener('click', () => { shopTab = 'courts'; Sfx.click(); renderShop(); });

    $('set-sound').addEventListener('click', () => { const on = !Save.data.settings.sound; Sfx.setMuted(!on); setToggle($('set-sound'), on); if (on) Sfx.click(); });
    $('set-vib').addEventListener('click', () => { const on = !Save.data.settings.vibration; Save.data.settings.vibration = on; Save.commit(); setToggle($('set-vib'), on); if (on) Haptics.v(30); });
    $('btn-reset').addEventListener('click', () => { $('btn-reset').classList.add('hidden'); $('reset-confirm').classList.remove('hidden'); });
    $('btn-reset-no').addEventListener('click', () => { $('btn-reset').classList.remove('hidden'); $('reset-confirm').classList.add('hidden'); });
    $('btn-reset-yes').addEventListener('click', () => {
      Save.reset(); H.onReset(); I18n.setLang(Save.data.settings.lang || I18n.detect()); refresh(); toast(tr('shop.unlocked'), false);
    });

    $('btn-pause').addEventListener('click', () => H.onPause());
    $('btn-resume').addEventListener('click', () => H.onResume());
    $('btn-restart').addEventListener('click', () => H.onRestart());
    $('btn-quit').addEventListener('click', () => H.onQuit());
    $('btn-again').addEventListener('click', () => H.onRestart());
    $('btn-menu').addEventListener('click', () => H.onQuit());
    $('btn-share').addEventListener('click', () => H.onShare());

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); H.onBack(); }
      else if ((e.key === 'p' || e.key === 'P') && !e.repeat) H.onPauseKey();
      else if ((e.key === 'm' || e.key === 'M') && !e.repeat) { Sfx.setMuted(!Sfx.muted); if (current === 'settings') renderSettings(); }
    });
    refresh();
  }

  return {
    init, screen, refresh, toast, banner, showCountdown, showOver, setPauseButton, updateCoins,
    get current() { return current; },
  };
})();
