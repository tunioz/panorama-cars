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
  async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    headers['accept'] = headers['accept'] || 'application/json';
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
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
    trim: 'ST-Line',
    year: 2025,
    pricePerHour: 28,
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
        trim: i % 3 ? 'ST-Line 115CV' : 'Titanium X',
        pricePerHour: 22 + (i % 7) * 2 + (i % 3),
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
  async function fetchCarsFromApi() {
    try {
      const res = await fetch(`${API_BASE}/api/cars`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Map API enums to UI fields
      return data.map(c => ({
        id: c.id,
        brand: c.brand, model: c.model, trim: c.trim,
        pricePerHour: c.pricePerHour,
        transmission: c.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual',
        fuel: c.fuel ? c.fuel.charAt(0) + c.fuel.slice(1).toLowerCase() : 'Diesel',
        seats: c.seats || 5,
        type: c.type || 'Лека кола',
        status: c.status === 'SERVICE' ? 'в сервиз' : c.status === 'RESERVED' ? 'резервиран' : 'наличен',
        favorite: false
      }));
    } catch {
      return null;
    }
  }
  let cars = await fetchCarsFromApi() || storage.get('cr_cars', cloneCars());
  storage.set('cr_cars', cars);
  let filtered = [...cars];
  let selected = filtered[0];
  const reservations = storage.get('cr_reservations', []);
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
  // Load parameter definitions from API for dynamic filters
  let paramDefs = [];
  async function loadParamDefs() {
    try {
      paramDefs = await apiFetch('/api/params');
    } catch {
      paramDefs = [];
    }
  }
  await loadParamDefs();

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
          <input id="fromDate" type="datetime-local" class="input">
        </div>
        <div class="fgrp g-to">
          <label>Дата на връщане</label>
          <input id="toDate" type="datetime-local" class="input">
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
    // Prefill dates
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const end = new Date(now); end.setHours(end.getHours() + 3);
    $('#fromDate').value = (filterState.from || now.toISOString().slice(0,16));
    $('#toDate').value = (filterState.to || end.toISOString().slice(0,16));

    $('#submitFilters').onclick = () => { applyFilters(); };
    $('#transmissionSelect').onchange = (e) => { filterState.transmission = e.target.value; applyFilters(); };
    $('#pickPlace').oninput = (e) => { filterState.pick = e.target.value; };
    $('#dropPlace').oninput = (e) => { filterState.drop = e.target.value; };
    $('#fromDate').onchange = (e) => { filterState.from = e.target.value; };
    $('#toDate').onchange = (e) => { filterState.to = e.target.value; };
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
      if (q && !(c.brand.toLowerCase().includes(q) || c.model.toLowerCase().includes(q) || c.trim.toLowerCase().includes(q))) return false;
      // normalize transmission (supports BG and EN)
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const mapTx = (v) => {
        const n = norm(v);
        if (n === 'автоматик' || n === 'automatic') return 'automatic';
        if (n === 'ръчна' || n === 'manual' || n === 'ръчна скоростна кутия') return 'manual';
        return n;
      };
      if (filterState.transmission !== 'Any') {
        if (mapTx(c.transmission) !== mapTx(filterState.transmission)) return false;
      }
      if (filterState.type !== 'Всички' && c.type !== filterState.type) return false;
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
    if (mode === 'Price: Low to High') filtered.sort((a,b) => a.pricePerHour - b.pricePerHour);
    if (mode === 'Price: High to Low') filtered.sort((a,b) => b.pricePerHour - a.pricePerHour);
    if (mode === 'Newest') filtered.sort((a,b) => b.year - a.year);
  }
  function renderResults() {
    const r = $('#results');
    const count = filtered.length;
    r.innerHTML = `
      <div class="results-header">
        <div style="display:flex;gap:8px;align-items:center;">
          <strong>${count}</strong><span style="color:var(--color-text-3)">коли за наем</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="color:var(--color-text-3)">Подредба:</span>
          <select id="sortSelect" class="select">
            <option>Closest to me</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
            <option>Newest</option>
          </select>
        </div>
      </div>
      <div class="results-grid" id="resultsGrid"></div>
    `;
    $('#sortSelect').value = filterState.sort;
    $('#sortSelect').onchange = (e) => { sortResults(e.target.value); renderResults(); };

    const grid = $('#resultsGrid');
    grid.innerHTML = '';
    filtered.forEach((c, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      const hue = 205 + (i * 20) % 120;
      card.innerHTML = `
        <div class="card-media"><img alt="" src="${carPlaceholderSVG(`${c.brand} ${c.model}`, 680, 160, hue)}" style="width:100%;height:100%;object-fit:cover;border:0;"></div>
        <div class="card-body">
          <div class="row">
            <div class="title">${c.brand} ${c.model} ${c.trim}</div>
            <div class="row" style="gap:6px;">
              <div class="price">$${c.pricePerHour}/h</div>
              <div class="heart ${c.favorite ? 'active':''}" data-id="${c.id}" title="Save">❤</div>
            </div>
          </div>
          <div class="meta" style="margin:6px 0 10px;">
            <span class="pill">⭐ ${c.rating.toFixed(1)}</span>
            <span class="pill">📍 ${c.distanceKm.toFixed(1)}km (${c.etaMin}m)</span>
          </div>
          <div class="meta">
            <span>🚗 ${c.bodyStyle}</span>
            <span>⚙️ ${c.transmission}</span>
            <span>⛽ ${c.fuel}</span>
            <span>👤 ${c.seats}</span>
          </div>
          <div class="row" style="margin-top:10px;">
            <button class="btn-primary" data-check="${c.id}">Проверка на наличност</button>
          </div>
        </div>
      `;
      card.onclick = (ev) => {
        if (ev.target.classList.contains('heart')) return;
        if (ev.target.dataset.check) return;
        selected = c; renderDetails(); window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      grid.appendChild(card);
    });
    $$('.heart').forEach(h => h.onclick = (e) => {
      e.stopPropagation();
      const id = h.getAttribute('data-id');
      const car = cars.find(x => x.id === id);
      if (car) { car.favorite = !car.favorite; h.classList.toggle('active', car.favorite); }
    });
    $$('[data-check]').forEach(b => b.onclick = (e) => {
      const id = e.currentTarget.getAttribute('data-check');
      const q = new URLSearchParams({
        car: id,
        pick: filterState.pick,
        drop: filterState.drop,
        from: filterState.from || '',
        to: filterState.to || ''
      }).toString();
      navigate(`#/reserve?${q}&step=1`);
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
    const rate = car.pricePerHour;
    // Prefill times
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const start = new Date(now);
    const end = new Date(now); end.setHours(end.getHours() + 3);
    pickup.value = start.toISOString().slice(0,16);
    dropoff.value = end.toISOString().slice(0,16);
    function hoursBetween(a,b) { const ms = new Date(b) - new Date(a); return Math.max(0, ms / 36e5); }
    function recalc() {
      const h = hoursBetween(pickup.value, dropoff.value) + (extra.checked ? 0.5 : 0);
      const base = h * rate;
      const insVal = Number(ins.value || 0);
      const tax = base * 0.162; // simple sample rate ~16.2%
      $('#rateVal').textContent = `${formatMoney(base)} (${h.toFixed(1)}h @ $${rate}/h)`;
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

  /* Booking Wizard (steps 1-3 + confirm) */
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
    const draftKey = 'cr_draft';
    const draft = storage.get(draftKey, {
      id: uid(),
      carId: car.id,
      pick: paramsUrl.get('pick') || '',
      drop: paramsUrl.get('drop') || '',
      from: paramsUrl.get('from') || '',
      to: paramsUrl.get('to') || '',
      driver: {},
      invoice: { type: 'individual' },
      status: 'pending'
    });
    storage.set(draftKey, draft);

    const stepper = `
      <div class="toolbar">
        <div class="tag ${step===1?'':'pill'}">Стъпка 1 • Параметри</div>
        <div class="tag ${step===2?'':'pill'}">Стъпка 2 • Шофьор</div>
        <div class="tag ${step===3?'':'pill'}">Стъпка 3 • Фактура</div>
        <div class="tag ${step===4?'':'pill'}">Потвърждение</div>
        <div style="margin-left:auto;" class="tag">Колa: ${car.brand} ${car.model}</div>
      </div>
    `;

    if (step === 1) {
      d.innerHTML = `
        <div class="header"><h2>Резервация – Параметри</h2></div>
        ${stepper}
        <div style="padding:16px; display:grid; gap:14px;">
          <div class="grid-2">
            <div><div class="section-title">Място взимане</div><input id="wPick" class="input" value="${draft.pick || ''}" placeholder="Място"/></div>
            <div><div class="section-title">Място връщане</div><input id="wDrop" class="input" value="${draft.drop || ''}" placeholder="Място"/></div>
          </div>
          <div class="grid-2">
            <div><div class="section-title">От</div><input id="wFrom" type="datetime-local" class="input" value="${(draft.from || '').slice(0,16)}"/></div>
            <div><div class="section-title">До</div><input id="wTo" type="datetime-local" class="input" value="${(draft.to || '').slice(0,16)}"/></div>
          </div>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button class="btn-primary" id="next1">Напред</button>
          </div>
        </div>
      `;
      $('#next1').onclick = () => {
        draft.pick = $('#wPick').value; draft.drop = $('#wDrop').value;
        draft.from = $('#wFrom').value; draft.to = $('#wTo').value;
        storage.set(draftKey, draft); navigate(`#/reserve?car=${car.id}&step=2`);
      };
      return;
    }
    if (step === 2) {
      d.innerHTML = `
        <div class="header"><h2>Резервация – Данни на шофьора</h2></div>
        ${stepper}
        <div style="padding:16px; display:grid; gap:14px;">
          <div class="grid-3">
            <div><div class="section-title">Име</div><input id="dName" class="input" value="${draft.driver.name || ''}"/></div>
            <div><div class="section-title">Телефон</div><input id="dPhone" class="input" value="${draft.driver.phone || ''}"/></div>
            <div><div class="section-title">Имейл</div><input id="dEmail" class="input" value="${draft.driver.email || ''}"/></div>
          </div>
          <div class="grid-3">
            <div><div class="section-title">№ книжка</div><input id="dLicense" class="input" value="${draft.driver.license || ''}"/></div>
            <div><div class="section-title">Дата на раждане</div><input id="dBirth" type="date" class="input" value="${draft.driver.birth || ''}"/></div>
            <div><div class="section-title">Адрес</div><input id="dAddr" class="input" value="${draft.driver.addr || ''}"/></div>
          </div>
          <div class="row" style="justify-content:space-between;">
            <button class="btn-secondary" id="back1">Назад</button>
            <button class="btn-primary" id="next2">Напред</button>
          </div>
        </div>
      `;
      $('#back1').onclick = () => navigate(`#/reserve?car=${car.id}&step=1`);
      $('#next2').onclick = () => {
        draft.driver = {
          name: $('#dName').value, phone: $('#dPhone').value, email: $('#dEmail').value,
          license: $('#dLicense').value, birth: $('#dBirth').value, addr: $('#dAddr').value
        };
        storage.set(draftKey, draft); navigate(`#/reserve?car=${car.id}&step=3`);
      };
      return;
    }
    if (step === 3) {
      const inv = draft.invoice || { type: 'individual' };
      d.innerHTML = `
        <div class="header"><h2>Резервация – Данни за фактура</h2></div>
        ${stepper}
        <div style="padding:16px; display:grid; gap:14px;">
          <div class="radios">
            <label><input type="radio" name="invType" value="individual" ${inv.type!=='company'?'checked':''}> Физическо лице</label>
            <label><input type="radio" name="invType" value="company" ${inv.type==='company'?'checked':''}> Юридическо лице</label>
          </div>
          <div class="grid-2">
            <div><div class="section-title">Име/Фирма</div><input id="iName" class="input" value="${inv.name || draft.driver.name || ''}"/></div>
            <div><div class="section-title">ЕИК/ЕГН</div><input id="iNum" class="input" value="${inv.num || ''}"/></div>
          </div>
          <div class="grid-2">
            <div><div class="section-title">Адрес</div><input id="iAddr" class="input" value="${inv.addr || ''}"/></div>
            <div><div class="section-title">Е-мейл за фактура</div><input id="iEmail" class="input" value="${inv.email || draft.driver.email || ''}"/></div>
          </div>
          <div class="row" style="justify-content:space-between;">
            <button class="btn-secondary" id="back2">Назад</button>
            <button class="btn-primary" id="confirm">Потвърждение</button>
          </div>
        </div>
      `;
      $$('input[name="invType"]').forEach(r => r.onchange = () => { inv.type = r.value; });
      $('#back2').onclick = () => navigate(`#/reserve?car=${car.id}&step=2`);
      $('#confirm').onclick = async () => {
        draft.invoice = {
          type: inv.type,
          name: $('#iName').value, num: $('#iNum').value, addr: $('#iAddr').value, email: $('#iEmail').value
        };
        draft.status = 'pending';
        // Try API first
        const payload = {
          carId: car.id,
          from: draft.from || new Date().toISOString(),
          to: draft.to || new Date(Date.now()+3*3600e3).toISOString(),
          pickPlace: draft.pick, dropPlace: draft.drop,
          driver: draft.driver, invoice: draft.invoice,
          total: car.pricePerHour * 3
        };
        try {
          const res = await fetch(`${API_BASE}/api/reservations`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('fail');
        } catch {
          // Fallback local
          const saved = storage.get('cr_reservations', []);
          saved.push({ ...draft, createdAt: new Date().toISOString(), pricePerHour: car.pricePerHour });
          storage.set('cr_reservations', saved);
        }
        storage.set(draftKey, null);
        navigate(`#/reserve?car=${car.id}&step=4&id=${draft.id}`);
      };
      return;
    }
    if (step === 4) {
      const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
      d.innerHTML = `
        <div class="header"><h2>Резервация изпратена</h2></div>
        ${stepper}
        <div style="padding:16px;">
          <p>Вашата заявка № <strong>${id}</strong> е получена и очаква одобрение.</p>
          <div class="row" style="gap:8px;">
            <a class="btn-primary" href="#/">Към начална страница</a>
            <a class="btn-secondary" href="#/admin/reservations">Към админ панел (демо)</a>
          </div>
        </div>
      `;
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
          <thead><tr><th>Марка</th><th>Модел</th><th>Тип</th><th>Цена/ч</th><th>Статус</th><th></th></tr></thead>
          <tbody id="carRows"></tbody>
        </table>
      </div>
    `;
    function draw() {
      $('#carRows').innerHTML = cars.map(c => `
        <tr>
          <td>${c.brand}</td><td>${c.model}</td><td>${c.type}</td><td>$${c.pricePerHour}</td>
          <td><select data-status="${c.id}" class="select" style="height:32px;">
            ${['наличен','в сервиз','резервиран'].map(s => `<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
          </select></td>
          <td><button class="btn-secondary" data-edit="${c.id}" style="height:32px;">Редакция</button></td>
        </tr>
      `).join('');
      $$('[data-status]').forEach(s => s.onchange = () => {
        const id = s.getAttribute('data-status'); const car = cars.find(x => x.id === id); car.status = s.value; storage.set('cr_cars', cars);
      });
      $$('[data-edit]').forEach(b => b.onclick = () => editCar(b.getAttribute('data-edit')));
    }
    function editCar(id) {
      const car = cars.find(c => c.id === id) || { id: uid(), brand:'', model:'', trim:'', pricePerHour:25, type:'Лека кола', status:'наличен' };
      const isNew = !cars.find(c => c.id === id);
      root.innerHTML = adminNav('cars') + `
        <div class="header"><h2>${isNew?'Добавяне':'Редакция'} на кола</h2></div>
        <div style="padding:16px; display:grid; gap:12px;">
          <div class="grid-3">
            <input id="cBrand" class="input" placeholder="Марка" value="${car.brand}">
            <input id="cModel" class="input" placeholder="Модел" value="${car.model}">
            <input id="cTrim" class="input" placeholder="Версия" value="${car.trim||''}">
          </div>
          <div class="grid-3">
            <select id="cType" class="select">
              ${['Лека кола','Джип','Товарен бус'].map(t => `<option ${car.type===t?'selected':''}>${t}</option>`).join('')}
            </select>
            <input id="cPrice" type="number" class="input" placeholder="Цена/ч" value="${car.pricePerHour}">
            <select id="cStatus" class="select">
              ${['наличен','в сервиз','резервиран'].map(s => `<option ${car.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="row" style="justify-content:space-between;">
            <a class="btn-secondary" href="#/admin/cars">Отказ</a>
            <button class="btn-primary" id="saveCar">Запази</button>
          </div>
        </div>
      `;
      $('#saveCar').onclick = () => {
        Object.assign(car, {
          brand: $('#cBrand').value, model: $('#cModel').value, trim: $('#cTrim').value,
          type: $('#cType').value, pricePerHour: Number($('#cPrice').value || 0),
          status: $('#cStatus').value
        });
        if (isNew) cars.push(car);
        storage.set('cr_cars', cars); navigate('#/admin/cars');
      };
    }
    $('#addCar').onclick = () => editCar(uid());
    draw();
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
    const rs = storage.get('cr_reservations', []);
    root.innerHTML = adminNav('reservations') + `
      <div style="padding:16px;">
        <table class="table">
          <thead><tr><th>№</th><th>Кола</th><th>Клиент</th><th>От</th><th>До</th><th>Статус</th><th></th></tr></thead>
          <tbody>${rs.map(r => `
            <tr>
              <td>${r.id}</td><td>${r.carId}</td><td>${r.driver?.name||''}</td>
              <td>${(r.from||'').replace('T',' ')}</td><td>${(r.to||'').replace('T',' ')}</td>
              <td><select class="select" data-status="${r.id}" style="height:32px;">
                  ${['pending','approved','declined','paid','invoiced'].map(s => `<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
              </select></td>
              <td class="row" style="gap:6px;">
                <button class="btn-secondary" data-invoice="${r.id}" style="height:32px;">Фактура</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
    $$('[data-status]').forEach(s => s.onchange = () => {
      const rsx = storage.get('cr_reservations', []);
      const r = rsx.find(x => x.id === s.getAttribute('data-status')); r.status = s.value; storage.set('cr_reservations', rsx);
    });
    $$('[data-invoice]').forEach(b => b.onclick = () => {
      const id = b.getAttribute('data-invoice');
      navigate(`#/admin/invoices?id=${id}`);
    });
  }
  function renderAdminInvoices() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('invoices') + `
      <div class="header"><h2>Инфо за компанията (за фактуриране)</h2></div>
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
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button type="submit" class="btn-primary" id="saveCompany">Запази</button>
          </div>
          <div id="companyMsg" style="color:#0F8E64; display:none;">Записано успешно.</div>
        </form>
      </div>
    `;
    async function load() {
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
    }
    load();
    $('#companyForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const payload = Object.fromEntries(new FormData(f).entries());
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
  }

  function renderAdminSettings() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('settings') + `
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
    async function load() {
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
    load();
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


