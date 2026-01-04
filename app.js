/* Car Rental Demo SPA (BG) powered by design.json */
(async function () {
  const app = document.getElementById('app');
  const design = await fetch('./design.json').then(r => r.json()).catch(() => null);
  const API_BASE = 'http://localhost:5175';

  // Map tokens to CSS variables
  function applyTokens(tokens) {
    if (!tokens) return;
    const root = document.documentElement;
    const palette = tokens.theme?.palette || {};
    const radii = tokens.theme?.radii || {};
    const shadows = tokens.theme?.shadows || {};
    const set = (k, v) => root.style.setProperty(k, v);
    if (palette.surface?.canvas) set('--color-canvas', palette.surface.canvas);
    if (palette.surface?.elevated) set('--color-surface', palette.surface.elevated);
    if (palette.surface?.muted) set('--color-muted', palette.surface.muted);
    if (palette.border?.default) set('--color-border', palette.border.default);
    if (palette.primary?.DEFAULT) set('--color-primary', palette.primary.DEFAULT);
    if (palette.text?.primary) set('--color-text', palette.text.primary);
    if (palette.text?.secondary) set('--color-text-2', palette.text.secondary);
    if (palette.text?.tertiary) set('--color-text-3', palette.text.tertiary);
    if (radii?.lg) set('--radius-lg', `${radii.lg}px`);
    if (radii?.md) set('--radius-md', `${radii.md}px`);
    if (shadows?.md) set('--shadow-md', shadows.md);
    if (shadows?.lg) set('--shadow-lg', shadows.lg);
  }
  applyTokens(design);

  // Utility
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const formatMoney = (v) => `$${v.toFixed(2)}`;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const carParamsCache = new Map();
  const RES_STATUS = [
    { value: 'REQUESTED', label: 'Заявка' },
    { value: 'APPROVED', label: 'Одобрена' },
    { value: 'DECLINED', label: 'Отказана' },
    { value: 'PAID', label: 'Платена' },
    { value: 'COMPLETED', label: 'Изпълнена' }
  ];
  const statusLabel = (v) => (RES_STATUS.find(s => s.value === v)?.label) || v || '';
  const fmtDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => n.toString().padStart(2,'0');
    return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fmtRange = (a,b) => `${fmtDate(a)} → ${fmtDate(b)}`;
  const snapMinutesLocal = (val) => {
    if (!val) return val;
    const parts = val.split('T');
    if (parts.length !== 2) return val;
    const datePart = parts[0];
    const timePart = parts[1] || '';
    const [hh, mm] = timePart.split(':');
    const h = Number(hh);
    const m = Number(mm);
    if (isNaN(h) || isNaN(m)) return val;
    const snapped = m < 30 ? 0 : 30;
    const mmStr = snapped === 0 ? '00' : '30';
    return `${datePart}T${String(h).padStart(2,'0')}:${mmStr}`;
  };
  const isOverlap = (aStart, aEnd, bStart, bEnd) => {
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    const a1 = new Date(aStart); const a2 = new Date(aEnd);
    const b1 = new Date(bStart); const b2 = new Date(bEnd);
    if (isNaN(a1) || isNaN(a2) || isNaN(b1) || isNaN(b2)) return false;
    return a1 <= b2 && b1 <= a2;
  };
  async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    headers['accept'] = headers['accept'] || 'application/json';
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    // Avoid 304 cached responses in the embedded browser
    headers['cache-control'] = headers['cache-control'] || 'no-cache';
    const fetchOpts = { cache: 'no-store', ...options, headers };
    const res = await fetch(`${API_BASE}${path}`, fetchOpts);
    if (res.status === 304) {
      // Force re-fetch bypassing cache
      const bust = await fetch(`${API_BASE}${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`, { ...fetchOpts, cache: 'no-store' });
      if (!bust.ok) throw new Error((await bust.text().catch(()=>'')) || `HTTP ${bust.status}`);
      try { return await bust.json(); } catch { return {}; }
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `HTTP ${res.status}`);
    }
    // Handle no-content responses (DELETE etc.)
    if (res.status === 204 || res.status === 205 || res.headers.get('content-length') === '0') return {};
    try { return await res.json(); } catch { return {}; }
  }
  // Transliteration helpers (BG <-> Latin) for matching
  function toLatin(str) {
    if (!str) return '';
    const map = {
      'А':'A','а':'a','Б':'B','б':'b','В':'V','в':'v','Г':'G','г':'g','Д':'D','д':'d','Е':'E','е':'e','Ж':'Zh','ж':'zh','З':'Z','з':'z','И':'I','и':'i','Й':'Y','й':'y','К':'K','к':'k','Л':'L','л':'l','М':'M','м':'m','Н':'N','н':'n','О':'O','о':'o','П':'P','п':'p','Р':'R','р':'r','С':'S','с':'s','Т':'T','т':'t','У':'U','у':'u','Ф':'F','ф':'f','Х':'H','х':'h','Ц':'Ts','ц':'ts','Ч':'Ch','ч':'ch','Ш':'Sh','ш':'sh','Щ':'Sht','щ':'sht','Ъ':'A','ъ':'a','Ь':'','ь':'','Ю':'Yu','ю':'yu','Я':'Ya','я':'ya'
    };
    return [...str].map(ch => map[ch] ?? ch).join('');
  }
  const normalize = (s) => toLatin(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  function matchQuery(haystack, query) {
    const a = normalize(haystack);
    const b = normalize(query);
    return a.includes(b);
  }
  function getParamIcon(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('вид кола')) return '🚗';
    if (n.includes('скоростна')) return '⚙️';
    if (n.includes('врати')) return '🚪';
    if (n.includes('багаж')) return '🧳';
    if (n.includes('гориво')) return '⛽';
    if (n.includes('конски') || n.includes('мощност')) return '🐎';
    if (n.includes('седалки') || n.includes('места')) return '👤';
    return '•';
  }
  async function loadCarParams(carId) {
    if (carParamsCache.has(carId)) return carParamsCache.get(carId);
    try {
      const defs = Array.isArray(paramDefs) && paramDefs.length ? paramDefs : await apiFetch('/api/params');
      const vals = await apiFetch(`/api/cars/${carId}/params`).catch(() => []);
      const merged = (defs || []).map(d => {
        const v = (vals || []).find(x => x.id === d.id);
        return { id: d.id, name: d.name, type: d.type, unit: d.unit, value: v?.value ?? null };
      });
      carParamsCache.set(carId, merged);
      return merged;
    } catch {
      const empty = [];
      carParamsCache.set(carId, empty);
      return empty;
    }
  }
  function attachTypeahead(inputEl, options) {
    const wrap = inputEl.closest('.ta-wrap') || inputEl.parentElement;
    if (!wrap) return;
    let listEl = $('.typeahead-list', wrap);
    if (!listEl) {
      listEl = document.createElement('div');
      listEl.className = 'typeahead-list';
      wrap.appendChild(listEl);
    }
    listEl.style.display = 'none';
    function render() {
      const q = inputEl.value.trim();
      const items = !q ? options.slice(0, 10) : options.filter(o => matchQuery(o, q)).slice(0, 10);
      if (!items.length) { listEl.style.display = 'none'; return; }
      listEl.innerHTML = items.map((o, i) => `<div class="typeahead-item" data-i="${i}">${o}</div>`).join('');
      // Position fixed to avoid clipping issues
      const rect = inputEl.getBoundingClientRect();
      listEl.style.position = 'fixed';
      listEl.style.left = `${rect.left}px`;
      listEl.style.top = `${rect.bottom + 6}px`;
      listEl.style.width = `${rect.width}px`;
      listEl.style.zIndex = '9999';
      listEl.style.display = 'block';
      $$('.typeahead-item', listEl).forEach(it => it.onclick = () => { inputEl.value = it.textContent; listEl.style.display = 'none'; inputEl.dispatchEvent(new Event('change')); });
    }
    inputEl.addEventListener('input', render);
    inputEl.addEventListener('focus', render);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') listEl.style.display = 'none';
      if (e.key === 'Enter') {
        const first = $('.typeahead-item', listEl);
        if (first) { inputEl.value = first.textContent; listEl.style.display = 'none'; }
      }
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) listEl.style.display = 'none'; });
  }
  function showModal(html, onMount) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal-card">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    if (onMount) onMount(wrap, close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    return { close };
  }

  // Data (seed and localStorage)
  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  };

  const exampleCar = design?.data?.examples?.car || {
    id: 'sample',
    brand: 'Ford',
    model: 'Focus',
    trim: '',
    year: 2025,
    pricePerDay: 60,
    rating: 4.8,
    reviewsCount: 300,
    distanceKm: 0.9,
    etaMin: 2,
    bodyStyle: 'Hatchback',
    transmission: 'Manual',
    fuel: 'Diesel',
    seats: 5,
    images: []
  };

  const brands = ['Ford', 'Toyota', 'Kia', 'BMW', 'Audi', 'Tesla', 'Hyundai', 'VW'];
  function cloneCars(n = 12) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const b = brands[i % brands.length];
      items.push({
        ...exampleCar,
        id: `${exampleCar.id}-${i}`,
        brand: b,
        model: i % 2 ? 'EcoBlue' : 'Focus',
        trim: '',
        pricePerDay: 40 + (i % 7) * 5 + (i % 3) * 2,
        rating: 4 + (i % 10) / 10,
        distanceKm: 0.4 + (i % 5) * 0.3,
        etaMin: 1 + (i % 4),
        transmission: i % 2 ? 'Automatic' : 'Manual',
        fuel: ['Diesel', 'Petrol', 'Electric'][i % 3],
        seats: [4, 5, 7][i % 3],
        favorite: false,
        status: 'наличен',
        type: ['Лека кола', 'Джип', 'Товарен бус'][i % 3]
      });
    }
    return items;
  }
  async function fetchCarById(id) {
    try {
      const res = await fetch(`${API_BASE}/api/cars/${id}`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('Failed');
      const c = await res.json();
      return {
        id: c.id,
        brand: c.brand,
        model: c.model,
        trim: c.trim,
        pricePerDay: c.pricePerDay ?? 0,
        transmission: c.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual',
        fuel: c.fuel ? c.fuel.charAt(0) + c.fuel.slice(1).toLowerCase() : '',
        seats: c.seats || null,
        bodyStyle: c.bodyStyle || '',
        type: c.type || '',
        images: Array.isArray(c.images) ? c.images : [],
        status: c.status === 'SERVICE' ? 'в сервиз' : c.status === 'RESERVED' ? 'резервиран' : 'наличен'
      };
    } catch (e) { console.error(e); return null; }
  }
  function normalizeInvoiceItems(items) {
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items)) return [];
    return items.map(it => {
      const qty = Number(it.qty ?? 1);
      const unitPrice = Number(it.unitPrice ?? 0);
      const vatRate = Number(it.vatRate ?? 20);
      const totalNet = qty * unitPrice;
      const totalVat = totalNet * (vatRate / 100);
      const totalGross = totalNet + totalVat;
      return {
        description: it.description || 'Услуга',
        qty,
        unitPrice,
        vatRate,
        totalNet,
        totalVat,
        totalGross
      };
    });
  }
  function calcInvoiceTotals(items) {
    const subtotal = items.reduce((s, it) => s + (it.totalNet || 0), 0);
    const vatAmount = items.reduce((s, it) => s + (it.totalVat || 0), 0);
    const total = items.reduce((s, it) => s + (it.totalGross || 0), 0);
    return { subtotal, vatAmount, total };
  }
  async function fetchCarsFromApi() {
    try {
      const res = await fetch(`${API_BASE}/api/cars`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Map API enums to UI fields
      let list = data.map(c => ({
        id: c.id,
        brand: c.brand, model: c.model, trim: c.trim,
        pricePerDay: c.pricePerDay ?? 0,
        transmission: c.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual',
        fuel: c.fuel ? c.fuel.charAt(0) + c.fuel.slice(1).toLowerCase() : 'Diesel',
        seats: c.seats || 5,
        bodyStyle: c.bodyStyle || '',
        rating: typeof c.rating === 'number' ? c.rating : 4.6,
        distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : 0.8,
        etaMin: typeof c.etaMin === 'number' ? c.etaMin : 3,
        type: c.type || 'Лека кола',
        images: Array.isArray(c.images) ? c.images : [],
        status: c.status === 'SERVICE' ? 'в сервиз' : c.status === 'RESERVED' ? 'резервиран' : 'наличен',
        favorite: false
      }));
      // Overlay values from dynamic parameters (e.g., 'Вид кола', 'Скоростна кутия')
      // Ensure paramDefs are loaded
      try {
        if (!Array.isArray(paramDefs) || !paramDefs.length) {
          paramDefs = await apiFetch('/api/params');
        }
        const typeDef = (paramDefs || []).find(p => p.name === 'Вид кола');
        const gearDef = (paramDefs || []).find(p => p.name === 'Скоростна кутия');
        if (typeDef || gearDef) {
          list = await Promise.all(list.map(async (car) => {
            try {
              const vals = await apiFetch(`/api/cars/${car.id}/params`);
              if (typeDef) {
                const v = (vals || []).find(x => x.id === typeDef.id)?.value;
                if (v) car.type = v;
              }
              if (gearDef) {
                const g = (vals || []).find(x => x.id === gearDef.id)?.value;
                if (g) car.transmission = g;
              }
            } catch {}
            return car;
          }));
        }
      } catch {}
      return list;
    } catch {
      return null;
    }
  }
  let cars = await fetchCarsFromApi() || storage.get('cr_cars', cloneCars());
  storage.set('cr_cars', cars);
  let filtered = [...cars];
  let selected = filtered[0];
  let reservations = [];
  let showMoreFilters = false;
  const params = storage.get('cr_params', {
    'Вид кола': { type: 'enum', options: ['Лека кола', 'Джип', 'Товарен бус'] },
    'Конски сили': { type: 'number', unit: 'к.с.' }
  });
  storage.set('cr_params', params);
  storage.set('cr_company', storage.get('cr_company', {
    name: 'CarRent BG OOD',
    vat: 'BG123456789',
    address: 'ул. Пример 1, София',
    iban: 'BG00UNCR00000000000000'
  }));
  // Допълнителни филтри по параметри (id -> value), попълват се от „Още филтри“
  let extraFilters = {};
  // Load parameter definitions from API for dynamic filters
  let paramDefs = [];
  async function loadReservations() {
    try { reservations = await apiFetch('/api/reservations'); }
    catch { reservations = storage.get('cr_reservations', []); }
  }
  async function loadParamDefs() {
    try {
      paramDefs = await apiFetch('/api/params');
    } catch {
      paramDefs = [];
    }
  }
  await loadParamDefs();
  await loadReservations();

  // Placeholders
  function carPlaceholderSVG(title = 'Car', w = 640, h = 360, hue = 205) {
    const bg = `hsl(${hue}, 95%, 95%)`;
    const stroke = `hsl(${hue}, 70%, 70%)`;
    const t = encodeURIComponent(title);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop stop-color='${bg}' offset='0'/>
          <stop stop-color='#fff' offset='1'/>
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <g fill='none' stroke='${stroke}' stroke-width='3'>
        <rect x='24' y='${h/2-50}' rx='12' ry='12' width='${w-48}' height='100'/>
        <circle cx='120' cy='${h/2+55}' r='22'/>
        <circle cx='${w-120}' cy='${h/2+55}' r='22'/>
      </g>
      <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, Arial' font-size='22' fill='hsl(${hue},40%,35%)'>${t}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${svg}`;
  }

  // Router
  function mountSearchLayout() {
    app.innerHTML = `
      <nav class="topnav">
        <div class="logo">CR</div>
        <a class="navbtn active" href="#/" title="Търсене">🔎</a>
        <a class="navbtn" href="#/admin" title="Админ">🛠️</a>
        <div class="spacer"></div>
      </nav>
      <section class="panel filters" id="filters"></section>
      <section class="panel results" id="results"></section>
      <section class="panel details" id="details"></section>
    `;
  }
  function mountAdminLayout() {
    app.innerHTML = `
      <nav class="topnav">
        <div class="logo">CR</div>
        <a class="navbtn" href="#/" title="Търсене">🔎</a>
        <a class="navbtn active" href="#/admin" title="Админ">🛠️</a>
        <div class="spacer"></div>
      </nav>
      <section class="panel" style="grid-column: 1 / -1;" id="adminRoot"></section>
    `;
  }
  function navigate(hash) { if (location.hash !== hash) location.hash = hash; else renderRoute(); }
  window.addEventListener('hashchange', renderRoute);

  // Filters
  const filterState = {
    query: '',
    rentalType: 'Per hour',
    availableNow: false,
    transmission: 'Any',
    sort: 'Closest to me',
    pick: '',
    drop: '',
    from: '',
    to: '',
    type: 'Всички'
  };

  async function renderFilters() {
    const root = $('#filters');
    const s = design?.components?.filter_panel;
    // Resolve dynamic options from admin-defined params
    const typeDef = (paramDefs || []).find(p => p.name === 'Вид кола' && p.type === 'ENUM');
    const typeOptions = typeDef?.options && Array.isArray(typeDef.options) && typeDef.options.length
      ? ['Всички', ...typeDef.options]
      : ['Всички', 'Лека кола', 'Джип', 'Товарен бус'];
    const gearDef = (paramDefs || []).find(p => p.name === 'Скоростна кутия' && p.type === 'ENUM');
    const gearOptions = gearDef?.options && Array.isArray(gearDef.options) && gearDef.options.length
      ? ['Без значение', ...gearDef.options]
      : ['Без значение', 'Автоматик', 'Ръчна'];
    // Load locations for datalist suggestions
    let locations = [];
    try { locations = await apiFetch('/api/locations'); } catch { locations = []; }
    root.innerHTML = `
      <div class="filters-bar">
        <div class="fgrp g-pick ta-wrap">
          <label>Място на взимане</label>
          <input id="pickPlace" class="input" placeholder="Започнете да пишете...">
        </div>
        <div class="fgrp g-drop ta-wrap">
          <label>Място на връщане</label>
          <input id="dropPlace" class="input" placeholder="Започнете да пишете...">
        </div>
            <div class="fgrp g-from">
              <label>Дата взимане</label>
              <input id="fromDate" type="datetime-local" class="input" step="1800">
            </div>
            <div class="fgrp g-to">
              <label>Дата на връщане</label>
              <input id="toDate" type="datetime-local" class="input" step="1800">
            </div>
        <div class="fgrp g-type">
          <label>Вид кола</label>
          <select id="typeSelect" class="select">
            ${typeOptions.map(o => `<option>${o}</option>`).join('')}
          </select>
        </div>
        <div class="fgrp g-gear">
          <label>Скоростна кутия</label>
          <select id="transmissionSelect" class="select">
            ${gearOptions.map(o => {
              const val = o === 'Без значение' ? 'Any' : o;
              const sel = o === 'Без значение' ? ' selected' : '';
              return `<option value="${val}"${sel}>${o}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="fgrp g-submit">
          <label>&nbsp;</label>
          <button id="submitFilters" class="btn-primary" style="height:40px;padding:0 18px;">Търси</button>
        </div>
      </div>
    `;
    // Attach typeahead to both inputs
    const labels = locations.map(l => l.label);
    attachTypeahead($('#pickPlace'), labels);
    attachTypeahead($('#dropPlace'), labels);
    // Leave dates empty by default
    $('#fromDate').value = filterState.from || '';
    $('#toDate').value = filterState.to || '';

    $('#submitFilters').onclick = () => { applyFilters(); };
    $('#transmissionSelect').onchange = (e) => { filterState.transmission = e.target.value; applyFilters(); };
    const syncPick = (e) => { filterState.pick = e.target.value; };
    const syncDrop = (e) => { filterState.drop = e.target.value; };
    $('#pickPlace').oninput = syncPick; $('#pickPlace').onchange = syncPick;
    $('#dropPlace').oninput = syncDrop; $('#dropPlace').onchange = syncDrop;
    const bindDateSnap = (el, key) => {
      if (!el) return;
      const apply = () => { const v = snapMinutesLocal(el.value); el.value = v; filterState[key] = v; };
      el.onfocus = (e) => e.target.showPicker?.();
      el.onclick = (e) => e.target.showPicker?.();
      el.onchange = apply;
      el.oninput = apply;
    };
    bindDateSnap($('#fromDate'), 'from');
    bindDateSnap($('#toDate'), 'to');
    $('#typeSelect').onchange = (e) => { filterState.type = e.target.value; applyFilters(); };
  }

  let filterTimer = null;
  function applyFiltersDebounced() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilters, 250);
  }
  function applyFilters() {
    filtered = cars.filter(c => {
      const q = filterState.query;
      if (q && !(c.brand.toLowerCase().includes(q) || c.model.toLowerCase().includes(q) || (c.trim || '').toLowerCase().includes(q))) return false;
      // normalize transmission (supports BG and EN)
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const mapTx = (v) => {
        const n = norm(v);
        // accept variations: "автоматик", "автоматична", "автоматични", "automatic"
        if (n.includes('автомат') || n === 'automatic') return 'automatic';
        // accept variations: "ръчна", "ръчни скорости", "manual"
        if (n.includes('ръч') || n === 'manual') return 'manual';
        return n;
      };
      if (filterState.transmission !== 'Any') {
        if (mapTx(c.transmission) !== mapTx(filterState.transmission)) return false;
      }
      if (filterState.type !== 'Всички' && c.type !== filterState.type) return false;
      // extra filters from admin parameters
      const keys = Object.keys(extraFilters || {});
      if (keys.length) {
        const vals = carParamsCache.get(c.id) || [];
        for (const pid of keys) {
          const expected = extraFilters[pid];
          const found = vals.find(v => v.id === pid);
          if (!found) return false;
          if ((''+found.value) !== (''+expected)) return false;
        }
      }
      return true;
    });
    sortResults(filterState.sort);
    renderResults();
    if (!selected || !filtered.find(c => c.id === selected.id)) {
      selected = filtered[0] || null;
    }
    renderDetails();
  }

  // Results
  function sortResults(mode) {
    filterState.sort = mode;
    if (mode === 'Closest to me') filtered.sort((a,b) => a.distanceKm - b.distanceKm);
    if (mode === 'Price: Low to High') filtered.sort((a,b) => (a.pricePerDay||0) - (b.pricePerDay||0));
    if (mode === 'Price: High to Low') filtered.sort((a,b) => (b.pricePerDay||0) - (a.pricePerDay||0));
    if (mode === 'Newest') filtered.sort((a,b) => b.year - a.year);
  }
  function renderResults() {
    const r = $('#results');
    const count = filtered.length;
    r.style.gridColumn = '1 / -1';
    const plainParams = (paramDefs || []).filter(d => !['Вид кола','Скоростна кутия'].includes(d.name));
    r.innerHTML = `
      <div class="results-header" style="justify-content:flex-start;gap:12px;">
        <button class="btn-secondary" id="btnMoreFilters" style="height:36px;">${showMoreFilters ? 'Скрий филтрите' : 'Още филтри'}</button>
      </div>
      <div id="inlineFilters" style="padding:12px; display:${showMoreFilters?'block':'none'}; background:#f6f7f9; border:1px solid var(--color-border); border-radius:10px; margin:0 16px 8px 16px;">
        <div class="grid-2" style="gap:12px;">
          ${plainParams.map(d => {
            const current = extraFilters[d.id] ?? '';
            if (d.type === 'ENUM') {
              const opts = (d.options||[]).map(o => `<option ${current===o?'selected':''}>${o}</option>`).join('');
              return `<div><div class="section-title">${d.name}</div><select class="select" data-pid="${d.id}"><option value="">—</option>${opts}</select></div>`;
            }
            return `<div><div class="section-title">${d.name}${d.unit?` (${d.unit})`:''}</div><input class="input" data-pid="${d.id}" value="${current}"></div>`;
          }).join('')}
        </div>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:10px;">
          <button class="btn-secondary" id="clearInline">Изчисти</button>
          <button class="btn-primary" id="applyInline">Приложи</button>
        </div>
      </div>
      <div class="results-grid" id="resultsGrid" style="grid-template-columns: repeat(3, minmax(280px, 1fr));"></div>
    `;
    $('#btnMoreFilters')?.addEventListener('click', () => { showMoreFilters = !showMoreFilters; renderResults(); });
    $('#clearInline')?.addEventListener('click', async () => {
      extraFilters = {};
      await Promise.all(cars.map(c => loadCarParams(c.id)));
      applyFilters();
    });
    $('#applyInline')?.addEventListener('click', async () => {
      const inputs = $$('[data-pid]', $('#inlineFilters'));
      const next = {};
      inputs.forEach(el => {
        const pid = el.getAttribute('data-pid');
        const val = (el.tagName === 'SELECT' ? el.value : el.value).trim();
        if (val) next[pid] = val;
      });
      extraFilters = next;
      await Promise.all(cars.map(c => loadCarParams(c.id)));
      applyFilters();
    });

    const grid = $('#resultsGrid');
    grid.innerHTML = '';
    filtered.forEach((c, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      const hue = 205 + (i * 20) % 120;
      const firstImg = (() => {
        const im = (c.images || [])[0];
        const p = im && (im.thumb || im.large);
        return p ? `${API_BASE}${p}` : carPlaceholderSVG(`${c.brand} ${c.model}`, 680, 160, hue);
      })();
      const fromTs = filterState.from ? Date.parse(filterState.from) : null;
      const toTs = filterState.to ? Date.parse(filterState.to) : null;
      const days = (fromTs && toTs) ? Math.max(1, Math.ceil((toTs - fromTs) / 86400000)) : 1;
      const priceDay = Number(c.pricePerDay || 0);
      const total = (priceDay * days) || 0;
      card.innerHTML = `
        <div class="card-media" data-car-details="${c.id}" style="cursor:pointer;">
          <img alt="" src="${firstImg}" style="width:100%;height:140px;object-fit:cover;border:0;border-top-left-radius:12px;border-top-right-radius:12px;">
        </div>
        <div class="card-body">
          <div class="row" style="align-items:flex-start;">
            <div>
              <div class="title" data-car-details="${c.id}" style="cursor:pointer;">${c.brand} ${c.model}</div>
              <div style="color:var(--color-text-3);font-size:13px;margin-top:2px;">${c.type || ''}</div>
            </div>
            <div class="row" style="gap:8px;align-items:center;">
              ${(() => {
                const selFrom = filterState.from;
                const selTo = filterState.to;
                const isService = () => {
                  const s = (c.status || '').toString().toLowerCase();
                  return s.includes('серв') || s === 'service';
                };
                const overlaps = (() => {
                  const rel = (reservations || []).filter(r => r.carId === c.id && !['declined'].includes(r.status));
                  if (!selFrom || !selTo) return rel;
                  return rel.filter(r => isOverlap(selFrom, selTo, r.from, r.to));
                })();
                const hasOverlap = overlaps.some(r => isOverlap(selFrom, selTo, r.from, r.to));
                let label = 'Наличен';
                let style = 'background:#e6f4ea;border-color:#b7ebc6;color:#0f5132;';
                if (isService()) {
                  label = 'Не е наличен';
                  style = 'background:#ffecec;border-color:#ffd0d0;color:#b42318;';
                } else if (hasOverlap) {
                  label = 'Резервиран';
                  style = 'background:#fff4e5;border-color:#ffd79d;color:#b25e09;';
                } else if (selFrom && selTo) {
                  label = 'Наличен';
                }
                const tooltip = overlaps.length
                  ? overlaps.map(r => fmtRange(r.from, r.to)).join('\n')
                  : '';
                return `<span class="pill" style="${style}" title="${tooltip}">${label}</span>`;
              })()}
            </div>
          </div>
          <div class="meta" id="specs-${c.id}" style="flex-wrap:wrap;gap:6px;"></div>
          <div class="row" style="margin-top:14px;align-items:center;justify-content:space-between;">
            <div style="font-size:18px;font-weight:700;">€${priceDay.toFixed(0)} <span style="color:var(--color-text-3);font-size:12px;font-weight:500;">/ ден</span></div>
            <div class="row" style="gap:8px;">
              ${(() => {
                // Определяме дали е налична според логиката за статус в момента
                const selFrom = filterState.from;
                const selTo = filterState.to;
                const isService = () => {
                  const s = (c.status || '').toString().toLowerCase();
                  return s.includes('серв') || s === 'service';
                };
                const hasOverlap = () => {
                  if (!selFrom || !selTo) return false;
                  const rel = (reservations || []).filter(r => r.carId === c.id && !['declined'].includes(r.status));
                  return rel.some(r => isOverlap(selFrom, selTo, r.from, r.to));
                };
                const available = !isService() && !(selFrom && selTo && hasOverlap());
                return available ? `<button class="btn-primary" data-check="${c.id}" style="height:36px;">Резервирай</button>` : '';
              })()}
            </div>
          </div>
        </div>
      `;
      card.onclick = (ev) => {
        // В списъка не показваме страничния панел с подробности
        if (ev.target.classList.contains('heart')) return;
        return;
      };
      grid.appendChild(card);
      // Load and render specs (само параметрите от админ панела)
      loadCarParams(c.id).then(list => {
        const el = document.getElementById(`specs-${c.id}`);
        if (!el) return;
        const items = (list || []).filter(p => p?.value !== null && p?.value !== '');
        const chips = items.map(p => {
          const icon = getParamIcon(p.name);
          // Показваме стойността както е въведена в админ панела, без превод
          return `<span class="pill" title="${p.name}">${icon} ${p.value}</span>`;
        }).join('');
        el.innerHTML = chips || `<span class="pill">Без параметри</span>`;
      }).catch(()=>{});
    });
    $$('[data-check]').forEach(b => b.onclick = (e) => {
      const id = e.currentTarget.getAttribute('data-check');
      const q = new URLSearchParams({
        car: id,
        pick: filterState.pick || '',
        drop: filterState.drop || '',
        from: filterState.from || '',
        to: filterState.to || ''
      }).toString();
      navigate(`#/reserve?${q}&step=1`);
    });
    $$('[data-car-details]').forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute('data-car-details');
        openCarDetails(id);
      };
    });
    // Навигация към wizard при „Детайли“
    $$('[data-details]').forEach(b => b.onclick = (e) => {
      const id = e.currentTarget.getAttribute('data-details');
      const q = new URLSearchParams({
        car: id,
        pick: filterState.pick,
        drop: filterState.drop,
        from: filterState.from || '',
        to: filterState.to || ''
      }).toString();
      navigate(`#/reserve?${q}&step=1`);
    });
    // Скрий панела за подробности на началната страница
    const d = document.getElementById('details'); if (d) d.style.display = 'none';
  }

  async function openAdvancedFilters() {
    if (!paramDefs?.length) await loadParamDefs();
    const plain = paramDefs.filter(d => !['Вид кола','Скоростна кутия'].includes(d.name));
    const html = `
      <div class="modal-header">Още филтри</div>
      <div class="modal-body">
        <div class="grid-2">
          ${plain.map(d => {
            const current = extraFilters[d.id] ?? '';
            if (d.type === 'ENUM') {
              const opts = (d.options||[]).map(o => `<option ${current===o?'selected':''}>${o}</option>`).join('');
              return `<div><div class="section-title">${d.name}</div><select class="select" data-pid="${d.id}"><option value="">—</option>${opts}</select></div>`;
            }
            return `<div><div class="section-title">${d.name}${d.unit?` (${d.unit})`:''}</div><input class="input" data-pid="${d.id}" value="${current}"></div>`;
          }).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="clear">Изчисти</button>
        <button class="btn-primary" id="apply">Приложи</button>
      </div>
    `;
    showModal(html, (wrap, close) => {
      $('#clear', wrap).onclick = async () => {
        extraFilters = {};
        close();
        await Promise.all(cars.map(c => loadCarParams(c.id)));
        applyFilters();
      };
      $('#apply', wrap).onclick = async () => {
        const inputs = $$('[data-pid]', wrap);
        const next = {};
        inputs.forEach(el => {
          const pid = el.getAttribute('data-pid');
          const val = (el.tagName === 'SELECT' ? el.value : el.value).trim();
          if (val) next[pid] = val;
        });
        extraFilters = next;
        close();
        await Promise.all(cars.map(c => loadCarParams(c.id)));
        applyFilters();
      };
    });
  }

  async function openCarDetails(id) {
    showModal(`<div class="modal-header">Зареждане...</div><div class="modal-body">Моля, изчакайте</div>`, async (wrap, close) => {
      const card = wrap.querySelector('.modal-card');
      if (card) {
        card.style.maxWidth = '960px';
        card.style.width = '90vw';
      }
      const car = await fetchCarById(id);
      if (!car) {
        card.innerHTML = `<div class="modal-header">Грешка</div><div class="modal-body">Неуспешно зареждане на колата.</div>`;
        return;
      }
      const params = await loadCarParams(id).catch(() => []);
      const relRes = (reservations || []).filter(r => r.carId === id && !['declined'].includes(r.status));
      const selFrom = filterState.from;
      const selTo = filterState.to;
      const isService = () => {
        const s = (car.status || '').toString().toLowerCase();
        return s.includes('серв') || s === 'service';
      };
      const hasOverlap = () => {
        if (!selFrom || !selTo) return false;
        return relRes.some(r => isOverlap(selFrom, selTo, r.from, r.to));
      };
      const available = !isService() && !(selFrom && selTo && hasOverlap());
      const statusLabel = (() => {
        if (isService()) return 'Не е наличен (в сервиз)';
        if (selFrom && selTo && hasOverlap()) return 'Резервиран за периода';
        return 'Наличен';
      })();
      const statusStyle = (() => {
        if (isService()) return 'background:#f8d7da;border-color:#f5c2c7;color:#842029;';
        if (selFrom && selTo && hasOverlap()) return 'background:#fff3cd;border-color:#ffe69c;color:#664d03;';
        return 'background:#e6f4ea;border-color:#b7ebc6;color:#0f5132;';
      })();
      const imgs = (car.images || []);
      const primaryIdx = imgs.findIndex(im => im && im.primary);
      let currentIdx = primaryIdx >= 0 ? primaryIdx : 0;
      const toSrc = (im) => {
        const p = im && (im.large || im.thumb);
        return p ? `${API_BASE}${p}` : carPlaceholderSVG(`${car.brand} ${car.model}`, 960, 360, 205);
      };
      const renderContent = () => {
        const main = imgs[currentIdx];
        const mainSrc = main ? toSrc(main) : carPlaceholderSVG(`${car.brand} ${car.model}`, 960, 360, 205);
        const chips = (params || []).filter(p => p?.value).map(p => {
          const icon = getParamIcon(p.name);
          return `<span class="pill" title="${p.name}">${icon} ${p.value}</span>`;
        }).join('');
        const tooltip = relRes.map(r => {
          const f = new Date(r.from).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
          const t = new Date(r.to).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
          return `${f} → ${t}`;
        }).join('\\n');
        card.innerHTML = `
          <div class="modal-header" style="display:flex;align-items:center;gap:12px;">
            <div style="flex:1;">
              <div style="font-size:20px;font-weight:700;">${car.brand} ${car.model}${car.trim ? (' ' + car.trim) : ''}</div>
              <div style="color:var(--color-text-3);font-size:13px;">${car.type || ''}</div>
            </div>
            <span class="pill" title="${tooltip}" style="${statusStyle}">${statusLabel}</span>
            <button class="btn-secondary" id="closeCarModal">✕</button>
          </div>
          <div class="modal-body" style="display:grid;gap:16px;">
            <div style="display:grid;gap:8px;">
              <div style="width:100%;height:320px;border-radius:12px;overflow:hidden;border:1px solid var(--color-border);background:#f6f7f9;">
                <img id="mainCarImg" src="${mainSrc}" alt="" style="width:100%;height:100%;object-fit:cover;">
              </div>
              <div style="display:flex;gap:8px;overflow:auto;padding-bottom:4px;">
                ${imgs.map((im, idx) => {
                  const s = toSrc(im);
                  return `<img data-thumb="${idx}" src="${s}" alt="" style="width:96px;height:72px;object-fit:cover;border-radius:8px;border:${idx===currentIdx?'2px solid var(--color-primary)':'1px solid var(--color-border)'};cursor:pointer;">`;
                }).join('')}
              </div>
            </div>
            <div class="meta" style="flex-wrap:wrap;gap:8px;">${chips || '<span class="pill">Без параметри</span>'}</div>
            <div class="row" style="justify-content:space-between;align-items:center;">
              <div style="font-size:20px;font-weight:700;">€${(car.pricePerDay||0).toFixed(0)} <span style="font-size:13px;color:var(--color-text-3);font-weight:500;">/ ден</span></div>
              ${available ? `<button class="btn-primary" id="reserveFromModal" style="height:40px;">Резервирай</button>` : ''}
            </div>
            ${relRes.length ? `<div style="font-size:13px;color:var(--color-text-3);">Резервации:<br>${relRes.map(r => {
              const f = new Date(r.from).toLocaleString('bg-BG', { dateStyle:'short', timeStyle:'short' });
              const t = new Date(r.to).toLocaleString('bg-BG', { dateStyle:'short', timeStyle:'short' });
              return `${f} → ${t}`;
            }).join('<br>')}</div>` : ''}
          </div>
        `;
        $('#closeCarModal', card).onclick = close;
        $$('[data-thumb]', card).forEach(th => {
          th.onclick = () => {
            currentIdx = Number(th.getAttribute('data-thumb'));
            renderContent();
          };
        });
        $('#reserveFromModal', card)?.addEventListener('click', () => {
          const q = new URLSearchParams({
            car: car.id,
            pick: filterState.pick || '',
            drop: filterState.drop || '',
            from: filterState.from || '',
            to: filterState.to || ''
          }).toString();
          navigate(`#/reserve?${q}&step=1`);
          close();
        });
      };
      renderContent();
    });
  }

  // Details
  function renderDetails() {
    const d = $('#details');
    if (!selected) { d.innerHTML = '<div class="details-header"><strong>No results</strong></div>'; return; }
    const car = selected;
    d.innerHTML = `
      <div class="details-header">
        <div style="display:flex;gap:10px;align-items:center;">
          <div class="pill">Ford Focus</div>
          <div class="pill">San Francisco, US</div>
        </div>
        <div class="row" style="gap:10px;">
          <div class="pill">⭐ ${car.rating.toFixed(1)}</div>
          <div class="heart ${car.favorite ? 'active':''}" id="favDetail">❤</div>
        </div>
      </div>
      <div class="gallery">
        <div class="img"><img alt="" src="${carPlaceholderSVG(`${car.brand} ${car.model}`, 820, 220, 210)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"></div>
        <div class="img"><img alt="" src="${carPlaceholderSVG('Rear', 420, 220, 230)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"></div>
      </div>
      <div class="tabs" id="tabs">
        <div class="tab active" data-tab="rent">Детайли за наем</div>
        <div class="tab" data-tab="info">Информация</div>
        <div class="tab" data-tab="specs">Параметри</div>
      </div>
      <div class="map">Route preview map</div>
      <div class="booking">
        <div class="field">
          <label>Дата и час взимане</label>
          <input id="pickup" type="datetime-local" class="input">
        </div>
        <div class="field">
          <label>Дата и час връщане</label>
          <input id="dropoff" type="datetime-local" class="input">
        </div>
        <div class="field">
          <label>Застраховка</label>
          <select id="insurance" class="select">
            <option value="0">Без застраховка — $0</option>
            <option value="52">Защита на автомобила — $52</option>
            <option value="62">Гражданска отговорност — $62</option>
          </select>
        </div>
        <div class="field">
          <label>Допълнително време</label>
          <label class="switch"><input id="extraTime" type="checkbox"><span>Включи</span></label>
        </div>
        <div class="summary">
          <div class="row"><div>Ставка</div><div id="rateVal">$${car.pricePerHour}/h</div></div>
          <div class="row"><div>Застраховка</div><div id="insVal">$0.00</div></div>
          <div class="row"><div>Данъци</div><div id="taxVal">$0.00</div></div>
          <div class="row" style="font-weight:700;"><div>Крайна сума</div><div id="totalVal">$0.00</div></div>
          <div class="row" style="gap:8px;margin-top:6px;">
            <button class="btn-primary" id="bookBtn" style="flex:1;">Проверка на наличност</button>
            <button class="btn-secondary" style="width:180px;">Резервирай безплатно • 10 мин</button>
          </div>
        </div>
      </div>
    `;
    $('#favDetail').onclick = () => { car.favorite = !car.favorite; $('#favDetail').classList.toggle('active', car.favorite); renderResults(); };
    $$('#tabs .tab').forEach(t => t.onclick = () => { $$('#tabs .tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); });
    setupBooking(car);
  }

  function setupBooking(car) {
    const ins = $('#insurance');
    const pickup = $('#pickup');
    const dropoff = $('#dropoff');
    const extra = $('#extraTime');
    const rate = car.pricePerDay || 0;
    // Prefill times
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const start = new Date(now);
    const end = new Date(now); end.setHours(end.getHours() + 3);
    pickup.value = start.toISOString().slice(0,16);
    dropoff.value = end.toISOString().slice(0,16);
    function daysBetween(a,b) { const ms = new Date(b) - new Date(a); return Math.max(1, Math.ceil(ms / 86400000)); }
    function recalc() {
      const d = daysBetween(pickup.value, dropoff.value);
      const base = d * rate;
      const insVal = Number(ins.value || 0);
      const tax = base * 0.162; // simple sample rate ~16.2%
      $('#rateVal').textContent = `€${base.toFixed(2)} (${d} дни @ €${rate}/ден)`;
      $('#insVal').textContent = formatMoney(insVal);
      $('#taxVal').textContent = formatMoney(tax);
      $('#totalVal').textContent = formatMoney(base + insVal + tax);
    }
    [ins, pickup, dropoff, extra].forEach(el => el.addEventListener('change', recalc));
    recalc();
    $('#bookBtn').onclick = () => {
      const payload = {
        carId: car.id,
        pickupAt: new Date(pickup.value).toISOString(),
        dropoffAt: new Date(dropoff.value).toISOString(),
        extraTime: extra.checked,
        insurance: Number(ins.value || 0),
        currency: design?.i18n?.currency || 'USD'
      };
      const q = new URLSearchParams({
        car: car.id,
        from: pickup.value,
        to: dropoff.value
      }).toString();
      navigate(`#/reserve?${q}&step=1`);
    };
  }

  /* Booking Wizard (steps: 1 car/параметри, 2 шофьор, 3 фактура, 4 потвърждение)
     Показва кумулативно стъпките до текущия step; всяка следваща се отключва след "Напред". */
  function renderWizard() {
    mountAdminIfNeeded(false);
    mountSearchLayout(); // reuse container but full-width details
    $('#filters').style.display = 'none';
    $('#results').style.display = 'none';
    $('#details').style.gridColumn = '1 / -1';
    const d = $('#details');
    const paramsUrl = new URLSearchParams(location.hash.split('?')[1] || '');
    const step = Number(paramsUrl.get('step') || '1');
    const car = cars.find(c => c.id === paramsUrl.get('car')) || cars[0];
    const draftKey = `cr_draft_${car?.id || 'default'}`;
    const existing = storage.get(draftKey, null) || {};
    const baseDraft = {
      id: uid(),
      carId: car?.id,
      pick: paramsUrl.get('pick') ?? filterState.pick ?? '',
      drop: paramsUrl.get('drop') ?? filterState.drop ?? '',
      from: paramsUrl.get('from') ?? filterState.from ?? '',
      to: paramsUrl.get('to') ?? filterState.to ?? '',
      driver: existing.driver || {},
      invoice: existing.invoice || { type: 'individual' },
      status: 'pending'
    };
    let draft = { ...existing, ...baseDraft };
    ['pick','drop','from','to'].forEach(k => {
      const v = paramsUrl.get(k);
      draft[k] = (v !== null && v !== undefined) ? v : (filterState[k] ?? '');
    });
    storage.set(draftKey, draft);

    const gotoStep = (s, extra={}) => {
      storage.set(draftKey, draft);
      const q = new URLSearchParams({
        car: car.id,
        step: s,
        pick: draft.pick || '',
        drop: draft.drop || '',
        from: draft.from || '',
        to: draft.to || '',
        ...extra
      }).toString();
      navigate(`#/reserve?${q}`);
    };

    const stepper = `
      <div class="toolbar">
        <div class="tag ${step===1?'':'pill'}">Стъпка 1 • Кола & параметри</div>
        <div class="tag ${step===2?'':'pill'}">Стъпка 2 • Шофьор</div>
        <div class="tag ${step===3?'':'pill'}">Стъпка 3 • Фактура</div>
        <div class="tag ${step===4?'':'pill'}">Потвърждение</div>
        <div style="margin-left:auto;" class="tag">Колa: ${car.brand} ${car.model}</div>
      </div>
    `;

    const renderCarBadge = (car) => {
      const firstImg = (() => {
        const im = (car?.images || [])[0];
        const p = im && (im.thumb || im.large);
        return p ? `${API_BASE}${p}` : carPlaceholderSVG(`${car?.brand||''} ${car?.model||''}`, 240, 120, 210);
      })();
      return `
        <div class="panel" style="padding:12px; display:grid; grid-template-columns: 120px 1fr auto; gap:12px; align-items:center; margin-bottom:12px;">
          <div style="border-radius:10px; overflow:hidden; border:1px solid var(--color-border); background:#f6f7f9;">
            <img src="${firstImg}" alt="" style="width:120px;height:80px;object-fit:cover;">
          </div>
          <div style="display:grid; gap:6px;">
            <div style="font-weight:700;">${car?.brand||''} ${car?.model||''}</div>
            <div class="meta" id="wizard-specs" style="flex-wrap:wrap;gap:6px;"></div>
          </div>
          <a class="btn-secondary" href="#/" style="height:32px;display:grid;place-items:center;">Промени</a>
        </div>
      `;
    };

    const allPrefilled = (draft.pick || draft.drop || draft.from || draft.to) ? true : false;

    const block1 = `
      <section id="step1" style="margin-bottom:12px;">
        <div id="paramsBlock" style="padding:16px; display:${allPrefilled?'none':'grid'}; gap:14px;">
          <div class="grid-2">
            <div><div class="section-title">Място взимане</div><input id="wPick" class="input" value="${draft.pick || ''}" placeholder="Място"/></div>
            <div><div class="section-title">Място връщане</div><input id="wDrop" class="input" value="${draft.drop || ''}" placeholder="Място"/></div>
          </div>
          <div class="grid-2">
            <div><div class="section-title">От</div><input id="wFrom" type="datetime-local" step="1800" class="input" value="${(draft.from || '').slice(0,16)}"/></div>
            <div><div class="section-title">До</div><input id="wTo" type="datetime-local" step="1800" class="input" value="${(draft.to || '').slice(0,16)}"/></div>
          </div>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button class="btn-primary" id="next1">Напред</button>
          </div>
        </div>
        <div id="paramsSummary" style="padding:16px; display:${allPrefilled ? 'block' : 'none'};">
          <div class="row" style="justify-content:space-between; align-items:center;">
            <div>
              <div class="meta" style="gap:6px;flex-wrap:wrap;">
                ${draft.pick ? `<span class="pill">Взимане: ${draft.pick}</span>` : ''}
                ${draft.drop ? `<span class="pill">Връщане: ${draft.drop}</span>` : ''}
                ${draft.from ? `<span class="pill">От: ${(draft.from||'').replace('T',' ')}</span>` : ''}
                ${draft.to ? `<span class="pill">До: ${(draft.to||'').replace('T',' ')}</span>` : ''}
              </div>
            </div>
            <button class="btn-secondary" id="changeParams" style="height:32px;">Промени</button>
          </div>
          <div class="row" style="justify-content:flex-end; margin-top:12px;">
            <button class="btn-primary" id="next1b">Напред</button>
          </div>
        </div>
      </section>
    `;

    const block2 = `
      <section id="step2" style="margin-bottom:12px;">
        <div class="header"><h2>Данни на шофьора</h2></div>
        <div style="padding:16px; display:grid; gap:14px;">
          <div class="grid-3">
            <div><div class="section-title">Име и фамилия</div><input id="dName" class="input" value="${draft.driver?.name || ''}"/></div>
            <div><div class="section-title">Телефон</div><input id="dPhone" class="input" value="${draft.driver?.phone || ''}"/></div>
            <div><div class="section-title">Имейл</div><input id="dEmail" class="input" value="${draft.driver?.email || ''}"/></div>
          </div>
          <div><div class="section-title">№ шофьорска книжка</div><input id="dLicense" class="input" value="${draft.driver?.license || ''}"/></div>
          <div class="row" style="justify-content:space-between;">
            <button class="btn-secondary" id="back1">Назад</button>
            <button class="btn-primary" id="next2">Напред</button>
          </div>
        </div>
      </section>
    `;

    const inv = draft.invoice || { type: 'individual' };
    const block3 = `
      <section id="step3" style="margin-bottom:12px;">
        <div class="header"><h2>Данни за фактура</h2></div>
        <div style="padding:16px; display:grid; gap:14px;">
          <div class="radios">
            <label><input type="radio" name="invType" value="individual" ${inv.type!=='company'?'checked':''}> Физическо лице</label>
            <label><input type="radio" name="invType" value="company" ${inv.type==='company'?'checked':''}> Юридическо лице</label>
          </div>
          <div id="invIndividual" style="display:${inv.type!=='company'?'grid':'none'}; gap:12px;">
            <div class="grid-2">
              <div><div class="section-title">Име и фамилия</div><input id="iNameInd" class="input" value="${(inv.name) || draft.driver?.name || ''}"/></div>
              <div><div class="section-title">ЕГН</div><input id="iEgn" class="input" value="${inv.egn || ''}"/></div>
            </div>
            <div class="grid-2">
              <div><div class="section-title">Адрес</div><input id="iAddrInd" class="input" value="${inv.addr || ''}"/></div>
              <div><div class="section-title">Имейл</div><input id="iEmailInd" class="input" value="${inv.email || draft.driver?.email || ''}"/></div>
            </div>
          </div>

          <div id="invCompany" style="display:${inv.type==='company'?'grid':'none'}; gap:12px;">
            <div class="grid-2">
              <div><div class="section-title">Име на фирмата</div><input id="iNameCo" class="input" value="${inv.name || ''}"/></div>
              <div><div class="section-title">ЕИК</div><input id="iNumCo" class="input" value="${inv.num || ''}"/></div>
            </div>
            <div class="grid-2">
              <div><div class="section-title">ДДС №</div><input id="iVatCo" class="input" value="${inv.vat || ''}"/></div>
              <div><div class="section-title">МОЛ</div><input id="iMolCo" class="input" value="${inv.mol || ''}"/></div>
            </div>
            <div class="grid-2">
              <div><div class="section-title">Адрес</div><input id="iAddrCo" class="input" value="${inv.addr || ''}"/></div>
              <div><div class="section-title">Имейл</div><input id="iEmailCo" class="input" value="${inv.email || ''}"/></div>
            </div>
            <div class="grid-3">
              <div><div class="section-title">Банка</div><input id="iBankCo" class="input" value="${inv.bank || ''}"/></div>
              <div><div class="section-title">IBAN</div><input id="iIbanCo" class="input" value="${inv.iban || ''}"/></div>
              <div><div class="section-title">BIC</div><input id="iBicCo" class="input" value="${inv.bic || ''}"/></div>
            </div>
          </div>
          <div class="row" style="justify-content:space-between;">
            <button class="btn-secondary" id="back2">Назад</button>
            <button class="btn-primary" id="confirm">Потвърждение</button>
          </div>
        </div>
      </section>
    `;

    const block4 = `
      <section id="step4" style="margin-bottom:12px;">
        <div class="header"><h2>Резервация изпратена</h2></div>
        <div style="padding:16px;">
          <p>Вашата заявка № <strong>${paramsUrl.get('id') || draft.id}</strong> е получена и очаква одобрение.</p>
          <div class="row" style="gap:8px;">
            <a class="btn-primary" href="#/">Към начална страница</a>
            <a class="btn-secondary" href="#/admin/reservations">Към админ панел (демо)</a>
          </div>
        </div>
      </section>
    `;

    d.innerHTML = `
      <div class="header"><h2>Резервация</h2></div>
      ${stepper}
      ${renderCarBadge(car)}
      ${step>=1 ? block1 : ''}
      ${step>=2 ? block2 : ''}
      ${step>=3 ? block3 : ''}
      ${step>=4 ? block4 : ''}
    `;

    // Стъпка 1
    if (step >= 1) {
      $('#wPick').value = draft.pick || '';
      $('#wDrop').value = draft.drop || '';
      $('#wFrom').value = (draft.from || '').slice(0,16);
      $('#wTo').value = (draft.to || '').slice(0,16);
      const bindDateSnap = (el, key) => {
        if (!el) return;
        const apply = () => { const v = snapMinutesLocal(el.value); el.value = v; draft[key] = v; };
        el.onfocus = (e) => e.target.showPicker?.();
        el.onclick = (e) => e.target.showPicker?.();
        el.onchange = apply;
        el.oninput = apply;
      };
      bindDateSnap($('#wFrom'), 'from');
      bindDateSnap($('#wTo'), 'to');
      loadCarParams(car?.id).then(list => {
        const el = $('#wizard-specs');
        if (!el) return;
        const chips = (list || []).filter(p => p?.value !== null && p?.value !== '')
          .map(p => `<span class="pill" title="${p.name}">${getParamIcon(p.name)} ${p.value}</span>`).join('');
        el.innerHTML = chips || '';
      }).catch(()=>{});
      apiFetch('/api/locations').then(locs => {
        const labels = (locs || []).map(l => l.label);
        attachTypeahead($('#wPick'), labels);
        attachTypeahead($('#wDrop'), labels);
      }).catch(()=>{});
      $('#changeParams')?.addEventListener('click', () => {
        $('#paramsSummary').style.display = 'none';
        $('#paramsBlock').style.display = 'grid';
      });
      $('#next1')?.addEventListener('click', () => {
        draft.pick = $('#wPick').value; draft.drop = $('#wDrop').value;
        draft.from = $('#wFrom').value; draft.to = $('#wTo').value;
        gotoStep(2);
      });
      $('#next1b')?.addEventListener('click', () => gotoStep(2));
    }

    // Стъпка 2
    if (step >= 2) {
      $('#back1')?.addEventListener('click', () => gotoStep(1));
      $('#next2')?.addEventListener('click', () => {
        draft.driver = {
          name: $('#dName').value, phone: $('#dPhone').value, email: $('#dEmail').value,
          license: $('#dLicense').value, birth: '', addr: ''
        };
        gotoStep(3);
      });
    }

    // Стъпка 3
    if (step >= 3) {
      const invState = draft.invoice || { type: 'individual' };
      $$('input[name="invType"]').forEach(r => r.onchange = () => {
        invState.type = r.value;
        $('#invIndividual').style.display = r.value === 'company' ? 'none' : 'grid';
        $('#invCompany').style.display = r.value === 'company' ? 'grid' : 'none';
      });
      $('#back2')?.addEventListener('click', () => gotoStep(2));
      $('#confirm')?.addEventListener('click', async () => {
        if (invState.type === 'company') {
          draft.invoice = {
            type: 'company',
            name: $('#iNameCo').value,
            num: $('#iNumCo').value,
            vat: $('#iVatCo').value,
            mol: $('#iMolCo').value,
            addr: $('#iAddrCo').value,
            email: $('#iEmailCo').value,
            bank: $('#iBankCo').value,
            iban: $('#iIbanCo').value,
            bic: $('#iBicCo').value
          };
        } else {
          draft.invoice = {
            type: 'individual',
            name: $('#iNameInd').value,
            egn: $('#iEgn').value,
            addr: $('#iAddrInd').value,
            email: $('#iEmailInd').value,
            num: null, vat: null, mol: null, bank: null, iban: null, bic: null
          };
        }
        draft.status = 'pending';
        const payload = {
          carId: car.id,
          from: draft.from || new Date().toISOString(),
          to: draft.to || new Date(Date.now()+3*3600e3).toISOString(),
          pickPlace: draft.pick, dropPlace: draft.drop,
          driver: draft.driver, invoice: draft.invoice,
          total: (function(){ const ms = new Date((draft.to||payload.to)) - new Date((draft.from||payload.from)); const days = Math.max(1, Math.ceil(ms/86400000)); return (car.pricePerDay||0) * days; })()
        };
        try {
          const created = await apiFetch('/api/reservations', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          storage.set(draftKey, null);
          gotoStep(4, { id: created?.id || draft.id });
        } catch {
          const saved = storage.get('cr_reservations', []);
          saved.push({ ...draft, createdAt: new Date().toISOString(), pricePerDay: car.pricePerDay });
          storage.set('cr_reservations', saved);
          gotoStep(4, { id: draft.id });
        }
      });
    }
  }

  /* Admin Panel */
  function mountAdminIfNeeded(isAdmin = true) {
    if (isAdmin) mountAdminLayout();
  }
  function adminNav(active) {
    return `
      <div class="header">
        <h2>Административен панел</h2>
        <div class="row" style="gap:8px;">
          <a class="btn-secondary" href="#/">Начало</a>
        </div>
      </div>
      <div class="toolbar">
        <a class="tag ${active==='dashboard'?'':'pill'}" href="#/admin">Дашборд</a>
        <a class="tag ${active==='cars'?'':'pill'}" href="#/admin/cars">Коли</a>
        <a class="tag ${active==='params'?'':'pill'}" href="#/admin/params">Параметри</a>
        <a class="tag ${active==='settings'?'':'pill'}" href="#/admin/settings">Настройки</a>
        <a class="tag ${active==='reservations'?'':'pill'}" href="#/admin/reservations">Резервации</a>
        <a class="tag ${active==='invoices'?'':'pill'}" href="#/admin/invoices">Фактури</a>
      </div>
    `;
  }
  function renderAdminDashboard() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    const rs = storage.get('cr_reservations', []);
    const pending = rs.filter(r => r.status === 'pending');
    root.innerHTML = adminNav('dashboard') + `
      <div style="padding:16px; display:grid; gap:12px;">
        <div class="grid-3">
          <div class="panel" style="padding:14px;"><div class="section-title">Брой коли</div><h2>${cars.length}</h2></div>
          <div class="panel" style="padding:14px;"><div class="section-title">Брой резервации</div><h2>${rs.length}</h2></div>
          <div class="panel" style="padding:14px;"><div class="section-title">Оборот (демо)</div><h2>$${(rs.length*50).toFixed(2)}</h2></div>
        </div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Очакващи одобрение</div>
          <table class="table">
            <thead><tr><th>№</th><th>Кола</th><th>Клиент</th><th>Статус</th></tr></thead>
            <tbody>
              ${pending.map(p => `<tr><td>${p.id}</td><td>${p.carId}</td><td>${p.driver?.name||''}</td><td><span class="tag">pending</span></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  function renderAdminCars() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('cars') + `
      <div class="toolbar">
        <button class="btn-primary" id="addCar">Добави кола</button>
      </div>
      <div style="padding:16px;">
        <table class="table">
          <thead><tr><th>Марка</th><th>Модел</th><th>Тип</th><th>Цена/ден (€)</th><th>Статус</th><th></th></tr></thead>
          <tbody id="carRows"></tbody>
        </table>
      </div>
    `;
    function draw() {
      const toApiStatus = (v) => {
        const n = (v||'').toLowerCase();
        if (n.includes('сервиз')) return 'SERVICE';
        if (n.includes('резерв')) return 'RESERVED';
        return 'AVAILABLE';
      };
      $('#carRows').innerHTML = cars.map(c => `
        <tr>
          <td>${c.brand}</td><td>${c.model}</td><td>${c.type}</td><td>€${c.pricePerDay||0}</td>
          <td><select data-status="${c.id}" class="select" style="height:32px;">
            ${['наличен','в сервиз','резервиран'].map(s => `<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
          </select></td>
          <td class="row" style="gap:6px;">
            <button class="btn-secondary" data-edit="${c.id}" style="height:32px;">Редакция</button>
            <button class="btn-secondary" data-delcar="${c.id}" style="height:32px;background:#ffecec;border-color:#ffd0d0;">Изтрий</button>
          </td>
        </tr>
      `).join('');
      $$('[data-status]').forEach(s => s.onchange = async () => {
        const id = s.getAttribute('data-status'); const car = cars.find(x => x.id === id); car.status = s.value;
        try {
          const payload = { ...car, status: toApiStatus(s.value) };
          await apiFetch(`/api/cars/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          car.status = s.value;
        } catch {}
        storage.set('cr_cars', cars);
      });
      $$('[data-edit]').forEach(b => b.onclick = () => editCar(b.getAttribute('data-edit')));
      $$('[data-delcar]').forEach(b => b.onclick = () => confirmDelete(b.getAttribute('data-delcar')));
    }
    function confirmDelete(id) {
      const car = cars.find(c => c.id === id);
      const html = `
        <div class="modal-header">Потвърдете изтриване</div>
        <div class="modal-body">
          <p>Наистина ли искате да изтриете колата:</p>
          <div><strong>${car?.brand || ''} ${car?.model || ''}</strong> (ID: <code>${id}</code>)</div>
          <p style="color:#b42318;margin-top:8px;">Операцията ще премахне и снимките, и параметрите към тази кола.</p>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancelDel">Отказ</button>
          <button class="btn-primary" id="confirmDel" style="background:#e0245e;">Изтрий</button>
        </div>
      `;
      showModal(html, (wrap, close) => {
        $('#cancelDel', wrap).onclick = close;
        $('#confirmDel', wrap).onclick = async () => {
          // Optimistic remove
          cars = cars.filter(c => c.id !== id);
          draw();
          close();
          try {
            await apiFetch(`/api/cars/${id}`, { method: 'DELETE' });
          } catch (e) {
            alert('Неуспешно изтриване: ' + (e.message || ''));
            // Reload to reconcile
            await reload();
          }
        };
      });
    }
    async function reload() {
      const list = await fetchCarsFromApi();
      if (list) cars = list;
      draw();
    }
    function editCar(id) {
      const existing = cars.find(c => c.id === id);
      const car = existing || { id: uid(), brand:'', model:'', trim:'', pricePerHour:25, type:'Лека кола', status:'наличен', images: [] };
      const isNew = !existing;
      async function loadCarFromApi() {
        // Винаги зареждаме свежи данни от API (списъкът може да няма images и други полета)
        try { const apiCar = await fetch(`${API_BASE}/api/cars/${id}`).then(r => r.json()); Object.assign(car, apiCar); } catch {}
      }
      async function loadParamDefsWithValues() {
        try {
          const defs = await apiFetch('/api/params');
          let values = [];
          if (!isNew) values = await apiFetch(`/api/cars/${car.id}/params`);
          return defs.map(d => {
            const v = values.find(x => x.id === d.id);
            return { ...d, value: v?.value ?? null };
          });
        } catch { return []; }
      }
      (async () => {
        await loadCarFromApi();
        const defs = await loadParamDefsWithValues();
        root.innerHTML = adminNav('cars') + `
          <div class="header"><h2>${isNew?'Добавяне':'Редакция'} на кола</h2></div>
          <div style="padding:16px; display:grid; gap:12px;">
            <div class="grid-3">
              <input id="cBrand" class="input" placeholder="Марка" value="${car.brand}">
              <input id="cModel" class="input" placeholder="Модел" value="${car.model}">
              <select id="cStatus" class="select">
                ${['наличен','в сервиз'].map(s => `<option ${car.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="grid-3">
              <div>
                <div class="section-title">Цена на ден (€)</div>
                <input id="cPriceDay" type="number" class="input" placeholder="€" value="${car.pricePerDay ?? ''}">
              </div>
            </div>
            <div class="panel" style="padding:12px;">
              <div class="section-title">Снимки</div>
              <input id="imgInput" type="file" accept="image/*" multiple class="input">
              <div id="imgGrid" class="results-grid" style="grid-template-columns: repeat(4, minmax(120px,1fr)); max-height:unset;"></div>
            </div>
            <div class="panel" style="padding:12px;">
              <div class="section-title">Параметри</div>
              <div id="paramGrid" class="grid-3"></div>
            </div>
            <div class="row" style="justify-content:space-between;">
              <a class="btn-secondary" href="#/admin/cars">Отказ</a>
              <button class="btn-primary" id="saveCar">Запази</button>
            </div>
          </div>
        `;
        function renderImages() {
          const grid = $('#imgGrid');
          const imgs = (car.images || []);
          const toAbs = (p) => p && p.startsWith('/') ? `${API_BASE}${p}` : p;
          const isDisplayable = (p) => {
            if (!p) return false;
            const ext = p.split('.').pop().toLowerCase();
            return ['jpg','jpeg','png','webp','gif'].includes(ext);
          };
          const getSrc = (im) => {
            const t = toAbs(im.thumb);
            const l = toAbs(im.large);
            if (isDisplayable(t)) return t;
            if (isDisplayable(l)) return l;
            return null;
          };
          const primaryIdx = imgs.findIndex(im => im && im.primary);
          grid.innerHTML = imgs.map((im, idx) => `
            <div class="card" style="overflow:hidden;">
              ${(() => {
                const src = getSrc(im);
                return src
                  ? `<img src="${src}" alt="" style="width:100%;height:120px;object-fit:cover;">`
                  : `<div style="width:100%;height:120px;display:grid;place-items:center;background:#f6f7f9;color:#9aa4b2;">Неподдържан формат</div>`;
              })()}
              <div style="padding:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="radio" name="primaryImg" data-primary="${im.large||im.thumb}" ${idx===0 || idx===primaryIdx ? 'checked' : ''}>
                  Основна снимка
                </label>
              </div>
              <div class="row" style="padding:8px;justify-content:flex-end;">
                <button class="btn-secondary" data-del="${im.large}" style="height:32px;">Премахни</button>
              </div>
            </div>
          `).join('');
          $$('input[name="primaryImg"]').forEach(r => r.onchange = async (e) => {
            const target = e.target.getAttribute('data-primary');
            if (!target) return;
            // reorder images: selected first
            const next = (car.images||[]).map(im => ({...im, primary:false}));
            const idx = next.findIndex(im => im.large === target || im.thumb === target);
            if (idx >= 0) {
              next[idx].primary = true;
              const [chosen] = next.splice(idx,1);
              next.unshift(chosen);
              car.images = next;
              renderImages();
              // persist
              try {
                await apiFetch(`/api/cars/${car.id}`, { method: 'PUT', body: JSON.stringify({ ...car, images: next }) });
              } catch {}
            }
          });
          $$('[data-del]').forEach(b => b.onclick = async () => {
            try {
              const target = b.getAttribute('data-del');
              // Optimistic remove from local state for instant UI response
              car.images = (car.images || []).filter(im => im.large !== target && im.thumb !== target);
              renderImages();
              await apiFetch(`/api/cars/${car.id}/images?name=${encodeURIComponent(target)}`, { method: 'DELETE' });
              // Bust cache to avoid stale 304
              const fresh = await fetch(`${API_BASE}/api/cars/${car.id}?t=${Date.now()}`, {
                headers: { accept: 'application/json', 'cache-control': 'no-cache' },
                cache: 'no-store'
              }).then(r=>r.json());
              car.images = fresh.images || [];
              renderImages();
            } catch {
              // If request fails, soft-refresh from API to reconcile state
              try {
                const fresh = await fetch(`${API_BASE}/api/cars/${car.id}?t=${Date.now()}`, {
                  headers: { accept: 'application/json', 'cache-control': 'no-cache' },
                  cache: 'no-store'
                }).then(r=>r.json());
                car.images = fresh.images || [];
                renderImages();
              } catch {}
            }
          });
        }
        renderImages();
        // Upload handler
        $('#imgInput').onchange = async (e) => {
          if (!car.id || isNew) {
            // create car first
            await saveBasics(true);
          }
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          const fd = new FormData();
          files.forEach(f => fd.append('images', f));
          await fetch(`${API_BASE}/api/cars/${car.id}/images`, { method: 'POST', body: fd }).then(r => r.json());
          const fresh = await fetch(`${API_BASE}/api/cars/${car.id}`).then(r=>r.json());
          car.images = fresh.images || [];
          renderImages();
          e.target.value = '';
        };
        // Parameters form
        const pGrid = $('#paramGrid');
        pGrid.innerHTML = defs.map(d => {
          if (d.type === 'ENUM') {
            const opts = (d.options||[]).map(o => `<option ${d.value===o?'selected':''}>${o}</option>`).join('');
            return `<div><div class="section-title">${d.name}</div><select class="select" data-param="${d.id}" data-type="ENUM"><option value="">—</option>${opts}</select></div>`;
          } else if (d.type === 'NUMBER') {
            return `<div><div class="section-title">${d.name}${d.unit?' ('+d.unit+')':''}</div><input class="input" type="number" step="any" value="${d.value??''}" data-param="${d.id}" data-type="NUMBER"></div>`;
          } else {
            return `<div><div class="section-title">${d.name}</div><input class="input" value="${d.value??''}" data-param="${d.id}" data-type="TEXT"></div>`;
          }
        }).join('');
        async function saveBasics(creating=false) {
          Object.assign(car, {
            brand: $('#cBrand').value, model: $('#cModel').value,
            pricePerDay: $('#cPriceDay').value !== '' ? Number($('#cPriceDay').value) : null,
            status: $('#cStatus').value
          });
          if (creating && isNew) {
            const created = await apiFetch('/api/cars', { method: 'POST', body: JSON.stringify(car) });
            car.id = created.id;
          } else {
            await apiFetch(`/api/cars/${car.id}`, { method: 'PUT', body: JSON.stringify(car) });
          }
        }
        $('#saveCar').onclick = async () => {
          const btn = $('#saveCar');
          btn.disabled = true; const prevText = btn.textContent; btn.textContent = 'Запис...';
          try {
            if (!$('#cBrand').value.trim() || !$('#cModel').value.trim()) throw new Error('Моля, попълнете Марка и Модел');
            await saveBasics(isNew);
            if (!car.id) throw new Error('Създаването не беше успешно.');
            // Save params
            const items = $$('#paramGrid [data-param]').map(el => {
              const paramId = el.getAttribute('data-param');
              const type = el.getAttribute('data-type');
              const val = el.tagName === 'SELECT' ? (el.value || null) : (el.value ?? null);
              return { paramId, type, value: val };
            });
            await apiFetch(`/api/cars/${car.id}/params`, { method: 'PUT', body: JSON.stringify({ items }) });
            navigate('#/admin/cars');
          } catch (e) {
            alert(e.message || 'Грешка при запис.');
          } finally {
            btn.disabled = false; btn.textContent = prevText;
          }
        };
      })();
    }
    $('#addCar').onclick = () => editCar(uid());
    reload();
  }
  function renderAdminParams() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('params') + `
      <div class="toolbar">
        <button class="btn-primary" id="addParam">Добави параметър</button>
        <div style="margin-left:auto;display:flex;gap:8px;">
          <input id="paramSearch" class="input" placeholder="Търсене по име" style="width:220px;">
        </div>
      </div>
      <div style="padding:16px;">
        <table class="table">
          <thead><tr><th>Име</th><th>Тип</th><th>Опции/Единица</th><th></th></tr></thead>
          <tbody id="paramRows"></tbody>
        </table>
      </div>
    `;
    async function fetchList(q = '') {
      try {
        const query = q ? `?q=${encodeURIComponent(q)}` : '';
        return await apiFetch(`/api/params${query}`);
      } catch {
        return [];
      }
    }
    function openParamModal(param) {
      const isEdit = !!param;
      const optsText = param?.type === 'ENUM' ? (Array.isArray(param.options) ? param.options.join(', ') : (param.options || []).join(', ')) : (param?.unit || '');
      const html = `
        <div class="modal-header">${isEdit ? 'Редакция на параметър' : 'Нов параметър'}</div>
        <div class="modal-body">
          <div class="grid-2">
            <div><div class="section-title">Име</div><input id="pName" class="input" value="${param?.name || ''}"></div>
            <div><div class="section-title">Тип</div>
              <select id="pType" class="select">
                <option value="ENUM" ${param?.type==='ENUM'?'selected':''}>enum</option>
                <option value="NUMBER" ${param?.type==='NUMBER'?'selected':''}>number</option>
                <option value="TEXT" ${param?.type==='TEXT'?'selected':''}>text</option>
              </select>
            </div>
          </div>
          <div class="section-title" id="optsLabel">${param?.type==='ENUM'?'Опции (разделени със ,)':'Мерна единица (за number)'}</div>
          <textarea id="pOptions" class="textarea" placeholder="например: Лека кола, Джип, Товарен бус">${optsText || ''}</textarea>
          <div id="err" style="color:#b42318;font-size:13px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel">Затвори</button>
          <button class="btn-primary" id="save">Запази</button>
        </div>
      `;
      showModal(html, (wrap, close) => {
        const setOptsLabel = () => { $('#optsLabel', wrap).textContent = $('#pType', wrap).value === 'ENUM' ? 'Опции (разделени със ,)' : 'Мерна единица (за number)'; };
        $('#pType', wrap).onchange = setOptsLabel; setOptsLabel();
        $('#cancel', wrap).onclick = close;
        $('#save', wrap).onclick = async () => {
          const payload = {
            name: $('#pName', wrap).value.trim(),
            type: $('#pType', wrap).value,
          };
          const raw = $('#pOptions', wrap).value.trim();
          if (payload.type === 'ENUM') payload.options = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
          if (payload.type === 'NUMBER') payload.unit = raw || null;
          try {
            if (isEdit) await apiFetch(`/api/params/${param.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            else await apiFetch('/api/params', { method: 'POST', body: JSON.stringify(payload) });
            close(); load('');
          } catch (e) {
            $('#err', wrap).textContent = 'Записът не бе успешен. Проверете дали API е стартирано и имате права.';
          }
        };
      });
    }
    async function load(q) {
      const list = await fetchList(q);
      $('#paramRows').innerHTML = list.map(p => `
        <tr>
          <td>${p.name}</td>
          <td>${p.type}</td>
          <td>${p.type==='ENUM' ? (Array.isArray(p.options)?p.options.join(', '):(p.options||[]).join(', ')) : (p.unit || '')}</td>
          <td><button class="btn-secondary" data-edit="${p.id}" style="height:32px;">Редакция</button></td>
        </tr>
      `).join('');
      $$('[data-edit]').forEach(b => b.onclick = () => {
        const id = b.getAttribute('data-edit');
        const p = list.find(x => x.id === id);
        openParamModal(p);
      });
    }
    $('#paramSearch').oninput = (e) => load(e.target.value.trim());
    $('#addParam').onclick = () => openParamModal(null);
    load('');
  }
  function renderAdminReservations() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    let dataRows = [];
    root.innerHTML = adminNav('reservations') + `
      <div style="padding:16px;">
        <table class="table">
          <thead><tr><th>№</th><th>Кола</th><th>Клиент</th><th>От</th><th>До</th><th>Дни</th><th>Сума</th><th>Проформа</th><th>Фактура</th><th>Статус</th><th></th></tr></thead>
          <tbody id="resRows"></tbody>
        </table>
      </div>
    `;
    const latestByType = (inv = [], type) => {
      const filtered = (inv || []).filter(x => x.type === type);
      if (!filtered.length) return null;
      return filtered.sort((a,b) => new Date(a.issueDate||a.createdAt||0) - new Date(b.issueDate||b.createdAt||0)).pop();
    };
    const renderRows = (rs=[]) => {
      // dedupe by id in case of accidental duplicates
      const uniq = [];
      const seen = new Set();
      (rs||[]).forEach(r => {
        const key = r.id || `${r.seq || ''}-${r.carId || ''}-${r.from || ''}-${r.to || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        uniq.push(r);
      });
      dataRows = uniq;
      $('#resRows').innerHTML = uniq.map((r, idx) => {
        const pro = latestByType(r.invoices, 'PROFORMA');
        const inv = latestByType(r.invoices, 'INVOICE');
        const fmtInvDate = (x) => fmtDate(x?.issueDate || x?.createdAt || x?.updatedAt || '');
        const fmtInvNum = (x) => x?.number || '(без номер)';
        return `
        <tr data-res="${r.id}">
          <td>${r.seq ?? (idx+1)}</td>
          <td>${(r.car?.brand||'').trim()} ${(r.car?.model||'').trim() || r.carId || ''}</td>
          <td>${r.driverName||r.driver?.name||''}</td>
          <td>${fmtDate(r.from)}</td><td>${fmtDate(r.to)}</td>
          <td>${(function(){ const a=new Date(r.from), b=new Date(r.to); const d=Math.max(1, Math.ceil((b-a)/86400000)); return d; })()}</td>
          <td>${r.total ? `€${r.total}` : '—'}</td>
          <td>${pro ? `${fmtInvNum(pro)}<br><span style="color:#556;">${fmtInvDate(pro)}</span>` : '—'}</td>
          <td>${inv ? `${fmtInvNum(inv)}<br><span style="color:#556;">${fmtInvDate(inv)}</span>` : '—'}</td>
          <td><select class="select" data-status="${r.id}" style="height:32px;">
              ${RES_STATUS.map(s => `<option value="${s.value}" ${r.status===s.value?'selected':''}>${s.label}</option>`).join('')}
          </select></td>
          <td class="row" style="gap:6px;">
            <button class="btn-secondary" data-invoice="${r.id}" style="height:32px;">${r.status==='PAID'?'Фактура':'Проформа'}</button>
          </td>
        </tr>
      `;
      }).join('');
      $$('[data-status]').forEach(s => s.onchange = async () => {
        const id = s.getAttribute('data-status');
        const status = s.value;
        // update local state for instant UI change
        const row = dataRows.find(x => x.id === id);
        if (row) row.status = status;
        renderRows(dataRows);
        try { await apiFetch(`/api/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
        catch {}
      });
      $$('[data-invoice]').forEach(b => b.onclick = () => {
        const id = b.getAttribute('data-invoice');
        navigate(`#/admin/invoices?id=${id}`);
      });
      $$('tr[data-res]').forEach(row => row.onclick = (e) => {
        if (e.target.closest('select') || e.target.closest('button')) return;
        const id = row.getAttribute('data-res');
        openReservationModal(id);
      });
    };
    const load = async () => {
      try {
        let rs = await apiFetch('/api/reservations');
        rs = await Promise.all((rs||[]).map(async (r) => {
          if (r.invoices && r.invoices.length) return r;
          try {
            const invs = await apiFetch(`/api/invoices?reservationId=${r.id}`);
            return { ...r, invoices: invs || [] };
          } catch { return { ...r, invoices: [] }; }
        }));
        renderRows(rs || []);
      } catch {
        const rs = storage.get('cr_reservations', []);
        renderRows(rs);
      }
    };
    load();
  }

  function openReservationModal(id) {
    const html = `
      <div class="modal-header">Резервация</div>
      <div class="modal-body" style="max-height:70vh;overflow:auto;" id="resModalBody">
        Зареждане...
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="closeRes">Затвори</button>
        <button class="btn-primary" id="printRes">Печат</button>
      </div>
    `;
    const modal = showModal(html, (wrap, close) => {
      $('#closeRes', wrap).onclick = close;
      $('#printRes', wrap).onclick = () => {
        const body = $('#resModalBody', wrap).innerHTML;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Проформа</title></head><body>${body}</body></html>`);
        w.document.close();
        w.print();
      };
      const load = async () => {
        try {
          const r = await apiFetch(`/api/reservations/${id}`);
          const days = (() => { const a=new Date(r.from), b=new Date(r.to); return Math.max(1, Math.ceil((b-a)/86400000)); })();
          $('#resModalBody', wrap).innerHTML = `
            <div style="display:grid; gap:8px;">
              <div><strong>№:</strong> ${r.seq ?? ''}</div>
              <div><strong>Кола:</strong> ${r.car?.brand||''} ${r.car?.model||r.carId||''}</div>
              <div><strong>Период:</strong> ${fmtDate(r.from)} → ${fmtDate(r.to)} (${days} дни)</div>
              <div><strong>Взимане:</strong> ${r.pickPlace || ''}</div>
              <div><strong>Връщане:</strong> ${r.dropPlace || ''}</div>
              <div><strong>Шофьор:</strong> ${r.driverName||''}, тел: ${r.driverPhone||''}, имейл: ${r.driverEmail||''}</div>
              <div><strong>Статус:</strong> ${statusLabel(r.status)}</div>
              <div><strong>Сума:</strong> ${r.total ? '€'+r.total : '—'}</div>
              <hr>
              <div><strong>${r.status==='paid' ? 'Фактура' : 'Проформа'}</strong> (${r.invoiceType || ''})</div>
              ${r.invoiceType==='company' ? `
                <div>Фирма: ${r.invoiceName||''}</div>
                <div>ЕИК: ${r.invoiceNum||''} ДДС: ${r.invoiceVat||''}</div>
                <div>МОЛ: ${r.invoiceMol||''}</div>
                <div>Адрес: ${r.invoiceAddr||''}</div>
                <div>Имейл: ${r.invoiceEmail||''}</div>
                <div>Банка: ${r.invoiceBank||''}</div>
                <div>IBAN: ${r.invoiceIban||''}</div>
                <div>BIC: ${r.invoiceBic||''}</div>
              ` : `
                <div>Име: ${r.invoiceName||''}</div>
                <div>ЕГН: ${r.invoiceEgn||''}</div>
                <div>Адрес: ${r.invoiceAddr||''}</div>
                <div>Имейл: ${r.invoiceEmail||''}</div>
              `}
            </div>
          `;
        } catch {
          $('#resModalBody', wrap).innerHTML = 'Неуспешно зареждане.';
        }
      };
      load();
    });
    return modal;
  }
  function renderAdminInvoices() {
    mountAdminIfNeeded(true);
    const params = new URLSearchParams((location.hash.split('?')[1] || ''));
    const resId = params.get('id');
    const editMode = params.get('edit') === '1';
    const root = $('#adminRoot');
    root.innerHTML = adminNav('invoices') + `
      <div class="header"><h2>Проформа / Фактура</h2></div>
      ${resId ? `<div id="invEditor" class="panel" style="padding:16px;">Зареждане...</div>` : `<div class="panel" style="padding:16px;">Изберете резервация от списъка с резервации, за да редактирате проформа/фактура.</div>`}
    `;
    let companyCache = null;
    async function loadCompanyCache() {
      try { companyCache = await apiFetch('/api/company'); } catch { companyCache = null; }
    }
    loadCompanyCache();
    if (resId) {
      if (editMode) loadInvoiceEditor(resId);
      else loadInvoiceView(resId);
    }

    async function loadInvoiceView(reservationId) {
      const host = $('#invEditor');
      host.innerHTML = '<div>Зареждане...</div>';
      let reservation = null;
      let invoice = null;
      await loadCompanyCache();
      try { reservation = await apiFetch(`/api/reservations/${reservationId}`); } catch {}
      try { const list = await apiFetch(`/api/invoices?reservationId=${reservationId}`); invoice = (list||[])[0] || null; } catch {}
      // Ако няма фактура/проформа, създаваме проформа автоматично
      if (!invoice && reservation) {
        try {
          invoice = await apiFetch('/api/invoices', { method: 'POST', body: JSON.stringify({ reservationId, type: 'PROFORMA', status: 'ISSUED' }) });
        } catch {}
      }
      // Ако има, но няма номер, генерираме
      if (invoice && !invoice.number) {
        try { invoice = await apiFetch(`/api/invoices/${invoice.id}`, { method: 'PUT', body: JSON.stringify({}) }); } catch {}
      }
      if (!reservation) { host.innerHTML = '<div style="color:#b42318;">Резервацията не е намерена.</div>'; return; }
      const days = (() => { const a=new Date(reservation.from), b=new Date(reservation.to); return Math.max(1, Math.ceil((b-a)/86400000)); })();
      const items = normalizeInvoiceItems(invoice?.items || [
        {
          description: `Наем на автомобил ${reservation.car?.brand||''} ${reservation.car?.model||''} (${fmtDate(new Date(reservation.from))} → ${fmtDate(new Date(reservation.to))})`,
          qty: days,
          unitPrice: reservation.total && days ? reservation.total / days : (reservation.car?.pricePerDay || 0),
          vatRate: 20
        }
      ]);
      const totals = calcInvoiceTotals(items);
      const sup = {
        name: invoice?.supplierName || companyCache?.name || '',
        eik: invoice?.supplierEik || companyCache?.eik || '',
        vat: invoice?.supplierVat || companyCache?.vat || '',
        mol: invoice?.supplierMol || companyCache?.mol || '',
        addr: invoice?.supplierAddr || companyCache?.address || '',
        email: invoice?.supplierEmail || companyCache?.email || '',
        phone: invoice?.supplierPhone || companyCache?.phone || '',
        bank: invoice?.supplierBank || companyCache?.bank || '',
        iban: invoice?.supplierIban || companyCache?.iban || '',
        bic: invoice?.supplierBic || companyCache?.bic || ''
      };
      const payload = {
        type: invoice?.type || 'PROFORMA',
        number: invoice?.number || '',
        issueDate: invoice?.issueDate ? invoice.issueDate.slice(0,10) : '',
        dueDate: invoice?.dueDate ? invoice.dueDate.slice(0,10) : '',
        currency: invoice?.currency || 'EUR',
        paymentMethod: invoice?.paymentMethod || '',
        paymentTerms: invoice?.paymentTerms || '',
        buyerType: invoice?.buyerType || reservation.invoiceType || 'individual',
        buyerName: invoice?.buyerName || reservation.invoiceName || reservation.driverName || '',
        buyerEik: invoice?.buyerEik || reservation.invoiceNum || '',
        buyerVat: invoice?.buyerVat || reservation.invoiceVat || '',
        buyerEgn: invoice?.buyerEgn || reservation.invoiceEgn || '',
        buyerMol: invoice?.buyerMol || reservation.invoiceMol || '',
        buyerAddr: invoice?.buyerAddr || reservation.invoiceAddr || '',
        buyerEmail: invoice?.buyerEmail || reservation.invoiceEmail || '',
        buyerBank: invoice?.buyerBank || reservation.invoiceBank || '',
        buyerIban: invoice?.buyerIban || reservation.invoiceIban || '',
        buyerBic: invoice?.buyerBic || reservation.invoiceBic || '',
        notes: invoice?.notes || '',
        items
      };
      const rows = items.map(it => `
        <tr>
          <td>${it.description}</td>
          <td style="text-align:right;">${it.qty}</td>
          <td style="text-align:right;">€${it.unitPrice.toFixed(2)}</td>
          <td style="text-align:right;">${it.vatRate}%</td>
          <td style="text-align:right;">€${it.totalNet.toFixed(2)}</td>
          <td style="text-align:right;">€${it.totalVat.toFixed(2)}</td>
          <td style="text-align:right;">€${it.totalGross.toFixed(2)}</td>
        </tr>
      `).join('');
      host.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div>
            <div class="section-title">${payload.type==='INVOICE'?'Фактура':'Проформа'}</div>
            <div style="color:#556;">Номер: ${payload.number || '(генерира се)'} | Дата: ${payload.issueDate || ''} ${payload.dueDate ? ' | Падеж: '+payload.dueDate : ''} | Валута: ${payload.currency}</div>
            <div style="color:#556;">Основание: Наем на автомобил. Цените са с ДДС 20%.</div>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn-secondary" id="editInv" style="height:34px;">Редактирай</button>
            <button class="btn-primary" id="printInvView" style="height:34px;">Печат</button>
          </div>
        </div>
        <div class="grid-2" style="gap:16px; margin-top:12px;">
          <div class="panel" style="padding:12px;">
            <div class="section-title">Доставчик</div>
            <div>${sup.name}</div>
            <div>ЕИК: ${sup.eik} ${sup.vat ? ('ДДС №: '+sup.vat) : ''}</div>
            <div>МОЛ: ${sup.mol || ''}</div>
            <div>Адрес: ${sup.addr}</div>
            <div>Имейл: ${sup.email || ''} Тел: ${sup.phone || ''}</div>
            <div>Банка: ${sup.bank || ''} IBAN: ${sup.iban || ''} BIC: ${sup.bic || ''}</div>
          </div>
          <div class="panel" style="padding:12px;">
            <div class="section-title">Получател</div>
            <div>${payload.buyerName || ''}</div>
            <div>${payload.buyerType==='company'
              ? `ЕИК: ${payload.buyerEik || ''} ${payload.buyerVat ? ('ДДС №: '+payload.buyerVat) : ''}`
              : `ЕГН: ${payload.buyerEgn || ''}`}</div>
            <div>МОЛ: ${payload.buyerMol || ''}</div>
            <div>Адрес: ${payload.buyerAddr || ''}</div>
            <div>Имейл: ${payload.buyerEmail || ''}</div>
            <div>Банка: ${payload.buyerBank || ''} IBAN: ${payload.buyerIban || ''} BIC: ${payload.buyerBic || ''}</div>
          </div>
        </div>
        <div style="margin-top:12px;">
          <table class="table">
            <thead><tr><th>Описание</th><th>Кол-во</th><th>Ед. цена</th><th>ДДС %</th><th>Сума без ДДС</th><th>ДДС</th><th>Сума с ДДС</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:10px; text-align:right;">
          <div>Междинна сума: €${totals.subtotal.toFixed(2)}</div>
          <div>ДДС (20%): €${totals.vatAmount.toFixed(2)}</div>
          <div><strong>Общо: €${totals.total.toFixed(2)}</strong></div>
        </div>
        ${payload.notes ? `<div style="margin-top:8px;color:#556;">Бележки: ${payload.notes}</div>` : ''}
        <div style="margin-top:12px;color:#556;">Начин на плащане: ${payload.paymentMethod || ''} ${payload.paymentTerms ? ' / Условия: '+payload.paymentTerms : ''}</div>
      `;
      $('#editInv', host).onclick = () => {
        const q = new URLSearchParams(location.hash.split('?')[1] || '');
        q.set('edit','1');
        location.hash = `#/admin/invoices?${q.toString()}`;
      };
      $('#printInvView', host).onclick = () => {
        // reuse print logic by opening print template
        const btn = document.createElement('button');
        btn.id = 'printTmp';
        // simulate using existing print code
        const hash = location.hash;
        const q = new URLSearchParams(hash.split('?')[1] || '');
        q.set('edit','1'); // ensure editor renders print logic; but simpler: call window.print on rendered view
        window.print();
      };
    }

    async function loadInvoiceEditor(reservationId) {
      const host = $('#invEditor');
      const loading = '<div>Зареждане...</div>';
      host.innerHTML = loading;
      let reservation = null;
      let invoice = null;
      try { reservation = await apiFetch(`/api/reservations/${reservationId}`); } catch {}
      try { const list = await apiFetch(`/api/invoices?reservationId=${reservationId}`); invoice = (list||[])[0] || null; } catch {}
      if (!reservation) { host.innerHTML = '<div style="color:#b42318;">Резервацията не е намерена.</div>'; return; }
      const days = (() => { const a=new Date(reservation.from), b=new Date(reservation.to); return Math.max(1, Math.ceil((b-a)/86400000)); })();
      const defaultItems = normalizeInvoiceItems(invoice?.items || [
        {
          description: `Наем на автомобил ${reservation.car?.brand||''} ${reservation.car?.model||''} (${fmtDate(new Date(reservation.from))} → ${fmtDate(new Date(reservation.to))})`,
          qty: days,
          unitPrice: reservation.total && days ? reservation.total / days : (reservation.car?.pricePerDay || 0),
          vatRate: 20
        }
      ]);
      let state = {
        id: invoice?.id,
        reservationId,
        type: invoice?.type || 'PROFORMA',
        status: invoice?.status || 'DRAFT',
        number: invoice?.number || '',
        issueDate: invoice?.issueDate ? invoice.issueDate.slice(0,10) : (new Date()).toISOString().slice(0,10),
        dueDate: invoice?.dueDate ? invoice.dueDate.slice(0,10) : '',
        currency: invoice?.currency || 'EUR',
        paymentMethod: invoice?.paymentMethod || '',
        paymentTerms: invoice?.paymentTerms || '',
        notes: invoice?.notes || '',
        buyerType: invoice?.buyerType || reservation.invoiceType || 'individual',
        buyerName: invoice?.buyerName || reservation.invoiceName || reservation.driverName || '',
        buyerEik: invoice?.buyerEik || reservation.invoiceNum || '',
        buyerVat: invoice?.buyerVat || reservation.invoiceVat || '',
        buyerEgn: invoice?.buyerEgn || reservation.invoiceEgn || '',
        buyerMol: invoice?.buyerMol || reservation.invoiceMol || '',
        buyerAddr: invoice?.buyerAddr || reservation.invoiceAddr || '',
        buyerEmail: invoice?.buyerEmail || reservation.invoiceEmail || '',
        buyerBank: invoice?.buyerBank || reservation.invoiceBank || '',
        buyerIban: invoice?.buyerIban || reservation.invoiceIban || '',
        buyerBic: invoice?.buyerBic || reservation.invoiceBic || '',
        items: defaultItems
      };
      const totals = () => calcInvoiceTotals(state.items);
      const setVal = (id, v) => { const el = host.querySelector(`#${id}`); if (el) el.value = v ?? ''; };
      const renderItems = () => {
        const box = host.querySelector('#invItems');
        box.innerHTML = state.items.map((it, idx) => `
          <div class="grid-4" data-row="${idx}" style="align-items:end; gap:8px; margin-bottom:6px;">
            <div><div class="section-title">Описание</div><input data-field="description" class="input" value="${it.description || ''}"></div>
            <div><div class="section-title">Кол-во</div><input data-field="qty" type="number" step="0.01" class="input" value="${it.qty}"></div>
            <div><div class="section-title">Ед. цена</div><input data-field="unitPrice" type="number" step="0.01" class="input" value="${it.unitPrice}"></div>
            <div><div class="section-title">ДДС %</div><input data-field="vatRate" type="number" step="1" class="input" value="${it.vatRate}"></div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button class="btn-secondary" data-del="${idx}" style="height:32px;">Изтрий</button>
            </div>
          </div>
        `).join('') || '<div>Няма редове.</div>';
        $$('[data-field]', box).forEach(inp => inp.oninput = () => {
          const row = Number(inp.closest('[data-row]').getAttribute('data-row'));
          const field = inp.getAttribute('data-field');
          state.items[row][field] = field === 'description' ? inp.value : Number(inp.value || 0);
          state.items = normalizeInvoiceItems(state.items);
          refreshTotals();
          renderItems();
        });
        $$('[data-del]', box).forEach(btn => btn.onclick = () => {
          const idx = Number(btn.getAttribute('data-del'));
          state.items.splice(idx, 1);
          renderItems();
          refreshTotals();
        });
      };
      const refreshTotals = () => {
        const t = totals();
        const el = host.querySelector('#invTotals');
        el.innerHTML = `
          <div>Междинна сума: €${t.subtotal.toFixed(2)}</div>
          <div>ДДС (20%): €${t.vatAmount.toFixed(2)}</div>
          <div><strong>Общо: €${t.total.toFixed(2)}</strong></div>
        `;
      };
      host.innerHTML = `
        <div class="section-title" style="margin-bottom:8px;">Резервация №${reservation.seq || ''} • ${reservation.car?.brand||''} ${reservation.car?.model||''}</div>
        <div class="grid-3" style="gap:12px;">
          <div><div class="section-title">Тип документ</div><select id="invType" class="select">
            <option value="PROFORMA" ${state.type==='PROFORMA'?'selected':''}>Проформа</option>
            <option value="INVOICE" ${state.type==='INVOICE'?'selected':''}>Фактура</option>
          </select></div>
          <div><div class="section-title">Статус</div><select id="invStatus" class="select">
            ${['DRAFT','ISSUED','PAID','CANCELLED'].map(s => `<option ${state.status===s?'selected':''} value="${s}">${s}</option>`).join('')}
          </select></div>
          <div><div class="section-title">Номер</div><input id="invNumber" class="input" placeholder="авто" value="${state.number || ''}"></div>
        </div>
        <div class="grid-3" style="gap:12px;">
          <div><div class="section-title">Дата издаване</div><input id="invIssue" type="date" class="input" value="${state.issueDate}"></div>
          <div><div class="section-title">Падеж</div><input id="invDue" type="date" class="input" value="${state.dueDate || ''}"></div>
          <div><div class="section-title">Валута</div><input id="invCurrency" class="input" value="${state.currency}"></div>
        </div>
        <div class="grid-2" style="gap:12px;">
          <div><div class="section-title">Начин на плащане</div><input id="invPay" class="input" value="${state.paymentMethod||''}"></div>
          <div><div class="section-title">Условия</div><input id="invTerms" class="input" value="${state.paymentTerms||''}"></div>
        </div>
        <div class="section-title" style="margin-top:8px;">Клиент</div>
        <div class="grid-3" style="gap:12px;">
          <div><div class="section-title">Тип</div><select id="buyerType" class="select">
            <option value="individual" ${state.buyerType==='individual'?'selected':''}>Физическо лице</option>
            <option value="company" ${state.buyerType==='company'?'selected':''}>Юридическо лице</option>
          </select></div>
          <div><div class="section-title">Име / Фирма</div><input id="buyerName" class="input" value="${state.buyerName||''}"></div>
          <div><div class="section-title">Имейл</div><input id="buyerEmail" class="input" value="${state.buyerEmail||''}"></div>
        </div>
        <div class="grid-3" style="gap:12px;">
          <div><div class="section-title">ЕИК</div><input id="buyerEik" class="input" value="${state.buyerEik||''}"></div>
          <div><div class="section-title">ДДС №</div><input id="buyerVat" class="input" value="${state.buyerVat||''}"></div>
          <div><div class="section-title">ЕГН</div><input id="buyerEgn" class="input" value="${state.buyerEgn||''}"></div>
        </div>
        <div class="grid-3" style="gap:12px;">
          <div><div class="section-title">МОЛ</div><input id="buyerMol" class="input" value="${state.buyerMol||''}"></div>
          <div><div class="section-title">Банка</div><input id="buyerBank" class="input" value="${state.buyerBank||''}"></div>
          <div><div class="section-title">IBAN / BIC</div>
            <div class="row" style="gap:6px;">
              <input id="buyerIban" class="input" style="flex:2;" value="${state.buyerIban||''}">
              <input id="buyerBic" class="input" style="flex:1;" value="${state.buyerBic||''}">
            </div>
          </div>
        </div>
        <div><div class="section-title">Адрес</div><input id="buyerAddr" class="input" value="${state.buyerAddr||''}"></div>
        <div class="section-title" style="margin-top:8px;">Редове</div>
        <div id="invItems"></div>
        <div><button class="btn-secondary" id="addItem" type="button" style="height:34px;">Добави ред</button></div>
        <div id="invTotals" style="display:grid;gap:4px;"></div>
        <div class="section-title">Бележки</div>
        <textarea id="invNotes" class="input" style="min-height:60px;">${state.notes||''}</textarea>
        <div class="row" style="justify-content:flex-end; gap:8px; margin-top:8px;">
          <button class="btn-secondary" id="printInv" type="button">Печат (Print to PDF)</button>
          <button class="btn-primary" id="saveInv" type="button">Запази</button>
        </div>
      `;
      renderItems();
      refreshTotals();
      $('#addItem', host).onclick = () => {
        state.items.push({ description:'Услуга', qty:1, unitPrice:0, vatRate:20, totalNet:0, totalVat:0, totalGross:0 });
        renderItems(); refreshTotals();
      };
      const collect = () => {
        const val = id => (host.querySelector(`#${id}`)?.value || '').trim();
        return {
          id: state.id,
          reservationId,
          type: val('invType') || 'PROFORMA',
          status: val('invStatus') || 'DRAFT',
          number: val('invNumber') || null,
          issueDate: val('invIssue'),
          dueDate: val('invDue') || null,
          currency: val('invCurrency') || 'EUR',
          paymentMethod: val('invPay') || null,
          paymentTerms: val('invTerms') || null,
          notes: $('#invNotes', host)?.value || '',
          buyerType: val('buyerType') || 'individual',
          buyerName: val('buyerName'),
          buyerEik: val('buyerEik'),
          buyerVat: val('buyerVat'),
          buyerEgn: val('buyerEgn'),
          buyerMol: val('buyerMol'),
          buyerAddr: val('buyerAddr'),
          buyerEmail: val('buyerEmail'),
          buyerBank: val('buyerBank'),
          buyerIban: val('buyerIban'),
          buyerBic: val('buyerBic'),
          items: state.items
        };
      };
      $('#saveInv', host).onclick = async () => {
        const payload = collect();
        try {
          const url = payload.id ? `/api/invoices/${payload.id}` : '/api/invoices';
          const method = payload.id ? 'PUT' : 'POST';
          const saved = await apiFetch(url, { method, body: JSON.stringify(payload) });
          state.id = saved.id;
          state.number = saved.number || state.number;
          state.status = saved.status || state.status;
          state.items = normalizeInvoiceItems(payload.items);
          renderItems(); refreshTotals();
          alert('Записано.');
        } catch (e) {
          alert('Грешка при запис: ' + (e.message || ''));
        }
      };
      $('#printInv', host).onclick = () => {
        const payload = collect();
        const t = calcInvoiceTotals(state.items);
        const supplier = {
          name: invoice?.supplierName || companyCache?.name || '',
          eik: invoice?.supplierEik || companyCache?.eik || '',
          vat: invoice?.supplierVat || companyCache?.vat || '',
          mol: invoice?.supplierMol || companyCache?.mol || '',
          addr: invoice?.supplierAddr || companyCache?.address || '',
          email: invoice?.supplierEmail || companyCache?.email || '',
          phone: invoice?.supplierPhone || companyCache?.phone || '',
          bank: invoice?.supplierBank || companyCache?.bank || '',
          iban: invoice?.supplierIban || companyCache?.iban || '',
          bic: invoice?.supplierBic || companyCache?.bic || ''
        };
        const win = window.open('', '_blank');
        const rows = state.items.map(it => `
          <tr>
            <td>${it.description}</td>
            <td style="text-align:right;">${it.qty}</td>
            <td style="text-align:right;">€${it.unitPrice.toFixed(2)}</td>
            <td style="text-align:right;">${it.vatRate}%</td>
            <td style="text-align:right;">€${it.totalNet.toFixed(2)}</td>
            <td style="text-align:right;">€${it.totalVat.toFixed(2)}</td>
            <td style="text-align:right;">€${it.totalGross.toFixed(2)}</td>
          </tr>
        `).join('');
        win.document.write(`
          <html><head><title>${payload.type==='INVOICE'?'Фактура':'Проформа'}</title>
            <style>
              body{font-family:Inter,Arial,sans-serif;padding:24px;font-size:13px;color:#1f2933;}
              table{width:100%;border-collapse:collapse;margin-top:12px;}
              td,th{border:1px solid #ccc;padding:6px;font-size:12px;}
              .grid{display:flex;gap:24px;}
              .muted{color:#666;font-size:12px;}
              .totals{margin-top:12px;text-align:right;}
              .badge{display:inline-block;padding:2px 8px;border-radius:6px;background:#eef2ff;font-size:12px;}
              h2{margin:0 0 6px 0;}
            </style>
          </head><body>
            <h2>${payload.type==='INVOICE'?'Фактура':'Проформа'}</h2>
            <div class="muted">
              Номер: ${payload.number || '(генерира се при запис)'} |
              Дата: ${payload.issueDate || ''} ${payload.dueDate ? ' | Падеж: '+payload.dueDate : ''} |
              Валута: ${payload.currency || 'EUR'}
            </div>
            <div class="muted">Основание: Наем на автомобил. Цените са с ДДС 20%.</div>
            <div class="grid" style="margin-top:12px;">
              <div style="flex:1;">
                <strong>Доставчик</strong><br>
                ${supplier.name}<br>
                ЕИК: ${supplier.eik} ${supplier.vat ? ('ДДС №: '+supplier.vat) : ''}<br>
                МОЛ: ${supplier.mol || ''}<br>
                Адрес: ${supplier.addr}<br>
                Имейл: ${supplier.email || ''} Тел: ${supplier.phone || ''}<br>
                Банка: ${supplier.bank || ''} IBAN: ${supplier.iban || ''} BIC: ${supplier.bic || ''}
              </div>
              <div style="flex:1;">
                <strong>Получател</strong><br>
                ${payload.buyerName || ''}<br>
                ${payload.buyerType==='company'
                  ? `ЕИК: ${payload.buyerEik || ''} ${payload.buyerVat ? ('ДДС №: '+payload.buyerVat) : ''}`
                  : `ЕГН: ${payload.buyerEgn || ''}`}<br>
                МОЛ: ${payload.buyerMol || ''}<br>
                Адрес: ${payload.buyerAddr || ''}<br>
                Имейл: ${payload.buyerEmail || ''}<br>
                Банка: ${payload.buyerBank || ''} IBAN: ${payload.buyerIban || ''} BIC: ${payload.buyerBic || ''}
              </div>
            </div>
            <table>
              <thead><tr><th>Описание</th><th>Кол-во</th><th>Ед. цена</th><th>ДДС %</th><th>Сума без ДДС</th><th>ДДС</th><th>Сума с ДДС</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="totals">
              <div>Междинна сума: €${t.subtotal.toFixed(2)}</div>
              <div>ДДС (20%): €${t.vatAmount.toFixed(2)}</div>
              <div><strong>Общо: €${t.total.toFixed(2)}</strong></div>
            </div>
            <div style="margin-top:12px;" class="muted">
              Начин на плащане: ${payload.paymentMethod || ''} ${payload.paymentTerms ? ' / Условия: '+payload.paymentTerms : ''}<br>
              Съставил: ....................................    Подпис: ..............................
            </div>
          </body></html>
        `);
        win.document.close(); win.print();
      };
    }
  }

  function renderAdminSettings() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('settings') + `
      <div class="header"><h2>Инфо за компанията (фактуриране)</h2></div>
      <div style="padding:16px;">
        <form id="companyForm" class="panel" style="padding:16px; display:grid; gap:14px;">
          <div class="grid-2">
            <div><div class="section-title">Наименование (фирма)</div><input name="name" class="input" required></div>
            <div><div class="section-title">МОЛ</div><input name="mol" class="input"></div>
          </div>
          <div class="grid-3">
            <div><div class="section-title">ЕИК/БУЛСТАТ</div><input name="eik" class="input" required></div>
            <div><div class="section-title">ДДС № (ако има)</div><input name="vat" class="input"></div>
            <div><div class="section-title">Град</div><input name="city" class="input" required></div>
          </div>
          <div><div class="section-title">Адрес на управление</div><input name="address" class="input" required></div>
          <div class="grid-3">
            <div><div class="section-title">Държава</div><input name="country" class="input" value="България" required></div>
            <div><div class="section-title">Телефон</div><input name="phone" class="input"></div>
            <div><div class="section-title">Имейл</div><input name="email" class="input"></div>
          </div>
          <div class="grid-3">
            <div><div class="section-title">Банка</div><input name="bank" class="input"></div>
            <div><div class="section-title">IBAN</div><input name="iban" class="input"></div>
            <div><div class="section-title">BIC</div><input name="bic" class="input"></div>
          </div>
          <div class="grid-2">
            <div><div class="section-title">Стартов номер проформа</div><input name="proStart" type="number" min="1" class="input" value="1"></div>
            <div><div class="section-title">Стартов номер фактура</div><input name="invStart" type="number" min="1" class="input" value="1"></div>
          </div>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button type="submit" class="btn-primary" id="saveCompany">Запази</button>
          </div>
          <div id="companyMsg" style="color:#0F8E64; display:none;">Записано успешно.</div>
        </form>
      </div>
      <div class="toolbar">
        <button class="btn-primary" id="addLoc">Добави място</button>
        <div style="margin-left:auto;"></div>
      </div>
      <div style="padding:16px;">
        <div class="section-title">Места за взимане/връщане</div>
        <table class="table">
          <thead><tr><th>Име</th><th>Активно</th><th></th></tr></thead>
          <tbody id="locRows"></tbody>
        </table>
      </div>
    `;
    async function loadCompany() {
      let data = null;
      try { data = await apiFetch('/api/company'); } catch { data = null; }
      const form = $('#companyForm');
      const set = (n,v) => { const el = form.querySelector(`[name="${n}"]`); if (el) el.value = v || ''; };
      set('name', data?.name); set('mol', data?.mol);
      set('eik', data?.eik); set('vat', data?.vat);
      set('city', data?.city); set('address', data?.address);
      set('country', data?.country || 'България');
      set('phone', data?.phone); set('email', data?.email);
      set('bank', data?.bank); set('iban', data?.iban); set('bic', data?.bic);
      set('proStart', data?.proStart || 1); set('invStart', data?.invStart || 1);
    }
    loadCompany();
    $('#companyForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const payload = Object.fromEntries(new FormData(f).entries());
      payload.proStart = payload.proStart ? Number(payload.proStart) : 1;
      payload.invStart = payload.invStart ? Number(payload.invStart) : 1;
      try {
        await apiFetch('/api/company', { method: 'PUT', body: JSON.stringify(payload) });
        $('#companyMsg').style.display = 'block';
        setTimeout(() => $('#companyMsg').style.display = 'none', 2000);
      } catch {
        const msg = $('#companyMsg');
        msg.style.display = 'block';
        msg.style.color = '#B42318';
        msg.textContent = 'Грешка при запис.';
        setTimeout(() => { msg.style.display = 'none'; msg.style.color = '#0F8E64'; msg.textContent = 'Записано успешно.'; }, 2500);
      }
    };
    async function loadLocations() {
      let list = [];
      try { list = await apiFetch('/api/locations'); } catch { list = []; }
      $('#locRows').innerHTML = list.map(l => `
        <tr>
          <td>${l.label}</td>
          <td>${l.active ? 'Да' : 'Не'}</td>
          <td class="row" style="gap:6px;">
            <button class="btn-secondary" data-del="${l.id}" style="height:32px;">Изтрий</button>
          </td>
        </tr>
      `).join('');
      $$('[data-del]').forEach(b => b.onclick = async () => {
        const id = b.getAttribute('data-del');
        const tr = b.closest('tr');
        b.disabled = true;
        const prev = b.textContent;
        b.textContent = 'Изтриване...';
        tr.style.opacity = '0.5';
        try {
          await apiFetch(`/api/locations/${id}`, { method: 'DELETE' });
          // Optimistic UI: remove row immediately
          tr.remove();
        } catch {
          // Revert on error
          b.disabled = false;
          b.textContent = prev;
          tr.style.opacity = '1';
        } finally {
          // Ensure latest state
          await load();
        }
      });
    }
    $('#addLoc').onclick = () => {
      const html = `
        <div class="modal-header">Добави място</div>
        <div class="modal-body">
          <div class="section-title">Име на място</div>
          <input id="locLabel" class="input" placeholder="напр. гр. София, Летище SOF">
          <div id="err" style="color:#b42318;font-size:13px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel">Затвори</button>
          <button class="btn-primary" id="save">Запази</button>
        </div>
      `;
      showModal(html, (wrap, close) => {
        $('#cancel', wrap).onclick = close;
        $('#save', wrap).onclick = async () => {
          const label = $('#locLabel', wrap).value.trim();
          if (!label) { $('#err', wrap).textContent = 'Мястото е задължително.'; return; }
          try { await apiFetch('/api/locations', { method: 'POST', body: JSON.stringify({ label }) }); close(); load(); } catch { $('#err', wrap).textContent = 'Записът не бе успешен.'; }
        };
      });
    };
    loadLocations();
  }

  function renderRoute() {
    const hash = location.hash || '#/';
    if (hash.startsWith('#/admin')) {
      const path = hash.split('?')[0];
      if (path === '#/admin' || path === '#/admin/') return renderAdminDashboard();
      if (path === '#/admin/cars') return renderAdminCars();
      if (path === '#/admin/params') return renderAdminParams();
      if (path === '#/admin/settings') return renderAdminSettings();
      if (path === '#/admin/reservations') return renderAdminReservations();
      if (path === '#/admin/invoices') return renderAdminInvoices();
      return renderAdminDashboard();
    }
    if (hash.startsWith('#/reserve')) return renderWizard();
    // default home
    mountSearchLayout();
    renderFilters();
    applyFilters();
  }

  // Kickoff router
  renderRoute();
})(); 


