// ==UserScript==
// @name         waffengebraucht.at-enhancer
// @namespace    isolatedsys
// @version      1.3.0
// @description  Inoffizielles Zusatz-Tool: schlanker Header + Kategorie-Leiste. Lädt alle Ergebnisseiten, ergänzt Filter (Preis, Kaliber, Ort, Händler/Privat, Alter ...), Sortierung, Tabellenansicht und "NEU"-Markierung.
// @match        https://www.waffengebraucht.at/*
// @match        https://waffengebraucht.at/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Dev-Komfort: erneutes Einspielen räumt die alte Instanz ab
  if (window.__wgf) { try { window.__wgf.destroy(); } catch (e) {} }


  /* ------------------------------------------------------------------ */
  /* Helfer                                                              */
  /* ------------------------------------------------------------------ */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const compact = s => s.replace(/[\s.\-_/,]/g, '');
  const fmtEUR = n => n == null ? '' : n.toLocaleString('de-AT', { maximumFractionDigits: 2 }) + ' €';
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ------------------------------------------------------------------ */
  /* Kopfbereich: schlanke Leiste + Kategorie-Navigation                 */
  /* ------------------------------------------------------------------ */
  function enhanceHeader() {
    if (document.getElementById('wgh-bar')) return () => {};
    const topHdr = document.querySelector('header.header-top');
    const hdr = document.querySelector('header.header');
    if (!topHdr || !hdr) return () => {};

    const undo = [];
    const html = document.documentElement;
    const curPath = location.pathname.replace(/\/+$/, '') || '/';
    const isOn = href => {
      try {
        const p = new URL(href, location.href).pathname.replace(/\/+$/, '') || '/';
        return p === '/' ? curPath === '/' : (curPath === p || curPath.startsWith(p + '/'));
      } catch (e) { return false; }
    };

    const logoA = topHdr.querySelector('a.logo');
    const logoImg = topHdr.querySelector('.logo-img');
    const navItems = [...hdr.querySelectorAll('.main-menu ul.nav > li:not(.main-menu-new-classified) > a')];
    const cta = hdr.querySelector('.main-menu-new-classified a');
    const login = hdr.querySelector('a.user-login-logout');
    const form = hdr.querySelector('form.wg-search');

    /* Kategorien: aus der Seitenleiste, sonst aus dem Footer */
    let l1 = [...document.querySelectorAll('li.categories--level-1')].map(li => {
      const a = li.querySelector(':scope > a');
      return a ? { t: a.textContent.trim(), h: a.href, subs: [...li.querySelectorAll('.categories--level-2 > a')].map(x => ({ t: x.textContent.trim(), h: x.href })) } : null;
    }).filter(Boolean);
    if (!l1.length) {
      const seenH = new Set();
      l1 = [...document.querySelectorAll('.footer-nav a')].filter(a => !seenH.has(a.href) && seenH.add(a.href)).map(a => ({ t: a.textContent.trim(), h: a.href, subs: [] }));
    }
    const activeL1 = l1.find(c => isOn(c.h));

    const bar = document.createElement('div');
    bar.id = 'wgh-bar';
    bar.className = 'wgh-bar';
    bar.innerHTML = `<div class="wgh-in">
      <a class="wgh-logo" href="${esc(logoA ? logoA.href : '/')}">${logoImg ? `<img src="${esc(logoImg.src)}" alt="Waffengebraucht.at">` : 'Waffengebraucht.at'}</a>
      <nav class="wgh-nav">${navItems.map(a => `<a href="${esc(a.href)}"${isOn(a.href) ? ' class="on"' : ''}>${esc(a.textContent.trim())}</a>`).join('')}</nav>
      <div class="wgh-sp"></div>
      <div class="wgh-slot"></div>
      ${cta ? `<a class="wgh-cta" href="${esc(cta.href)}">+ ${esc(cta.textContent.trim())}</a>` : ''}
      ${login ? `<a class="wgh-login" href="${esc(login.href)}">${esc(login.textContent.trim())}</a>` : ''}
    </div>`;

    const cats = document.createElement('div');
    cats.id = 'wgh-cats';
    cats.className = 'wgh-cats';
    cats.innerHTML = `<div class="wgh-l1">${l1.map(c => `<a href="${esc(c.h)}"${c === activeL1 ? ' class="on"' : ''}>${esc(c.t)}</a>`).join('')}<span class="wgh-sp"></span><button type="button" class="wgh-adtoggle"></button></div>
      ${activeL1 && activeL1.subs.length ? `<div class="wgh-l2">${activeL1.subs.map(c => `<a href="${esc(c.h)}"${isOn(c.h) ? ' class="on"' : ''}>${esc(c.t)}</a>`).join('')}</div>` : ''}`;
    const ads = document.createElement('div');
    ads.id = 'wgh-ads';
    ads.className = 'wgh-ads';
    const adCard = document.createElement('div');
    adCard.className = 'wgh-adcard';
    adCard.innerHTML = '<span class="wgh-adlabel">Anzeige</span>';
    ads.appendChild(adCard);
    let adCount = 0;

    /* Suchformular der Seite in die Leiste verschieben (bleibt voll funktionsfähig) */
    if (form) {
      const parent = form.parentNode, next = form.nextSibling;
      const btn = form.querySelector('button');
      const btnHTML = btn ? btn.innerHTML : '';
      const input = form.querySelector('input[name=q]');
      const fullInput = document.querySelector('.wg-search.full input[name=q]');
      if (input && fullInput && !input.value) input.value = fullInput.value;
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
      bar.querySelector('.wgh-slot').appendChild(form);
      undo.push(() => { if (btn) btn.innerHTML = btnHTML; parent.insertBefore(form, next); });
    }
    /* Werbebanner in einen ein-/ausklappbaren Bereich */
    ['btop', 'bright'].forEach(id => {
      const n = document.getElementById(id);
      if (!n) return;
      const parent = n.parentNode, next = n.nextSibling;
      adCard.appendChild(n);
      adCount++;
      undo.push(() => parent.insertBefore(n, next));
    });

    const anchor = document.querySelector('.container-fluid') || document.body.firstChild;
    anchor.parentNode.insertBefore(bar, anchor);
    anchor.parentNode.insertBefore(cats, anchor);
    anchor.parentNode.insertBefore(ads, anchor);

    const style = document.createElement('style');
    style.id = 'wgh-style';
    style.textContent = `
html.wgh-on body { background:#f5f4f1 !important; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important; color:#222; }
html.wgh-on header.header-top, html.wgh-on header.header, html.wgh-on .wg-search.full { display:none !important; }
html.wgh-on.wgh-l2on ul.subcategories { display:none !important; }
html.wgh-on h1 { font-family: inherit !important; font-size: 24px; font-weight: 650; color:#222; margin: 14px 0 10px; letter-spacing:-.01em; }
.wgh-bar { --o:#d9730d; position:sticky; top:0; z-index:900; background:#fff; border-bottom:1px solid #e3e1dc; box-shadow:0 1px 5px rgba(0,0,0,.06); font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
.wgh-bar *, .wgh-cats * { box-sizing:border-box; }
.wgh-in { max-width:1500px; margin:0 auto; padding:0 14px; display:flex; align-items:center; gap:8px; height:58px; }
.wgh-logo { display:flex; align-items:center; flex:none; }
.wgh-logo img { height:50px !important; width:auto !important; max-width:none !important; display:block; }
.wgh-nav { display:flex; gap:2px; margin-left:12px; }
.wgh-nav a { padding:7px 12px; border-radius:8px; color:#333 !important; text-decoration:none !important; font-weight:500; white-space:nowrap; }
.wgh-nav a:hover { background:#f3f1ec; }
.wgh-nav a.on { background:#fff3e6; color:#b85a00 !important; }
.wgh-sp { flex:1; }
.wgh-slot { flex:0 1 260px; min-width:150px; }
.wgh-bar .wg-search { display:flex !important; margin:0 !important; padding:0 !important; float:none !important; width:100% !important; position:static !important; }
.wgh-bar .wg-search button { position:static !important; margin:0 !important; inset:auto !important; transform:none !important; flex:none; }
.wgh-bar .wg-search input { position:static !important; width:auto !important; }
.wgh-bar .wg-search input { flex:1; min-width:0; height:36px !important; padding:0 11px !important; border:1px solid #d8d6d0 !important; border-right:0 !important; border-radius:8px 0 0 8px !important; background:#faf9f7 !important; font:inherit !important; box-shadow:none !important; }
.wgh-bar .wg-search input:focus { outline:2px solid color-mix(in srgb, var(--o) 40%, transparent); background:#fff !important; }
.wgh-bar .wg-search button { float:none !important; height:36px !important; width:40px; padding:0 !important; border:0 !important; border-radius:0 8px 8px 0 !important; background:var(--o) !important; color:#fff !important; display:flex; align-items:center; justify-content:center; }
.wgh-cta { background:var(--o); color:#fff !important; border-radius:8px; padding:8px 14px; font-weight:600; text-decoration:none !important; white-space:nowrap; }
.wgh-cta:hover { filter:brightness(.93); }
.wgh-login { color:#555 !important; text-decoration:none !important; padding:7px 8px; border-radius:8px; white-space:nowrap; }
.wgh-login:hover { background:#f3f1ec; }
.wgh-cats { max-width:1500px; margin:0 auto; padding:0 14px; font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
.wgh-l1 { display:flex; align-items:center; gap:2px; overflow-x:auto; overflow-y:hidden; border-bottom:1px solid #e3e1dc; scrollbar-width:thin; }
.wgh-l1 a { padding:11px 12px 9px; border-bottom:2px solid transparent; margin-bottom:-1px; color:#444 !important; text-decoration:none !important; white-space:nowrap; }
.wgh-l1 a:hover { color:#000 !important; border-color:#ccc; }
.wgh-l1 a.on { border-color:var(--o, #d9730d); color:#b85a00 !important; font-weight:600; }
.wgh-adtoggle { border:0; background:none; color:#999; font:inherit; font-size:12px; cursor:pointer; padding:6px; flex:none; white-space:nowrap; }
.wgh-adtoggle:hover { color:#333; }
.wgh-l2 { display:flex; flex-wrap:wrap; gap:6px; padding:10px 0 2px; }
.wgh-l2 a { padding:3px 11px; border:1px solid #dcdad4; background:#fff; border-radius:999px; color:#333 !important; text-decoration:none !important; font-size:13px; }
.wgh-l2 a:hover { border-color:#d9730d; }
.wgh-l2 a.on { background:#d9730d; border-color:#d9730d; color:#fff !important; }
.wgh-ads { display:none; max-width:1500px; margin:8px auto 0; padding:0 14px; justify-content:flex-end; }
html.wgh-adson .wgh-ads { display:flex; }
.wgh-adcard { display:flex; align-items:center; gap:12px; padding:6px 10px 6px 8px; background:#fff; border:1px solid #e3e1dc; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,.04); max-width:100%; overflow:hidden; }
.wgh-adlabel { writing-mode:vertical-rl; transform:rotate(180deg); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#aaa; user-select:none; }
.wgh-adcard #btop, .wgh-adcard #bright { display:block; line-height:0; margin:0 !important; padding:0 !important; float:none !important; position:static !important; width:auto !important; }
.wgh-adcard a { display:block; line-height:0; }
.wgh-adcard img { height:76px !important; width:auto !important; max-width:300px !important; object-fit:contain; border-radius:7px; display:block; background:#f3f1ec; }
.wgh-adcard a:hover img { filter:brightness(1.04); }
.wgf-side { top: calc(var(--wgh-h, 0px) + 8px) !important; max-height: calc(100vh - var(--wgh-h, 0px) - 16px) !important; }
@media (max-width: 900px) {
  .wgh-in { height:auto; flex-wrap:wrap; padding:8px 14px; row-gap:6px; }
  .wgh-nav { order:5; width:100%; margin:0; overflow-x:auto; }
  .wgh-slot { order:3; flex:1 1 160px; }
  .wgh-sp { display:none; }
  .wgh-logo { margin-right:auto; }
  .wgh-logo img { height:38px !important; }
  .wgh-ads { justify-content:center; }
  .wgh-adcard img { height:64px !important; max-width:44vw !important; }
}`;
    document.head.appendChild(style);
    html.classList.add('wgh-on');
    if (activeL1 && activeL1.subs.length) html.classList.add('wgh-l2on');
    let adsOn = load('wgf:ads', true) !== false;
    const adBtn = cats.querySelector('.wgh-adtoggle');
    const applyAds = () => {
      html.classList.toggle('wgh-adson', !!adsOn && adCount > 0);
      adBtn.textContent = adsOn ? 'Anzeigen ausblenden' : 'Anzeigen einblenden';
    };
    if (adCount) { applyAds(); adBtn.addEventListener('click', () => { adsOn = !adsOn; save('wgf:ads', adsOn); applyAds(); }); }
    else adBtn.remove();

    const setH = () => html.style.setProperty('--wgh-h', bar.offsetHeight + 'px');
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(bar);

    return () => {
      ro.disconnect();
      undo.reverse().forEach(f => f());
      bar.remove(); cats.remove(); ads.remove(); style.remove();
      html.classList.remove('wgh-on', 'wgh-l2on', 'wgh-adson');
      html.style.removeProperty('--wgh-h');
    };
  }

  const cleanups = [];
  cleanups.push(enhanceHeader());
  window.__wgf = {
    destroy() { cleanups.reverse().forEach(f => { try { f(); } catch (e) {} }); delete window.__wgf; },
    dbg: () => ({}),
  };

  /* Ab hier: nur auf Seiten mit Inseratsliste (Suche, Kategorien) */
  const srcList = document.querySelector('.classified-list');
  if (!srcList || !srcList.querySelector('.classified-teaser')) return;

  /* ------------------------------------------------------------------ */
  /* Kaliber-Erkennung (aus dem Titel)                                   */
  /* ------------------------------------------------------------------ */
  const CAL = [
    ['.22 WMR',        /(?<![\d.,])\.?22\s*(?:wmr|w\.?m\.?r|mag(?:num)?)(?![a-z])/i],
    ['.22 Hornet',     /(?<![\d.,])\.?22\s*hornet/i],
    ['.22 lr',         /(?<![\d.,])\.?22\s*(?:l\.?\s?r\.?|lfb|long\s*rifle)(?![a-z])/i],
    ['.22 lr',         /kal(?:iber)?\.?\s*\.?22(?![\d])/i],
    ['.22 lr',         /(?<![\d,.])\.22(?!\d)/],
    ['.17 HMR',        /(?<![\d.,])\.?17\s*hmr/i],
    ['.223 / 5.56',    /(?<![\d.,])(?:\.?223(?:\s*rem(?:ington)?)?|5[.,]56(?:\s*x\s*45)?)(?!\d)/i],
    ['.308 / 7.62x51', /(?<![\d.,])(?:\.?308\s*(?:win(?:chester)?)?|7[.,]62\s*x\s*51)(?!\d)/i],
    ['7.62x39',        /7[.,]62\s*x\s*39/i],
    ['6.5 Creedmoor',  /6[.,]5\s*(?:x\s*)?creed(?:moor)?/i],
    ['6.5x55',         /6[.,]5\s*x\s*55/i],
    ['.243 Win',       /(?<![\d.,])\.?243(?:\s*win)?(?!\d)/i],
    ['.270 Win',       /(?<![\d.,])\.?270\s*win/i],
    ['.30-06',         /(?<![\d.,])\.?30[-\s]?06(?!\d)/i],
    ['.300 Win Mag',   /(?<![\d.,])\.?300\s*(?:win\.?\s*mag|wm\b|wsm)/i],
    ['.300 BLK',       /(?<![\d.,])\.?300\s*(?:aac|blk|blackout)/i],
    ['.338',           /(?<![\d.,])\.?338(?!\d)/i],
    ['7mm Rem Mag',    /7\s*mm\s*rem/i],
    ['8x57 IS',        /(?<![\d.,])8\s*x\s*57/i],
    ['7x64',           /(?<![\d.,])7\s*x\s*64/i],
    ['9.3x62',         /9[.,]3\s*x\s*62/i],
    ['9mm Kurz / .380',/9\s*mm\s*kurz|\.?380\s*acp|9\s*x\s*17(?!\d)/i],
    ['9mm P.A.K.',     /9\s*mm\s*p\.?\s?a\.?\s?k/i],
    ['9x19',           /(?<![\d.,x])9\s*(?:x\s*19|mm)(?![a-z0-9])/i],
    ['.45 ACP',        /(?<![\d.,])\.?45\s*(?:acp|auto)/i],
    ['.40 S&W',        /(?<![\d.,])\.?40\s*(?:s\s*&\s*w|sw)/i],
    ['.357 Mag',       /(?<![\d.,])\.?357(?!\d)/i],
    ['.38 Spl',        /(?<![\d.,])\.?38\s*(?:spl|special|spezial)/i],
    ['.44 Mag',        /(?<![\d.,])\.?44\s*(?:mag|rem)/i],
    ['.32 ACP / 7.65', /(?<![\d.,])(?:\.?32\s*acp|7[.,]65\s*(?:mm|br))/i],
    ['Flobert',        /flobert/i],
    ['12/76',          /12\s*\/\s*76/],
    ['12/70',          /12\s*\/\s*70|kal(?:iber)?\.?\s*12(?!\d)|(?<![\d.,])12\s*(?:ga\b|gauge)/i],
    ['16/70',          /16\s*\/\s*7[06]/],
    ['20/70',          /20\s*\/\s*7[06]|kal(?:iber)?\.?\s*20(?!\d)/i],
    ['.410',           /(?<![\d.,])\.410(?!\d)/],
  ];
  const detectCals = t => { const out = []; for (const [l, re] of CAL) if (re.test(t) && !out.includes(l)) out.push(l); return out; };

  /* ------------------------------------------------------------------ */
  /* Teaser → Datenobjekt                                                */
  /* ------------------------------------------------------------------ */
  const catLabels = new Map();
  document.querySelectorAll('.categories a, .sidebar a').forEach(a => {
    const h = (a.getAttribute('href') || '').replace(/\/$/, '');
    if (/^\/[^/]+(\/[^/]+)?$/.test(h) && a.textContent.trim()) catLabels.set(h, a.textContent.trim());
  });
  const pretty = s => s.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());

  const parsePrice = s => { const m = (s || '').match(/\d[\d.]*(?:,\d+)?/); return m ? parseFloat(m[0].replace(/\./g, '').replace(',', '.')) : null; };
  const parseDate = s => { const m = (s || '').match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/); return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null; };
  const txt = (n, sel) => (n.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();

  function parseTeaser(t, base) {
    const a = t.querySelector('a.classified-teaser-title');
    if (!a) return null;
    const href = new URL(a.getAttribute('href'), base);
    const idm = href.pathname.match(/--(\d+)$/);
    const id = idm ? idm[1] : href.pathname;
    const raw = a.textContent.replace(/\s+/g, ' ').trim();
    const soldM = raw.match(/(verkauft|reserviert)/i);
    const title = raw.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/>>\s*[^<]*<</g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    const priceText = txt(t, '.classified-teaser-price');
    const price = parsePrice(priceText);
    const dateText = txt(t, '.classified-teaser-footer-date');
    const loc = txt(t, '.classified-teaser-footer-location');
    const [country, ...rest] = loc.split(',').map(x => x.trim());
    const parts = href.pathname.split('/').filter(Boolean);
    const catPath = '/' + parts.slice(0, Math.min(2, parts.length - 1)).join('/');
    const main = catLabels.get('/' + parts[0]) || pretty(parts[0] || '');
    const sub = parts.length >= 3 ? (catLabels.get(catPath) || pretty(parts[1])) : '';
    const noImg = t.classList.contains('no-img');
    const imgSrc = t.querySelector('.classified-teaser-img img')?.getAttribute('src');
    return {
      id, url: href.href, title, rawTitle: raw,
      price, priceText, date: parseDate(dateText), dateText,
      country: country || '', city: rest.join(', '), loc,
      kind: t.classList.contains('request') ? 'request' : 'offer',
      partner: t.classList.contains('partner'),
      dealer: txt(t, '.classified-partner'),
      sold: !!soldM, soldLabel: soldM ? soldM[1].toUpperCase() : '',
      img: !noImg && imgSrc ? new URL(imgSrc, base).href : '',
      cat: sub ? main + ' › ' + sub : main,
      cals: detectCals(title),
    };
  }
  const finishItem = it => {
    it.hay = norm([it.title, it.loc, it.dealer, it.cat, it.cals.join(' ')].join(' '));
    it.hayC = compact(it.hay);
    it.locN = norm(it.loc);
    return it;
  };

  /* ------------------------------------------------------------------ */
  /* Zustand                                                             */
  /* ------------------------------------------------------------------ */
  const path = location.pathname.replace(/\/+$/, '');
  const KEY = 'wgf:v1:' + path;
  const defaults = { q: '', pmin: '', pmax: '', who: 'all', kind: 'offer', hideSold: true, dedupe: true, noPrice: false, newOnly: false, showHidden: false, age: 0, loc: '', cats: [], cals: [], sort: 'date-desc', view: 'cards', wide: true, ps: 48 };
  const s = Object.assign({}, defaults, load(KEY, {}));
  const hidden = load('wgf:hidden', {});
  const saveState = debounce(() => save(KEY, s), 200);

  const all = new Map();
  let pageNo = 0;
  let current = [];
  let loadedPages = 0, totalPages = 1, loading = false, loadedAt = null, pageErrors = 0;
  const MAXP = 60;

  /* NEU-Markierung: pro Suche merken, wann ein Inserat erstmals gesehen wurde */
  const SKEY = 'wgf:seen:' + path;
  const seen = load(SKEY, null) || { init: Date.now(), prev: Date.now(), cur: Date.now(), ids: {} };
  const NOW = Date.now();
  if (NOW - seen.cur > 10 * 60 * 1000) { seen.prev = seen.cur; seen.cur = NOW; }

  /* ------------------------------------------------------------------ */
  /* Filter                                                              */
  /* ------------------------------------------------------------------ */
  const tokens = q => (q.match(/-?"[^"]+"|-?\S+/g) || []).map(t => {
    const neg = t.startsWith('-') && t.length > 1;
    const w = norm(neg ? t.slice(1) : t).replace(/"/g, '');
    return { neg, w, c: compact(w) };
  }).filter(t => t.w);

  let tok = [], locTok = [];
  const prepare = () => {
    tok = tokens(s.q);
    locTok = s.loc.split(',').map(x => norm(x.trim())).filter(Boolean);
  };

  function matches(it, skip) {
    if (!s.showHidden && hidden[it.id]) return false;
    if (s.kind !== 'all' && it.kind !== s.kind) return false;
    if (s.who === 'priv' && it.partner) return false;
    if (s.who === 'dealer' && !it.partner) return false;
    if (s.hideSold && it.sold) return false;
    if (s.dedupe && it.dup) return false;
    if (s.noPrice && it.price == null) return false;
    if (s.pmin !== '' && (it.price == null || it.price < +s.pmin)) return false;
    if (s.pmax !== '' && (it.price == null || it.price > +s.pmax)) return false;
    if (s.age && it.date && (NOW - it.date) / 864e5 > s.age) return false;
    if (s.newOnly && !it.isNew) return false;
    for (const t of tok) {
      const hit = it.hay.includes(t.w) || (t.c && it.hayC.includes(t.c));
      if (t.neg ? hit : !hit) return false;
    }
    if (locTok.length && !locTok.some(l => it.locN.includes(l))) return false;
    if (skip !== 'cat' && s.cats.length && !s.cats.includes(it.cat)) return false;
    if (skip !== 'cal' && s.cals.length && !it.cals.some(c => s.cals.includes(c))) return false;
    return true;
  }

  const sorters = {
    'date-desc':  (a, b) => (b.date || 0) - (a.date || 0),
    'date-asc':   (a, b) => (a.date || 0) - (b.date || 0),
    'price-asc':  (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    'price-desc': (a, b) => (b.price ?? -1) - (a.price ?? -1),
    'title':      (a, b) => a.title.localeCompare(b.title, 'de'),
    'loc':        (a, b) => a.loc.localeCompare(b.loc, 'de'),
  };

  function markDups() {
    const arr = [...all.values()].sort(sorters['date-desc']);
    const keys = new Set();
    for (const it of arr) {
      const k = norm(it.title).replace(/[^a-z0-9]/g, '') + '|' + it.price + '|' + it.loc;
      it.dup = keys.has(k);
      keys.add(k);
    }
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */
  const CSS = `
html.wgf-on .classified-list, html.wgf-on ul.pagination { display: none !important; }
html.wgf-on #block-system-main > h1, html.wgf-on .region-content > h1 { display: none !important; }
html.wgf-on.wgf-wide aside.sidebar, html.wgf-on.wgf-wide .sidebar-left, html.wgf-on.wgf-wide .sidebar-right { display: none !important; }
html.wgf-on.wgf-wide #main-content { width: 100% !important; float: none !important; max-width: none !important; flex: 0 0 100% !important; }
.wgf { --o:#d9730d; --g:#2e7d32; --b:#1565c0; --bd:#dcdcdc; --mut:#6b6b6b; --bg:#fff; --bg2:#f6f6f4;
  font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:#222; display:grid; grid-template-columns: 270px minmax(0,1fr); gap:18px; margin: 12px 0 40px;
  position: relative; width: min(1500px, calc(100vw - 28px)); left: 50%; transform: translateX(-50%); box-sizing: border-box; }
.wgf *, .wgf *::before, .wgf *::after { box-sizing: border-box; }
.wgf button { font: inherit; cursor: pointer; }
.wgf-h1 { margin: 0 0 10px !important; font-size: 22px !important; font-weight: 650; }
.wgf-side { background: var(--bg); border: 1px solid var(--bd); border-radius: 10px; padding: 12px 14px; align-self: start; position: sticky; top: 8px; max-height: calc(100vh - 16px); overflow: auto; }
.wgf-sec { padding: 9px 0; border-bottom: 1px solid #eee; }
.wgf-sec:last-child { border-bottom: 0; }
.wgf-sec > label, .wgf-lbl { display:block; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--mut); margin-bottom: 5px; }
.wgf-sec small { text-transform:none; letter-spacing:0; font-weight:400; }
.wgf input[type=text], .wgf input[type=search], .wgf input[type=number], .wgf select { width: 100%; padding: 6px 8px; border: 1px solid var(--bd); border-radius: 6px; background: #fff; font: inherit; height: auto; box-shadow: none; }
.wgf input:focus, .wgf select:focus { outline: 2px solid color-mix(in srgb, var(--o) 40%, transparent); border-color: var(--o); }
.wgf-row { display: flex; gap: 6px; }
.wgf-seg { display:flex; border:1px solid var(--bd); border-radius:6px; overflow:hidden; }
.wgf-seg button { flex:1; padding:5px 4px; border:0; background:#fff; border-right:1px solid var(--bd); color:#333; }
.wgf-seg button:last-child { border-right:0; }
.wgf-seg button.on { background: var(--o); color:#fff; }
.wgf-chk { display:flex; align-items:center; gap:7px; margin: 5px 0 0; font-weight:400 !important; text-transform:none !important; letter-spacing:0 !important; color:#222 !important; font-size:13.5px !important; cursor:pointer; }
.wgf-chk input { margin:0; }
.wgf-chips { display:flex; flex-wrap:wrap; gap:5px; max-height: 210px; overflow:auto; }
.wgf-chip { border:1px solid var(--bd); background:#fff; border-radius:999px; padding:2px 9px; font-size:12.5px; color:#333; }
.wgf-chip b { font-weight:600; color: var(--mut); margin-left:3px; font-size:11.5px; }
.wgf-chip:hover { border-color: var(--o); }
.wgf-chip.on { background: var(--o); border-color: var(--o); color:#fff; }
.wgf-chip.on b { color:#fff; opacity:.85; }
.wgf-chip.zero { opacity:.45; }
.wgf-reset { width:100%; padding:7px; border:1px solid var(--bd); background:var(--bg2); border-radius:6px; margin-top:6px; }
.wgf-reset:hover { border-color: var(--o); }
.wgf-main { min-width:0; }
.wgf-bar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; background:var(--bg); border:1px solid var(--bd); border-radius:10px; padding:8px 12px; }
.wgf-count { font-weight:600; font-size:15px; }
.wgf-count span { font-weight:400; color:var(--mut); }
.wgf-stat { color:var(--mut); font-size:13px; }
.wgf-sp { flex:1; }
.wgf-bar select { width:auto; }
.wgf-btn { border:1px solid var(--bd); background:#fff; border-radius:6px; padding:5px 10px; }
.wgf-btn:hover { border-color:var(--o); }
.wgf-btn.on { background:var(--o); color:#fff; border-color:var(--o); }
.wgf-filtertoggle { display:none; }
.wgf-active { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 0; }
.wgf-active button { background:#fff3e6; border:1px solid #f0c9a0; color:#8a4300; border-radius:999px; padding:2px 10px; font-size:12.5px; }
.wgf-active button::after { content:" ×"; }
.wgf-prog { margin:8px 0 0; color:var(--mut); font-size:13px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.wgf-prog .bar { height:4px; flex:1 1 140px; max-width:260px; background:#e5e5e5; border-radius:3px; overflow:hidden; }
.wgf-prog .bar i { display:block; height:100%; background:var(--o); transition:width .2s; }
.wgf-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(215px, 1fr)); gap:12px; margin-top:12px; }
.wgf-card { position:relative; display:flex; flex-direction:column; background:var(--bg); border:1px solid var(--bd); border-radius:10px; overflow:hidden; color:inherit !important; text-decoration:none !important; transition: box-shadow .15s, border-color .15s; }
.wgf-card:hover { border-color:var(--o); box-shadow:0 3px 12px rgba(0,0,0,.12); }
.wgf-card.sold { opacity:.55; }
.wgf-card.isnew { border-color: var(--o); }
.wgf-img { position:relative; aspect-ratio:4/3; background:#eee; }
.wgf-img img { width:100%; height:100%; object-fit:cover; display:block; }
.wgf-noimg { height:100%; display:flex; align-items:center; justify-content:center; color:#999; font-size:13px; }
.wgf-badges { position:absolute; left:6px; top:6px; display:flex; flex-direction:column; align-items:flex-start; gap:4px; }
.wgf-bd { font-size:11px; font-weight:700; padding:1px 7px; border-radius:4px; color:#fff; background:#555; letter-spacing:.02em; }
.wgf-bd.new { background: var(--o); }
.wgf-bd.dealer { background: var(--g); }
.wgf-bd.req { background: var(--b); }
.wgf-bd.sold { background:#777; }
.wgf-x { position:absolute; right:6px; top:6px; width:26px; height:26px; border-radius:50%; border:0; background:rgba(0,0,0,.55); color:#fff; font-size:16px; line-height:1; opacity:0; transition:opacity .12s; padding:0; }
.wgf-card:hover .wgf-x, .wgf-table tr:hover .wgf-x { opacity:1; }
.wgf-body { padding:9px 11px 11px; display:flex; flex-direction:column; gap:3px; flex:1; }
.wgf-price { font-size:18px; font-weight:700; color:var(--o); }
.wgf-price.none { color:var(--mut); font-weight:500; font-size:15px; }
.wgf-title { font-weight:500; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:2.8em; }
.wgf-card:visited .wgf-title { color:#7b5ea7; }
.wgf-meta { display:flex; justify-content:space-between; gap:8px; color:var(--mut); font-size:12.5px; margin-top:auto; padding-top:4px; }
.wgf-meta span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wgf-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:3px; }
.wgf-tag { font-size:11.5px; background:var(--bg2); border:1px solid #e4e4e0; border-radius:4px; padding:0 6px; color:#444; }
.wgf-tag.cal { background:#eef4ff; border-color:#cfdcf5; color:#1f4a99; }
.wgf-table { width:100%; border-collapse:collapse; margin-top:12px; background:var(--bg); border:1px solid var(--bd); border-radius:10px; overflow:hidden; }
.wgf-table th { text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--mut); padding:7px 9px; background:var(--bg2); border-bottom:1px solid var(--bd); white-space:nowrap; position:sticky; top:0; }
.wgf-table th[data-sortth] { cursor:pointer; }
.wgf-table th[data-sortth]:hover { color:var(--o); }
.wgf-table td { padding:5px 9px; border-bottom:1px solid #eee; vertical-align:middle; }
.wgf-table tr:hover td { background:#fffaf3; }
.wgf-table tr.sold td { opacity:.5; }
.wgf-table td.r, .wgf-table th.r { text-align:right; white-space:nowrap; }
.wgf-table img { width:54px; height:40px; object-fit:cover; border-radius:4px; display:block; background:#eee; }
.wgf-table a.t { color:#222 !important; text-decoration:none !important; font-weight:500; }
.wgf-table a.t:hover { color:var(--o) !important; }
.wgf-table a.t:visited { color:#7b5ea7 !important; }
.wgf-table .p { font-weight:700; color:var(--o); }
.wgf-table .x { position:static; opacity:.35; background:#888; width:22px; height:22px; }
.wgf-empty { margin:30px 0; text-align:center; color:var(--mut); }
.wgf-pager { display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin:12px 0 0; }
.wgf-pager.bottom { margin:16px 0 0; justify-content:center; }
.wgf-pager button { min-width:34px; height:32px; padding:0 8px; border:1px solid var(--bd); background:#fff; border-radius:8px; color:#333; }
.wgf-pager button:hover:not(:disabled):not(.on) { border-color:var(--o); color:var(--o); }
.wgf-pager button.on { background:var(--o); border-color:var(--o); color:#fff; font-weight:600; }
.wgf-pager button:disabled { opacity:.35; cursor:default; }
.wgf-pager .gap { padding:0 4px; color:var(--mut); }
.wgf-pager .info { margin-left:10px; color:var(--mut); font-size:13px; }
@media (max-width: 900px) {
  .wgf { grid-template-columns: 1fr; }
  .wgf-side { display:none; position:static; max-height:none; }
  .wgf.open .wgf-side { display:block; }
  .wgf-filtertoggle { display:inline-block; }
  .wgf-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .wgf-table .hm { display:none; }
  .wgf-pager .info { display:none; }
}`;

  const AGE = [[0, 'Alle'], [1, 'Letzte 24 Stunden'], [3, 'Letzte 3 Tage'], [7, 'Letzte 7 Tage'], [14, 'Letzte 14 Tage'], [30, 'Letzte 30 Tage'], [90, 'Letzte 90 Tage']];
  const SORTS = [['date-desc', 'Neueste zuerst'], ['date-asc', 'Älteste zuerst'], ['price-asc', 'Preis aufsteigend'], ['price-desc', 'Preis absteigend'], ['title', 'Titel A–Z'], ['loc', 'Ort A–Z']];

  const root = document.createElement('div');
  root.id = 'wgf';
  root.className = 'wgf';
  root.innerHTML = `
  <aside class="wgf-side">
    <div class="wgf-sec"><label>Im Ergebnis suchen</label>
      <input type="search" data-f="q" placeholder='glock -magazin "cz 75"'>
      <small style="color:#888">Mit <code>-</code> ausschließen, <code>"..."</code> für Phrasen. Taste <kbd>/</kbd> fokussiert.</small></div>
    <div class="wgf-sec"><label>Preis (€)</label>
      <div class="wgf-row"><input type="number" min="0" step="10" data-f="pmin" placeholder="von"><input type="number" min="0" step="10" data-f="pmax" placeholder="bis"></div>
      <label class="wgf-chk"><input type="checkbox" data-f="noPrice"> Ohne Preis ausblenden</label></div>
    <div class="wgf-sec"><label>Anbieter</label>
      <div class="wgf-seg" data-seg="who"><button data-v="all">Alle</button><button data-v="priv">Privat</button><button data-v="dealer">Händler</button></div></div>
    <div class="wgf-sec"><label>Art</label>
      <div class="wgf-seg" data-seg="kind"><button data-v="offer">Angebote</button><button data-v="request">Gesuche</button><button data-v="all">Beides</button></div></div>
    <div class="wgf-sec"><label>Eingestellt</label>
      <select data-f="age">${AGE.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="wgf-sec"><label>Ort <small>(mehrere mit Komma)</small></label>
      <input type="text" data-f="loc" list="wgf-locs" placeholder="z.B. Graz, Wien, Kärnten"><datalist id="wgf-locs"></datalist></div>
    <div class="wgf-sec"><label>Kaliber <small>(aus Titel erkannt)</small></label><div class="wgf-chips" id="wgf-cal"></div></div>
    <div class="wgf-sec"><label>Kategorie</label><div class="wgf-chips" id="wgf-cat"></div></div>
    <div class="wgf-sec"><label>Optionen</label>
      <label class="wgf-chk"><input type="checkbox" data-f="hideSold"> Verkauft/Reserviert ausblenden</label>
      <label class="wgf-chk"><input type="checkbox" data-f="dedupe"> Doppelte Inserate ausblenden</label>
      <label class="wgf-chk"><input type="checkbox" data-f="newOnly"> Nur neue seit letztem Besuch</label>
      <label class="wgf-chk"><input type="checkbox" data-f="showHidden"> Von mir ausgeblendete zeigen <span id="wgf-hcount"></span></label>
      <button class="wgf-reset" data-act="reset">Alle Filter zurücksetzen</button></div>
  </aside>
  <section class="wgf-main">
    <h1 class="wgf-h1">${esc((document.querySelector('#block-system-main > h1, .region-content h1') || {}).textContent || '')}</h1>
    <div class="wgf-bar">
      <button class="wgf-btn wgf-filtertoggle" data-act="toggle">Filter</button>
      <div class="wgf-count" id="wgf-count"></div>
      <div class="wgf-stat" id="wgf-stat"></div>
      <div class="wgf-sp"></div>
      <select data-f="sort" title="Sortierung">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <select data-f="ps" title="Einträge pro Seite">${[24, 48, 96, 200].map(n => `<option value="${n}">${n} pro Seite</option>`).join('')}</select>
      <div class="wgf-seg" data-seg="view" style="min-width:150px"><button data-v="cards">Karten</button><button data-v="table">Tabelle</button></div>
      <button class="wgf-btn" data-act="wide" title="Original-Seitenleisten ein/aus">Breit</button>
    </div>
    <div class="wgf-active" id="wgf-active"></div>
    <div class="wgf-prog" id="wgf-prog"></div>
    <div id="wgf-results"></div>
  </section>`;
  srcList.parentNode.insertBefore(root, srcList);

  const styleEl = document.createElement('style');
  styleEl.id = 'wgf-style';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  document.documentElement.classList.add('wgf-on');
  const applyWide = () => document.documentElement.classList.toggle('wgf-wide', !!s.wide);
  applyWide();

  const $ = sel => root.querySelector(sel);

  /* Kontrollen aus Zustand befüllen */
  function syncControls() {
    root.querySelectorAll('[data-f]').forEach(c => {
      const f = c.dataset.f;
      if (c.type === 'checkbox') c.checked = !!s[f]; else c.value = s[f];
    });
    root.querySelectorAll('[data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === s[g.dataset.seg])));
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  const fmtDate = d => {
    if (!d) return '';
    const n = new Date();
    const days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    const hm = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    if (days === 0) return 'heute ' + hm;
    if (days === 1) return 'gestern ' + hm;
    if (days > 1 && days < 7) return 'vor ' + days + ' Tagen';
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const badges = it => [
    it.isNew ? '<span class="wgf-bd new">NEU</span>' : '',
    it.sold ? `<span class="wgf-bd sold">${esc(it.soldLabel)}</span>` : '',
    it.kind === 'request' ? '<span class="wgf-bd req">GESUCH</span>' : '',
    it.partner ? `<span class="wgf-bd dealer">${esc(it.dealer || 'Händler')}</span>` : '',
  ].join('');

  const priceHTML = it => it.price != null
    ? `<div class="wgf-price">${fmtEUR(it.price)}</div>`
    : `<div class="wgf-price none">${esc(it.priceText || '–')}</div>`;

  const xBtn = it => `<button class="wgf-x" data-hide="${esc(it.id)}" title="${hidden[it.id] ? 'Wieder einblenden' : 'Ausblenden'}">${hidden[it.id] ? '↺' : '×'}</button>`;

  const cardHTML = it => `
  <a class="wgf-card${it.sold ? ' sold' : ''}${it.isNew ? ' isnew' : ''}" href="${esc(it.url)}" title="${esc(it.rawTitle)}">
    <div class="wgf-img">${it.img ? `<img loading="lazy" src="${esc(it.img)}" alt="">` : `<div class="wgf-noimg">${it.kind === 'request' ? 'Gesuch' : 'kein Bild'}</div>`}
      <div class="wgf-badges">${badges(it)}</div>${xBtn(it)}</div>
    <div class="wgf-body">${priceHTML(it)}
      <div class="wgf-title">${esc(it.title)}</div>
      ${it.cals.length ? `<div class="wgf-tags">${it.cals.slice(0, 2).map(c => `<span class="wgf-tag cal">${esc(c)}</span>`).join('')}</div>` : ''}
      <div class="wgf-meta"><span title="${esc(it.loc)}">${esc(it.loc)}</span><span title="${esc(it.dateText)}">${esc(fmtDate(it.date))}</span></div>
    </div></a>`;

  const rowHTML = it => `
  <tr class="${it.sold ? 'sold' : ''}">
    <td style="width:62px">${it.img ? `<img loading="lazy" src="${esc(it.img)}" alt="">` : ''}</td>
    <td><a class="t" href="${esc(it.url)}">${esc(it.title)}</a> ${badges(it)}</td>
    <td class="hm">${it.cals.slice(0, 2).map(c => `<span class="wgf-tag cal">${esc(c)}</span>`).join(' ')}</td>
    <td class="r p">${it.price != null ? fmtEUR(it.price) : `<span style="color:#888;font-weight:400">${esc(it.priceText || '–')}</span>`}</td>
    <td class="hm">${esc(it.loc)}</td>
    <td class="r" title="${esc(it.dateText)}">${esc(fmtDate(it.date))}</td>
    <td style="width:30px">${xBtn(it)}</td>
  </tr>`;

  const sortTh = (key, label, cls) => {
    const asc = key + '-asc', desc = key + '-desc';
    const arrow = s.sort === asc ? ' ▲' : s.sort === desc ? ' ▼' : '';
    return `<th class="${cls || ''}" data-sortth="${key}">${label}${arrow}</th>`;
  };

  function pagerHTML(total, cur) {
    const n = Math.ceil(total / s.ps);
    if (n <= 1) return '';
    const set = new Set([0, n - 1]);
    for (let i = cur - 2; i <= cur + 2; i++) if (i >= 0 && i < n) set.add(i);
    let html = '<nav class="wgf-pager" aria-label="Seiten">';
    html += `<button data-page="${cur - 1}" ${cur === 0 ? 'disabled' : ''} title="Vorherige Seite">‹</button>`;
    let prev = -1;
    for (const p of [...set].sort((x, y) => x - y)) {
      if (p - prev > 1) html += '<span class="gap">…</span>';
      html += `<button data-page="${p}" class="${p === cur ? 'on' : ''}">${p + 1}</button>`;
      prev = p;
    }
    html += `<button data-page="${cur + 1}" ${cur >= n - 1 ? 'disabled' : ''} title="Nächste Seite">›</button>`;
    html += `<span class="info">${cur * s.ps + 1}–${Math.min(total, (cur + 1) * s.ps)} von ${total}</span></nav>`;
    return html;
  }

  function renderResults() {
    const box = $('#wgf-results');
    if (!current.length) {
      box.innerHTML = `<div class="wgf-empty">${loading ? 'Lade …' : 'Keine Inserate für diese Filter.'}</div>`;
      return;
    }
    const slice = current.slice(pageNo * s.ps, (pageNo + 1) * s.ps);
    let html;
    if (s.view === 'table') {
      html = `<table class="wgf-table"><thead><tr><th></th>
        <th data-sortth="title">Titel${s.sort === 'title' ? ' ▲' : ''}</th><th class="hm">Kaliber</th>${sortTh('price', 'Preis', 'r')}<th class="hm" data-sortth="loc">Ort${s.sort === 'loc' ? ' ▲' : ''}</th>${sortTh('date', 'Datum', 'r')}<th></th></tr></thead>
        <tbody>${slice.map(rowHTML).join('')}</tbody></table>`;
    } else {
      html = `<div class="wgf-grid">${slice.map(cardHTML).join('')}</div>`;
    }
    const pager = pagerHTML(current.length, pageNo);
    box.innerHTML = pager + html + pager.replace('class="wgf-pager"', 'class="wgf-pager bottom"');
  }

  const scrollToResults = () => {
    const h = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--wgh-h'), 10) || 0;
    const top = $('.wgf-bar').getBoundingClientRect().top + window.scrollY - h - 10;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  };

  const chipHTML = (f, v, n, on) => `<button class="wgf-chip${on ? ' on' : ''}${n === 0 ? ' zero' : ''}" data-chip="${f}" data-v="${esc(v)}">${esc(v)}<b>${n}</b></button>`;

  function renderFacets() {
    const calC = new Map(), catC = new Map(), locC = new Map();
    for (const it of all.values()) {
      if (matches(it, 'cal')) it.cals.forEach(c => inc(calC, c));
      if (matches(it, 'cat')) inc(catC, it.cat);
      if (it.city) inc(locC, it.city);
    }
    const build = (f, map, sel) => {
      const keys = new Set([...map.keys(), ...sel]);
      return [...keys].sort((a, b) => (map.get(b) || 0) - (map.get(a) || 0) || a.localeCompare(b, 'de'))
        .map(k => chipHTML(f, k, map.get(k) || 0, sel.includes(k))).join('') || '<span style="color:#999;font-size:13px">–</span>';
    };
    $('#wgf-cal').innerHTML = build('cals', calC, s.cals);
    $('#wgf-cat').innerHTML = build('cats', catC, s.cats);
    const dl = $('#wgf-locs');
    const sig = [...locC.keys()].length;
    if (dl.dataset.n !== String(sig)) {
      dl.dataset.n = sig;
      dl.innerHTML = [...locC.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([c]) => `<option value="${esc(c)}">`).join('');
    }
    const hc = Object.keys(hidden).length;
    $('#wgf-hcount').textContent = hc ? `(${hc})` : '';
  }

  function renderBar() {
    const total = [...all.values()].filter(it => s.kind === 'all' || it.kind === s.kind).length;
    $('#wgf-count').innerHTML = `${current.length} <span>von ${total} Inseraten</span>`;
    const prices = current.filter(i => i.price != null && i.kind === 'offer').map(i => i.price).sort((a, b) => a - b);
    if (prices.length >= 3) {
      const med = prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
      const pct = p => prices[Math.min(prices.length - 1, Math.floor(p * (prices.length - 1)))];
      $('#wgf-stat').textContent = `Median ${fmtEUR(Math.round(med))} · typisch ${fmtEUR(Math.round(pct(0.1)))} – ${fmtEUR(Math.round(pct(0.9)))}`;
    } else $('#wgf-stat').textContent = '';

    const act = [];
    const add = (label, fn) => act.push([label, fn]);
    if (s.q) add('Suche: ' + s.q, () => s.q = '');
    if (s.pmin !== '') add('ab ' + s.pmin + ' €', () => s.pmin = '');
    if (s.pmax !== '') add('bis ' + s.pmax + ' €', () => s.pmax = '');
    if (s.noPrice) add('nur mit Preis', () => s.noPrice = false);
    if (s.who !== 'all') add(s.who === 'priv' ? 'nur Privat' : 'nur Händler', () => s.who = 'all');
    if (s.kind !== 'offer') add(s.kind === 'request' ? 'nur Gesuche' : 'Angebote + Gesuche', () => s.kind = 'offer');
    if (s.age) add('letzte ' + s.age + ' Tage', () => s.age = 0);
    if (s.loc) add('Ort: ' + s.loc, () => s.loc = '');
    if (s.newOnly) add('nur neue', () => s.newOnly = false);
    s.cals.forEach(c => add('Kaliber ' + c, () => s.cals = s.cals.filter(x => x !== c)));
    s.cats.forEach(c => add(c, () => s.cats = s.cats.filter(x => x !== c)));
    window.__wgfClears = act.map(a => a[1]);
    $('#wgf-active').innerHTML = act.map(([l], i) => `<button data-clear="${i}">${esc(l)}</button>`).join('');

    const p = $('#wgf-prog');
    if (loading) {
      p.innerHTML = `<span>Lade Seite ${loadedPages} / ${Math.min(totalPages, MAXP)} …</span><span class="bar"><i style="width:${Math.round(100 * loadedPages / Math.max(1, Math.min(totalPages, MAXP)))}%"></i></span>`;
    } else {
      const t = loadedAt ? loadedAt.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : '';
      let h = `<span>${all.size} Inserate aus ${loadedPages} Seiten${t ? ' · Stand ' + t : ''}${pageErrors ? ` · <b style="color:#b00">${pageErrors} Seite(n) fehlgeschlagen</b>` : ''}</span>
        <button class="wgf-btn" data-act="reload">Neu laden</button>`;
      if (totalPages > loadedPages) h += `<button class="wgf-btn" data-act="loadmore">Weitere ${Math.min(MAXP, totalPages - loadedPages)} Seiten laden (${totalPages - loadedPages} offen)</button>`;
      p.innerHTML = h;
    }
    root.querySelectorAll('[data-seg="view"] button').forEach(b => b.classList.toggle('on', b.dataset.v === s.view));
    root.querySelector('[data-act="wide"]').classList.toggle('on', !!s.wide);
  }

  function render(resetShown) {
    prepare();
    if (resetShown) pageNo = 0;
    current = [...all.values()].filter(it => matches(it)).sort(sorters[s.sort] || sorters['date-desc']);
    pageNo = Math.min(pageNo, Math.max(0, Math.ceil(current.length / s.ps) - 1));
    renderFacets();
    renderBar();
    renderResults();
  }
  const scheduleRender = debounce(() => render(false), 120);

  /* ------------------------------------------------------------------ */
  /* Laden aller Seiten                                                  */
  /* ------------------------------------------------------------------ */
  const baseKey = () => { const u = new URL(location.href); u.searchParams.delete('page'); u.hash = ''; return u.pathname + u.search; };
  const pageUrl = n => { const u = new URL(location.href); u.hash = ''; if (n > 0) u.searchParams.set('page', n); else u.searchParams.delete('page'); return u.href; };

  function lastPageIndex() {
    let max = parseInt(new URL(location.href).searchParams.get('page') || '0', 10) || 0;
    document.querySelectorAll('ul.pagination a[href*="page="]').forEach(a => {
      const m = a.getAttribute('href').match(/[?&]page=(\d+)/);
      if (m) max = Math.max(max, +m[1]);
    });
    return max;
  }

  const CKEY = 'wgf:cache:' + baseKey();
  const readCache = () => { try { const c = JSON.parse(sessionStorage.getItem(CKEY)); if (c && Date.now() - c.t < 10 * 60 * 1000) return c; } catch (e) {} return null; };
  const writeCache = () => { try { sessionStorage.setItem(CKEY, JSON.stringify({ t: Date.now(), pages: loadedPages, total: totalPages, items: [...all.values()].map(i => { const o = { ...i }; delete o.hay; delete o.hayC; delete o.locN; delete o.dup; delete o.isNew; o.date = i.date ? +i.date : null; return o; }) })); } catch (e) {} };

  const addItem = it => { if (it && !all.has(it.id)) all.set(it.id, finishItem(it)); };

  function stampNew() {
    for (const it of all.values()) {
      if (!seen.ids[it.id]) seen.ids[it.id] = NOW;
      it.isNew = seen.ids[it.id] > seen.prev && seen.ids[it.id] > seen.init;
    }
    const keys = Object.keys(seen.ids);
    if (keys.length > 6000) { keys.sort((a, b) => seen.ids[a] - seen.ids[b]).slice(0, keys.length - 4000).forEach(k => delete seen.ids[k]); }
    save(SKEY, seen);
  }

  async function fetchPage(n) {
    const r = await fetch(pageUrl(n), { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    return [...doc.querySelectorAll('.classified-list .classified-teaser')].map(t => parseTeaser(t, r.url)).filter(Boolean);
  }

  async function loadPages(from, to) {
    loading = true;
    const idx = []; for (let i = from; i < to; i++) idx.push(i);
    let next = 0;
    const worker = async () => {
      while (next < idx.length) {
        const n = idx[next++];
        try { (await fetchPage(n)).forEach(addItem); }
        catch (e) { try { (await fetchPage(n)).forEach(addItem); } catch (e2) { pageErrors++; } }
        loadedPages++;
        markDups(); stampNew(); scheduleRender();
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    loading = false;
    loadedAt = new Date();
    markDups(); stampNew(); writeCache();
    render(false);
  }

  async function start(force) {
    all.clear(); loadedPages = 0; pageErrors = 0;
    totalPages = lastPageIndex() + 1;
    if (!force) {
      const c = readCache();
      if (c) {
        c.items.forEach(i => { i.date = i.date ? new Date(i.date) : null; addItem(i); });
        loadedPages = c.pages; totalPages = Math.max(totalPages, c.total); loadedAt = new Date(c.t);
        markDups(); stampNew(); render(true);
        return;
      }
    }
    // Aktuelle Seite sofort anzeigen, damit nicht erst alles geladen werden muss
    srcList.querySelectorAll('.classified-teaser').forEach(t => addItem(parseTeaser(t, location.href)));
    markDups(); stampNew(); render(true);
    all.clear();
    await loadPages(0, Math.min(totalPages, MAXP));
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  const changed = (reset = true) => { saveState(); render(reset); };
  const onText = debounce(() => changed(), 160);

  root.addEventListener('input', e => {
    const c = e.target.closest('[data-f]'); if (!c) return;
    if (c.type === 'checkbox' || c.tagName === 'SELECT') return;
    s[c.dataset.f] = c.value; onText();
  });
  root.addEventListener('change', e => {
    const c = e.target.closest('[data-f]'); if (!c) return;
    const f = c.dataset.f;
    if (c.type === 'checkbox') s[f] = c.checked;
    else if (f === 'age' || f === 'ps') s[f] = +c.value;
    else s[f] = c.value;
    changed();
  });

  root.addEventListener('click', e => {
    const t = e.target;
    const hide = t.closest('[data-hide]');
    if (hide) {
      e.preventDefault(); e.stopPropagation();
      const id = hide.dataset.hide;
      if (hidden[id]) delete hidden[id]; else hidden[id] = Date.now();
      save('wgf:hidden', hidden);
      return render(false);
    }
    const seg = t.closest('[data-seg] button');
    if (seg) { s[seg.parentElement.dataset.seg] = seg.dataset.v; syncControls(); return changed(seg.parentElement.dataset.seg !== 'view'); }
    const chip = t.closest('[data-chip]');
    if (chip) {
      const f = chip.dataset.chip, v = chip.dataset.v;
      s[f] = s[f].includes(v) ? s[f].filter(x => x !== v) : [...s[f], v];
      return changed();
    }
    const clr = t.closest('[data-clear]');
    if (clr) { window.__wgfClears[+clr.dataset.clear](); syncControls(); return changed(); }
    const th = t.closest('[data-sortth]');
    if (th) {
      const k = th.dataset.sortth;
      if (k === 'title' || k === 'loc') s.sort = k;
      else s.sort = s.sort === k + '-asc' ? k + '-desc' : k + '-asc';
      syncControls(); return changed();
    }
    const pg = t.closest('[data-page]');
    if (pg) {
      if (!pg.disabled) { pageNo = +pg.dataset.page; renderResults(); scrollToResults(); }
      return;
    }
    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'reset': Object.assign(s, { ...defaults, view: s.view, wide: s.wide, sort: s.sort, ps: s.ps }); syncControls(); changed(); break;
      case 'toggle': root.classList.toggle('open'); break;
      case 'wide': s.wide = !s.wide; applyWide(); changed(false); break;
      case 'reload': try { sessionStorage.removeItem(CKEY); } catch (er) {} start(true); break;
      case 'loadmore': { const from = loadedPages; loadPages(from, Math.min(totalPages, from + MAXP)); break; }
    }
  });

  root.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.matches('input[type=search]')) { e.target.value = ''; s.q = ''; changed(); } });
  const onKey = e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); $('[data-f="q"]').focus(); }
  };
  document.addEventListener('keydown', onKey);

  cleanups.push(() => {
    document.removeEventListener('keydown', onKey);
    root.remove(); styleEl.remove();
    document.documentElement.classList.remove('wgf-on', 'wgf-wide');
  });
  window.__wgf.dbg = () => ({ n: all.size, shown: current.length, pages: loadedPages, total: totalPages, err: pageErrors });

  syncControls();
  start(false);
})();
