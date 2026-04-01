/* Car Rental Demo SPA (BG) powered by design.json */
(async function () {
  const app = document.getElementById('app');
  const design = await fetch('./design.json').then(r => r.json()).catch(() => null);
  // Same origin — Express serves both frontend and API on the same port
  const API_BASE = '';

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

  /* ===== Custom Date-Time Picker (cross-browser) ===== */
  const BG_MONTHS = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'];
  const BG_DAYS  = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];

  function dtpFormatDisplay(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // One global picker panel (fixed position, no overflow clipping)
  const dtpPanel = document.createElement('div');
  dtpPanel.className = 'dtp-dropdown';
  dtpPanel.style.display = 'none';

  let _dtpInput = null;  // currently active input
  let _dtpS = {};        // picker state

  function dtpOpen(input) {
    if (_dtpInput === input && dtpPanel.style.display !== 'none') { dtpClose(); return; }
    _dtpInput = input;
    const step = parseInt(input.getAttribute('step')) || 1800;
    _dtpS.mStep = Math.max(1, Math.floor(step / 60));

    // Read current value (always ISO from the input)
    const val = input._dtpIso || input.value || '';
    const d = val ? new Date(val) : new Date();
    const dt = isNaN(d) ? new Date() : d;
    _dtpS.vM = dt.getMonth(); _dtpS.vY = dt.getFullYear();
    _dtpS.day = dt.getDate(); _dtpS.hr = dt.getHours();
    _dtpS.mn = Math.round(dt.getMinutes() / _dtpS.mStep) * _dtpS.mStep;
    if (_dtpS.mn >= 60) _dtpS.mn = 0;

    dtpRender();

    // Position fixed relative to viewport
    if (!dtpPanel.parentNode) document.body.appendChild(dtpPanel);
    const rect = input.getBoundingClientRect();
    dtpPanel.style.top = (rect.bottom + 6) + 'px';
    dtpPanel.style.left = rect.left + 'px';
    dtpPanel.style.display = '';

    // Adjust if off-screen
    requestAnimationFrame(() => {
      const pr = dtpPanel.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8) dtpPanel.style.left = Math.max(8, window.innerWidth - pr.width - 8) + 'px';
      if (pr.bottom > window.innerHeight - 8) dtpPanel.style.top = Math.max(8, rect.top - pr.height - 6) + 'px';
    });
  }

  function dtpClose() { dtpPanel.style.display = 'none'; _dtpInput = null; }

  function dtpApply() {
    if (!_dtpInput) return;
    const { vY, vM, day, hr, mn } = _dtpS;
    const iso = `${vY}-${String(vM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
    _dtpInput._dtpIso = iso;
    const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nSet.call(_dtpInput, dtpFormatDisplay(iso));
    _dtpInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function dtpRender() {
    const s = _dtpS;
    const today = new Date();
    const first = new Date(s.vY, s.vM, 1);
    const startDay = (first.getDay() + 6) % 7;
    const dim = new Date(s.vY, s.vM + 1, 0).getDate();

    let h = `<div class="dtp-header">
      <button type="button" class="dtp-nav" data-dir="-1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
      <span class="dtp-month-year">${BG_MONTHS[s.vM]} ${s.vY}</span>
      <button type="button" class="dtp-nav" data-dir="1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>
    <div class="dtp-weekdays">${BG_DAYS.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="dtp-days">`;
    for (let i = 0; i < startDay; i++) h += `<span class="dtp-day dtp-empty"></span>`;
    for (let d = 1; d <= dim; d++) {
      const isToday = d === today.getDate() && s.vM === today.getMonth() && s.vY === today.getFullYear();
      const isSel = d === s.day && s.vM === new Date(s.vY, s.vM, s.day).getMonth();
      let cls = 'dtp-day';
      if (isToday) cls += ' dtp-today';
      if (isSel)   cls += ' dtp-sel';
      h += `<span class="${cls}" data-d="${d}">${d}</span>`;
    }
    h += `</div>
    <div class="dtp-time-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      <select class="dtp-sel-h">${Array.from({length:24},(_,i)=>`<option value="${i}"${i===s.hr?' selected':''}>${String(i).padStart(2,'0')}</option>`).join('')}</select>
      <span class="dtp-colon">:</span>
      <select class="dtp-sel-m">${Array.from({length:Math.ceil(60/s.mStep)},(_,i)=>{const m=i*s.mStep;return `<option value="${m}"${m===s.mn?' selected':''}>${String(m).padStart(2,'0')}</option>`;}).join('')}</select>
    </div>
    <button type="button" class="dtp-done">Готово</button>`;
    dtpPanel.innerHTML = h;

    // Bind events inside the panel
    dtpPanel.querySelectorAll('.dtp-nav').forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      s.vM += parseInt(b.dataset.dir);
      if (s.vM < 0)  { s.vM = 11; s.vY--; }
      if (s.vM > 11) { s.vM = 0;  s.vY++; }
      dtpRender();
    });
    dtpPanel.querySelectorAll('.dtp-day[data-d]').forEach(c => c.onclick = e => {
      e.stopPropagation();
      s.day = parseInt(c.dataset.d);
      dtpApply(); dtpRender();
    });
    dtpPanel.querySelector('.dtp-sel-h').onchange = function() { s.hr = parseInt(this.value); dtpApply(); };
    dtpPanel.querySelector('.dtp-sel-m').onchange = function() { s.mn = parseInt(this.value); dtpApply(); };
    dtpPanel.querySelector('.dtp-done').onclick = e => { e.stopPropagation(); dtpClose(); };
  }

  // Convert a datetime-local input to custom picker input (lazy, on first interaction)
  function dtpConvert(input) {
    if (input._dtpInit) return;
    input._dtpInit = true;
    const origVal = input.value || '';
    input._dtpIso = origVal;

    // Change to text so native picker never shows
    input.type = 'text';
    input.readOnly = true;
    input.style.cursor = 'pointer';
    input.classList.add('dtp-input');
    // Remove any native showPicker handlers that would throw on text inputs
    input.onfocus = null;
    input.onclick = null;

    // Show formatted display
    const nSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nSet.call(input, dtpFormatDisplay(origVal));

    // Intercept .value so existing code gets/sets ISO strings
    Object.defineProperty(input, 'value', {
      get() { return input._dtpIso || ''; },
      set(v) {
        input._dtpIso = v || '';
        nSet.call(input, dtpFormatDisplay(v));
      },
      configurable: true
    });
  }

  // Pro-actively convert all datetime-local inputs to text ASAP (prevents native picker)
  function dtpScanAll() {
    document.querySelectorAll('input[type="datetime-local"]').forEach(dtpConvert);
  }
  // Scan on DOM changes + periodic fallback
  new MutationObserver(dtpScanAll).observe(document.body || document.documentElement, { childList: true, subtree: true });
  setInterval(dtpScanAll, 400);

  // Event delegation: open picker when user clicks a converted input
  function dtpHandlePointer(e) {
    const input = e.target.closest('input.dtp-input') || e.target.closest('input[type="datetime-local"]');
    if (input) {
      e.preventDefault();
      dtpConvert(input);
      dtpOpen(input);
      return;
    }
    if (!e.target.closest('.dtp-dropdown')) dtpClose();
  }
  document.addEventListener('mousedown', dtpHandlePointer);
  document.addEventListener('touchstart', dtpHandlePointer, { passive: false });
  // Close on Escape / scroll / resize / navigation
  document.addEventListener('keydown', e => { if (e.key === 'Escape') dtpClose(); });
  window.addEventListener('scroll', e => { if (!dtpPanel.contains(e.target)) dtpClose(); }, true);
  window.addEventListener('resize', dtpClose);
  window.addEventListener('hashchange', dtpClose);
  // Keep panel interactions from closing
  dtpPanel.addEventListener('mousedown', e => e.stopPropagation());
  dtpPanel.addEventListener('touchstart', e => e.stopPropagation(), { passive: false });

  /* ===== Admin Auth ===== */
  // Credentials are hashed (SHA-256 hex) so they're not in plain text in source.
  // Default: user=evgi, pass=evgi
  const _AH = { u: '518a0a45f6802f5d8553634af3455c014c8cd981299c942963f7c7804272d979', p: '518a0a45f6802f5d8553634af3455c014c8cd981299c942963f7c7804272d979' };
  const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes

  async function _sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function isAdminLoggedIn() {
    try {
      const raw = localStorage.getItem('_adminSession');
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (!session?.token || !session?.exp) return false;
      if (Date.now() > session.exp) {
        localStorage.removeItem('_adminSession');
        return false;
      }
      return true;
    } catch { return false; }
  }

  function _getLoginAttempts() {
    try {
      const raw = localStorage.getItem('_loginAttempts');
      if (!raw) return { count: 0, lockedUntil: 0 };
      return JSON.parse(raw);
    } catch { return { count: 0, lockedUntil: 0 }; }
  }

  function _isLoginLocked() {
    const a = _getLoginAttempts();
    if (a.lockedUntil && Date.now() < a.lockedUntil) return true;
    return false;
  }

  function _getLockRemainingSeconds() {
    const a = _getLoginAttempts();
    if (!a.lockedUntil || Date.now() >= a.lockedUntil) return 0;
    return Math.ceil((a.lockedUntil - Date.now()) / 1000);
  }

  function _recordFailedLogin() {
    const a = _getLoginAttempts();
    a.count = (a.count || 0) + 1;
    if (a.count >= MAX_LOGIN_ATTEMPTS) {
      a.lockedUntil = Date.now() + LOCKOUT_TIME;
      a.count = 0; // reset count, the lock takes over
    }
    localStorage.setItem('_loginAttempts', JSON.stringify(a));
  }

  function _resetLoginAttempts() {
    localStorage.removeItem('_loginAttempts');
  }

  async function loginAdmin(user, pass) {
    if (_isLoginLocked()) return { ok: false, locked: true, seconds: _getLockRemainingSeconds() };
    // [V1] Authenticate via backend JWT — the server validates credentials
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: user, password: pass })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.token) {
          // Store JWT for API auth
          localStorage.setItem('_adminJWT', data.token);
          // Also store session for UI guard
          const uiToken = crypto.getRandomValues(new Uint8Array(32));
          const tokenHex = [...uiToken].map(b => b.toString(16).padStart(2, '0')).join('');
          localStorage.setItem('_adminSession', JSON.stringify({
            token: tokenHex,
            exp: Date.now() + SESSION_TTL
          }));
          _resetLoginAttempts();
          return { ok: true };
        }
      }
    } catch (e) {
      // Backend unreachable — fall back to offline SHA-256 check
      console.warn('[auth] Backend login failed, using offline fallback:', e.message);
      const userHash = await _sha256(user);
      const passHash = await _sha256(pass);
      if (userHash === _AH.u && passHash === _AH.p) {
        const token = crypto.getRandomValues(new Uint8Array(32));
        const tokenHex = [...token].map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('_adminSession', JSON.stringify({
          token: tokenHex,
          exp: Date.now() + SESSION_TTL
        }));
        _resetLoginAttempts();
        return { ok: true };
      }
    }
    _recordFailedLogin();
    if (_isLoginLocked()) return { ok: false, locked: true, seconds: _getLockRemainingSeconds() };
    return { ok: false, locked: false, remaining: MAX_LOGIN_ATTEMPTS - _getLoginAttempts().count };
  }

  function logoutAdmin() {
    localStorage.removeItem('_adminSession');
    localStorage.removeItem('_adminJWT');
    location.hash = '#/';
  }

  /** Escape HTML to prevent XSS in dynamic content */
  const escHtml = (str) => {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /** Global handler for broken car images — show SVG silhouette fallback */
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el.tagName === 'IMG' && (el.classList.contains('cc-photo') || el.classList.contains('cdm-main-img') || el.classList.contains('cdm-thumb'))) {
      el.onerror = null; // prevent infinite loop
      el.src = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="#F3F4F6"/><text x="200" y="110" text-anchor="middle" fill="#9CA3AF" font-size="14" font-family="sans-serif">Снимката не е налична</text></svg>')}`;
      el.alt = 'Снимката не е налична';
    }
  }, true);

  const RES_STATUS = [
    { value: 'REQUESTED', label: 'Заявка' },
    { value: 'APPROVED', label: 'Одобрена' },
    { value: 'DECLINED', label: 'Отказана' },
    { value: 'CANCELLED', label: 'Анулирана' },
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
  /** [V1] Get auth headers for direct fetch() calls to protected API endpoints */
  function authHeaders(extra = {}) {
    const h = { ...extra };
    const jwt = localStorage.getItem('_adminJWT');
    if (jwt) h['authorization'] = 'Bearer ' + jwt;
    return h;
  }

  async function apiFetch(path, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    headers['accept'] = headers['accept'] || 'application/json';
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    // [V1] Attach JWT token for authenticated API calls
    const jwt = localStorage.getItem('_adminJWT');
    if (jwt && !headers['authorization']) headers['authorization'] = 'Bearer ' + jwt;
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
  // Normalize DB enum values for human display (DIESEL → Diesel, AUTOMATIC → Automatic)
  function displayVal(v) {
    if (!v || typeof v !== 'string') return '';
    const n = v.trim().toLowerCase();
    // Transmission
    if (n === 'manual' || n === 'ръчна') return 'Ръчна';
    if (n === 'automatic' || n.includes('автомат')) return 'Автоматик';
    // Fuel
    if (n === 'diesel' || n === 'дизел') return 'Дизел';
    if (n === 'petrol' || n === 'бензин') return 'Бензин';
    if (n === 'electric' || n === 'ток') return 'Ток';
    if (n === 'hybrid' || n === 'хибрид') return 'Хибрид';
    // Already readable or unknown — return as-is
    return v;
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
      listEl.innerHTML = items.map((o, i) => `<div class="typeahead-item" data-i="${i}">${escHtml(o)}</div>`).join('');
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
    wrap.setAttribute('role', 'presentation');
    wrap.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="Диалогов прозорец">${html}</div>`;
    document.body.appendChild(wrap);
    // Trap focus: remember previously focused element
    const prevFocus = document.activeElement;
    const close = () => {
      wrap.remove();
      document.removeEventListener('keydown', escHandler);
      if (prevFocus) prevFocus.focus();
    };
    // Close on Escape key
    const escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);
    if (onMount) onMount(wrap, close);
    // Close on backdrop click
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    // Focus the modal card for keyboard users
    const card = wrap.querySelector('.modal-card');
    if (card) { card.setAttribute('tabindex', '-1'); card.focus(); }
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
      const res = await fetch(`${API_BASE}/api/cars/${id}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const c = await res.json();
      const car = {
        id: c.id,
        brand: c.brand,
        model: c.model,
        trim: c.trim,
        pricePerDay: c.pricePerDay ?? 0,
        transmission: displayVal(c.transmission),
        fuel: displayVal(c.fuel),
        seats: c.seats || null,
        bodyStyle: c.bodyStyle || '',
        year: c.year || null,
        type: c.type || '',
        images: Array.isArray(c.images) ? c.images : [],
        status: c.status === 'SERVICE' ? 'в сервиз' : c.status === 'RESERVED' ? 'резервиран' : 'наличен'
      };
      // Enrich with dynamic params if missing
      try {
        const params = await fetch(`${API_BASE}/api/cars/${id}/params`, { headers: { accept: 'application/json' }, cache: 'no-store' }).then(r => r.ok ? r.json() : []);
        if (!car.seats) {
          const seatsP = params.find(p => /места|седалки|seat/i.test(p.name));
          if (seatsP && seatsP.value) car.seats = Number(seatsP.value) || seatsP.value;
        }
        if (!car.transmission || car.transmission === '') {
          const txP = params.find(p => /скоростна|кутия|transmission|gear/i.test(p.name));
          if (txP && txP.value) car.transmission = displayVal(txP.value);
        }
        if (!car.fuel || car.fuel === '') {
          const fuelP = params.find(p => /гориво|fuel|бензин|дизел/i.test(p.name));
          if (fuelP && fuelP.value) car.fuel = displayVal(fuelP.value);
        }
      } catch {}
      return car;
    } catch (e) { console.error(e); return null; }
  }
  function normalizeInvoiceItems(items) {
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items)) return [];
    /* Strip legacy parenthetical date/qty suffixes from stored descriptions */
    const cleanDesc = (d) => {
      if (!d) return d;
      // "(12.02.2026 г. → 19.02.2026 г.)" or "(12-02-2026 → 19-02-2026)"
      d = d.replace(/\s*\(\d{2}[\.\-]\d{2}[\.\-]\d{4}\s*г?\.?\s*→\s*\d{2}[\.\-]\d{2}[\.\-]\d{4}\s*г?\.?\s*\)$/, '');
      // "(7 дни × €10.00/ден)" or "(7 дни)"
      d = d.replace(/\s*\(\d+\s*дни?\s*(?:[×x]\s*€?\d+[\.,]?\d*\/ден)?\)$/, '');
      return d.trim();
    };
    return items.map(it => {
      const qty = Number(it.qty ?? 1);
      const unitPrice = Number(it.unitPrice ?? 0); // цена С ДДС
      const vatRate = Number(it.vatRate ?? 20);
      const totalGross = qty * unitPrice; // обща сума С ДДС
      const totalNet = totalGross / (1 + vatRate / 100); // обща сума БЕЗ ДДС
      const totalVat = totalGross - totalNet; // сума на ДДС
      return {
        description: cleanDesc(it.description) || 'Услуга',
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
  /**
   * Builds a full standalone HTML document for a proforma/invoice,
   * identical to the admin printInvoice design. Used both in wizard step 6
   * and in the admin invoice viewer.
   */
  function buildProformaStandaloneHTML({ reservation, invoice, company }) {
    const days = (() => {
      const a = new Date(reservation.from), b = new Date(reservation.to);
      return Math.max(1, Math.ceil((b - a) / 86400000));
    })();
    const resTotal = Number(reservation.total || invoice?.total || 0);
    const baseUnit = resTotal && days ? (resTotal / days) : (reservation.car?.pricePerDay || 0);
    let items = normalizeInvoiceItems(invoice?.items || []);
    const needsDefault = !items.length || calcInvoiceTotals(items).total === 0;
    if (needsDefault) {
      items = normalizeInvoiceItems([{
        description: `Наем на автомобил ${reservation.car?.brand||''} ${reservation.car?.model||''}`.trim(),
        qty: days, unitPrice: baseUnit, vatRate: 20
      }]);
    }
    const totals = calcInvoiceTotals(items);
    const sup = {
      name: invoice?.supplierName || company?.name || '',
      eik: invoice?.supplierEik || company?.eik || '',
      vat: invoice?.supplierVat || company?.vat || '',
      mol: invoice?.supplierMol || company?.mol || '',
      addr: invoice?.supplierAddr || company?.address || '',
      email: invoice?.supplierEmail || company?.email || '',
      phone: invoice?.supplierPhone || company?.phone || '',
      bank: invoice?.supplierBank || company?.bank || '',
      iban: invoice?.supplierIban || company?.iban || '',
      bic: invoice?.supplierBic || company?.bic || ''
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
    };
    const fmtMoney = (v) => `\u20AC${Number(v || 0).toFixed(2)}`;
    const fmtDateShort = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt)) return d;
      return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
    };
    const rows = items.map(it => `
      <tr>
        <td>
          <div class="desc">${escHtml(it.description)}</div>
          <div class="meta">${reservation.from ? fmtDate(reservation.from) : ''}${reservation.to ? ' \u2192 ' + fmtDate(reservation.to) : ''}</div>
        </td>
        <td class="center">${escHtml(it.qty)}</td>
        <td class="num">${fmtMoney(it.unitPrice)}</td>
        <td class="center">${escHtml(it.vatRate)}%</td>
        <td class="num">${fmtMoney(it.totalNet)}</td>
        <td class="num">${fmtMoney(it.totalVat)}</td>
        <td class="num">${fmtMoney(it.totalGross)}</td>
      </tr>
    `).join('');
    // Policies
    const POLICY_SECTIONS = getPolicySections();
    const polTerms = POLICY_SECTIONS.find(s => s.slug === 'terms');
    const polCancel = POLICY_SECTIONS.find(s => s.slug === 'cancellation');
    const polInsurance = POLICY_SECTIONS.find(s => s.slug === 'insurance');
    const replPol = (t) => (t || '')
      .replace(/\{\{company_name\}\}/g, escHtml(sup.name))
      .replace(/\{\{company_eik\}\}/g, escHtml(sup.eik))
      .replace(/\{\{company_address\}\}/g, escHtml(sup.addr))
      .replace(/\{\{company_email\}\}/g, escHtml(sup.email))
      .replace(/\{\{company_phone\}\}/g, escHtml(sup.phone))
      .replace(/\{\{company_phone_clean\}\}/g, (sup.phone||'').replace(/\s/g,''))
      .replace(/\{\{extra_driver_price\}\}/g, Number(company?.extraDriverPrice ?? 10).toFixed(2))
      .replace(/\{\{insurance_price\}\}/g, Number(company?.insurancePrice ?? 15).toFixed(2));

    const invoiceBody = `
        <div class="invoice-grid-header">
          <div class="invoice-brand">
            <div class="invoice-logo" aria-label="logo">${logoSVG}</div>
            <div>
              <div style="font-weight:700; font-size:16px;">${escHtml(sup.name || 'Company')}</div>
            </div>
          </div>
          <div class="invoice-title">${payload.type==='INVOICE'?'ФАКТУРА':'ПРОФОРМА'}</div>
          <div class="invoice-meta">
            <div><span class="label">Номер</span><br><span class="value">${payload.number || '(генерира се)'}</span></div>
            <div style="margin-top:6px;"><span class="label">Дата</span><br><span class="value">${fmtDateShort(payload.issueDate)}</span></div>
            ${payload.dueDate ? `<div style="margin-top:6px;"><span class="label">Валиден до</span><br><span class="value">${fmtDateShort(payload.dueDate)}</span></div>` : ''}
            <div style="margin-top:6px;"><span class="label">Валута</span><br><span class="value">${payload.currency}</span></div>
          </div>
        </div>

        <div class="invoice-parties">
          <div class="party-card">
            <h4>Доставчик</h4>
            <div class="name">${escHtml(sup.name)}</div>
            <div class="party-row">ЕИК: ${escHtml(sup.eik || '—')} ${sup.vat ? ' | ДДС №: '+escHtml(sup.vat) : ''}</div>
            <div class="party-row">МОЛ: ${escHtml(sup.mol || '—')}</div>
            <div class="party-row">${escHtml(sup.addr || '—')}</div>
            <div class="party-row">${escHtml(sup.email || '—')} | ${escHtml(sup.phone || '—')}</div>
            <div class="party-row">Банка: ${escHtml(sup.bank || '—')}</div>
            <div class="party-row">IBAN: ${escHtml(sup.iban || '—')} | BIC: ${escHtml(sup.bic || '—')}</div>
          </div>
          <div class="party-card">
            <h4>Получател</h4>
            <div class="name">${escHtml(payload.buyerName || '')}</div>
            <div class="party-row">${payload.buyerType==='company'
              ? `ЕИК: ${escHtml(payload.buyerEik || '—')} ${payload.buyerVat ? ' | ДДС №: '+escHtml(payload.buyerVat) : ''}`
              : `ЕГН: ${escHtml(payload.buyerEgn || '—')}`}</div>
            ${payload.buyerMol ? `<div class="party-row">МОЛ: ${escHtml(payload.buyerMol)}</div>` : ''}
            <div class="party-row">${escHtml(payload.buyerAddr || '—')}</div>
            <div class="party-row">${escHtml(payload.buyerEmail || '—')}</div>
            ${(payload.buyerBank || payload.buyerIban || payload.buyerBic) ? `
              <div class="party-row">Банка: ${escHtml(payload.buyerBank || '—')}</div>
              <div class="party-row">IBAN: ${escHtml(payload.buyerIban || '—')} | BIC: ${escHtml(payload.buyerBic || '—')}</div>
            ` : ''}
          </div>
        </div>

        <div>
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width:40%;">Описание</th>
                <th class="center" style="width:8%;">Кол-во</th>
                <th class="num" style="width:12%;">Ед. цена (с ДДС)</th>
                <th class="center" style="width:8%;">ДДС %</th>
                <th class="num" style="width:12%;">Сума без ДДС</th>
                <th class="num" style="width:10%;">ДДС</th>
                <th class="num" style="width:10%;">Общо с ДДС</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="invoice-totals">
          <div class="row"><span>Данъчна основа (без ДДС)</span><span class="num">${fmtMoney(totals.subtotal)}</span></div>
          <div class="row" style="padding-bottom:8px; border-bottom:1px solid #D1D5DB;"><span>ДДС (20%)</span><span class="num">${fmtMoney(totals.vatAmount)}</span></div>
          <div class="invoice-total-final"><span>Общо (с ДДС)</span><span class="amount">${fmtMoney(totals.total)}</span></div>
        </div>

        <div class="invoice-footer">
          <span>Генерирана от системата на ${fmtDate(new Date().toISOString())}</span>
          <span>${payload.paymentMethod ? 'Начин на плащане: '+payload.paymentMethod : ''} ${payload.paymentTerms ? 'Условия: '+payload.paymentTerms : ''}</span>
        </div>
    `;
    const policyPages = `
      <div class="inv-policy-page">
        <h3 class="inv-policy-title">${escHtml(polTerms?.title || 'Условия за ползване')}</h3>
        <div class="inv-policy-body">${replPol(polTerms?.defaultContent || '')}</div>
      </div>
      <div class="inv-policy-page">
        <h3 class="inv-policy-title">${escHtml(polCancel?.title || 'Политика за анулиране')}</h3>
        <div class="inv-policy-body">${replPol(polCancel?.defaultContent || '')}</div>
      </div>
      <div class="inv-policy-page">
        <h3 class="inv-policy-title">${escHtml(polInsurance?.title || 'Застраховки')}</h3>
        <div class="inv-policy-body">${replPol(polInsurance?.defaultContent || '')}</div>
      </div>
    `;
    const docTitle = (payload.type==='INVOICE'?'Фактура':'Проформа') + ' ' + (payload.number || '');
    const selfCSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{margin:0;padding:0;background:#fff;font-family:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111827;font-size:13px;line-height:1.5;font-variant-numeric:tabular-nums;}
.invoice-shell{background:#fff;padding:28px 32px;display:grid;gap:24px;max-width:210mm;margin:0 auto;}
.invoice-grid-header{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;}
.invoice-brand{display:flex;align-items:center;gap:12px;}
.invoice-logo{width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.invoice-logo svg{width:48px;height:48px;}
.invoice-title{text-align:center;font-size:26px;font-weight:800;color:#1E3A8A;letter-spacing:.3px;}
.invoice-meta{background:#F3F4F6;border:2px solid #2563EB;border-radius:10px;padding:12px 14px;min-width:200px;}
.invoice-meta .label{font-size:11px;color:#6B7280;font-weight:600;}
.invoice-meta .value{font-size:14px;font-weight:700;color:#111827;}
.invoice-parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.party-card{border:1px solid #E5E7EB;border-radius:10px;padding:16px;background:#FAFAFA;}
.party-card h4{margin:0 0 10px 0;font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#6B7280;border-bottom:2px solid #2563EB;padding-bottom:6px;}
.party-card .name{font-size:16px;font-weight:700;color:#111827;margin-bottom:8px;}
.party-row{margin:4px 0;color:#111827;font-size:13px;line-height:1.5;}
.invoice-table{width:100%;border-collapse:collapse;font-size:12px;}
.invoice-table thead th{background:#1E3A8A;color:#fff;padding:12px 14px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.invoice-table thead th.num{text-align:right;}
.invoice-table tbody td{padding:12px 14px;border-bottom:1px solid #E5E7EB;vertical-align:top;}
.invoice-table tbody tr:nth-child(even){background:#F9FAFB;}
.invoice-table .desc{font-weight:700;font-size:13px;}
.invoice-table .meta{color:#6B7280;font-size:11px;margin-top:4px;}
.num{text-align:right;}
.center{text-align:center;}
.invoice-totals{margin-left:auto;width:480px;max-width:100%;border:2px solid #E5E7EB;border-radius:10px;padding:16px;background:linear-gradient(180deg,#FAFAFA 0%,#FFFFFF 100%);display:grid;gap:8px;}
.invoice-totals .row{display:grid;grid-template-columns:1fr auto;gap:12px;font-size:13px;color:#374151;}
.invoice-totals .row strong{font-size:14px;}
.invoice-total-final{background:#1E3A8A;color:#fff;padding:14px 16px;border-radius:8px;display:grid;grid-template-columns:1fr auto;align-items:center;font-weight:800;font-size:18px;box-shadow:0 4px 12px rgba(30,64,175,.3);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.invoice-total-final .amount{font-size:22px;}
.invoice-footer{border-top:2px solid #E5E7EB;padding-top:12px;font-size:10px;color:#6B7280;display:flex;justify-content:space-between;gap:8px;}
.inv-policy-page{border-top:2px solid #E5E7EB;padding-top:20px;margin-top:24px;page-break-before:always;}
.inv-policy-title{color:#1E3A8A;font-size:18px;font-weight:700;border-bottom:2px solid #2563EB;padding-bottom:6px;margin:0 0 12px 0;}
.inv-policy-body{font-size:12px;line-height:1.6;color:#374151;}
.inv-policy-body h3{font-size:13px;font-weight:700;color:#1E3A8A;margin:14px 0 6px;}
.inv-policy-body ul{padding-left:18px;margin:6px 0;}
.inv-policy-body li{margin:3px 0;}
.inv-policy-body p{margin:6px 0;}
.inv-policy-body table{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;}
.inv-policy-body table th,.inv-policy-body table td{border:1px solid #D1D5DB;padding:6px 8px;text-align:left;}
.inv-policy-body table th{background:#F3F4F6;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.logo-car-svg rect{fill:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
@page{size:A4;margin:14mm 16mm;}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .invoice-shell{padding:0;max-width:none;}
  .invoice-grid-header,.invoice-parties,.party-card,.invoice-totals,.invoice-total-final{break-inside:avoid;}
  .inv-policy-page{page-break-before:always;margin-top:0;border-top:none;padding-top:0;}
}`;
    const fullHTML = '<!DOCTYPE html><html lang="bg"><head><meta charset="utf-8"><title>'
      + escHtml(docTitle) + '</title><style>' + selfCSS + '</style></head><body><div class="invoice-shell">'
      + invoiceBody + policyPages + '</div></body></html>';
    return fullHTML;
  }

  async function fetchCarsFromApi() {
    try {
      const res = await fetch(`${API_BASE}/api/cars`, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      // Map API enums to UI fields
      let list = data.map(c => ({
        id: c.id,
        brand: c.brand, model: c.model, trim: c.trim,
        pricePerDay: c.pricePerDay ?? 0,
        transmission: displayVal(c.transmission),
        fuel: displayVal(c.fuel),
        seats: c.seats || null,
        bodyStyle: c.bodyStyle || '',
        rating: typeof c.rating === 'number' ? c.rating : 4.6,
        distanceKm: typeof c.distanceKm === 'number' ? c.distanceKm : 0.8,
        etaMin: typeof c.etaMin === 'number' ? c.etaMin : 3,
        year: c.year || null,
        type: c.type || '',
        images: Array.isArray(c.images) ? c.images : [],
        status: c.status === 'SERVICE' ? 'в сервиз' : c.status === 'RESERVED' ? 'резервиран' : 'наличен',
        favorite: false
      }));
      // Enrich with dynamic params (seats, etc.) if missing from car fields
      await Promise.all(list.map(async (car) => {
        try {
          const params = await fetch(`${API_BASE}/api/cars/${car.id}/params`, { headers: { accept: 'application/json' }, cache: 'no-store' }).then(r => r.ok ? r.json() : []);
          if (!car.seats) {
            const seatsP = params.find(p => /места|седалки|seat/i.test(p.name));
            if (seatsP && seatsP.value) car.seats = Number(seatsP.value) || seatsP.value;
          }
          if (!car.transmission || car.transmission === '') {
            const txP = params.find(p => /скоростна|кутия|transmission|gear/i.test(p.name));
            if (txP && txP.value) car.transmission = displayVal(txP.value);
          }
          if (!car.fuel || car.fuel === '') {
            const fuelP = params.find(p => /гориво|fuel|бензин|дизел/i.test(p.name));
            if (fuelP && fuelP.value) car.fuel = displayVal(fuelP.value);
          }
        } catch {}
      }));
      return list;
    } catch {
      return null;
    }
  }
  let cars = await fetchCarsFromApi() || storage.get('cr_cars', cloneCars());
  storage.set('cr_cars', cars);
  /** Refresh cars from API — always returns fresh data after admin edits */
  async function refreshCars() {
    const fresh = await fetchCarsFromApi();
    if (fresh) { cars = fresh; storage.set('cr_cars', cars); }
  }
  let filtered = [...cars];
  let selected = filtered[0];
  let reservations = [];
  let showMoreFilters = false;
  const params = storage.get('cr_params', {});
  storage.set('cr_params', params);
  storage.set('cr_company', storage.get('cr_company', {
    name: 'CarRent BG OOD',
    vat: 'BG123456789',
    address: 'ул. Пример 1, София',
    iban: 'BG00UNCR00000000000000'
  }));
  // Global company info for header/footer
  let companyInfo = null;
  async function loadCompanyInfo() {
    try { companyInfo = await apiFetch('/api/company'); } catch { companyInfo = null; }
  }
  await loadCompanyInfo();
  // Допълнителни филтри по параметри (id -> value), попълват се от „Още филтри"
  let extraFilters = {};
  // Load parameter definitions from API for dynamic filters
  let paramDefs = [];
  // Flexible lookup: finds the "car type" ENUM param regardless of name ("Вид кола", "Тип кола", etc.)
  function findCarTypeDef() {
    return (paramDefs || []).find(p => p.type === 'ENUM' && isCarTypeParam(p.name));
  }
  function findGearDef() {
    return (paramDefs || []).find(p => p.type === 'ENUM' && isGearParam(p.name));
  }
  function isCarTypeParam(name) {
    return /(?:вид|тип)\b.*(?:кола|авто|мпс|возило)|(?:кола|авто).*(?:вид|тип)|категория\s*(?:кола|авто)|клас\s*(?:кола|авто)/i.test(name);
  }
  function isGearParam(name) {
    return /скоростна\s*кутия|предавк|трансмиси|скорости/i.test(name);
  }
  function isFuelParam(name) {
    return /гориво|fuel|бензин|дизел|захранване/i.test(name);
  }
  function findFuelDef() {
    return (paramDefs || []).find(p => p.type === 'ENUM' && isFuelParam(p.name));
  }
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
  // Only load reservations if admin is logged in (avoids 401 console error)
  if (localStorage.getItem('_adminJWT')) await loadReservations();

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
  /* ===== Reusable layout components ===== */
  const logoSVG = `<svg class="logo-car-svg" viewBox="0 0 40 40" width="40" height="40"><rect width="40" height="40" rx="10" fill="#111827"/><g transform="translate(6,10)" fill="none" stroke="#fff" stroke-width="1.8"><path d="M2 14h24M4 14c0-2 1-4 3-5l3-4h8l3 4c2 1 3 3 3 5"/><circle cx="8" cy="16" r="2.5"/><circle cx="20" cy="16" r="2.5"/></g></svg>`;
  const phoneSVGInline = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.36a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.76.32 1.55.55 2.36.68A2 2 0 0 1 22 16.92z"/></svg>`;

  function siteHeaderHTML(activePage) {
    const navLinks = [
      { href:'#/', label:'Начало', id:'home' },
      { href:'#/vehicles', label:'АвтоПарк', id:'vehicles' },
      { href:'#/about-us', label:'За нас', id:'about-us' },
      { href:'#footer', label:'Контакти', id:'contact' },
    ];
    // Only show Админ link if logged in
    if (isAdminLoggedIn()) {
      navLinks.push({ href:'#/admin', label:'Админ', id:'admin' });
    }
    const desktopLinks = navLinks.map(l => {
      const cls = l.id === activePage ? ' class="hdr-link-active"' : '';
      return `<a href="${l.href}"${cls}>${l.label}</a>`;
    }).join('');
    const mobileLinks = navLinks.map(l => {
      const cls = l.id === activePage ? ' class="hdr-link-active"' : '';
      return `<a href="${l.href}"${cls}>${l.label}</a>`;
    }).join('');
    const hdrPhone = companyInfo?.phone || '+359 888 810 469';
    const hdrPhoneClean = hdrPhone.replace(/[\s-]/g, '');
    return `
      <header class="site-header" role="banner">
        <a href="#/" class="logo-brand">${logoSVG} Meniar.com</a>
        <nav id="desktopNav" aria-label="Основна навигация">${desktopLinks}</nav>
        <div class="hdr-spacer"></div>
        <a href="tel:${hdrPhoneClean}" class="hdr-phone" aria-label="Телефон: ${escHtml(hdrPhone)}">${phoneSVGInline} ${hdrPhone}</a>
        <button class="hamburger" id="hamburgerBtn" aria-label="Отвори менюто" aria-expanded="false" aria-controls="mobileNav"></button>
      </header>
      <nav id="mobileNav" class="mobile-nav" style="display:none;" aria-label="Мобилна навигация">${mobileLinks}</nav>
    `;
  }

  function siteFooterHTML() {
    const ftPhone = companyInfo?.phone || '+359 888 810 469';
    const ftEmail = companyInfo?.email || 'info@meniar.com';
    const ftAddr = (() => {
      const parts = [];
      if (companyInfo?.city) parts.push('гр. ' + companyInfo.city);
      if (companyInfo?.address) parts.push(companyInfo.address);
      return parts.length ? parts.join(', ') : 'гр. София';
    })();
    // Unique car types from loaded cars
    const carTypes = [...new Set(cars.map(c => c.type).filter(Boolean))];
    const carTypesHTML = carTypes.length
      ? carTypes.map(t => `<li><a href="#/vehicles?type=${encodeURIComponent(t)}">${t}</a></li>`).join('')
      : '<li><a href="#/vehicles">Всички коли</a></li>';
    return `
      <footer class="site-footer" id="footer" role="contentinfo">
        <div class="foot-inner">
          <div class="foot-contact">
            <div class="foot-contact-item"><div class="foot-contact-icon">${svgCarIcon}</div><div><div class="fc-value" style="font-weight:600;">Meniar.com</div></div></div>
            <div class="foot-contact-item"><div class="foot-contact-icon">${svgPin}</div><div><div class="fc-label">Адрес</div><div class="fc-value">${ftAddr}</div></div></div>
            <div class="foot-contact-item"><div class="foot-contact-icon">${svgMail}</div><div><div class="fc-label">Имейл</div><div class="fc-value">${ftEmail}</div></div></div>
            <div class="foot-contact-item"><div class="foot-contact-icon">${svgPhone}</div><div><div class="fc-label">Телефон</div><div class="fc-value">${ftPhone}</div></div></div>
          </div>
          <div class="foot-links">
            <div><p style="font-size:13px;color:#9CA3AF;line-height:1.6;">Вашият надежден партньор за наем на автомобили. Качество и комфорт на достъпна цена.</p><div class="foot-socials"><a href="https://facebook.com" aria-label="Facebook" rel="noopener noreferrer" target="_blank"><i class="fa-brands fa-facebook-f"></i></a><a href="https://instagram.com" aria-label="Instagram" rel="noopener noreferrer" target="_blank"><i class="fa-brands fa-instagram"></i></a></div></div>
            <div><h4>Бързи връзки</h4><ul><li><a href="#/about-us">За нас</a></li><li><a href="#/vehicles">АвтоПарк</a></li><li><a href="#/about-us" onclick="setTimeout(()=>{const f=document.getElementById('faq');if(f)f.scrollIntoView({behavior:'smooth'})},100)">Въпроси & Отговори</a></li><li><a href="#/policies">Условия и Политики</a></li></ul></div>
            <div><h4>АвтоПарк</h4><ul>${carTypesHTML}</ul></div>
          </div>
          <div class="foot-bottom">© Meniar ${new Date().getFullYear()}. Всички права запазени.</div>
        </div>
      </footer>
    `;
  }

  function bindHamburger() {
    const hBtn = $('#hamburgerBtn');
    const mNav = $('#mobileNav');
    if (!hBtn || !mNav) return;
    hBtn.innerHTML = svgMenu;
    hBtn.onclick = () => {
      const open = mNav.style.display !== 'none';
      mNav.style.display = open ? 'none' : 'block';
      hBtn.innerHTML = open ? svgMenu : svgX;
      hBtn.setAttribute('aria-expanded', String(!open));
      hBtn.setAttribute('aria-label', open ? 'Отвори менюто' : 'Затвори менюто');
    };
    $$('a', mNav).forEach(a => a.addEventListener('click', () => {
      mNav.style.display = 'none';
      hBtn.innerHTML = svgMenu;
      hBtn.setAttribute('aria-expanded', 'false');
      hBtn.setAttribute('aria-label', 'Отвори менюто');
    }));

    // Scroll to top when clicking any footer link
    const footer = $('#footer');
    if (footer) {
      footer.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#/"]');
        if (link) scrollToTop();
      });
    }
  }

  /* SVG icon helpers for landing sections */
  const svgCalCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><path d="M9 14l2 2 4-4"/></svg>`;
  const svgCouch = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4"/><path d="M2 14a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M6 18v2"/><path d="M18 18v2"/></svg>`;
  const svgPiggy = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 10c0 3.87-3.13 7-7 7s-7-3.13-7-7 3.13-7 7-7 7 3.13 7 7z"/><path d="M15.5 8.5l.5-.5"/><path d="M9 14h6"/><circle cx="9" cy="10" r=".5" fill="currentColor"/></svg>`;
  const svgCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>`;
  const svgCarIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M5 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM19 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`;
  const svgUsers = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const svgCalendar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const svgRoad = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19L8 5h8l4 14"/><line x1="12" y1="5" x2="12" y2="19" stroke-dasharray="2 2"/></svg>`;
  const svgPhone = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.36a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.76.32 1.55.55 2.36.68A2 2 0 0 1 22 16.92z"/></svg>`;
  const svgMail = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>`;
  const svgPin = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const svgMenu = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  const svgX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const svgCarSide = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>`;
  const svgLocationDot = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const svgCalIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const svgGearSmall = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  function mountSearchLayout() {
    app.className = 'landing-wrap';
    app.innerHTML = `
      ${siteHeaderHTML('home')}

      <!-- HERO -->
      <section class="hero-section" id="main-content">
        <div class="hero-inner">
          <div class="hero-text">
            <h1>Преживей пътя като никога преди!</h1>
            <p>Открийте перфектния автомобил под наем. <br/>Бързо, лесно и на достъпни цени.</p>
            <a href="#vehicles" class="hero-cta">Виж всички коли ↓</a>
          </div>
          <div class="hero-booking" id="heroBooking">
            <h2>Намери кола под наем</h2>
            <!-- Booking form will be rendered by renderFilters -->
            <div id="filters"></div>
          </div>
        </div>
      </section>

      <!-- FEATURES -->
      <section class="features-section">
        <div class="feat-inner">
          <div class="feat-item">
            <div class="feat-icon">${svgCalCheck}</div>
            <h3>Наличност</h3>
            <p>Широк избор от коли, налични 24/7 за вашите нужди.</p>
          </div>
          <div class="feat-item">
            <div class="feat-icon">${svgCouch}</div>
            <h3>Комфорт</h3>
            <p>Премиум автомобили с пълно оборудване за максимален комфорт.</p>
          </div>
          <div class="feat-item">
            <div class="feat-icon">${svgPiggy}</div>
            <h3>Спестявания</h3>
            <p>Конкурентни цени и специални оферти за дългосрочен наем.</p>
          </div>
        </div>
      </section>

      <!-- ABOUT -->
      <section class="about-section" id="about">
        <div class="about-inner">
          <div class="about-img"><img src="/uploads/site/about-cars.jpg" alt="Паркинг с луксозни автомобили под наем" loading="lazy"></div>
          <div class="about-points">
            <div class="about-point"><div class="about-bullet">${svgCheck}</div><div><h4>Бърза резервация</h4><p>Резервирайте кола за минути с нашата лесна онлайн система.</p></div></div>
            <div class="about-point"><div class="about-bullet">${svgCheck}</div><div><h4>Гъвкави условия</h4><p>Без скрити такси. Безплатна отмяна до 24 часа преди взимане.</p></div></div>
            <div class="about-point"><div class="about-bullet">${svgCheck}</div><div><h4>Включена Застраховка</h4><p>Всички автомобили са с пълна застраховка и пътна помощ.</p></div></div>
            <div class="about-point"><div class="about-bullet">${svgCheck}</div><div><h4>24/7 поддръжка</h4><p>Нашият екип е на ваше разположение денонощно.</p></div></div>
          </div>
        </div>
      </section>

      <!-- VEHICLES (car grid) -->
      <div id="vehicles">
        <div class="vehicles-heading">
          <h2>Налични коли в автопарка</h2>
          <p class="vehicles-period" id="vehiclesPeriod"></p>
        </div>
        <section class="panel results" id="results" style="border:none; box-shadow:none; max-width:1200px; margin:0 auto;"></section>
      </div>

      <!-- STATS -->
      <section class="stats-section" id="stats">
        <div class="stats-inner">
          <h2>Факти и Цифри</h2>
          <p class="stats-sub">Нашият опит в цифри – надеждност, която говори сама за себе си.</p>
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">${svgCarIcon}</div><div><div class="stat-value">10+</div><div class="stat-label">Коли</div></div></div>
            <div class="stat-card"><div class="stat-icon">${svgUsers}</div><div><div class="stat-value">100+</div><div class="stat-label">Клиенти</div></div></div>
            <div class="stat-card"><div class="stat-icon">${svgCalendar}</div><div><div class="stat-value">15+</div><div class="stat-label">Години</div></div></div>
            <div class="stat-card"><div class="stat-icon">${svgRoad}</div><div><div class="stat-value">1,000,000+</div><div class="stat-label">Километра</div></div></div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <h2>Наслаждавайте се на всеки километър <br>с приятна компания</h2>
        <p>Абонирайте се за нашия бюлетин и получавайте специални оферти.</p>
        <div class="cta-form">
          <label for="ctaEmail" class="sr-only">Вашият имейл</label>
          <input id="ctaEmail" type="email" placeholder="Вашият имейл" autocomplete="email" aria-label="Имейл адрес за бюлетин">
          <button id="ctaSubBtn" type="button" aria-label="Абонирай се за бюлетина">Абонирай се сега</button>
        </div>
        <div id="ctaMsg" class="cta-msg" aria-live="polite"></div>
      </section>

      ${siteFooterHTML()}
      <section class="panel details" id="details" style="display:none;"></section>
    `;
    bindHamburger();
    bindNewsletter();
  }

  /* ── Newsletter subscription handler ── */
  function bindNewsletter() {
    const btn = $('#ctaSubBtn');
    const input = $('#ctaEmail');
    const msgEl = $('#ctaMsg');
    if (!btn || !input || !msgEl) return;
    function showMsg(text, type) {
      msgEl.textContent = text;
      msgEl.className = 'cta-msg ' + (type === 'ok' ? 'cta-msg-ok' : type === 'err' ? 'cta-msg-err' : '');
    }
    btn.addEventListener('click', async () => {
      msgEl.textContent = '';
      msgEl.className = 'cta-msg';
      const email = input.value.trim();
      if (!email) { showMsg('Моля, въведете имейл адрес.', 'err'); input.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Моля, въведете валиден имейл адрес.', 'err'); input.focus(); return; }
      btn.disabled = true;
      btn.textContent = 'Изпращане...';
      try {
        await apiFetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) });
        showMsg('Успешно се абонирахте! Благодарим ви!', 'ok');
        input.value = '';
      } catch (e) {
        const msg = e.message || '';
        if (msg.includes('вече е абониран')) showMsg('Този имейл вече е абониран.', 'err');
        else if (msg.includes('валиден')) showMsg('Моля, въведете валиден имейл адрес.', 'err');
        else showMsg(msg || 'Възникна грешка. Опитайте отново.', 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Абонирай се сега';
      }
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  }

  function mountAdminLayout() {
    app.className = 'landing-wrap';
    app.innerHTML = `
      ${siteHeaderHTML('admin')}
      <section id="adminRoot" class="admin-shell" style="max-width:1200px; margin:0 auto; padding:16px;"></section>
    `;
    bindHamburger();
  }
  function navigate(hash) { if (location.hash !== hash) location.hash = hash; else renderRoute(); }
  window.addEventListener('hashchange', renderRoute);

  const defaultRange = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const snapMinutes = (d) => {
      const m = d.getMinutes();
      d.setMinutes(m < 30 ? 0 : 30, 0, 0);
      return d;
    };
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const start = snapMinutes(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { from: fmt(start), to: fmt(end) };
  };
  const initialRange = defaultRange();

  // Filters
  const filterState = {
    query: '',
    rentalType: 'Per hour',
    availableNow: false,
    transmission: 'Any',
    sort: 'Closest to me',
    pick: '',
    drop: '',
    from: initialRange.from,
    to: initialRange.to,
    type: 'Всички'
  };

  async function renderFilters() {
    const root = $('#filters');
    const s = design?.components?.filter_panel;
    // Resolve dynamic options from admin-defined params (fallback: derive from actual car data)
    const typeDef = findCarTypeDef();
    const typeOptions = typeDef?.options?.length
      ? ['Всички', ...typeDef.options]
      : ['Всички', ...new Set(cars.map(c => c.type).filter(Boolean))];
    const gearDef = findGearDef();
    const gearOptions = gearDef?.options?.length
      ? ['Без значение', ...gearDef.options]
      : ['Без значение', ...new Set(cars.map(c => c.transmission).filter(Boolean))];
    // Load locations for datalist suggestions
    let locations = [];
    try { locations = await apiFetch('/api/locations'); } catch { locations = []; }
    root.innerHTML = `
      <div style="display:grid; gap:14px;">
        <div class="hb-group ta-wrap">
          <label>Място на взимане</label>
          <div class="hb-input-wrap">
            <input id="pickPlace" class="hb-input" placeholder="Въведи локация">
            <span class="hb-icon">${svgLocationDot}</span>
          </div>
        </div>
        <div class="hb-group ta-wrap">
          <label>Място на връщане</label>
          <div class="hb-input-wrap">
            <input id="dropPlace" class="hb-input" placeholder="Въведи локация">
            <span class="hb-icon">${svgLocationDot}</span>
          </div>
        </div>
        <div class="hb-group">
          <label>Дата на взимане</label>
          <div class="hb-input-wrap">
            <input id="fromDate" type="datetime-local" class="hb-input" step="1800">
            <span class="hb-icon">${svgCalIcon}</span>
          </div>
        </div>
        <div class="hb-group">
          <label>Дата на връщане</label>
          <div class="hb-input-wrap">
            <input id="toDate" type="datetime-local" class="hb-input" step="1800">
            <span class="hb-icon">${svgCalIcon}</span>
          </div>
        </div>
        <select id="transmissionSelect" style="display:none;">
          ${gearOptions.map(o => {
            const val = o === 'Без значение' ? 'Any' : o;
            const sel = o === 'Без значение' ? ' selected' : '';
            return `<option value="${val}"${sel}>${o}</option>`;
          }).join('')}
        </select>
        <button id="submitFilters" class="hb-submit">Резервирай сега</button>
      </div>
    `;
    // Attach typeahead to both inputs
    const labels = locations.map(l => l.label);
    attachTypeahead($('#pickPlace'), labels);
    attachTypeahead($('#dropPlace'), labels);
    // Leave dates empty by default
    $('#fromDate').value = filterState.from || '';
    $('#toDate').value = filterState.to || '';

    $('#submitFilters').onclick = () => { navigate('#/vehicles'); };
    $('#transmissionSelect').onchange = (e) => { filterState.transmission = e.target.value; applyFilters(); };
    const syncPick = (e) => { filterState.pick = e.target.value; };
    const syncDrop = (e) => { filterState.drop = e.target.value; };
    $('#pickPlace').oninput = syncPick; $('#pickPlace').onchange = syncPick;
    $('#dropPlace').oninput = syncDrop; $('#dropPlace').onchange = syncDrop;
    const bindDateSnap = (el, key) => {
      if (!el) return;
      const apply = () => { const v = snapMinutesLocal(el.value); el.value = v; filterState[key] = v; };
      // Don't set onfocus/onclick to showPicker — the custom DTP handles opening
      el.onchange = apply;
      el.oninput = apply;
    };
    bindDateSnap($('#fromDate'), 'from');
    bindDateSnap($('#toDate'), 'to');
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
      if (filterState.transmission !== 'Any' && filterState.transmission !== 'Без значение') {
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
    if (mode === 'Newest') filtered.sort((a,b) => (b.year || 0) - (a.year || 0));
  }
  // Shared car spec SVG icons — used by both homepage and vehicles page
  // Shared icon helper: maps any param name → SVG/FA icon for car cards
  const specCardIcon = (name) => {
    const n = (name || '').toLowerCase();
    if (isGearParam(name) || n.includes('скоростна') || n.includes('gear') || n.includes('кутия') || n.includes('transmission')) return gearIcon();
    if (n.includes('гориво') || n.includes('fuel') || n.includes('бензин') || n.includes('дизел')) return fuelIcon();
    if (n.includes('седалки') || n.includes('места') || n.includes('seat') || n.includes('пътник')) return seatIcon();
    if (n.includes('конски') || n.includes('мощност') || n.includes('horse') || n.includes('power') || n.includes('к.с')) return powerIcon();
    if (n.includes('врати') || n.includes('door')) return doorsIcon();
    if (n.includes('багаж') || n.includes('luggage') || n.includes('куфар')) return luggageIcon();
    if (n.includes('климат') || n.includes('air') || n.includes('клима')) return acIcon();
    if (isCarTypeParam(name) || n.includes('тип') || n.includes('вид') || n.includes('категория')) return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17H3v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0H9"></path></svg>`;
    if (n.includes('цвят') || n.includes('color')) return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="8" r="1" fill="#9CA3AF"></circle><circle cx="8" cy="14" r="1" fill="#9CA3AF"></circle><circle cx="16" cy="14" r="1" fill="#9CA3AF"></circle></svg>`;
    if (n.includes('година') || n.includes('year') || n.includes('произв')) return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;
  };
  const gearIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  const fuelIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h1a2 2 0 0 1 2 2v11.5a2.5 2.5 0 1 1-5 0V4a1 1 0 0 1 1-1Z"></path><path d="M6 3h8v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path><path d="M6 14h8"></path><path d="M18 7h1.5a1.5 1.5 0 0 1 0 3H18"></path><path d="M8 7h2"></path></svg>`;
  const acIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 0 20"></path><path d="m4.93 4.93 14.14 14.14"></path><path d="m4.93 19.07 14.14-14.14"></path><path d="m3 12 18 0"></path></svg>`;
  const seatIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7a2 2 0 0 1 2 2v9h-5a4 4 0 0 1-4-4V3Z"></path><path d="M9 18h9a2 2 0 0 0 2-2v-2"></path><path d="M3 12v2a4 4 0 0 0 4 4"></path></svg>`;
  const powerIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v7l-2 2"></path><path d="m12 9 2 2"></path><circle cx="12" cy="13" r="8"></circle></svg>`;
  const doorsIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18H6z"></path><path d="M14 12h2"></path></svg>`;
  const luggageIcon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="13" rx="2"></rect><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path><path d="M9 11v4"></path><path d="M15 11v4"></path></svg>`;

  function renderResults() {
    const r = $('#results');
    const count = filtered.length;
    r.innerHTML = `
      <div class="results-grid" id="resultsGrid" style="grid-template-columns: repeat(3, minmax(280px, 1fr));"></div>
    `;

    // Update period subtitle
    const periodEl = $('#vehiclesPeriod');
    if (periodEl) {
      if (filterState.from && filterState.to) {
        periodEl.textContent = 'За периода: ' + fmtDate(filterState.from) + ' → ' + fmtDate(filterState.to);
      } else if (filterState.from) {
        periodEl.textContent = 'За периода: от ' + fmtDate(filterState.from);
      } else if (filterState.to) {
        periodEl.textContent = 'За периода: до ' + fmtDate(filterState.to);
      } else {
        periodEl.textContent = 'За периода: не е избран период';
      }
    }

    const grid = $('#resultsGrid');
    grid.innerHTML = '';
    const silhouetteSVG = () => {
      const svg = `<svg width="320" height="120" viewBox="0 0 320 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="120" rx="16" fill="url(#grad)"/>
        <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="120"><stop stop-color="#F8F9FA"/><stop offset="1" stop-color="#E9ECEF"/></linearGradient></defs>
        <path d="M40 72c5-16 24-30 54-30h62c18 0 36 8 46 20l13 16H40v-6Z" fill="#D1D5DB"/>
        <circle cx="90" cy="78" r="12" fill="#CED4DA"/><circle cx="90" cy="78" r="6" fill="#ADB5BD"/>
        <circle cx="206" cy="78" r="12" fill="#CED4DA"/><circle cx="206" cy="78" r="6" fill="#ADB5BD"/>
      </svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };
    if (!filtered.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;">
        <i class="fa-solid fa-car-burst" style="font-size:48px;color:#D1D5DB;margin-bottom:16px;display:block;"></i>
        <p style="font-size:18px;font-weight:600;color:#374151;margin:0 0 8px;">Няма намерени автомобили</p>
        <p style="font-size:14px;color:#6B7280;margin:0;">Опитайте с различни филтри или период.</p>
      </div>`;
      return;
    }
    filtered.forEach((c, i) => {
      const card = document.createElement('article');
      card.className = 'cc';
      card.setAttribute('aria-label', `${escHtml(c.brand)} ${escHtml(c.model)}`);
      const firstImg = (() => {
        const im = (c.images || [])[0];
        const p = im && (im.thumb || im.large);
        return p ? `${API_BASE}${p}` : null;
      })();
      const fromTs = filterState.from ? Date.parse(filterState.from) : null;
      const toTs = filterState.to ? Date.parse(filterState.to) : null;
      const days = (fromTs && toTs) ? Math.max(1, Math.ceil((toTs - fromTs) / 86400000)) : 1;
      const priceDay = Number(c.pricePerDay || 0);
      const total = (priceDay * days) || 0;
      card.innerHTML = `
        <div class="cc-img" data-car-details="${c.id}">
          ${firstImg
            ? `<img alt="${escHtml(c.brand)} ${escHtml(c.model)}" src="${firstImg}" loading="lazy" class="cc-photo">`
            : `<svg viewBox="0 0 400 200" class="cc-sil" role="img" aria-label="${escHtml(c.brand)} ${escHtml(c.model)}"><path d="M50 140 Q60 100 120 90 L160 70 Q200 55 260 70 L310 90 Q360 100 370 140 Z" fill="#9CA3AF"/><circle cx="120" cy="150" r="22" fill="#6B7280"/><circle cx="120" cy="150" r="12" fill="#D1D5DB"/><circle cx="310" cy="150" r="22" fill="#6B7280"/><circle cx="310" cy="150" r="12" fill="#D1D5DB"/><rect x="40" y="140" width="340" height="6" rx="3" fill="#9CA3AF"/></svg>`
          }
        </div>
        <div class="cc-body">
          <div class="cc-head">
            <div>
              <h3 class="cc-name" data-car-details="${c.id}">${escHtml(c.brand)} ${escHtml(c.model)}</h3>
              <p class="cc-type">${escHtml(c.type || '')}</p>
            </div>
            <div class="cc-price-block">
              <span class="cc-price">€${priceDay.toFixed(0)}</span>
              <span class="cc-per">на ден</span>
            </div>
          </div>
          <div id="specs-${c.id}" class="cc-specs"></div>
          <button class="cc-btn" data-details="${c.id}">
            Резервирай
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      `;
      grid.appendChild(card);
      // Render specs directly from car fields: transmission, seats, fuel
      const specsEl = document.getElementById(`specs-${c.id}`);
      if (specsEl) {
        const specs = [];
        if (c.transmission) specs.push({ icon: gearIcon(), text: displayVal(c.transmission) });
        if (c.seats) specs.push({ icon: seatIcon(), text: c.seats + ' места' });
        if (c.fuel) specs.push({ icon: fuelIcon(), text: displayVal(c.fuel) });
        specsEl.innerHTML = specs.map(s => `<div class="cc-spec-item">${s.icon}<span>${escHtml(String(s.text))}</span></div>`).join('');
      }
      const availability = (() => {
        const selFrom = filterState.from;
        const selTo = filterState.to;
        const isService = () => {
          const s = (c.status || '').toString().toLowerCase();
          return s.includes('серв') || s === 'service';
        };
        const overlaps = (() => {
          const rel = (reservations || []).filter(r => r.carId === c.id && !(r.status && r.status.toUpperCase() === 'DECLINED'));
          if (!selFrom || !selTo) return rel;
          return rel.filter(r => isOverlap(selFrom, selTo, r.from, r.to));
        })();
        const hasOverlap = overlaps.some(r => isOverlap(selFrom, selTo, r.from, r.to));
        let label = 'Наличен';
        let available = true;
        if (isService()) { label = 'Не е наличен'; available = false; }
        else if (selFrom && selTo && hasOverlap) { label = 'Резервиран'; available = false; }
        return { available, label };
      })();
      const btn = card.querySelector('.cc-btn');
      if (btn && !availability.available) {
        btn.disabled = true;
        btn.classList.add('cc-btn-disabled');
      }
    });
    $$('[data-car-details]').forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute('data-car-details');
        openCarDetails(id);
      };
    });
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
    const plain = paramDefs.filter(d => !isCarTypeParam(d.name) && !isGearParam(d.name));
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
      const now = new Date();
      const relRes = (reservations || []).filter(r => {
        const st = (r.status || '').toLowerCase();
        if (st === 'declined') return false;
        const to = new Date(r.to);
        return to >= now && r.carId === id;
      });
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
        const tooltip = relRes.map(r => {
          const f = new Date(r.from).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
          const t = new Date(r.to).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
          return `${f} → ${t}`;
        }).join('\\n');

        /* Build spec cards for Technical Specification grid */
        const specIconFA = (name) => {
          const n = (name || '').toLowerCase();
          if (n.includes('скоростна') || n.includes('gear') || n.includes('кутия') || n.includes('transmission'))
            return '<i class="fa-solid fa-gears"></i>';
          if (n.includes('гориво') || n.includes('fuel') || n.includes('бензин') || n.includes('дизел'))
            return '<i class="fa-solid fa-gas-pump"></i>';
          if (n.includes('врати') || n.includes('door'))
            return '<i class="fa-solid fa-door-open"></i>';
          if (n.includes('седалки') || n.includes('места') || n.includes('seat') || n.includes('пътник'))
            return '<i class="fa-solid fa-user-group"></i>';
          if (n.includes('конски') || n.includes('мощност') || n.includes('horse') || n.includes('power') || n.includes('к.с'))
            return '<i class="fa-solid fa-bolt"></i>';
          if (n.includes('багаж') || n.includes('luggage') || n.includes('куфар'))
            return '<i class="fa-solid fa-suitcase-rolling"></i>';
          if (n.includes('вид кола') || n.includes('тип') || n.includes('type') || n.includes('категория'))
            return '<i class="fa-solid fa-car"></i>';
          if (n.includes('климат') || n.includes('air') || n.includes('клима'))
            return '<i class="fa-solid fa-snowflake"></i>';
          if (n.includes('разстояние') || n.includes('distance') || n.includes('пробег') || n.includes('километ'))
            return '<i class="fa-solid fa-road"></i>';
          if (n.includes('цвят') || n.includes('color') || n.includes('colour'))
            return '<i class="fa-solid fa-palette"></i>';
          if (n.includes('година') || n.includes('year') || n.includes('произв'))
            return '<i class="fa-solid fa-calendar"></i>';
          if (n.includes('двигател') || n.includes('engine') || n.includes('кубик'))
            return '<i class="fa-solid fa-gear"></i>';
          if (n.includes('каросерия') || n.includes('обем') || n.includes('cargo') || n.includes('trunk'))
            return '<i class="fa-solid fa-box-open"></i>';
          if (n.includes('тегло') || n.includes('weight') || n.includes('маса'))
            return '<i class="fa-solid fa-weight-hanging"></i>';
          if (n.includes('скорост') || n.includes('speed'))
            return '<i class="fa-solid fa-gauge-high"></i>';
          if (n.includes('навигаци') || n.includes('gps') || n.includes('navi'))
            return '<i class="fa-solid fa-location-crosshairs"></i>';
          if (n.includes('камер') || n.includes('camera') || n.includes('паркинг'))
            return '<i class="fa-solid fa-video"></i>';
          if (n.includes('bluetooth') || n.includes('блутут'))
            return '<i class="fa-brands fa-bluetooth-b"></i>';
          if (n.includes('подгрев') || n.includes('отопл') || n.includes('heat'))
            return '<i class="fa-solid fa-temperature-arrow-up"></i>';
          if (n.includes('abs') || n.includes('спирачк') || n.includes('brake'))
            return '<i class="fa-solid fa-brake-warning"></i>';
          if (n.includes('airbag') || n.includes('въздушн') || n.includes('еърбег'))
            return '<i class="fa-solid fa-shield-halved"></i>';
          if (n.includes('регистрац') || n.includes('номер') || n.includes('plate'))
            return '<i class="fa-solid fa-id-card"></i>';
          return '<i class="fa-solid fa-circle-info"></i>';
        };
        /* Split params: highlight (top) vs rest (bottom) — flexible matching */
        const isHighlight = (name) => {
          const n = (name || '').toLowerCase();
          return isCarTypeParam(name) || isGearParam(name)
            || n.includes('гориво') || n.includes('fuel')
            || n.includes('багаж') || n.includes('luggage')
            || n.includes('седалк') || n.includes('места') || n.includes('seat');
        };
        const allParams = params || [];
        const topParams = allParams.filter(p => isHighlight(p.name) && p?.value);
        const restParams = allParams.filter(p => !isHighlight(p.name));
        // Sort rest: with value first, without value second
        const restWithVal = restParams.filter(p => p?.value);
        const restNoVal = restParams.filter(p => !p?.value);
        const sortedRest = [...restWithVal, ...restNoVal];

        const buildCard = (p) => {
          const hasVal = !!p?.value;
          return `<div class="cdm-spec-card${hasVal ? '' : ' cdm-spec-empty'}" role="listitem">
            <div class="cdm-spec-icon">${specIconFA(p.name)}</div>
            <div class="cdm-spec-text">
              <div class="cdm-spec-label">${escHtml(p.name)}</div>
              <div class="cdm-spec-value">${hasVal ? (escHtml(p.value) + (p.unit ? ' ' + escHtml(p.unit) : '')) : '---'}</div>
            </div>
          </div>`;
        };

        const topCards = topParams.map(buildCard).join('');
        const specCards = sortedRest.map(buildCard).join('');

        const carNameSafe = escHtml(`${car.brand} ${car.model}`);
        card.setAttribute('aria-label', `Детайли за ${carNameSafe}`);
        card.innerHTML = `
          <button class="cdm-close-btn" id="closeCarModal" aria-label="Затвори">✕</button>
          <div class="cdm-top">
            <!-- LEFT: Image + thumbs strip -->
            <div class="cdm-gallery">
              <div class="cdm-main-img-wrap">
                <img id="mainCarImg" src="${mainSrc}" alt="Снимка на ${carNameSafe}" class="cdm-main-img">
              </div>
              ${imgs.length > 1 ? `<div class="cdm-thumbs-wrap">
                <button class="cdm-thumbs-arrow cdm-thumbs-up" id="thumbsUp" aria-label="Предишна снимка"><i class="fa-solid fa-chevron-up"></i></button>
                <div class="cdm-thumbs" id="cdmThumbsScroll" role="listbox" aria-label="Снимки">
                  ${imgs.map((im, idx) => {
                    const s = toSrc(im);
                    return `<img data-thumb="${idx}" src="${s}" alt="Снимка ${idx+1} на ${carNameSafe}" role="option" aria-selected="${idx===currentIdx}" class="cdm-thumb ${idx===currentIdx?'cdm-thumb-active':''}">`;
                  }).join('')}
                </div>
                <button class="cdm-thumbs-arrow cdm-thumbs-down" id="thumbsDown" aria-label="Следваща снимка"><i class="fa-solid fa-chevron-down"></i></button>
              </div>` : ''}
            </div>
            <!-- RIGHT: Info -->
            <div class="cdm-info">
              <div class="cdm-name-row">
                <h2 class="cdm-car-name" id="cdmCarTitle">${carNameSafe}</h2>
                <span class="cdm-status" title="${escHtml(tooltip)}" style="${statusStyle}" role="status">${escHtml(statusLabel)}</span>
              </div>
              <div class="cdm-price-row">
                <span class="cdm-price" aria-label="Цена">€${(car.pricePerDay||0).toFixed(0)}</span>
                <span class="cdm-per">/ ден</span>
              </div>
              ${topCards ? `<div class="cdm-top-specs">${topCards}</div>` : ''}
              ${available ? `<button class="cdm-reserve-btn" id="reserveFromModal"><i class="fa-solid fa-key"></i> Наеми сега</button>` : ''}
              ${relRes.length ? `<div class="cdm-reservations" aria-label="Активни резервации">
                <div class="cdm-res-title">Активни резервации:</div>
                ${relRes.map(r => {
                  const f = new Date(r.from).toLocaleString('bg-BG', { dateStyle:'short', timeStyle:'short' });
                  const t = new Date(r.to).toLocaleString('bg-BG', { dateStyle:'short', timeStyle:'short' });
                  return `<div class="cdm-res-line">${escHtml(f)} → ${escHtml(t)}</div>`;
                }).join('')}
              </div>` : ''}
            </div>
          </div>
          <!-- PARAMETERS full width -->
          <div class="cdm-params-section">
            <h3 class="cdm-section-title"><i class="fa-solid fa-sliders" style="font-size:16px;margin-right:8px;color:#6366F1;"></i>Технически Параметри</h3>
            <div class="cdm-specs-grid" role="list" aria-label="Параметри">
              ${specCards || '<div class="cdm-spec-card" role="listitem"><div class="cdm-spec-label">Без параметри</div></div>'}
            </div>
          </div>
        `;
        $('#closeCarModal', card).onclick = close;
        $$('[data-thumb]', card).forEach(th => {
          th.onclick = () => {
            currentIdx = Number(th.getAttribute('data-thumb'));
            renderContent();
          };
        });
        // Thumb scroll arrows
        const thumbsScroll = $('#cdmThumbsScroll', card);
        $('#thumbsUp', card)?.addEventListener('click', () => { if (thumbsScroll) thumbsScroll.scrollBy({ top: -160, behavior: 'smooth' }); });
        $('#thumbsDown', card)?.addEventListener('click', () => { if (thumbsScroll) thumbsScroll.scrollBy({ top: 160, behavior: 'smooth' }); });
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
        <div class="img"><img alt="${escHtml(car.brand)} ${escHtml(car.model)}" src="${carPlaceholderSVG(`${car.brand} ${car.model}`, 820, 220, 210)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"></div>
        <div class="img"><img alt="${escHtml(car.brand)} ${escHtml(car.model)} – задна страна" src="${carPlaceholderSVG('Rear', 420, 220, 230)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:12px;"></div>
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
          <div class="row"><div>Ставка (с ДДС)</div><div id="rateVal">€${car.pricePerDay}/ден</div></div>
          <div class="row"><div>Застраховка</div><div id="insVal">€0.00</div></div>
          <div class="row"><div>ДДС 20% (вкл. в цената)</div><div id="taxVal">€0.00</div></div>
          <div class="row" style="font-weight:700;"><div>Крайна сума</div><div id="totalVal">€0.00</div></div>
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
      const base = d * rate; // цената вече е с ДДС
      const insVal = Number(ins.value || 0);
      const vatInBase = base - (base / 1.20); // ДДС, включен в цената (20%)
      $('#rateVal').textContent = `€${base.toFixed(2)} (${d} дни @ €${rate}/ден)`;
      $('#insVal').textContent = formatMoney(insVal);
      $('#taxVal').textContent = `€${vatInBase.toFixed(2)} (вкл. в цената)`;
      $('#totalVal').textContent = formatMoney(base + insVal);
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
    app.className = 'landing-wrap';
    app.innerHTML = `
      ${siteHeaderHTML('reserve')}
      <div class="reserve-page">
        <div class="reserve-container" id="details"></div>
      </div>
      ${siteFooterHTML()}
    `;
    bindHamburger();
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
      extraDriver: existing.extraDriver || false,
      insurance: existing.insurance || false,
      termsAccepted: existing.termsAccepted || false,
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

    const stepLabels = ['Кола & дати', 'Шофьор', 'Допълнения', 'Фактура', 'Условия', 'Потвърждение'];
    const stepper = `
      <div class="wz-stepper">
        ${stepLabels.map((label, i) => {
          const num = i + 1;
          const cls = num < step ? 'wz-step done' : num === step ? 'wz-step active' : 'wz-step';
          return `<div class="${cls}"><span class="wz-step-num">${num < step ? '✓' : num}</span><span class="wz-step-label">${label}</span></div>`;
        }).join('<div class="wz-step-line"></div>')}
      </div>
    `;

    const renderCarBadge = (car) => {
      const firstImg = (() => {
        const im = (car?.images || [])[0];
        const p = im && (im.thumb || im.large);
        return p ? `${API_BASE}${p}` : carPlaceholderSVG(`${car?.brand||''} ${car?.model||''}`, 240, 120, 210);
      })();
      const priceDay = Number(car?.pricePerDay || 0);
      const fromTs = draft.from ? Date.parse(draft.from) : null;
      const toTs = draft.to ? Date.parse(draft.to) : null;
      const days = (fromTs && toTs) ? Math.max(1, Math.ceil((toTs - fromTs) / 86400000)) : 1;
      const total = priceDay * days;
      return `
        <div class="wz-car-badge">
          <div class="wz-car-img-wrap">
            <img src="${firstImg}" alt="${car?.brand||''} ${car?.model||''}" class="wz-car-img">
          </div>
          <div class="wz-car-info">
            <div class="wz-car-header">
              <div>
                <div class="wz-car-name">${car?.brand||''} ${car?.model||''}${car?.trim ? ' ' + car.trim : ''}</div>
                <div class="wz-car-type">${car?.type || ''}</div>
              </div>
              <div class="wz-car-price-block">
                <div class="wz-car-price">€${priceDay.toFixed(0)} <span class="wz-car-per">/ ден</span></div>
                ${days > 1 ? `<div class="wz-car-total">${days} дни = €${total.toFixed(2)}</div>` : ''}
                <a class="wz-change-btn" href="#/vehicles">Промени</a>
              </div>
            </div>
            <div class="wz-car-specs" id="wizard-specs"></div>
          </div>
        </div>
      `;
    };

    const blockDates = `
      <section id="step1" class="wz-section">
        <h3 class="wz-section-title">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#6366F1" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Дати и локации
        </h3>
        <div class="grid-2" style="gap:14px;">
          <div><div class="section-title">Място взимане</div><input id="wPick" class="input" value="${draft.pick || ''}" placeholder="Място"/><span class="field-hint" data-hint="wPick">Въведете адрес или населено място</span></div>
          <div><div class="section-title">Място връщане</div><input id="wDrop" class="input" value="${draft.drop || ''}" placeholder="Място"/><span class="field-hint" data-hint="wDrop">Въведете адрес или населено място</span></div>
        </div>
        <div class="grid-2" style="gap:14px; margin-top:14px;">
          <div><div class="section-title">От</div><input id="wFrom" type="datetime-local" step="1800" class="input" value="${(draft.from || '').slice(0,16)}"/><span class="field-hint" data-hint="wFrom">Изберете начална дата и час</span></div>
          <div><div class="section-title">До</div><input id="wTo" type="datetime-local" step="1800" class="input" value="${(draft.to || '').slice(0,16)}"/><span class="field-hint" data-hint="wTo">Изберете крайна дата и час</span></div>
        </div>
        <div class="wz-actions">
          <button class="wz-btn-primary" id="next1">Напред →</button>
        </div>
      </section>
    `;

    const block2 = `
      <section id="step2" class="wz-section">
        <h3 class="wz-section-title">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#6366F1" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Данни на шофьора
        </h3>
        <div class="grid-2" style="gap:14px;">
          <div><div class="section-title">Име и фамилия</div><input id="dName" class="input" value="${draft.driver?.name || ''}"/><span class="field-hint" data-hint="dName">Поне 2 думи</span></div>
          <div><div class="section-title">Телефон</div><input id="dPhone" class="input" value="${draft.driver?.phone || ''}"/><span class="field-hint" data-hint="dPhone">Телефонен номер (поне 7 цифри)</span></div>
        </div>
        <div class="grid-2" style="gap:14px; margin-top:14px;">
          <div><div class="section-title">Имейл</div><input id="dEmail" class="input" value="${draft.driver?.email || ''}"/><span class="field-hint" data-hint="dEmail">Валиден имейл адрес</span></div>
          <div><div class="section-title">№ шофьорска книжка</div><input id="dLicense" class="input" value="${draft.driver?.license || ''}"/><span class="field-hint" data-hint="dLicense">Номер от книжката (поне 5 символа)</span></div>
        </div>
        <div class="wz-actions wz-actions-between">
          <button class="wz-btn-secondary" id="back1">← Назад</button>
          <button class="wz-btn-primary" id="next2">Напред →</button>
        </div>
      </section>
    `;

    // ─── Step 3: Допълнения (extras) ───
    const extDriverPrice = Number(companyInfo?.extraDriverPrice ?? 10);
    const extInsurancePrice = Number(companyInfo?.insurancePrice ?? 15);
    const priceDay = Number(car?.pricePerDay || 0);
    const fromTs2 = draft.from ? Date.parse(draft.from) : null;
    const toTs2 = draft.to ? Date.parse(draft.to) : null;
    const daysCalc = (fromTs2 && toTs2) ? Math.max(1, Math.ceil((toTs2 - fromTs2) / 86400000)) : 1;
    const block3 = `
      <section id="step3" class="wz-section">
        <h3 class="wz-section-title">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#6366F1" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
          Допълнителни услуги
        </h3>
        <div class="wz-extras-list">
          <label class="wz-extra-card" for="chkExtraDriver">
            <div class="wz-extra-check"><input type="checkbox" id="chkExtraDriver" ${draft.extraDriver ? 'checked' : ''}></div>
            <div class="wz-extra-info">
              <div class="wz-extra-name">Допълнителен шофьор</div>
              <div class="wz-extra-desc">Добавете втори шофьор към наема. Цената е за всеки ден от резервацията.</div>
              <div class="wz-extra-price">€${extDriverPrice.toFixed(2)} / ден <span class="wz-extra-total">(${daysCalc} дни = €${(extDriverPrice * daysCalc).toFixed(2)})</span></div>
            </div>
          </label>
          <label class="wz-extra-card" for="chkInsurance">
            <div class="wz-extra-check"><input type="checkbox" id="chkInsurance" ${draft.insurance ? 'checked' : ''}></div>
            <div class="wz-extra-info">
              <div class="wz-extra-name">Пълно каско (Full Coverage)</div>
              <div class="wz-extra-desc">Намалява самоучастието до €0 — пълно покритие за спокойствие по пътищата.</div>
              <div class="wz-extra-price">€${extInsurancePrice.toFixed(2)} / ден <span class="wz-extra-total">(${daysCalc} дни = €${(extInsurancePrice * daysCalc).toFixed(2)})</span></div>
            </div>
          </label>
        </div>
        <div class="wz-extras-summary" id="extrasSummary"></div>
        <div class="wz-actions wz-actions-between">
          <button class="wz-btn-secondary" id="backToDriver">← Назад</button>
          <button class="wz-btn-primary" id="nextToInvoice">Напред →</button>
        </div>
      </section>
    `;

    const inv = draft.invoice || { type: 'individual' };
    const block4 = `
      <section id="step4" class="wz-section">
        <h3 class="wz-section-title">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#6366F1" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
          Данни за фактура
        </h3>
        <div class="wz-radio-group">
          <label class="wz-radio ${inv.type!=='company'?'wz-radio-active':''}"><input type="radio" name="invType" value="individual" ${inv.type!=='company'?'checked':''}> Физическо лице</label>
          <label class="wz-radio ${inv.type==='company'?'wz-radio-active':''}"><input type="radio" name="invType" value="company" ${inv.type==='company'?'checked':''}> Юридическо лице</label>
        </div>
        <div id="invIndividual" style="display:${inv.type!=='company'?'grid':'none'}; gap:14px; margin-top:16px;">
          <div class="grid-2" style="gap:14px;">
            <div><div class="section-title">Име и фамилия</div><input id="iNameInd" class="input" value="${(inv.name) || draft.driver?.name || ''}"/><span class="field-hint" data-hint="iNameInd">Поне 2 думи</span></div>
            <div><div class="section-title">ЕГН</div><input id="iEgn" class="input" value="${inv.egn || ''}"/><span class="field-hint" data-hint="iEgn">Точно 10 цифри</span></div>
          </div>
          <div class="grid-2" style="gap:14px;">
            <div><div class="section-title">Адрес</div><input id="iAddrInd" class="input" value="${inv.addr || ''}"/><span class="field-hint" data-hint="iAddrInd">Поне 5 символа</span></div>
            <div><div class="section-title">Имейл</div><input id="iEmailInd" class="input" value="${inv.email || draft.driver?.email || ''}"/><span class="field-hint" data-hint="iEmailInd">Валиден имейл адрес</span></div>
          </div>
        </div>

        <div id="invCompany" style="display:${inv.type==='company'?'grid':'none'}; gap:14px; margin-top:16px;">
          <div class="grid-2" style="gap:14px;">
            <div><div class="section-title">Име на фирмата</div><input id="iNameCo" class="input" value="${inv.name || ''}"/><span class="field-hint" data-hint="iNameCo">Пълно наименование (поне 2 символа)</span></div>
            <div><div class="section-title">ЕИК</div><input id="iNumCo" class="input" value="${inv.num || ''}"/><span class="field-hint" data-hint="iNumCo">9 или 13 цифри</span></div>
          </div>
          <div class="grid-2" style="gap:14px;">
            <div><div class="section-title">ДДС №</div><input id="iVatCo" class="input" value="${inv.vat || ''}"/><span class="field-hint" data-hint="iVatCo">По избор – BG + 9-10 цифри</span></div>
            <div><div class="section-title">МОЛ</div><input id="iMolCo" class="input" value="${inv.mol || ''}"/><span class="field-hint" data-hint="iMolCo">Поне 2 думи</span></div>
          </div>
          <div class="grid-2" style="gap:14px;">
            <div><div class="section-title">Адрес</div><input id="iAddrCo" class="input" value="${inv.addr || ''}"/><span class="field-hint" data-hint="iAddrCo">Поне 5 символа</span></div>
            <div><div class="section-title">Имейл</div><input id="iEmailCo" class="input" value="${inv.email || ''}"/><span class="field-hint" data-hint="iEmailCo">Валиден имейл адрес</span></div>
          </div>
          <div class="grid-3" style="gap:14px;">
            <div><div class="section-title">Банка</div><input id="iBankCo" class="input" value="${inv.bank || ''}"/><span class="field-hint" data-hint="iBankCo">По избор – поне 3 символа</span></div>
            <div><div class="section-title">IBAN</div><input id="iIbanCo" class="input" value="${inv.iban || ''}"/><span class="field-hint" data-hint="iIbanCo">По избор – BG + 20 знака</span></div>
            <div><div class="section-title">BIC</div><input id="iBicCo" class="input" value="${inv.bic || ''}"/><span class="field-hint" data-hint="iBicCo">По избор – 8 или 11 символа</span></div>
          </div>
        </div>
        <div class="wz-actions wz-actions-between">
          <button class="wz-btn-secondary" id="backToExtras">← Назад</button>
          <button class="wz-btn-primary" id="nextToTerms">Напред →</button>
        </div>
      </section>
    `;

    // ─── Step 5: Приемане на условията ───
    const block5 = `
      <section id="step5" class="wz-section">
        <h3 class="wz-section-title">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#6366F1" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Приемане на условия
        </h3>
        <div class="wz-terms-list">
          <label class="wz-terms-item" for="chkTerms">
            <input type="checkbox" id="chkTerms">
            <span>Прочетох и приемам <a href="#/policies" target="_blank">Условията за ползване</a></span>
          </label>
          <label class="wz-terms-item" for="chkCancel">
            <input type="checkbox" id="chkCancel">
            <span>Прочетох и приемам <a href="#/policies" target="_blank">Политика за анулиране и възстановяване</a></span>
          </label>
          <label class="wz-terms-item" for="chkInsurancePol">
            <input type="checkbox" id="chkInsurancePol">
            <span>Прочетох и приемам <a href="#/policies" target="_blank">Застрахователните условия</a></span>
          </label>
          <label class="wz-terms-item" for="chkPrivacy">
            <input type="checkbox" id="chkPrivacy">
            <span>Прочетох и приемам <a href="#/policies" target="_blank">Политика за поверителност</a></span>
          </label>
        </div>
        <div id="termsError" class="wz-terms-error" style="display:none;"></div>
        <div class="wz-actions wz-actions-between">
          <button class="wz-btn-secondary" id="backToInvoice">← Назад</button>
          <button class="wz-btn-primary" id="confirm" disabled>Резервирай</button>
        </div>
      </section>
    `;

    const _resId = paramsUrl.get('id') || draft.id;
    const block6 = `
      <section id="step6" class="wz-section wz-section-confirm">
        <div class="wz-confirm-icon">
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#10B981" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <h3 class="wz-confirm-title">Резервацията е изпратена!</h3>
        <p class="wz-confirm-text">Вашата заявка № <strong>${_resId}</strong> е получена и очаква одобрение.</p>
        <p class="wz-confirm-sub">Ще се свържем с вас съвсем скоро.</p>
        <button id="downloadProformaPdf" class="btn-primary wz-download-pdf-btn" style="display:inline-flex; align-items:center; gap:8px; margin-top:20px; cursor:pointer; border:none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Свали проформа (PDF)
        </button>
        <p id="pdfLoadingMsg" style="display:none; margin-top:10px; font-size:13px; color:#6B7280;">Зареждане на проформата...</p>
      </section>
    `;

    const clearErrors = () => {
      $$('.err-msg', d).forEach(n => n.remove());
      $$('.error', d).forEach(n => n.classList.remove('error'));
      $$('.hint-error', d).forEach(n => n.classList.remove('hint-error'));
    };
    const setError = (inputEl, msg) => {
      if (!inputEl) return;
      inputEl.classList.add('error');
      const holder = inputEl.parentElement || inputEl;
      const m = document.createElement('span');
      m.className = 'err-msg';
      m.textContent = msg;
      holder.appendChild(m);
    };
    const scrollToError = () => {
      const first = $('.error', d);
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    d.innerHTML = `
      <h1 class="wz-page-title" style="font-size:var(--font-h2);">Резервация</h1>
      ${stepper}
      ${renderCarBadge(car)}
      ${step === 1 ? blockDates : ''}
      ${step === 2 ? block2 : ''}
      ${step === 3 ? block3 : ''}
      ${step === 4 ? block4 : ''}
      ${step === 5 ? block5 : ''}
      ${step === 6 ? block6 : ''}
    `;

    // Load car specs for badge (all steps) — use SVG icons like car listing cards
    const wzSpecIcon = (name) => {
      const n = (name || '').toLowerCase();
      if (n.includes('скоростна') || n.includes('gear'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
      if (n.includes('гориво') || n.includes('fuel'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="M16 3h1a2 2 0 0 1 2 2v11.5a2.5 2.5 0 1 1-5 0V4a1 1 0 0 1 1-1Z"/><path d="M6 3h8v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M6 14h8"/><path d="M18 7h1.5a1.5 1.5 0 0 1 0 3H18"/><path d="M8 7h2"/></svg>`;
      if (n.includes('врати') || n.includes('door'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="M6 3h12v18H6z"/><path d="M14 12h2"/></svg>`;
      if (n.includes('седалки') || n.includes('места') || n.includes('seat'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>`;
      if (n.includes('конски') || n.includes('мощност') || n.includes('horse') || n.includes('power'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="M12 2v7l-2 2"/><path d="m12 9 2 2"/><circle cx="12" cy="13" r="8"/></svg>`;
      if (n.includes('багаж') || n.includes('luggage'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M9 11v4"/><path d="M15 11v4"/></svg>`;
      if (n.includes('вид кола') || n.includes('тип') || n.includes('type'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>`;
      if (n.includes('климат') || n.includes('air'))
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><path d="m12 2 0 20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m4.93 19.07 14.14-14.14"/><path d="m3 12 18 0"/></svg>`;
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>`;
    };
    loadCarParams(car?.id).then(list => {
      const el = $('#wizard-specs');
      if (!el) return;
      const items = (list || []).filter(p => p?.value !== null && p?.value !== '')
        .map(p => `<div class="wz-spec-item">${wzSpecIcon(p.name)}<span>${escHtml(p.value)}${p.unit ? ' ' + escHtml(p.unit) : ''}</span></div>`).join('');
      el.innerHTML = items || '';
    }).catch(()=>{});

    // Стъпка 1
    if (step === 1) {
      const validateStep1 = () => {
        clearErrors();
        let ok = true;
        const markField = (el) => {
          if (!el) return;
          el.classList.add('error');
          const hint = el.parentElement?.querySelector('.field-hint');
          if (hint) hint.classList.add('hint-error');
        };
        if (!$('#wPick').value.trim()) { markField($('#wPick')); ok = false; }
        if (!$('#wDrop').value.trim()) { markField($('#wDrop')); ok = false; }
        if (!$('#wFrom').value) { markField($('#wFrom')); ok = false; }
        if (!$('#wTo').value) { markField($('#wTo')); ok = false; }
        if (!ok) scrollToError();
        return ok;
      };
      $('#wPick').value = draft.pick || '';
      $('#wDrop').value = draft.drop || '';
      $('#wFrom').value = (draft.from || '').slice(0,16);
      $('#wTo').value = (draft.to || '').slice(0,16);
      // Clear error state on input
      ['#wPick','#wDrop','#wFrom','#wTo'].forEach(sel => {
        const el = $(sel);
        if (!el) return;
        el.addEventListener('input', () => {
          el.classList.remove('error');
          const hint = el.parentElement?.querySelector('.field-hint');
          if (hint) hint.classList.remove('hint-error');
        });
      });
      const bindDateSnap = (el, key) => {
        if (!el) return;
        const apply = () => { const v = snapMinutesLocal(el.value); el.value = v; draft[key] = v; };
        // Don't set onfocus/onclick to showPicker — the custom DTP handles opening
        el.onchange = apply;
        el.oninput = apply;
      };
      bindDateSnap($('#wFrom'), 'from');
      bindDateSnap($('#wTo'), 'to');
      apiFetch('/api/locations').then(locs => {
        const labels = (locs || []).map(l => l.label);
        attachTypeahead($('#wPick'), labels);
        attachTypeahead($('#wDrop'), labels);
      }).catch(()=>{});
      $('#next1')?.addEventListener('click', () => {
        if (!validateStep1()) return;
        draft.pick = $('#wPick').value; draft.drop = $('#wDrop').value;
        draft.from = $('#wFrom').value; draft.to = $('#wTo').value;
        gotoStep(2);
      });
    }

    // Стъпка 2
    if (step === 2) {
      const errorMessages = {
        name: {
          empty: "Моля, въведете име и фамилия",
          invalid: "Въведете поне 2 думи"
        },
        phone: {
          empty: "Моля, въведете телефонен номер",
          wrongFormat: "Номерът трябва да съдържа поне 7 цифри"
        },
        email: {
          empty: "Моля, въведете имейл адрес",
          invalid: "Моля, въведете валиден имейл адрес"
        },
        license: {
          empty: "Моля, въведете номер на шофьорска книжка",
          wrongLength: "Поне 5 символа"
        }
      };

      const normSpaces = (v='') => v.replace(/\s+/g, ' ').trim();
      const setFieldState = (inputEl, res, showError) => {
        if (!inputEl) return;
        const holder = inputEl.parentElement || inputEl;
        const msgEl = holder.querySelector('.err-msg');
        if (msgEl) msgEl.remove();
        const hintEl = holder.querySelector('.field-hint');
        inputEl.classList.remove('error','valid');
        if (hintEl) hintEl.classList.remove('hint-error');
        if (res?.ok) {
          inputEl.classList.add('valid');
        } else {
          if (showError) {
            inputEl.classList.add('error');
            if (hintEl) hintEl.classList.add('hint-error');
          }
        }
      };

      const validators = {
        name(val) {
          const v = normSpaces(val);
          if (!v) return { ok:false, err:'empty', value:'' };
          const parts = v.split(' ').filter(Boolean);
          if (parts.length < 2) return { ok:false, err:'invalid', value:v };
          return { ok:true, value:v };
        },
        phone(val) {
          const digits = (val || '').replace(/\D/g, '');
          if (!digits) return { ok:false, err:'empty', value:'' };
          if (digits.length < 7) return { ok:false, err:'wrongFormat', value:val.trim() };
          return { ok:true, value:val.trim() };
        },
        email(val) {
          const v = normSpaces(val).toLowerCase();
          if (!v) return { ok:false, err:'empty', value:'' };
          const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!re.test(v)) return { ok:false, err:'invalid', value:v };
          return { ok:true, value:v };
        },
        license(val) {
          const v = (val || '').trim();
          if (!v) return { ok:false, err:'empty', value:'' };
          if (v.length < 5) return { ok:false, err:'wrongLength', value:v };
          return { ok:true, value:v };
        }
      };

      const fields = {
        name: $('#dName'),
        phone: $('#dPhone'),
        email: $('#dEmail'),
        license: $('#dLicense')
      };
      const fieldLabels = {
        name: 'Име и фамилия',
        phone: 'Телефон',
        email: 'Имейл',
        license: '№ шофьорска книжка'
      };
      const touched = { name:false, phone:false, email:false, license:false };

      const runValidation = (key, showError = false) => {
        const input = fields[key];
        const res = validators[key](input?.value || '');
        const message = res.ok ? '' : errorMessages[key][res.err] || errorMessages[key].invalid;
        setFieldState(input, { ...res, message }, showError);
        return res;
      };

      const validateAll = (showErrors = false) => {
        const values = {};
        let ok = true;
        Object.keys(fields).forEach(k => {
          const res = runValidation(k, showErrors);
          if (!res.ok) ok = false;
          if (res.ok) values[k] = res.value;
        });
        if (!ok && showErrors) scrollToError();
        return { ok, values };
      };

      const updateNextBtn = () => {
        // Button always enabled — errors shown on click
      };

      Object.entries(fields).forEach(([k, input]) => {
        if (!input) return;
        input.addEventListener('blur', () => {
          touched[k] = true;
          runValidation(k, true);
          updateNextBtn();
        });
        input.addEventListener('input', () => {
          runValidation(k, touched[k]);
          updateNextBtn();
        });
      });

      $('#back1')?.addEventListener('click', () => gotoStep(1));
      $('#next2')?.addEventListener('click', () => {
        const res = validateAll(true);
        if (!res.ok) return;
        draft.driver = {
          name: res.values.name,
          phone: res.values.phone,
          email: res.values.email,
          license: res.values.license,
          birth: '', addr: ''
        };
        gotoStep(3); // → Допълнения
      });
      updateNextBtn();
    }

    // Стъпка 3: Допълнения
    if (step === 3) {
      const updateSummary = () => {
        const ed = $('#chkExtraDriver')?.checked;
        const ins = $('#chkInsurance')?.checked;
        const sum = $('#extrasSummary');
        if (!sum) return;
        let base = priceDay * daysCalc;
        let lines = [`Наем: €${base.toFixed(2)}`];
        if (ed) { const cost = extDriverPrice * daysCalc; base += cost; lines.push(`Доп. шофьор: €${cost.toFixed(2)}`); }
        if (ins) { const cost = extInsurancePrice * daysCalc; base += cost; lines.push(`Пълно каско: €${cost.toFixed(2)}`); }
        sum.innerHTML = `<div class="wz-extras-total"><strong>Обща сума: €${base.toFixed(2)}</strong> <span style="font-size:13px;color:#6B7280;">(с ДДС)</span></div>`;
      };
      updateSummary();
      const toggleCardClass = (chk) => { if (chk) chk.closest('.wz-extra-card')?.classList.toggle('checked', chk.checked); };
      $('#chkExtraDriver')?.addEventListener('change', () => { toggleCardClass($('#chkExtraDriver')); updateSummary(); });
      $('#chkInsurance')?.addEventListener('change', () => { toggleCardClass($('#chkInsurance')); updateSummary(); });
      toggleCardClass($('#chkExtraDriver')); toggleCardClass($('#chkInsurance'));
      $('#backToDriver')?.addEventListener('click', () => gotoStep(2));
      $('#nextToInvoice')?.addEventListener('click', () => {
        draft.extraDriver = !!$('#chkExtraDriver')?.checked;
        draft.insurance = !!$('#chkInsurance')?.checked;
        gotoStep(4);
      });
    }

    // Стъпка 4: Фактура
    if (step === 4) {
      const invState = { ...(draft.invoice || {}), type: draft.invoice?.type === 'company' ? 'company' : 'individual' };
      const normSpaces = (v='') => v.replace(/\s+/g, ' ').trim();
      const setFieldState = (inputEl, res, showError) => {
        if (!inputEl) return;
        const holder = inputEl.parentElement || inputEl;
        const msgEl = holder.querySelector('.err-msg');
        if (msgEl) msgEl.remove();
        const hintEl = holder.querySelector('.field-hint');
        inputEl.classList.remove('error','valid');
        if (hintEl) hintEl.classList.remove('hint-error');
        if (res?.ok) {
          if (res.value !== '') inputEl.classList.add('valid');
        } else if (showError) {
          inputEl.classList.add('error');
          if (hintEl) hintEl.classList.add('hint-error');
        }
      };
      const errorMessagesInv = {
        name: {
          empty: 'Моля, въведете име и фамилия',
          invalid: 'Въведете поне 2 думи'
        },
        company: {
          empty: 'Моля, въведете име на фирмата',
          invalid: 'Поне 2 символа'
        },
        egn: {
          empty: 'Моля, въведете ЕГН',
          wrongLength: 'ЕГН трябва да съдържа 10 цифри',
          invalidDate: 'Невалидна дата в ЕГН',
          invalidChecksum: 'Невалидна контролна сума на ЕГН'
        },
        eik: {
          empty: 'Моля, въведете ЕИК',
          invalid: 'ЕИК трябва да е 9 или 13 цифри',
          invalidChecksum: 'Невалидна контролна сума на ЕИК'
        },
        vat: {
          invalid: 'BG + 9 или 10 цифри'
        },
        mol: {
          empty: 'Моля, въведете име на представляващо лице',
          invalid: 'Въведете поне 2 думи'
        },
        addr: {
          empty: 'Моля, въведете адрес',
          invalid: 'Поне 5 символа'
        },
        email: {
          empty: 'Моля, въведете имейл адрес',
          invalid: 'Моля, въведете валиден имейл адрес'
        },
        bank: {
          invalid: 'Поне 3 символа'
        },
        iban: {
          invalid: 'BG + 20 знака'
        },
        bic: {
          invalid: '8 или 11 символа'
        },
        bankDeps: {
          missingIban: 'IBAN е задължителен при попълнена банка',
          missingBic: 'BIC е задължителен при попълнена банка'
        }
      };

      const validatorsInv = {
        fullName(v) {
          const val = normSpaces(v);
          if (!val) return { ok:false, err:'empty', value:'' };
          const parts = val.split(' ').filter(Boolean);
          if (parts.length < 2) return { ok:false, err:'invalid', value:val };
          return { ok:true, value:val };
        },
        companyName(v) {
          const val = normSpaces(v);
          if (!val) return { ok:false, err:'empty', value:'' };
          if (val.length < 2) return { ok:false, err:'invalid', value:val };
          return { ok:true, value:val };
        },
        egn(v) {
          const digits = (v||'').replace(/\D/g,'');
          if (!digits) return { ok:false, err:'empty', value:'' };
          if (digits.length !== 10) return { ok:false, err:'wrongLength', value:digits };
          const year = Number(digits.slice(0,2));
          let month = Number(digits.slice(2,4));
          const day = Number(digits.slice(4,6));
          let century = 1900;
          if (month > 40) { month -= 40; century = 2000; }
          else if (month > 20) { month -= 20; century = 1800; }
          const fullYear = century + year;
          const date = new Date(fullYear, month - 1, day);
          if (month < 1 || month > 12 || day < 1 || day > 31 || date.getDate() !== day || date.getMonth()+1 !== month) {
            return { ok:false, err:'invalidDate', value:digits };
          }
          const weights = [2,4,8,5,10,9,7,3,6];
          let sum = 0;
          for (let i=0;i<9;i++) sum += Number(digits[i]) * weights[i];
          const checksum = sum % 11 === 10 ? 0 : sum % 11;
          if (checksum !== Number(digits[9])) return { ok:false, err:'invalidChecksum', value:digits };
          return { ok:true, value:digits };
        },
        eik(v) {
          const digits = (v||'').replace(/\D/g,'');
          if (!digits) return { ok:false, err:'empty', value:'' };
          if (!/^\d{9}$|^\d{13}$/.test(digits)) return { ok:false, err:'invalid', value:digits };
          if (digits.length === 9) {
            const w1 = [1,2,3,4,5,6,7,8];
            let sum = 0;
            for (let i=0;i<8;i++) sum += Number(digits[i]) * w1[i];
            let c = sum % 11;
            if (c === 10) {
              const w2 = [3,4,5,6,7,8,9,10];
              sum = 0;
              for (let i=0;i<8;i++) sum += Number(digits[i]) * w2[i];
              c = sum % 11;
            }
            if (c === 10) c = 0;
            if (c !== Number(digits[8])) return { ok:false, err:'invalidChecksum', value:digits };
          }
          return { ok:true, value:digits };
        },
        vat(v) {
          if (!v) return { ok:true, value:'' };
          const cleaned = v.replace(/\s/g,'').toUpperCase();
          const normalized = cleaned.startsWith('BG') ? cleaned : `BG${cleaned}`;
          if (!/^BG\d{9,10}$/.test(normalized)) return { ok:false, err:'invalid', value:normalized };
          const num = normalized.slice(2);
          if (num.length === 10) {
            const res = validatorsInv.egn(num);
            if (!res.ok) return { ok:false, err:'invalid', value:normalized };
          } else if (num.length === 9) {
            const res = validatorsInv.eik(num);
            if (!res.ok) return { ok:false, err:'invalid', value:normalized };
          }
          return { ok:true, value:normalized };
        },
        address(v) {
          const val = normSpaces(v);
          if (!val) return { ok:false, err:'empty', value:'' };
          if (val.length < 5) return { ok:false, err:'invalid', value:val };
          return { ok:true, value:val };
        },
        email(v) {
          const val = normSpaces(v).toLowerCase();
          if (!val) return { ok:false, err:'empty', value:'' };
          const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!re.test(val)) return { ok:false, err:'invalid', value:val };
          return { ok:true, value:val };
        },
        bank(v) {
          const val = normSpaces(v);
          if (!val) return { ok:true, value:'' };
          if (val.length < 3) return { ok:false, err:'invalid', value:val };
          return { ok:true, value:val };
        },
        iban(v) {
          let cleaned = (v||'').replace(/\s/g,'').toUpperCase();
          if (!cleaned) return { ok:true, value:'' };
          if (!cleaned.startsWith('BG')) cleaned = `BG${cleaned}`;
          if (!/^BG\d{2}[A-Z]{4}\d{14}$/.test(cleaned)) return { ok:false, err:'invalid', value:cleaned };
          const rearr = cleaned.slice(4) + cleaned.slice(0,4);
          const toNum = rearr.split('').map(ch => {
            const code = ch.charCodeAt(0);
            return code >= 65 && code <= 90 ? String(code - 55) : ch;
          }).join('');
          let remainder = 0n;
          for (const ch of toNum) {
            remainder = (remainder * 10n + BigInt(ch)) % 97n;
          }
          if (remainder !== 1n) return { ok:false, err:'invalid', value:cleaned };
          return { ok:true, value:cleaned };
        },
        bic(v) {
          const val = (v||'').replace(/\s/g,'').toUpperCase();
          if (!val) return { ok:true, value:'' };
          if (!/^[A-Z]{4}BG[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(val)) return { ok:false, err:'invalid', value:val };
          return { ok:true, value:val };
        }
      };

      const fieldsInv = {
        individual: {
          name: $('#iNameInd'),
          egn: $('#iEgn'),
          addr: $('#iAddrInd'),
          email: $('#iEmailInd')
        },
        company: {
          name: $('#iNameCo'),
          eik: $('#iNumCo'),
          vat: $('#iVatCo'),
          mol: $('#iMolCo'),
          addr: $('#iAddrCo'),
          email: $('#iEmailCo'),
          bank: $('#iBankCo'),
          iban: $('#iIbanCo'),
          bic: $('#iBicCo')
        }
      };
      const touchedInv = {
        individual: { name:false, egn:false, addr:false, email:false },
        company: { name:false, eik:false, vat:false, mol:false, addr:false, email:false, bank:false, iban:false, bic:false }
      };

      const runInvValidation = (type, key, showError=false) => {
        const input = fieldsInv[type][key];
        if (!input) return { ok:true };
        let res;
        switch (key) {
          case 'name': res = type === 'individual' ? validatorsInv.fullName(input.value) : validatorsInv.companyName(input.value); break;
          case 'egn': res = validatorsInv.egn(input.value); break;
          case 'eik': res = validatorsInv.eik(input.value); break;
          case 'vat': res = validatorsInv.vat(input.value); break;
          case 'mol': res = validatorsInv.fullName(input.value); break;
          case 'addr': res = validatorsInv.address(input.value); break;
          case 'email': res = validatorsInv.email(input.value); break;
          case 'bank': res = validatorsInv.bank(input.value); break;
          case 'iban': res = validatorsInv.iban(input.value); break;
          case 'bic': res = validatorsInv.bic(input.value); break;
          default: res = { ok:true, value:input.value };
        }
        const msgMap = errorMessagesInv[key] || {};
        const message = res.ok ? '' : (msgMap[res.err] || msgMap.invalid || msgMap.empty);
        setFieldState(input, { ...res, message }, showError);
        return res;
      };

      const validateInvoice = (showErrors=false) => {
        const type = invState.type === 'company' ? 'company' : 'individual';
        const values = {};
        let ok = true;
        if (type === 'individual') {
          ['name','egn','addr','email'].forEach(k => {
            const res = runInvValidation('individual', k, showErrors);
            if (!res.ok) ok = false;
            if (res.ok) values[k] = res.value;
          });
        } else {
          ['name','eik','vat','mol','addr','email','bank','iban','bic'].forEach(k => {
            const res = runInvValidation('company', k, showErrors);
            if (!res.ok) ok = false;
            if (res.ok) values[k] = res.value;
          });
          if (values.bank) {
            if (!values.iban) { ok = false; if (showErrors) setFieldState(fieldsInv.company.iban, { ok:false, message:errorMessagesInv.bankDeps.missingIban }); }
            if (!values.bic) { ok = false; if (showErrors) setFieldState(fieldsInv.company.bic, { ok:false, message:errorMessagesInv.bankDeps.missingBic }); }
          }
        }
        if (!ok && showErrors) scrollToError();
        return { ok, values };
      };

      const collectErrorMessages = () => {
        const type = invState.type === 'company' ? 'company' : 'individual';
        const keys = type === 'individual'
          ? ['name','egn','addr','email']
          : ['name','eik','vat','mol','addr','email','bank','iban','bic'];
        const errors = [];
        keys.forEach(k => {
          const res = runInvValidation(type, k, false);
          if (!res.ok) {
            const map = errorMessagesInv[k] || {};
            const msg = map[res.err] || map.invalid || map.empty;
            if (msg) errors.push(msg);
          }
        });
        if (type === 'company') {
          const bankVal = (fieldsInv.company.bank?.value || '').trim();
          const ibanVal = (fieldsInv.company.iban?.value || '').trim();
          const bicVal = (fieldsInv.company.bic?.value || '').trim();
          if (bankVal) {
            if (!ibanVal) errors.push(errorMessagesInv.bankDeps.missingIban);
            if (!bicVal) errors.push(errorMessagesInv.bankDeps.missingBic);
          }
        }
        return errors;
      };

      const bindInvField = (type, key) => {
        const input = fieldsInv[type][key];
        if (!input) return;
        input.addEventListener('blur', () => {
          touchedInv[type][key] = true;
          runInvValidation(type, key, true);
          updateConfirmBtn();
        });
        input.addEventListener('input', () => {
          runInvValidation(type, key, touchedInv[type][key]);
          updateConfirmBtn();
        });
      };

      const updateConfirmBtn = () => {
        // Button always enabled — errors shown on click
      };

      Object.keys(fieldsInv.individual).forEach(k => bindInvField('individual', k));
      Object.keys(fieldsInv.company).forEach(k => bindInvField('company', k));

      $$('input[name="invType"]').forEach(r => r.onchange = () => {
        invState.type = r.value;
        $('#invIndividual').style.display = r.value === 'company' ? 'none' : 'grid';
        $('#invCompany').style.display = r.value === 'company' ? 'grid' : 'none';
        // Update radio button active state
        $$('.wz-radio').forEach(lbl => lbl.classList.remove('wz-radio-active'));
        r.closest('.wz-radio')?.classList.add('wz-radio-active');
        updateConfirmBtn();
      });
      $('#backToExtras')?.addEventListener('click', () => gotoStep(3));
      $('#nextToTerms')?.addEventListener('click', async () => {
        const res = validateInvoice(true);
        if (!res.ok) return;
        if (invState.type === 'company') {
          draft.invoice = {
            type: 'company',
            name: res.values.name,
            num: res.values.eik,
            vat: res.values.vat || '',
            mol: res.values.mol,
            addr: res.values.addr,
            email: res.values.email,
            bank: res.values.bank || '',
            iban: res.values.iban || '',
            bic: res.values.bic || ''
          };
        } else {
          draft.invoice = {
            type: 'individual',
            name: res.values.name,
            egn: res.values.egn,
            addr: res.values.addr,
            email: res.values.email,
            num: null, vat: null, mol: null, bank: null, iban: null, bic: null
          };
        }
        // Save invoice data and go to terms acceptance
        gotoStep(5);
      });
      updateConfirmBtn();
    }

    // Стъпка 5: Приемане на условия
    if (step === 5) {
      const allBoxes = ['#chkTerms','#chkCancel','#chkInsurancePol','#chkPrivacy'];
      const updateTermsBtn = () => {
        const btn = $('#confirm');
        const allChecked = allBoxes.every(sel => $(sel)?.checked);
        if (btn) btn.disabled = !allChecked;
        const err = $('#termsError');
        if (err) err.style.display = 'none';
      };
      allBoxes.forEach(sel => { $(sel)?.addEventListener('change', () => {
        const el = $(sel); if (el) el.closest('.wz-terms-item')?.classList.toggle('checked', el.checked);
        updateTermsBtn();
      }); });
      $('#backToInvoice')?.addEventListener('click', () => gotoStep(4));
      $('#confirm')?.addEventListener('click', async () => {
        const allChecked = allBoxes.every(sel => $(sel)?.checked);
        if (!allChecked) {
          const err = $('#termsError');
          if (err) { err.textContent = 'Моля, приемете всички условия, за да продължите.'; err.style.display = 'block'; }
          return;
        }
        draft.termsAccepted = true;
        draft.status = 'pending';
        const payload = {
          carId: car.id,
          from: draft.from || new Date().toISOString(),
          to: draft.to || new Date(Date.now()+3*3600e3).toISOString(),
          pickPlace: draft.pick, dropPlace: draft.drop,
          driver: draft.driver, invoice: draft.invoice,
          extraDriver: !!draft.extraDriver,
          insurance: !!draft.insurance
        };
        try {
          const btn = $('#confirm');
          if (btn) { btn.disabled = true; btn.textContent = 'Изпращане...'; }
          const created = await apiFetch('/api/reservations', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          storage.set(draftKey, null);
          gotoStep(6, { id: created?.id || draft.id });
        } catch {
          const saved = storage.get('cr_reservations', []);
          saved.push({ ...draft, createdAt: new Date().toISOString(), pricePerDay: car.pricePerDay });
          storage.set('cr_reservations', saved);
          gotoStep(6, { id: draft.id });
        }
      });
    }

    // Step 6: PDF download button
    if (step === 6) {
      const pdfBtn = $('#downloadProformaPdf');
      if (pdfBtn) pdfBtn.onclick = async () => {
        const msg = $('#pdfLoadingMsg');
        if (msg) msg.style.display = 'block';
        pdfBtn.disabled = true;
        // Open window synchronously so popup blockers don't interfere
        const printWin = window.open('', '_blank', 'width=900,height=700');
        try {
          const reservation = await apiFetch(`/api/reservations/${_resId}`);
          const invoices = reservation?.invoices || [];
          const invoice = invoices.find(i => i.type === 'PROFORMA') || invoices[0] || null;
          const company = companyInfo || (await apiFetch('/api/company'));
          const fullHTML = buildProformaStandaloneHTML({ reservation, invoice, company });
          if (printWin) {
            printWin.document.write(fullHTML);
            printWin.document.close();
            printWin.onload = () => { printWin.focus(); printWin.print(); };
          }
        } catch (err) {
          console.error('[proforma-pdf]', err);
          if (printWin) printWin.close();
          alert('Грешка при генериране на проформата. Моля опитайте отново.');
        }
        pdfBtn.disabled = false;
        if (msg) msg.style.display = 'none';
      };
    }
  }

  /* Admin Panel */
  function mountAdminIfNeeded(isAdmin = true) {
    if (isAdmin) mountAdminLayout();
  }

  /** Render admin login page */
  function renderAdminLogin() {
    app.className = 'landing-wrap';
    app.innerHTML = `
      ${siteHeaderHTML('admin')}
      <div class="admin-login-wrap">
        <div class="admin-login-card">
          <div class="admin-login-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z"/>
              <path d="M20 21c0-3.31-3.58-6-8-6s-8 2.69-8 6"/>
            </svg>
          </div>
          <h1 class="admin-login-title">Вход за администратор</h1>
          <p class="admin-login-subtitle">Моля, въведете вашите данни за достъп</p>
          <form id="adminLoginForm" class="admin-login-form">
            <div class="admin-login-field">
              <label for="adminUser">Потребител</label>
              <input type="text" id="adminUser" class="input" placeholder="Потребителско име" autocomplete="username" required>
            </div>
            <div class="admin-login-field">
              <label for="adminPass">Парола</label>
              <input type="password" id="adminPass" class="input" placeholder="Парола" autocomplete="current-password" required>
            </div>
            <div id="loginError" class="admin-login-error" style="display:none;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Грешно потребителско име или парола
            </div>
            <button type="submit" class="btn-primary admin-login-btn">Вход</button>
          </form>
          <a href="#/" class="admin-login-back">&larr; Към началната страница</a>
        </div>
      </div>
      ${siteFooterHTML()}
    `;
    bindHamburger();

    const form = $('#adminLoginForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const user = $('#adminUser').value.trim();
      const pass = $('#adminPass').value;
      const btn = form.querySelector('.admin-login-btn');
      btn.disabled = true;
      btn.textContent = 'Проверка...';
      const result = await loginAdmin(user, pass);
      btn.disabled = false;
      btn.textContent = 'Вход';
      if (result.ok) {
        location.hash = '#/admin';
        renderRoute();
      } else {
        const err = $('#loginError');
        if (result.locked) {
          err.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Твърде много неуспешни опити. Опитайте отново след ${result.seconds} сек.`;
        } else {
          err.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Грешно потребителско име или парола (остават ${result.remaining ?? 0} опита)`;
        }
        err.style.display = 'flex';
        $('#adminPass').value = '';
        $('#adminPass').focus();
      }
    };
    // Auto-focus username
    $('#adminUser').focus();
    // Show lockout message if already locked
    if (_isLoginLocked()) {
      const err = $('#loginError');
      err.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        Твърде много неуспешни опити. Опитайте отново след ${_getLockRemainingSeconds()} сек.`;
      err.style.display = 'flex';
    }
  }
  function adminNav(active) {
    return `
      <div class="header">
        <h2>Административен панел</h2>
        <button class="btn-logout" onclick="(${logoutAdmin.toString()})()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Изход
        </button>
      </div>
      <div class="panel" style="padding:12px; margin:12px 0;">
        <div class="toolbar" style="border:0; padding:0;">
          <a class="tag ${active==='dashboard'?'':'pill'}" href="#/admin">Дашборд</a>
          <a class="tag ${active==='cars'?'':'pill'}" href="#/admin/cars">Коли</a>
          <a class="tag ${active==='params'?'':'pill'}" href="#/admin/params">Параметри</a>
          <a class="tag ${active==='settings'?'':'pill'}" href="#/admin/settings">Настройки</a>
          <a class="tag ${active==='reservations'?'':'pill'}" href="#/admin/reservations">Резервации</a>
          <a class="tag ${active==='invoices'?'':'pill'}" href="#/admin/invoices">Фактури</a>
          <a class="tag ${active==='policies'?'':'pill'}" href="#/admin/policies">Политики</a>
          <a class="tag ${active==='images'?'':'pill'}" href="#/admin/images">Снимки</a>
          <a class="tag ${active==='newsletter'?'':'pill'}" href="#/admin/newsletter">Бюлетин</a>
        </div>
      </div>
    `;
  }
  function renderAdminDashboard() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let range = { from: monthStart.toISOString().slice(0,10), to: now.toISOString().slice(0,10) };
    root.innerHTML = adminNav('dashboard') + `
      <div class="panel" style="padding:16px; display:grid; gap:12px;">
        <div class="grid-3">
          <div>
            <div class="section-title">Период</div>
            <div class="grid-2">
              <input id="dashFrom" type="date" class="input" value="${range.from}">
              <input id="dashTo" type="date" class="input" value="${range.to}">
            </div>
          </div>
          <div></div><div></div>
        </div>
        <div class="grid-3" id="dashStats"></div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Платени резервации (период)</div>
          <table class="table">
            <thead><tr><th>№</th><th>Кола</th><th>Клиент</th><th>Сума (с ДДС)</th><th>От</th><th>До</th></tr></thead>
            <tbody id="paidRows">
              <tr><td colspan="6">Зареждане...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Очакващи одобрение</div>
          <table class="table">
            <thead><tr><th>№</th><th>Кола</th><th>Клиент</th><th>Статус</th><th></th></tr></thead>
            <tbody id="pendingRows">
              <tr><td colspan="5">Зареждане...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    const renderStats = (reservations=[], carsCount=0) => {
      const f = new Date(range.from); const t = new Date(range.to); t.setHours(23,59,59,999);
      const inPeriod = (r) => {
        const start = new Date(r.from || r.createdAt || Date.now());
        const end = new Date(r.to || r.from || r.createdAt || Date.now());
        if (isNaN(start) || isNaN(end)) return false;
        return start <= t && end >= f; // интерсект с периода
      };
      const inRange = reservations.filter(inPeriod);
      const paidOrCompleted = inRange.filter(r => ['PAID','COMPLETED'].includes((r.status||'').toUpperCase()));
      const paidList = inRange.filter(r => (r.status||'').toUpperCase() === 'PAID');
      const count = inRange.length;
      const turnover = paidOrCompleted.reduce((s,r) => s + Number(r.total||0), 0);
      const paid = paidOrCompleted.length;
      const pending = inRange.filter(r => (r.status||'').toUpperCase() === 'REQUESTED').length;
      const declined = inRange.filter(r => ['DECLINED','CANCELLED'].includes((r.status||'').toUpperCase())).length;
      $('#dashStats').innerHTML = `
        <div class="panel" style="padding:14px;">
          <div class="section-title">Общ брой резервации</div>
          <h2><a href="#/admin/reservations" style="color:inherit;text-decoration:none;">${count}</a></h2>
        </div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Платени / Изпълнени</div>
          <h2><a href="#/admin/reservations" style="color:inherit;text-decoration:none;">${paid}</a></h2>
        </div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Чакащи одобрение</div>
          <h2><a href="#/admin/reservations" style="color:inherit;text-decoration:none;">${pending}</a></h2>
        </div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Отказани</div>
          <h2><a href="#/admin/reservations" style="color:inherit;text-decoration:none;">${declined}</a></h2>
        </div>
        <div class="panel" style="padding:14px;">
          <div class="section-title">Оборот (с ДДС)</div>
          <h2><a href="#/admin/invoices" style="color:inherit;text-decoration:none;">€${turnover.toFixed(2)}</a></h2>
        </div>
      `;
    };
    const fetchData = async () => {
      try {
        const [reservations, carsList] = await Promise.all([
          apiFetch('/api/reservations'),
          apiFetch('/api/cars')
        ]);
        renderStats(reservations, carsList?.length || 0);
        const f = new Date(range.from); const t = new Date(range.to); t.setHours(23,59,59,999);
        const inPeriod = (r) => {
          const start = new Date(r.from || r.createdAt || Date.now());
          const end = new Date(r.to || r.from || r.createdAt || Date.now());
          if (isNaN(start) || isNaN(end)) return false;
          return start <= t && end >= f;
        };
        const inRange = (reservations||[]).filter(inPeriod);
        const paid = inRange.filter(r => (r.status||'').toUpperCase() === 'PAID');
        const pending = inRange.filter(r => (r.status||'').toUpperCase() === 'REQUESTED');
        const paidTbody = $('#paidRows');
        if (paidTbody) {
          paidTbody.innerHTML = paid.length
            ? paid.map(p => `<tr>
                <td>${escHtml(p.seq ?? '')}</td>
                <td>${escHtml(p.car?.brand||'')} ${escHtml(p.car?.model||'')}</td>
                <td>${escHtml(p.driverName||'')}</td>
                <td>€${Number(p.total||0).toFixed(2)}</td>
                <td>${fmtDate(p.from)}</td>
                <td>${fmtDate(p.to)}</td>
              </tr>`).join('')
            : '<tr><td colspan="6">Няма платени резервации за периода.</td></tr>';
        }
        const pendTbody = $('#pendingRows');
        if (pendTbody) {
          pendTbody.innerHTML = pending.length
            ? pending.map(p => `<tr>
                <td>${escHtml(p.seq ?? '')}</td>
                <td>${escHtml(p.car?.brand||'')} ${escHtml(p.car?.model||'')}</td>
                <td>${escHtml(p.driverName||'')}</td>
                <td><span class="tag">Заявка</span></td>
                <td><a class="btn-secondary" href="#/admin/reservations" style="height:32px;display:grid;place-items:center;">Управление</a></td>
              </tr>`).join('')
            : '<tr><td colspan="5">Няма чакащи резервации.</td></tr>';
        }
      } catch {
        renderStats([], 0);
      }
    };
    fetchData();
    const syncRange = () => {
      range = { from: $('#dashFrom').value || range.from, to: $('#dashTo').value || range.to };
      fetchData();
    };
    $('#dashFrom').onchange = syncRange;
    $('#dashTo').onchange = syncRange;
  }
  function renderAdminCars() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('cars') + `
      <div class="panel" style="padding:16px; display:grid; gap:12px;">
        <div class="toolbar" style="padding:0; border:0;">
          <button class="btn-primary" id="addCar">Добави кола</button>
          <div style="margin-left:auto;"></div>
        </div>
        <table class="table">
          <thead><tr><th>Марка</th><th>Модел</th><th>Тип</th><th>Цена/ден с ДДС (€)</th><th>Статус</th><th></th></tr></thead>
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
          <td>${escHtml(c.brand)}</td><td>${escHtml(c.model)}</td><td>${escHtml(c.type)}</td><td>€${c.pricePerDay||0}</td>
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
      const car = existing || { id: uid(), brand:'', model:'', trim:'', pricePerDay:0, type:'', status:'наличен', images: [] };
      let isNew = !existing;
      let _apiLoaded = isNew; // track whether we have raw API data (new cars don't need it)
      async function loadCarFromApi() {
        // Винаги зареждаме свежи данни от API (списъкът може да няма images и други полета)
        try {
          const apiCar = await fetch(`${API_BASE}/api/cars/${id}`).then(r => r.json());
          Object.assign(car, apiCar);
          _apiLoaded = true;
        } catch {
          // If API fails for existing car, flag it so we can block save (prevents displayVal corruption)
          if (!isNew) _apiLoaded = false;
        }
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
          <div class="panel" style="padding:16px; display:grid; gap:12px;">
            <div class="grid-3">
              <input id="cBrand" class="input" placeholder="Марка" value="${car.brand}">
              <input id="cModel" class="input" placeholder="Модел" value="${car.model}">
              <select id="cStatus" class="select">
                <option value="AVAILABLE" ${['наличен','AVAILABLE'].includes(car.status)?'selected':''}>Наличен</option>
                <option value="SERVICE" ${['в сервиз','SERVICE'].includes(car.status)?'selected':''}>В сервиз</option>
              </select>
            </div>
            <div class="grid-3">
              <div>
                <div class="section-title">Цена на ден с ДДС (€)</div>
                <input id="cPriceDay" type="number" class="input" placeholder="€ (с ДДС)" value="${car.pricePerDay ?? ''}">
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
              <a class="btn-secondary" href="#/admin/cars" style="text-decoration:none; display:grid; place-items:center; height:44px;">Отказ</a>
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
                  ? `<img src="${src}" alt="Снимка на кола" loading="lazy" style="width:100%;height:120px;object-fit:cover;">`
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
          const saveBtn = $('#saveCar');
          try {
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Създаване...'; }
            if (!car.id || isNew) {
              // create car first
              await saveBasics(true);
            }
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            const fd = new FormData();
            files.forEach(f => fd.append('images', f));
            await fetch(`${API_BASE}/api/cars/${car.id}/images`, { method: 'POST', body: fd, headers: authHeaders() }).then(r => r.json());
            const fresh = await fetch(`${API_BASE}/api/cars/${car.id}`, { headers: authHeaders({ accept: 'application/json' }) }).then(r=>r.json());
            car.images = fresh.images || [];
            renderImages();
            e.target.value = '';
          } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Запази'; }
          }
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
        let _creatingPromise = null;
        async function saveBasics(creating=false) {
          // If a creation is already in progress, wait for it to finish first
          // This prevents race conditions between image upload and save button
          if (_creatingPromise) {
            await _creatingPromise;
          }
          Object.assign(car, {
            brand: $('#cBrand').value, model: $('#cModel').value,
            pricePerDay: $('#cPriceDay').value !== '' ? Number($('#cPriceDay').value) : null,
            status: $('#cStatus').value
          });
          if (creating && isNew) {
            _creatingPromise = (async () => {
              const created = await apiFetch('/api/cars', { method: 'POST', body: JSON.stringify(car) });
              car.id = created.id;
              isNew = false;
            })();
            try {
              await _creatingPromise;
            } finally {
              _creatingPromise = null;
            }
          } else if (car.id && !isNew) {
            await apiFetch(`/api/cars/${car.id}`, { method: 'PUT', body: JSON.stringify(car) });
          }
        }
        let _saving = false;
        $('#saveCar').onclick = async () => {
          if (_saving) return; // Prevent double-click
          _saving = true;
          const btn = $('#saveCar');
          btn.disabled = true; const prevText = btn.textContent; btn.textContent = 'Запис...';
          try {
            if (!$('#cBrand').value.trim() || !$('#cModel').value.trim()) throw new Error('Моля, попълнете Марка и Модел');
            if (!isNew && !_apiLoaded) throw new Error('Не успяхме да заредим данни от сървъра. Моля, опреснете страницата и опитайте отново.');
            // Sync car fields from dynamic params before saving basics
            // 1. Sync car.type from "Тип кола" / "Вид кола"
            const vidKolaDef = defs.find(d => isCarTypeParam(d.name))
              || defs.find(d => d.type === 'ENUM' && /тип|вид|категория|клас/i.test(d.name) && !/горив|fuel|скорост|transm/i.test(d.name));
            if (vidKolaDef) {
              const el = $(`[data-param="${vidKolaDef.id}"]`);
              if (el) car.type = el.value || '';
            }
            // 2. Sync car.transmission from "Скоростна кутия" etc.
            const gearParamDef = defs.find(d => isGearParam(d.name));
            if (gearParamDef) {
              const el = $(`[data-param="${gearParamDef.id}"]`);
              if (el && el.value) car.transmission = el.value;
            }
            // 3. Sync car.fuel from "Гориво" etc.
            const fuelParamDef = defs.find(d => isFuelParam(d.name));
            if (fuelParamDef) {
              const el = $(`[data-param="${fuelParamDef.id}"]`);
              if (el && el.value) car.fuel = el.value;
            }
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
            // Clear params cache so detail modals get fresh data
            carParamsCache.delete(car.id);
            // Ensure cars array is fresh before navigating to list
            await refreshCars();
            navigate('#/admin/cars');
          } catch (e) {
            alert(e.message || 'Грешка при запис.');
          } finally {
            _saving = false;
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
      <div class="panel" style="padding:16px; display:grid; gap:12px;">
        <div class="toolbar" style="padding:0; border:0;">
          <button class="btn-primary" id="addParam">Добави параметър</button>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <input id="paramSearch" class="input" placeholder="Търсене по име" style="width:220px;">
          </div>
        </div>
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
                <option value="" ${param?.type ? '' : 'selected'} disabled>Изберете тип</option>
                <option value="ENUM" ${param?.type==='ENUM'?'selected':''}>опции</option>
                <option value="NUMBER" ${param?.type==='NUMBER'?'selected':''}>число</option>
                <option value="TEXT" ${param?.type==='TEXT'?'selected':''}>текст</option>
              </select>
            </div>
          </div>
          <div id="optsWrap">
            <div class="section-title" id="optsLabel">${param?.type==='ENUM'?'Опции (разделени със ,)':'Мерна единица (за number)'}</div>
            <textarea id="pOptions" class="textarea" placeholder="">${optsText || ''}</textarea>
          </div>
          <div id="err" style="color:#b42318;font-size:13px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel">Затвори</button>
          <button class="btn-primary" id="save">Запази</button>
        </div>
      `;
      showModal(html, (wrap, close) => {
        const optsWrap = $('#optsWrap', wrap);
        const optsArea = $('#pOptions', wrap);
        const setOptsLabel = () => {
          const type = $('#pType', wrap).value;
          if (type === 'ENUM') {
            $('#optsLabel', wrap).textContent = 'Опции (разделени със ,)';
            optsArea.placeholder = 'например: Опция 1, Опция 2, Опция 3';
            optsWrap.style.display = 'block';
          } else if (type === 'NUMBER') {
            $('#optsLabel', wrap).textContent = 'Мерна единица (за number)';
            optsArea.placeholder = 'например: к.с., kWh, кг';
            optsWrap.style.display = 'block';
          } else {
            optsWrap.style.display = 'none';
            optsArea.value = '';
          }
        };
        $('#pType', wrap).onchange = setOptsLabel; setOptsLabel();
        $('#cancel', wrap).onclick = close;
        $('#save', wrap).onclick = async () => {
          const payload = {
            name: $('#pName', wrap).value.trim(),
            type: $('#pType', wrap).value,
          };
          const raw = $('#pOptions', wrap).value.trim();
          if (!payload.name) { $('#err', wrap).textContent = 'Името е задължително'; return; }
          if (!payload.type) { $('#err', wrap).textContent = 'Изберете тип'; return; }
          if (payload.type === 'ENUM') {
            payload.options = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
            if (!payload.options.length) { $('#err', wrap).textContent = 'Добавете поне една опция'; return; }
          }
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
          <td>${p.type==='ENUM'?'опции':p.type}</td>
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
    const params = new URLSearchParams((location.hash.split('?')[1] || ''));
    const focusId = params.get('id');
    let dataRows = [];
    root.innerHTML = adminNav('reservations') + `
      <div class="panel" style="padding:16px;">
        <table class="table">
          <thead>
            <tr>
              <th>№</th>
              <th>Кола</th>
              <th>Клиент</th>
              <th>Период</th>
              <th>Дни</th>
              <th>Сума (с ДДС)</th>
              <th>Фактури</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody id="resRows"></tbody>
        </table>
      </div>
    `;
    const latestByType = (inv = [], type) => {
      const norm = (t) => (t || '').toString().toUpperCase();
      const filtered = (inv || []).filter(x => norm(x.type) === norm(type));
      if (!filtered.length) return null;
      return filtered.sort((a,b) => new Date(a.issueDate||a.createdAt||0) - new Date(b.issueDate||b.createdAt||0)).pop();
    };
    const latestAny = (inv = []) => {
      if (!inv?.length) return null;
      return [...inv].sort((a,b) => new Date(a.issueDate||a.createdAt||0) - new Date(b.issueDate||b.createdAt||0)).pop();
    };
    const renderRows = (rs=[]) => {
      const mergeMap = new Map();
      const dayKey = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt)) return '';
        return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      };
      (rs||[]).forEach(r => {
        const key = `${r.seq || ''}-${r.carId || ''}-${dayKey(r.from)}-${dayKey(r.to)}-${(r.driverName||'').trim().toLowerCase()}`;
        if (!mergeMap.has(key)) {
          mergeMap.set(key, { ...r, invoices: r.invoices || [] });
        } else {
          const cur = mergeMap.get(key);
          cur.invoices = [...(cur.invoices||[]), ...(r.invoices||[])];
        }
      });
      const merged = Array.from(mergeMap.values());
      dataRows = merged;
      $('#resRows').innerHTML = merged.map((r, idx) => {
        const pro = latestByType(r.invoices, 'PROFORMA') || latestByType(r.invoices, 'PRO');
        const inv = latestByType(r.invoices, 'INVOICE') || latestAny(r.invoices);
        const fmtInvDate = (x) => fmtDate(x?.issueDate || x?.createdAt || x?.updatedAt || '');
        const fmtInvNum = (x) => x?.number || '(без номер)';
        const days = (() => { const a=new Date(r.from), b=new Date(r.to); const d=Math.max(1, Math.ceil((b-a)/86400000)); return d; })();
        const period = `${fmtDate(r.from)}<br>${fmtDate(r.to)}`;
        const invoiceCell = `
          ${pro ? `<a href="#/admin/invoices?id=${r.id}" class="link">${fmtInvNum(pro)}</a>` : '—'}
          ${inv ? `<br><a href="#/admin/invoices?id=${r.id}" class="link">${fmtInvNum(inv)}</a>` : ''}
        `;
        const seqVal = (r.seq ?? r.id ?? (idx+1));
        return `
        <tr data-res="${r.id}" class="row-status-${r.status}">
          <td>${seqVal}</td>
          <td>${escHtml((r.car?.brand||'').trim())} ${escHtml((r.car?.model||'').trim() || r.carId || '')}</td>
          <td>${escHtml(r.driverName||r.driver?.name||'')}</td>
          <td>${period}</td>
          <td>${days}</td>
          <td>${r.total ? `€${Number(r.total).toFixed(2)}` : '—'}</td>
          <td>${invoiceCell}</td>
          <td><select class="select" data-status="${r.id}" style="height:32px;">
              ${RES_STATUS.map(s => `<option value="${s.value}" ${r.status===s.value?'selected':''}>${s.label}</option>`).join('')}
          </select></td>
        </tr>
      `;
      }).join('');
      $$('[data-status]').forEach(s => s.onchange = async () => {
        const id = s.getAttribute('data-status');
        const status = s.value;
        const oldStatus = s.getAttribute('data-old-status') || s.querySelector('option[selected]')?.value;
        // update local state for instant UI change
        const row = dataRows.find(x => x.id === id);
        if (row) row.status = status;
        renderRows(dataRows);
        try {
          await apiFetch(`/api/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
        } catch (e) {
          // Revert on error and show message
          if (row) row.status = oldStatus || 'REQUESTED';
          renderRows(dataRows);
          alert('Грешка при промяна на статус: ' + (e.message || 'Невалиден преход'));
        }
      });
      $$('tr[data-res]').forEach(row => row.onclick = (e) => {
        if (e.target.closest('select') || e.target.closest('button') || e.target.closest('a')) return;
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
        if (focusId) openReservationModal(focusId);
      } catch {
        const rs = storage.get('cr_reservations', []);
        renderRows(rs);
        if (focusId) openReservationModal(focusId);
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
              <div><strong>№:</strong> ${escHtml(r.seq ?? '')}</div>
              <div><strong>Кола:</strong> ${escHtml(r.car?.brand||'')} ${escHtml(r.car?.model||r.carId||'')}</div>
              <div><strong>Период:</strong> ${fmtDate(r.from)} → ${fmtDate(r.to)} (${days} дни)</div>
              <div><strong>Взимане:</strong> ${escHtml(r.pickPlace || '')}</div>
              <div><strong>Връщане:</strong> ${escHtml(r.dropPlace || '')}</div>
              <div><strong>Шофьор:</strong> ${escHtml(r.driverName||'')}, тел: ${escHtml(r.driverPhone||'')}, имейл: ${escHtml(r.driverEmail||'')}</div>
              <div><strong>Статус:</strong> ${escHtml(statusLabel(r.status))}</div>
              <div><strong>Сума:</strong> ${r.total ? '€'+escHtml(r.total) : '—'}</div>
              <hr>
              <div><strong>${r.status==='paid' ? 'Фактура' : 'Проформа'}</strong> (${escHtml(r.invoiceType || '')})</div>
              ${r.invoiceType==='company' ? `
                <div>Фирма: ${escHtml(r.invoiceName||'')}</div>
                <div>ЕИК: ${escHtml(r.invoiceNum||'')} ДДС: ${escHtml(r.invoiceVat||'')}</div>
                <div>МОЛ: ${escHtml(r.invoiceMol||'')}</div>
                <div>Адрес: ${escHtml(r.invoiceAddr||'')}</div>
                <div>Имейл: ${escHtml(r.invoiceEmail||'')}</div>
                <div>Банка: ${escHtml(r.invoiceBank||'')}</div>
                <div>IBAN: ${escHtml(r.invoiceIban||'')}</div>
                <div>BIC: ${escHtml(r.invoiceBic||'')}</div>
              ` : `
                <div>Име: ${escHtml(r.invoiceName||'')}</div>
                <div>ЕГН: ${escHtml(r.invoiceEgn||'')}</div>
                <div>Адрес: ${escHtml(r.invoiceAddr||'')}</div>
                <div>Имейл: ${escHtml(r.invoiceEmail||'')}</div>
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
      <div class="panel" style="padding:16px; margin-bottom:12px;">
        <div class="header" style="padding:0 0 12px 0; border:0;"><h2>Списък фактури/проформи</h2></div>
        <table class="table">
          <thead>
            <tr><th>Номер</th><th>Тип</th><th>Дата</th><th>Получател</th><th>Резервация</th><th></th></tr>
            <tr>
              <th><div class="ta-wrap"><input id="fInvNum" class="input" placeholder="Филтър"/></div></th>
              <th><div class="ta-wrap"><input id="fInvType" class="input" placeholder="Фактура/Проформа"/></div></th>
              <th><div class="ta-wrap"><input id="fInvDate" class="input" placeholder="ГГГГ-ММ-ДД" type="date"/></div></th>
              <th><div class="ta-wrap"><input id="fInvBuyer" class="input" placeholder="Получател"/></div></th>
              <th><div class="ta-wrap"><input id="fInvRes" class="input" placeholder="Резервация"/></div></th>
              <th></th>
            </tr>
          </thead>
          <tbody id="invList"></tbody>
        </table>
      </div>
      <div class="header"><h2>Проформа / Фактура</h2></div>
      ${resId ? `<div id="invEditor" class="panel" style="padding:16px;">Зареждане...</div>` : `<div class="panel" style="padding:16px;">Изберете резервация от списъка с резервации, за да редактирате проформа/фактура.</div>`}
    `;
    let companyCache = null;
    async function loadCompanyCache() {
      try { companyCache = await apiFetch('/api/company'); } catch { companyCache = null; }
    }
    loadCompanyCache();
    // списък с фактури
    (async () => {
      try {
        const [list, resList] = await Promise.all([
          apiFetch('/api/invoices'),
          apiFetch('/api/reservations').catch(() => [])
        ]);
        const resMap = new Map((resList||[]).map(r => [String(r.id), r]));
        const viewList = (list||[]).map(inv => {
          const dt = inv.issueDate ? fmtDate(inv.issueDate) : '';
          const dateIso = inv.issueDate ? inv.issueDate.slice(0,10) : '';
          const t = (inv.type || '').toString().toUpperCase();
          const typeLabel = t.includes('INV') ? 'Фактура' : 'Проформа';
          const resObj = resMap.get(String(inv.reservationId));
          const resLabel = resObj?.seq ?? resObj?.id ?? inv.reservationId ?? '';
          const buyerName = inv.buyerName || resObj?.invoiceName || resObj?.driverName || '';
          return { ...inv, _dt: dt, _dateIso: dateIso, _typeLabel: typeLabel, _resLabel: resLabel, _buyerName: buyerName };
        });

        const filters = { num:'', type:'', date:'', buyer:'', res:'' };
        const optNum = Array.from(new Set(viewList.map(i => i.number || '').filter(Boolean)));
        const optType = ['Фактура','Проформа'];
        const optDate = Array.from(new Set(viewList.map(i => i._dateIso).filter(Boolean)));
        const optBuyer = Array.from(new Set(viewList.map(i => i._buyerName || '').filter(Boolean)));
        const optRes = Array.from(new Set(viewList.map(i => i._resLabel || '').filter(Boolean)));

        const pass = (inv) => {
          if (filters.num && !(inv.number || '').toLowerCase().includes(filters.num.toLowerCase())) return false;
          if (filters.type && !(inv._typeLabel || '').toLowerCase().includes(filters.type.toLowerCase())) return false;
          if (filters.date && !(inv._dateIso || '').includes(filters.date)) return false;
          if (filters.buyer && !(inv._buyerName || '').toLowerCase().includes(filters.buyer.toLowerCase())) return false;
          if (filters.res && !(inv._resLabel || '').toString().toLowerCase().includes(filters.res.toLowerCase())) return false;
          return true;
        };

        const renderRows = () => {
          const rows = viewList.filter(pass).map(inv => {
            const resLink = inv._resLabel ? `<a class="link" href="#/admin/reservations" data-reslink="${inv.reservationId}">${inv._resLabel}</a>` : '';
            return `<tr>
              <td><a class="link" data-open-inv="${inv.id || ''}" href="javascript:void(0);">${inv.number || '—'}</a></td>
              <td>${inv._typeLabel}</td>
              <td>${inv._dt}</td>
              <td>${inv._buyerName || ''}</td>
              <td>${resLink}</td>
              <td><button class="btn-secondary" data-open="${inv.reservationId}" style="height:32px;">Отвори</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="6">Няма фактури.</td></tr>';
          $('#invList').innerHTML = rows;
          $$('[data-open]').forEach(b => b.onclick = () => {
            const rid = b.getAttribute('data-open');
            if (rid) navigate(`#/admin/reservations?id=${rid}`);
          });
          $$('[data-reslink]').forEach(a => a.onclick = async (e) => {
            e.preventDefault();
            const rid = a.getAttribute('data-reslink');
            if (rid) await loadInvoiceView(rid, true);
          });
          $$('[data-open-inv]').forEach(a => a.onclick = async (e) => {
            e.preventDefault();
            const invId = a.getAttribute('data-open-inv');
            if (!invId) return;
            try {
              const inv = (list||[]).find(x => String(x.id) === String(invId));
              const resIdForModal = inv?.reservationId;
              await loadInvoiceView(resIdForModal, true);
            } catch {}
          });
        };

        const bindFilter = (id, key, options=[]) => {
          const el = document.getElementById(id);
          if (!el) return;
          attachTypeahead(el, options);
          el.addEventListener('input', () => { filters[key] = el.value; renderRows(); });
          el.addEventListener('change', () => { filters[key] = el.value; renderRows(); });
        };
        bindFilter('fInvNum','num', optNum);
        bindFilter('fInvType','type', optType);
        bindFilter('fInvDate','date', optDate);
        bindFilter('fInvBuyer','buyer', optBuyer);
        bindFilter('fInvRes','res', optRes);

        renderRows();
      } catch {
        $('#invList').innerHTML = '<tr><td colspan="6">Неуспешно зареждане на фактурите.</td></tr>';
      }
    })();
    if (resId) {
      if (editMode) loadInvoiceEditor(resId);
      else loadInvoiceView(resId);
    }

    async function loadInvoiceView(reservationId, asModal = false) {
      const host = $('#invEditor');
      if (!asModal && host) host.innerHTML = '<div>Зареждане...</div>';
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
      if (!reservation) {
        if (asModal) { showModal('<div style="padding:16px;">Резервацията не е намерена.</div>'); }
        else { host.innerHTML = '<div style="color:#b42318;">Резервацията не е намерена.</div>'; }
        return;
      }
      const days = (() => { const a=new Date(reservation.from), b=new Date(reservation.to); return Math.max(1, Math.ceil((b-a)/86400000)); })();
      const resTotal = Number(reservation.total || invoice?.totals?.total || invoice?.totals?.gross || invoice?.total || 0);
      const baseUnit = resTotal && days ? (resTotal / days) : (reservation.car?.pricePerDay || 0);
      let items = normalizeInvoiceItems(invoice?.items || []);
      const needsDefault = !items.length || calcInvoiceTotals(items).total === 0;
      if (needsDefault) {
        items = normalizeInvoiceItems([{
          description: `Наем на автомобил ${reservation.car?.brand||''} ${reservation.car?.model||''}`.trim(),
          qty: days,
          unitPrice: baseUnit,
          vatRate: 20
        }]);
      }
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
      const fmtMoney = (v) => `€${Number(v || 0).toFixed(2)}`;
      const fmtDateShort = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt)) return d;
        return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
      };
      const rows = items.map(it => `
        <tr>
          <td>
            <div class="desc">${escHtml(it.description)}</div>
            <div class="meta">${reservation.from ? fmtDate(reservation.from) : ''}${reservation.to ? ' → ' + fmtDate(reservation.to) : ''}</div>
          </td>
          <td class="center">${escHtml(it.qty)}</td>
          <td class="num">${fmtMoney(it.unitPrice)}</td>
          <td class="center">${escHtml(it.vatRate)}%</td>
          <td class="num">${fmtMoney(it.totalNet)}</td>
          <td class="num">${fmtMoney(it.totalVat)}</td>
          <td class="num">${fmtMoney(it.totalGross)}</td>
        </tr>
      `).join('');
      // Политики за печат
      const POLICY_SECTIONS = getPolicySections();
      const polTerms = POLICY_SECTIONS.find(s => s.slug === 'terms');
      const polCancel = POLICY_SECTIONS.find(s => s.slug === 'cancellation');
      const polInsurance = POLICY_SECTIONS.find(s => s.slug === 'insurance');
      const replPol = (t) => (t || '')
        .replace(/\{\{company_name\}\}/g, escHtml(sup.name))
        .replace(/\{\{company_eik\}\}/g, escHtml(sup.eik))
        .replace(/\{\{company_address\}\}/g, escHtml(sup.addr))
        .replace(/\{\{company_email\}\}/g, escHtml(sup.email))
        .replace(/\{\{company_phone\}\}/g, escHtml(sup.phone))
        .replace(/\{\{company_phone_clean\}\}/g, (sup.phone||'').replace(/\s/g,''))
        .replace(/\{\{extra_driver_price\}\}/g, Number(companyCache?.extraDriverPrice ?? 10).toFixed(2))
        .replace(/\{\{insurance_price\}\}/g, Number(companyCache?.insurancePrice ?? 15).toFixed(2));

      const invoiceBody = `
          <div class="invoice-grid-header">
            <div class="invoice-brand">
              <div class="invoice-logo" aria-label="logo">${logoSVG}</div>
              <div>
                <div style="font-weight:700; font-size:16px;">${escHtml(sup.name || 'Company')}</div>
              </div>
            </div>
            <div class="invoice-title">${payload.type==='INVOICE'?'ФАКТУРА':'ПРОФОРМА'}</div>
            <div class="invoice-meta">
              <div><span class="label">Номер</span><br><span class="value">${payload.number || '(генерира се)'}</span></div>
              <div style="margin-top:6px;"><span class="label">Дата</span><br><span class="value">${fmtDateShort(payload.issueDate)}</span></div>
              ${payload.dueDate ? `<div style="margin-top:6px;"><span class="label">Валиден до</span><br><span class="value">${fmtDateShort(payload.dueDate)}</span></div>` : ''}
              <div style="margin-top:6px;"><span class="label">Валута</span><br><span class="value">${payload.currency}</span></div>
            </div>
          </div>

          <div class="invoice-parties">
            <div class="party-card">
              <h4>Доставчик</h4>
              <div class="name">${escHtml(sup.name)}</div>
              <div class="party-row">ЕИК: ${escHtml(sup.eik || '—')} ${sup.vat ? ' | ДДС №: '+escHtml(sup.vat) : ''}</div>
              <div class="party-row">МОЛ: ${escHtml(sup.mol || '—')}</div>
              <div class="party-row">${escHtml(sup.addr || '—')}</div>
              <div class="party-row">${escHtml(sup.email || '—')} | ${escHtml(sup.phone || '—')}</div>
              <div class="party-row">Банка: ${escHtml(sup.bank || '—')}</div>
              <div class="party-row">IBAN: ${escHtml(sup.iban || '—')} | BIC: ${escHtml(sup.bic || '—')}</div>
            </div>
            <div class="party-card">
              <h4>Получател</h4>
              <div class="name">${escHtml(payload.buyerName || '')}</div>
              <div class="party-row">${payload.buyerType==='company'
                ? `ЕИК: ${escHtml(payload.buyerEik || '—')} ${payload.buyerVat ? ' | ДДС №: '+escHtml(payload.buyerVat) : ''}`
                : `ЕГН: ${escHtml(payload.buyerEgn || '—')}`}</div>
              ${payload.buyerMol ? `<div class="party-row">МОЛ: ${escHtml(payload.buyerMol)}</div>` : ''}
              <div class="party-row">${escHtml(payload.buyerAddr || '—')}</div>
              <div class="party-row">${escHtml(payload.buyerEmail || '—')}</div>
              ${(payload.buyerBank || payload.buyerIban || payload.buyerBic) ? `
                <div class="party-row">Банка: ${escHtml(payload.buyerBank || '—')}</div>
                <div class="party-row">IBAN: ${escHtml(payload.buyerIban || '—')} | BIC: ${escHtml(payload.buyerBic || '—')}</div>
              ` : ''}
            </div>
          </div>

          <div>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th style="width:40%;">Описание</th>
                  <th class="center" style="width:8%;">Кол-во</th>
                  <th class="num" style="width:12%;">Ед. цена (с ДДС)</th>
                  <th class="center" style="width:8%;">ДДС %</th>
                  <th class="num" style="width:12%;">Сума без ДДС</th>
                  <th class="num" style="width:10%;">ДДС</th>
                  <th class="num" style="width:10%;">Общо с ДДС</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>

          <div class="invoice-totals">
            <div class="row"><span>Данъчна основа (без ДДС)</span><span class="num">${fmtMoney(totals.subtotal)}</span></div>
            <div class="row" style="padding-bottom:8px; border-bottom:1px solid #D1D5DB;"><span>ДДС (20%)</span><span class="num">${fmtMoney(totals.vatAmount)}</span></div>
            <div class="invoice-total-final"><span>Общо (с ДДС)</span><span class="amount">${fmtMoney(totals.total)}</span></div>
          </div>

          <div class="invoice-footer">
            <span>Генерирана от системата на ${fmtDate(new Date().toISOString())}</span>
            <span>${payload.paymentMethod ? 'Начин на плащане: '+payload.paymentMethod : ''} ${payload.paymentTerms ? 'Условия: '+payload.paymentTerms : ''}</span>
          </div>
      `;

      const policyPages = `
        <div class="inv-policy-page">
          <h3 class="inv-policy-title">${escHtml(polTerms?.title || 'Условия за ползване')}</h3>
          <div class="inv-policy-body">${replPol(polTerms?.defaultContent || '')}</div>
        </div>
        <div class="inv-policy-page">
          <h3 class="inv-policy-title">${escHtml(polCancel?.title || 'Политика за анулиране')}</h3>
          <div class="inv-policy-body">${replPol(polCancel?.defaultContent || '')}</div>
        </div>
        <div class="inv-policy-page">
          <h3 class="inv-policy-title">${escHtml(polInsurance?.title || 'Застраховки')}</h3>
          <div class="inv-policy-body">${replPol(polInsurance?.defaultContent || '')}</div>
        </div>
      `;

      const html = `
        <div class="invoice-shell" id="invoicePrintArea">
          <div class="inv-no-print" style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:-8px;">
            <button class="btn-secondary" id="editInvView" style="height:34px; display:flex; align-items:center; gap:6px; padding:0 12px;">Редактирай</button>
            <button class="btn-secondary" id="printInvView" style="height:34px; display:flex; align-items:center; gap:6px; padding:0 12px;">Принтирай / PDF</button>
          </div>
          ${invoiceBody}
          ${policyPages}
        </div>
      `;

      const printInvoice = () => {
        const fullHTML = buildProformaStandaloneHTML({ reservation, invoice, company: companyCache });
        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) return;
        printWin.document.write(fullHTML);
        printWin.document.close();
        printWin.onload = () => { printWin.focus(); printWin.print(); };
      };

      if (asModal) {
        showModal(`<div style="max-width:1100px;max-height:82vh;overflow:auto;">${html}</div>`, (wrap, close) => {
          const printBtn = wrap.querySelector('#printInvView');
          const editBtn = wrap.querySelector('#editInvView');
          if (printBtn) printBtn.onclick = printInvoice;
          if (editBtn) editBtn.onclick = () => { close(); openInvoiceEditorModal(reservationId); };
        });
      } else {
        if (host) host.innerHTML = html;
        const printBtn = host ? $('#printInvView', host) : null;
        const editBtn = host ? $('#editInvView', host) : null;
        if (printBtn) printBtn.onclick = printInvoice;
        if (editBtn) editBtn.onclick = () => openInvoiceEditorModal(reservationId);
      }
    }

    async function loadInvoiceEditor(reservationId, hostEl = null) {
      const host = hostEl || $('#invEditor');
      if (!host) return;
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
          description: `Наем на автомобил ${reservation.car?.brand||''} ${reservation.car?.model||''}`.trim(),
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
      const locked = state.status === 'PAID' || state.status === 'CANCELLED';
      const setVal = (id, v) => { const el = host.querySelector(`#${id}`); if (el) el.value = v ?? ''; };
      const renderItems = () => {
        const box = host.querySelector('#invItems');
        if (!box) return;
        box.innerHTML = state.items.map((it, idx) => `
          <div class="grid-4" data-row="${idx}" style="align-items:end; gap:8px; margin-bottom:6px;">
            <div><div class="section-title">Описание</div><input data-field="description" class="input" ${locked?'disabled':''} value="${it.description || ''}"></div>
            <div><div class="section-title">Кол-во</div><input data-field="qty" type="number" step="0.01" class="input" ${locked?'disabled':''} value="${it.qty}"></div>
            <div><div class="section-title">Ед. цена (с ДДС)</div><input data-field="unitPrice" type="number" step="0.01" class="input" ${locked?'disabled':''} value="${it.unitPrice}"></div>
            <div><div class="section-title">ДДС %</div><input data-field="vatRate" type="number" step="1" class="input" ${locked?'disabled':''} value="${it.vatRate}"></div>
            <div style="display:flex;align-items:center;gap:6px;">
              ${locked ? '' : `<button class="btn-secondary" data-del="${idx}" type="button" style="height:32px;">Изтрий</button>`}
            </div>
          </div>
        `).join('') || '<div>Няма редове.</div>';
        if (locked) return;
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
        if (!el) return;
        el.innerHTML = `
          <div>Данъчна основа (без ДДС): €${t.subtotal.toFixed(2)}</div>
          <div>ДДС (20%): €${t.vatAmount.toFixed(2)}</div>
          <div><strong>Общо (с ДДС): €${t.total.toFixed(2)}</strong></div>
        `;
      };
      const badge = (st) => `<span class="pill pill-status-${st}">${st}</span>`;
      host.innerHTML = `
        <div class="section-card" style="background:linear-gradient(180deg,#F9FAFB, #FFFFFF); position:sticky; top:0; z-index:2; padding:16px 16px 12px 16px; margin:-14px -14px 8px -14px; border:0; border-bottom:2px solid #E5E7EB;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div>
              <div class="section-title" style="margin:0;">Резервация №${reservation.seq || ''}</div>
              <div style="color:#6B7280; font-size:13px;">${reservation.car?.brand||''} ${reservation.car?.model||''} • ${fmtRange(reservation.from, reservation.to)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${badge(state.status)}
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-card">
            <div class="section-title">Документ</div>
            <div class="grid-3" style="gap:12px;">
              <div><div class="section-title">Тип документ</div><select id="invType" class="select" ${locked?'disabled':''}>
                <option value="PROFORMA" ${state.type==='PROFORMA'?'selected':''}>Проформа</option>
                <option value="INVOICE" ${state.type==='INVOICE'?'selected':''}>Фактура</option>
              </select></div>
              <div><div class="section-title">Статус</div><select id="invStatus" class="select">
                ${['DRAFT','ISSUED','PAID','CANCELLED'].map(s => `<option ${state.status===s?'selected':''} value="${s}">${s}</option>`).join('')}
              </select></div>
              <div><div class="section-title">Номер</div><input id="invNumber" class="input" placeholder="авто" value="${state.number || ''}" ${locked?'disabled':''}></div>
            </div>
            <div class="grid-3" style="gap:12px; margin-top:10px;">
              <div><div class="section-title">Дата издаване</div><input id="invIssue" type="date" class="input" value="${state.issueDate}" ${locked?'disabled':''}></div>
              <div><div class="section-title">Падеж</div><input id="invDue" type="date" class="input" value="${state.dueDate || ''}" ${locked?'disabled':''}></div>
              <div><div class="section-title">Валута</div><input id="invCurrency" class="input" value="${state.currency}" ${locked?'disabled':''}></div>
            </div>
            <div class="grid-2" style="gap:12px; margin-top:10px;">
              <div><div class="section-title">Начин на плащане</div><input id="invPay" class="input" value="${state.paymentMethod||''}" ${locked?'disabled':''}></div>
              <div><div class="section-title">Условия</div><input id="invTerms" class="input" value="${state.paymentTerms||''}" ${locked?'disabled':''}></div>
            </div>
          </div>

          <div class="section-card">
            <div class="section-title">Получател</div>
            <div class="grid-3" style="gap:12px;">
              <div><div class="section-title">Тип</div><select id="buyerType" class="select" ${locked?'disabled':''}>
                <option value="individual" ${state.buyerType==='individual'?'selected':''}>Физическо лице</option>
                <option value="company" ${state.buyerType==='company'?'selected':''}>Юридическо лице</option>
              </select></div>
              <div><div class="section-title">Име / Фирма</div><input id="buyerName" class="input" value="${state.buyerName||''}" ${locked?'disabled':''}></div>
              <div><div class="section-title">Имейл</div><input id="buyerEmail" class="input" value="${state.buyerEmail||''}" ${locked?'disabled':''}></div>
            </div>
            <div class="grid-3" style="gap:12px; margin-top:10px;">
              <div id="buyerEikWrap"><div class="section-title">ЕИК</div><input id="buyerEik" class="input" value="${state.buyerEik||''}" ${locked?'disabled':''}></div>
              <div id="buyerVatWrap"><div class="section-title">ДДС №</div><input id="buyerVat" class="input" value="${state.buyerVat||''}" ${locked?'disabled':''}></div>
              <div id="buyerEgnWrap"><div class="section-title">ЕГН</div><input id="buyerEgn" class="input" value="${state.buyerEgn||''}" ${locked?'disabled':''}></div>
            </div>
            <div class="grid-3" style="gap:12px; margin-top:10px;">
              <div id="buyerMolWrap"><div class="section-title">МОЛ</div><input id="buyerMol" class="input" value="${state.buyerMol||''}" ${locked?'disabled':''}></div>
              <div><div class="section-title">Банка</div><input id="buyerBank" class="input" value="${state.buyerBank||''}" ${locked?'disabled':''}></div>
              <div><div class="section-title">IBAN / BIC</div>
                <div class="row" style="gap:6px;">
                  <input id="buyerIban" class="input" style="flex:2;" value="${state.buyerIban||''}" ${locked?'disabled':''}>
                  <input id="buyerBic" class="input" style="flex:1;" value="${state.buyerBic||''}" ${locked?'disabled':''}>
                </div>
              </div>
            </div>
            <div style="margin-top:10px;"><div class="section-title">Адрес</div><input id="buyerAddr" class="input" value="${state.buyerAddr||''}" ${locked?'disabled':''}></div>
          </div>

          <div class="section-card">
            <div class="row" style="justify-content:space-between; align-items:center;">
              <div class="section-title">Редове</div>
              ${locked ? '' : `<button class="btn-secondary" id="addItem" type="button" style="height:34px;">Добави ред</button>`}
            </div>
            <div id="invItems" style="margin-top:8px;"></div>
          </div>

          <div class="section-card">
            <div class="section-title">Бележки</div>
            <textarea id="invNotes" class="input" style="min-height:60px;" ${locked?'disabled':''}>${state.notes||''}</textarea>
          </div>

          <div class="section-card" id="invTotals" style="display:grid;gap:4px;"></div>
          <div id="invErr" style="color:#B42318; font-size:13px; display:none;"></div>
          <div class="sticky-actions">
            <button class="btn-secondary" id="printInv" type="button">Печат (PDF)</button>
            ${locked ? '' : `<button class="btn-primary" id="saveInv" type="button">Запази</button>`}
          </div>
        </div>
      `;
      renderItems();
      refreshTotals();
      const toggleBuyerFields = () => {
        const typeSel = host.querySelector('#buyerType');
        const type = typeSel?.value || 'individual';
        const isCompany = type === 'company';
        const show = (id, visible) => { const el = host.querySelector(id); if (el) el.style.display = visible ? '' : 'none'; };
        show('#buyerEikWrap', isCompany);
        show('#buyerVatWrap', isCompany);
        show('#buyerMolWrap', isCompany);
        show('#buyerEgnWrap', !isCompany);
      };
      toggleBuyerFields();
      $('#buyerType', host)?.addEventListener('change', () => {
        const typeSel = host.querySelector('#buyerType');
        state.buyerType = typeSel?.value || 'individual';
        if (state.buyerType === 'company') {
          state.buyerEgn = '';
          const egn = host.querySelector('#buyerEgn'); if (egn) egn.value = '';
        } else {
          state.buyerEik = ''; state.buyerVat = ''; state.buyerMol = '';
          const eik = host.querySelector('#buyerEik'); if (eik) eik.value = '';
          const vat = host.querySelector('#buyerVat'); if (vat) vat.value = '';
          const mol = host.querySelector('#buyerMol'); if (mol) mol.value = '';
        }
        toggleBuyerFields();
      });
      if (!locked) {
        $('#addItem', host)?.addEventListener('click', () => {
          state.items.push({ description:'Услуга', qty:1, unitPrice:0, vatRate:20, totalNet:0, totalVat:0, totalGross:0 });
          renderItems(); refreshTotals();
        });
      }
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

      const clearFieldErrors = () => {
        $$('.err-msg, .err-inline', host).forEach(n => n.remove());
        $$('.error', host).forEach(n => n.classList.remove('error'));
      };
      const markFieldError = (sel, msg) => {
        const el = typeof sel === 'string' ? host.querySelector(sel) : sel;
        if (!el) return;
        el.classList.add('error');
        const holder = el.parentElement || el;
        const span = document.createElement('span');
        span.className = 'err-inline';
        span.textContent = msg;
        holder.appendChild(span);
      };

      const validateInvoicePayload = (p) => {
        const emailRe = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const eikRe = /^\d{9}$|^\d{13}$/;
        const egnRe = /^\d{10}$/;
        const vatRe = /^BG\d{9,10}$/;
        const ibanRe = /^[A-Z]{2}[0-9A-Z]{10,32}$/;

        if (!p.issueDate) return { field: '#invIssue', msg: 'Попълнете дата на издаване' };
        if (!p.buyerName) return { field: '#buyerName', msg: 'Попълнете получател' };
        if (!p.buyerEmail || !emailRe.test(p.buyerEmail)) return { field: '#buyerEmail', msg: 'Попълнете валиден имейл' };
        if (p.buyerType === 'company') {
          if (!p.buyerEik || !eikRe.test(p.buyerEik)) return { field: '#buyerEik', msg: 'Попълнете валиден ЕИК (9 или 13 цифри)' };
          if (p.buyerVat && !vatRe.test(p.buyerVat.toUpperCase().replace(/\s/g,''))) return { field: '#buyerVat', msg: 'Невалиден ДДС № (BG + 9/10 цифри)' };
        } else {
          if (!p.buyerEgn || !egnRe.test(p.buyerEgn)) return { field: '#buyerEgn', msg: 'Попълнете валидно ЕГН (10 цифри)' };
        }
        if (p.buyerBank && !p.buyerIban) return { field: '#buyerIban', msg: 'IBAN е задължителен при попълнена банка' };
        if (p.buyerIban && !ibanRe.test(p.buyerIban.toUpperCase().replace(/\s/g,''))) return { field: '#buyerIban', msg: 'Невалиден IBAN' };
        if (!Array.isArray(p.items) || !p.items.length) return { field: '#invItems', msg: 'Добавете поне един ред' };
        const bad = p.items.find(it => !it.description || Number(it.qty) <= 0 || Number(it.unitPrice) < 0);
        if (bad) return { field: '#invItems', msg: 'Всеки ред трябва да има описание и количество > 0' };
        return null;
      };
      $('#saveInv', host)?.addEventListener('click', async () => {
        const payload = collect();
        clearFieldErrors();
        const err = validateInvoicePayload(payload);
        if (err) { markFieldError(err.field, err.msg); return; }
        const btn = $('#saveInv', host);
        if (btn) btn.disabled = true;
        try {
          const url = payload.id ? `/api/invoices/${payload.id}` : '/api/invoices';
          const method = payload.id ? 'PUT' : 'POST';
          const saved = await apiFetch(url, { method, body: JSON.stringify(payload) });
          state.id = saved.id;
          state.number = saved.number || state.number;
          state.status = saved.status || state.status;
          state.items = normalizeInvoiceItems(payload.items);
          renderItems(); refreshTotals();
        } catch (e) {
          markFieldError('#saveInv', 'Грешка при запис: ' + (e.message || ''));
        } finally {
          if (btn) btn.disabled = false;
        }
      });

      $('#printInv', host)?.addEventListener('click', () => { loadInvoiceView(reservationId, true); });
    }
    function openInvoiceEditorModal(reservationId) {
      showModal(`<div id="invEditorModal" style="max-width:1100px;max-height:82vh;overflow:auto;">Зареждане...</div>`, (wrap) => {
        const container = wrap.querySelector('#invEditorModal');
        loadInvoiceEditor(reservationId, container);
      });
    }
  }

  function renderAdminSettings() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('settings') + `
      <div class="panel" style="padding:16px; margin-bottom:12px;">
        <div class="header" style="padding:0 0 12px 0; border:0;"><h2>Инфо за компанията (фактуриране)</h2></div>
        <form id="companyForm" style="display:grid; gap:14px;">
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
          <div class="header" style="padding:16px 0 8px 0; border:0; margin-top:8px;"><h3 style="font-size:15px; color:#1E3A8A;">Допълнителни услуги (цени с ДДС)</h3></div>
          <div class="grid-2">
            <div><div class="section-title">Допълнителен шофьор (€/ден)</div><input name="extraDriverPrice" type="number" min="0" step="0.01" class="input" value="10"></div>
            <div><div class="section-title">Застраховка пълно каско (€/ден)</div><input name="insurancePrice" type="number" min="0" step="0.01" class="input" value="15"></div>
          </div>
          <div class="header" style="padding:16px 0 8px 0; border:0; margin-top:8px;"><h3 style="font-size:15px; color:#1E3A8A;">📧 Имейл настройки (SMTP)</h3></div>
          <p style="font-size:12px; color:#6B7280; margin:0 0 8px;">Конфигурирайте SMTP за автоматично изпращане на имейл при нова резервация.</p>
          <div class="grid-2">
            <div><div class="section-title">SMTP Хост</div><input name="smtpHost" class="input" placeholder="smtp.gmail.com"></div>
            <div><div class="section-title">SMTP Порт</div><input name="smtpPort" type="number" class="input" value="587" placeholder="587"></div>
          </div>
          <div class="grid-2">
            <div><div class="section-title">SMTP Потребител</div><input name="smtpUser" class="input" placeholder="user@gmail.com"></div>
            <div><div class="section-title">SMTP Парола</div><input name="smtpPass" type="password" class="input" placeholder="app password"></div>
          </div>
          <div class="grid-2">
            <div><div class="section-title">Имейл подател (From)</div><input name="smtpFrom" class="input" placeholder="noreply@meniar.com"></div>
            <div style="display:flex; align-items:flex-end;">
              <button type="button" class="btn-secondary" id="testSmtp" style="height:40px; font-size:13px;">Тест имейл</button>
            </div>
          </div>
          <div id="smtpTestMsg" style="display:none; font-size:13px; margin-top:4px;"></div>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button type="submit" class="btn-primary" id="saveCompany">Запази</button>
          </div>
          <div id="companyMsg" style="color:#0F8E64; display:none;">Записано успешно.</div>
        </form>
      </div>
      <div class="panel" style="padding:16px; display:grid; gap:12px;">
        <div class="toolbar" style="padding:0; border:0;">
          <div class="section-title">Места за взимане/връщане</div>
          <button class="btn-primary" id="addLoc">Добави място</button>
          <div style="margin-left:auto;"></div>
        </div>
        <table class="table">
          <thead><tr><th>Име</th><th>Активно</th><th></th></tr></thead>
          <tbody id="locRows"></tbody>
        </table>
      </div>
    `;
    const companyForm = $('#companyForm');
    const companyFields = {
      name: companyForm.querySelector('[name="name"]'),
      mol: companyForm.querySelector('[name="mol"]'),
      eik: companyForm.querySelector('[name="eik"]'),
      vat: companyForm.querySelector('[name="vat"]'),
      city: companyForm.querySelector('[name="city"]'),
      address: companyForm.querySelector('[name="address"]'),
      country: companyForm.querySelector('[name="country"]'),
      phone: companyForm.querySelector('[name="phone"]'),
      email: companyForm.querySelector('[name="email"]'),
      bank: companyForm.querySelector('[name="bank"]'),
      iban: companyForm.querySelector('[name="iban"]'),
      bic: companyForm.querySelector('[name="bic"]'),
      proStart: companyForm.querySelector('[name="proStart"]'),
      invStart: companyForm.querySelector('[name="invStart"]'),
      extraDriverPrice: companyForm.querySelector('[name="extraDriverPrice"]'),
      insurancePrice: companyForm.querySelector('[name="insurancePrice"]'),
      smtpHost: companyForm.querySelector('[name="smtpHost"]'),
      smtpPort: companyForm.querySelector('[name="smtpPort"]'),
      smtpUser: companyForm.querySelector('[name="smtpUser"]'),
      smtpPass: companyForm.querySelector('[name="smtpPass"]'),
      smtpFrom: companyForm.querySelector('[name="smtpFrom"]')
    };
    const clearCompanyErrors = () => {
      $$('.err-msg', companyForm).forEach(n => n.remove());
      $$('.error', companyForm).forEach(n => n.classList.remove('error'));
    };
    const saveCompanyBtn = $('#saveCompany');
    const setCompanyError = (inputEl, msg) => {
      if (!inputEl) return;
      inputEl.classList.add('error');
      const holder = inputEl.parentElement || inputEl;
      const m = document.createElement('span');
      m.className = 'err-msg';
      m.textContent = msg;
      holder.appendChild(m);
    };
    const scrollToCompanyError = () => {
      const first = $('.error', companyForm);
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const normSpaces = (v='') => v.replace(/\s+/g, ' ').trim();
    const validateEIK9 = (eik) => {
      if (!/^\d{9}$/.test(eik)) return false;
      const w1 = [1,2,3,4,5,6,7,8];
      let sum = 0;
      for (let i=0;i<8;i++) sum += Number(eik[i]) * w1[i];
      let c = sum % 11;
      if (c === 10) {
        const w2 = [3,4,5,6,7,8,9,10];
        sum = 0;
        for (let i=0;i<8;i++) sum += Number(eik[i]) * w2[i];
        c = sum % 11;
        if (c === 10) c = 0;
      }
      return c === Number(eik[8]);
    };
    const validateIBANbg = (ibanRaw) => {
      let cleaned = (ibanRaw||'').replace(/\s/g,'').toUpperCase();
      if (!cleaned) return { ok:false, err:'empty', value:'' };
      if (!cleaned.startsWith('BG')) cleaned = `BG${cleaned}`;
      if (!/^BG\d{2}[A-Z]{4}\d{14}$/.test(cleaned)) return { ok:false, err:'invalid', value:cleaned };
      const rearr = cleaned.slice(4) + cleaned.slice(0,4);
      const toNum = rearr.split('').map(ch => {
        const code = ch.charCodeAt(0);
        return code >= 65 && code <= 90 ? String(code - 55) : ch;
      }).join('');
      let rem = 0n;
      for (const ch of toNum) rem = (rem * 10n + BigInt(ch)) % 97n;
      if (rem !== 1n) return { ok:false, err:'invalid', value:cleaned };
      return { ok:true, value:cleaned };
    };
    const validatorsCompany = {
      name(v) {
        const val = normSpaces(v);
        if (!val) return { ok:false, err:'empty', value:'' };
        const re = /(ООД|ЕООД|АД|ЕАД|СД|КД|ЕТ|ДП|OOD|EOOD|AD|EAD|SD|KD|ET|DP)$/i;
        if (val.length < 3 || !re.test(val)) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      mol(v) {
        const val = normSpaces(v);
        if (!val) return { ok:false, err:'empty', value:'' };
        const re = /^[А-Яа-яЁёЪъЬьЮюЯяЩщШшЧчЦцЙйѝІіҐґЇї\- ]+$/u;
        if (!re.test(val)) return { ok:false, err:'invalid', value:val };
        const parts = val.split(' ').filter(Boolean);
        if (parts.length < 2) return { ok:false, err:'invalid', value:val };
        if (parts.some(p => p.replace(/-/g,'').length < 2)) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      eik(v) {
        const digits = (v||'').replace(/\D/g,'');
        if (!digits) return { ok:false, err:'empty', value:'' };
        if (!/^\d{9}$|^\d{13}$/.test(digits)) return { ok:false, err:'invalid', value:digits };
        if (digits.length === 9 && !validateEIK9(digits)) return { ok:false, err:'invalid', value:digits };
        return { ok:true, value:digits };
      },
      vat(v, eikDigits='') {
        let cleaned = (v||'').replace(/\s/g,'').toUpperCase();
        if (!cleaned) return { ok:true, value:'' };
        if (!cleaned.startsWith('BG')) cleaned = `BG${cleaned}`;
        if (!/^BG\d{9,10}$/.test(cleaned)) return { ok:false, err:'invalid', value:cleaned };
        const num = cleaned.slice(2);
        if (num.length === 9 && eikDigits && eikDigits.length === 9 && num !== eikDigits) {
          return { ok:false, err:'mismatch', value:cleaned };
        }
        return { ok:true, value:cleaned };
      },
      city(v) {
        const val = normSpaces(v);
        if (!val) return { ok:false, err:'empty', value:'' };
        if (!/^[А-Яа-яЁёЪъЬьЮюЯяЩщШшЧчЦцЙйѝІіҐґЇї\- ]{2,}$/u.test(val)) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      address(v) {
        const val = normSpaces(v);
        if (!val || val.length < 10 || !/(ул\.|бул\.|пл\.|str|street|bul)/i.test(val) || !/\d/.test(val)) {
          return { ok:false, err:'invalid', value:val };
        }
        return { ok:true, value:val };
      },
      country(v) {
        const val = normSpaces(v);
        if (!val) return { ok:false, err:'empty', value:'' };
        if (!/^(България|Bulgaria)$/i.test(val)) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      phone(v) {
        const digits = (v||'').replace(/\D/g,'');
        if (!digits) return { ok:false, err:'empty', value:'' };
        const mobile = /^0(87|88|89)\d{7}$/;
        const land = /^0[2-9]\d{6,8}$/;
        if (!mobile.test(digits) && !land.test(digits)) return { ok:false, err:'invalid', value:digits };
        return { ok:true, value:digits };
      },
      email(v) {
        const val = normSpaces(v).toLowerCase();
        if (!val) return { ok:false, err:'empty', value:'' };
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!re.test(val)) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      bank(v) {
        const val = normSpaces(v);
        if (!val) return { ok:true, value:'' };
        if (val.length < 3) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      iban(v, bankFilled=false) {
        if (!v && !bankFilled) return { ok:true, value:'' };
        if (!v && bankFilled) return { ok:false, err:'empty', value:'' };
        return validateIBANbg(v);
      },
      bic(v, bankFilled=false) {
        const val = (v||'').replace(/\s/g,'').toUpperCase();
        if (!val && !bankFilled) return { ok:true, value:'' };
        if (!val && bankFilled) return { ok:false, err:'empty', value:'' };
        if (!/^[A-Z]{4}BG[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(val)) return { ok:false, err:'invalid', value:val };
        return { ok:true, value:val };
      },
      proStart(v) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) return { ok:false, err:'invalid', value:v };
        return { ok:true, value:n };
      },
      invStart(v, proVal=1) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) return { ok:false, err:'invalid', value:v };
        if (n < proVal) return { ok:false, err:'lessThanPro', value:n };
        return { ok:true, value:n };
      }
    };

    async function loadCompany() {
      let data = null;
      try { data = await apiFetch('/api/company'); } catch { data = null; }
      const set = (n,v) => { const el = companyFields[n]; if (el) el.value = v || ''; };
      set('name', data?.name); set('mol', data?.mol);
      set('eik', data?.eik); set('vat', data?.vat);
      set('city', data?.city); set('address', data?.address);
      set('country', data?.country || 'България');
      set('phone', data?.phone); set('email', data?.email);
      set('bank', data?.bank); set('iban', data?.iban); set('bic', data?.bic);
      set('proStart', data?.proStart || 1); set('invStart', data?.invStart || 1);
      set('extraDriverPrice', data?.extraDriverPrice ?? 10); set('insurancePrice', data?.insurancePrice ?? 15);
      set('smtpHost', data?.smtpHost); set('smtpPort', data?.smtpPort || 587);
      set('smtpUser', data?.smtpUser); set('smtpFrom', data?.smtpFrom);
      // Don't overwrite password field if it's a masked value
      if (data?.smtpPass) companyFields.smtpPass.placeholder = '••••••••';
    }
    loadCompany();
    const validateCompanyForm = (showErrors=false) => {
      clearCompanyErrors();
      const res = {};
      let ok = true;
      const nameVal = validatorsCompany.name(companyFields.name.value);
      if (!nameVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.name, 'Въведете име с правна форма (ООД/ЕООД/АД...)'); }
      else res.name = nameVal.value;

      const molVal = validatorsCompany.mol(companyFields.mol.value);
      if (!molVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.mol, 'МОЛ трябва да е на кирилица, 2+ имена'); }
      else res.mol = molVal.value;

      const eikVal = validatorsCompany.eik(companyFields.eik.value);
      if (!eikVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.eik, 'ЕИК/БУЛСТАТ трябва да е 9 или 13 цифри с валидна контр. сума'); }
      else res.eik = eikVal.value;

      const vatVal = validatorsCompany.vat(companyFields.vat.value, res.eik);
      if (!vatVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.vat, vatVal.err==='mismatch' ? 'ДДС № трябва да съвпада с ЕИК (9 цифри) или да е ЕГН (10 цифри)' : 'Невалиден ДДС №'); }
      else res.vat = vatVal.value;

      const cityVal = validatorsCompany.city(companyFields.city.value);
      if (!cityVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.city, 'Градът трябва да е на кирилица, поне 2 букви'); }
      else res.city = cityVal.value;

      const addrVal = validatorsCompany.address(companyFields.address.value);
      if (!addrVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.address, 'Адрес: град + ул./бул. + номер, мин. 10 символа'); }
      else res.address = addrVal.value;

      const countryVal = validatorsCompany.country(companyFields.country.value);
      if (!countryVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.country, 'Стойност: България / Bulgaria'); }
      else res.country = countryVal.value;

      const phoneVal = validatorsCompany.phone(companyFields.phone.value);
      if (!phoneVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.phone, 'Телефон: мобилен 087/088/089 +7 или стационарен с код'); }
      else res.phone = phoneVal.value;

      const emailVal = validatorsCompany.email(companyFields.email.value);
      if (!emailVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.email, 'Невалиден имейл'); }
      else res.email = emailVal.value;

      const bankVal = validatorsCompany.bank(companyFields.bank.value);
      if (!bankVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.bank, 'Въведете пълно име на банката (мин. 3 символа)'); }
      else res.bank = bankVal.value;

      const ibanVal = validatorsCompany.iban(companyFields.iban.value, !!res.bank);
      if (!ibanVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.iban, ibanVal.err==='empty' ? 'IBAN е задължителен при попълнена банка' : 'Невалиден IBAN (BG + 20 знака)'); }
      else res.iban = ibanVal.value;

      const bicVal = validatorsCompany.bic(companyFields.bic.value, !!res.bank);
      if (!bicVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.bic, bicVal.err==='empty' ? 'BIC е задължителен при попълнена банка' : 'Невалиден BIC (8 или 11 знака, съдържа BG)'); }
      else res.bic = bicVal.value;

      const proVal = validatorsCompany.proStart(companyFields.proStart.value);
      if (!proVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.proStart, 'Старт проформа трябва да е цяло число ≥ 1'); }
      else res.proStart = proVal.value;

      const invVal = validatorsCompany.invStart(companyFields.invStart.value, proVal.ok ? proVal.value : 1);
      if (!invVal.ok) { ok=false; if (showErrors) setCompanyError(companyFields.invStart, invVal.err==='lessThanPro' ? 'Старт фактура трябва да е ≥ старт проформа' : 'Старт фактура трябва да е цяло число ≥ 1'); }
      else res.invStart = invVal.value;

      // Extra services prices (optional, default to current values)
      const edp = Number(companyFields.extraDriverPrice?.value);
      if (isNaN(edp) || edp < 0) { ok=false; if (showErrors) setCompanyError(companyFields.extraDriverPrice, 'Цената трябва да е ≥ 0'); }
      else res.extraDriverPrice = edp;
      const ip = Number(companyFields.insurancePrice?.value);
      if (isNaN(ip) || ip < 0) { ok=false; if (showErrors) setCompanyError(companyFields.insurancePrice, 'Цената трябва да е ≥ 0'); }
      else res.insurancePrice = ip;

      // SMTP (optional, no validation needed - just pass through)
      res.smtpHost = (companyFields.smtpHost?.value || '').trim();
      res.smtpPort = Number(companyFields.smtpPort?.value) || 587;
      res.smtpUser = (companyFields.smtpUser?.value || '').trim();
      res.smtpPass = (companyFields.smtpPass?.value || '').trim();
      res.smtpFrom = (companyFields.smtpFrom?.value || '').trim();

      if (!ok && showErrors) scrollToCompanyError();
      return { ok, values: res };
    };

    const updateSaveBtn = () => {
      const r = validateCompanyForm(true);
      if (saveCompanyBtn) saveCompanyBtn.disabled = !r.ok;
    };

    Object.values(companyFields).forEach(el => {
      if (!el) return;
      el.addEventListener('input', () => { validateCompanyForm(true); updateSaveBtn(); });
      el.addEventListener('blur', () => { validateCompanyForm(true); updateSaveBtn(); });
    });

    $('#companyForm').onsubmit = async (e) => {
      e.preventDefault();
      const res = validateCompanyForm(true);
      if (!res.ok) return;
      const payload = { ...res.values };
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

    // Test SMTP button
    const testSmtpBtn = $('#testSmtp');
    if (testSmtpBtn) testSmtpBtn.onclick = async () => {
      const smtpMsg = $('#smtpTestMsg');
      smtpMsg.style.display = 'block';
      smtpMsg.style.color = '#6B7280';
      smtpMsg.textContent = 'Изпращане на тестов имейл...';
      try {
        const res = await apiFetch('/api/test-smtp', {
          method: 'POST',
          body: JSON.stringify({
            smtpHost: companyFields.smtpHost?.value?.trim(),
            smtpPort: Number(companyFields.smtpPort?.value) || 587,
            smtpUser: companyFields.smtpUser?.value?.trim(),
            smtpPass: companyFields.smtpPass?.value?.trim(),
            smtpFrom: companyFields.smtpFrom?.value?.trim()
          })
        });
        smtpMsg.style.color = '#059669';
        smtpMsg.textContent = '✓ Тестовият имейл е изпратен успешно!';
      } catch (err) {
        smtpMsg.style.color = '#B42318';
        smtpMsg.textContent = '✗ Грешка: ' + (err.message || 'Неуспешно свързване');
      }
      setTimeout(() => smtpMsg.style.display = 'none', 5000);
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

  /* ===== Vehicles Page ===== */
  let vpActiveTab = 'all';

  function mountVehiclesPage() {
    app.className = 'landing-wrap';

    // Read ?type= parameter from hash URL (e.g. #/vehicles?type=Джип)
    const hashQuery = (location.hash.split('?')[1]) || '';
    const hashParams = new URLSearchParams(hashQuery);
    const urlType = hashParams.get('type');

    // Resolve type options from params (fallback: derive from actual car data)
    const typeDef = findCarTypeDef();
    const typeOpts = typeDef?.options?.length
      ? typeDef.options : [...new Set(cars.map(c => c.type).filter(Boolean))];
    const gearDef = findGearDef();
    const gearOpts = gearDef?.options?.length
      ? ['Без значение', ...gearDef.options] : ['Без значение', ...new Set(cars.map(c => c.transmission).filter(Boolean))];

    // Only show car types that actually have at least one car
    const existingTypes = [...new Set(cars.map(c => c.type).filter(Boolean))];
    const activeTypeOpts = typeOpts.filter(t => existingTypes.includes(t));

    // If a valid type was passed via URL, set it as the active tab
    if (urlType && activeTypeOpts.includes(urlType)) {
      vpActiveTab = urlType;
    } else if (!urlType) {
      vpActiveTab = 'all';
    }

    // Font Awesome icon mapping for car types
    const typeIconFA = (type) => {
      const t = (type || '').toLowerCase();
      if (t.includes('джип') || t.includes('suv') || t.includes('офроуд'))
        return '<i class="fa-solid fa-truck-monster" style="font-size:16px;"></i>';
      if (t.includes('камион') || t.includes('truck'))
        return '<i class="fa-solid fa-truck-moving" style="font-size:16px;"></i>';
      if (t.includes('товарен') || t.includes('ван') || t.includes('van'))
        return '<i class="fa-solid fa-truck" style="font-size:16px;"></i>';
      if (t.includes('пътнически') || t.includes('бус'))
        return '<i class="fa-solid fa-van-shuttle" style="font-size:16px;"></i>';
      if (t.includes('лека') || t.includes('sedan') || t.includes('седан'))
        return '<i class="fa-solid fa-car" style="font-size:16px;"></i>';
      if (t.includes('кабрио') || t.includes('cabriolet'))
        return '<i class="fa-solid fa-car-rear" style="font-size:16px;"></i>';
      if (t.includes('хечбек') || t.includes('hatch'))
        return '<i class="fa-solid fa-car-side" style="font-size:16px;"></i>';
      if (t.includes('комби') || t.includes('estate') || t.includes('wagon'))
        return '<i class="fa-solid fa-car-side" style="font-size:16px;"></i>';
      if (t.includes('купе') || t.includes('coupe'))
        return '<i class="fa-solid fa-car-rear" style="font-size:16px;"></i>';
      if (t.includes('електр') || t.includes('electric'))
        return '<i class="fa-solid fa-charging-station" style="font-size:16px;"></i>';
      return '<i class="fa-solid fa-car" style="font-size:16px;"></i>';
    };

    const tabs = [
      { id: 'all', label: 'Всички типове', icon: '<i class="fa-solid fa-border-all" style="font-size:16px;"></i>' },
      ...activeTypeOpts.map(t => ({ id: t, label: t, icon: typeIconFA(t) }))
    ];

    app.innerHTML = `
      ${siteHeaderHTML('vehicles')}

      <!-- FILTER BAR -->
      <div class="vp-filter-wrap" id="main-content">
        <div class="hero-booking" id="vpFilterBar" style="max-width:100%;margin:0 auto;">
          <h2>Наемете кола</h2>
        </div>
      </div>

      <!-- TABS + GRID -->
      <div class="vp-tabs">
        <h1 class="vp-tabs-title" style="font-size:var(--font-h2);">АвтоПарк</h1>
        <h2 class="vp-tabs-subtitle" style="font-size:16px;font-weight:500;color:#6B7280;margin:4px 0 12px;">Селектирай по тип кола</h2>
        <div class="vp-tabs-row" id="vpTabs" role="tablist" aria-label="Филтър по тип кола">
          ${tabs.map(t => `<button class="vp-tab ${t.id === vpActiveTab ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === vpActiveTab}">${t.icon} ${t.label}</button>`).join('')}
        </div>
      </div>

      <div class="vp-grid-wrap">
        <div class="results-grid" id="resultsGrid" style="grid-template-columns:repeat(3, minmax(280px, 1fr));"></div>
      </div>

      ${siteFooterHTML()}
      <section class="panel details" id="details" style="display:none;"></section>
    `;
    bindHamburger();

    // Render filter bar
    renderVpFilters(gearOpts);

    // Tab clicks (with aria-selected)
    $$('.vp-tab').forEach(btn => btn.onclick = () => {
      vpActiveTab = btn.getAttribute('data-tab');
      $$('.vp-tab').forEach(b => {
        const isActive = b.getAttribute('data-tab') === vpActiveTab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
      });
      renderVpResults();
    });

    // Initial render
    renderVpResults();
  }

  async function renderVpFilters(gearOpts) {
    const typeDef = findCarTypeDef();
    const typeOptions = typeDef?.options?.length
      ? ['Всички', ...typeDef.options] : ['Всички', ...new Set(cars.map(c => c.type).filter(Boolean))];
    let locations = [];
    try { locations = await apiFetch('/api/locations'); } catch {}
    const bar = $('#vpFilterBar');
    // Same form as home page hero booking
    bar.innerHTML = `
      <div class="vp-form-grid">
        <div class="hb-group ta-wrap">
          <label>Място на взимане</label>
          <div class="hb-input-wrap">
            <input id="vpPick" class="hb-input" placeholder="Въведи локация" value="${filterState.pick||''}">
            <span class="hb-icon">${svgLocationDot}</span>
          </div>
        </div>
        <div class="hb-group ta-wrap">
          <label>Място на връщане</label>
          <div class="hb-input-wrap">
            <input id="vpDrop" class="hb-input" placeholder="Въведи локация" value="${filterState.drop||''}">
            <span class="hb-icon">${svgLocationDot}</span>
          </div>
        </div>
        <div class="hb-group">
          <label>Дата на взимане</label>
          <div class="hb-input-wrap">
            <input id="vpFrom" type="datetime-local" class="hb-input" step="1800" value="${(filterState.from||'').slice(0,16)}">
            <span class="hb-icon">${svgCalIcon}</span>
          </div>
        </div>
        <div class="hb-group">
          <label>Дата на връщане</label>
          <div class="hb-input-wrap">
            <input id="vpTo" type="datetime-local" class="hb-input" step="1800" value="${(filterState.to||'').slice(0,16)}">
            <span class="hb-icon">${svgCalIcon}</span>
          </div>
        </div>
      </div>
      <button id="vpSubmit" class="hb-submit" style="margin-top:14px;">Търси</button>
    `;
    const labels = (locations||[]).map(l => l.label);
    attachTypeahead($('#vpPick'), labels);
    attachTypeahead($('#vpDrop'), labels);
    // Sync filters
    $('#vpPick').oninput = (e) => { filterState.pick = e.target.value; };
    $('#vpPick').onchange = (e) => { filterState.pick = e.target.value; };
    $('#vpDrop').oninput = (e) => { filterState.drop = e.target.value; };
    $('#vpDrop').onchange = (e) => { filterState.drop = e.target.value; };
    const bindSnap = (el, key) => {
      if (!el) return;
      const apply = () => { const v = snapMinutesLocal(el.value); el.value = v; filterState[key] = v; };
      // Don't set onfocus/onclick to showPicker — the custom DTP handles opening
      el.onchange = apply; el.oninput = apply;
    };
    bindSnap($('#vpFrom'), 'from');
    bindSnap($('#vpTo'), 'to');
    $('#vpSubmit').onclick = () => { renderVpResults(); };
  }

  function renderVpResults() {
    // Apply all filters
    let list = cars.filter(c => {
      const q = filterState.query;
      if (q && !(c.brand.toLowerCase().includes(q) || c.model.toLowerCase().includes(q))) return false;
      const norm = (v) => (v || '').toString().trim().toLowerCase();
      const mapTx = (v) => {
        const n = norm(v);
        if (n.includes('автомат') || n === 'automatic') return 'automatic';
        if (n.includes('ръч') || n === 'manual') return 'manual';
        return n;
      };
      if (filterState.transmission !== 'Any' && filterState.transmission !== 'Без значение') {
        if (mapTx(c.transmission) !== mapTx(filterState.transmission)) return false;
      }
      if (filterState.type !== 'Всички' && c.type !== filterState.type) return false;
      // Tab filter
      if (vpActiveTab !== 'all' && c.type !== vpActiveTab) return false;
      return true;
    });

    const grid = $('#resultsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px;">
        <i class="fa-solid fa-car-burst" style="font-size:48px;color:#D1D5DB;margin-bottom:16px;display:block;"></i>
        <p style="font-size:18px;font-weight:600;color:#374151;margin:0 0 8px;">Няма намерени автомобили</p>
        <p style="font-size:14px;color:#6B7280;margin:0;">Опитайте с различни филтри или период.</p>
      </div>`;
      return;
    }

    list.forEach((c) => {
      const card = document.createElement('article');
      card.className = 'cc';
      card.setAttribute('aria-label', `${escHtml(c.brand)} ${escHtml(c.model)}`);
      const firstImg = (() => {
        const im = (c.images || [])[0];
        const p = im && (im.thumb || im.large);
        return p ? `${API_BASE}${p}` : null;
      })();
      const priceDay = Number(c.pricePerDay || 0);
      card.innerHTML = `
        <div class="cc-img" data-car-details="${c.id}">
          ${firstImg
            ? `<img alt="${escHtml(c.brand)} ${escHtml(c.model)}" src="${firstImg}" loading="lazy" class="cc-photo">`
            : `<svg viewBox="0 0 400 200" class="cc-sil" role="img" aria-label="${escHtml(c.brand)} ${escHtml(c.model)}"><path d="M50 140 Q60 100 120 90 L160 70 Q200 55 260 70 L310 90 Q360 100 370 140 Z" fill="#9CA3AF"/><circle cx="120" cy="150" r="22" fill="#6B7280"/><circle cx="120" cy="150" r="12" fill="#D1D5DB"/><circle cx="310" cy="150" r="22" fill="#6B7280"/><circle cx="310" cy="150" r="12" fill="#D1D5DB"/><rect x="40" y="140" width="340" height="6" rx="3" fill="#9CA3AF"/></svg>`
          }
        </div>
        <div class="cc-body">
          <div class="cc-head">
            <div>
              <h3 class="cc-name" data-car-details="${c.id}">${escHtml(c.brand)} ${escHtml(c.model)}</h3>
              <p class="cc-type">${escHtml(c.type || '')}</p>
            </div>
            <div class="cc-price-block">
              <span class="cc-price">€${priceDay.toFixed(0)}</span>
              <span class="cc-per">на ден</span>
            </div>
          </div>
          <div id="vp-specs-${c.id}" class="cc-specs"></div>
          <button class="cc-btn" data-details="${c.id}">
            Разгледай
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      `;
      grid.appendChild(card);

      // Render specs directly from car fields: transmission, seats, fuel
      const specsEl = document.getElementById(`vp-specs-${c.id}`);
      if (specsEl) {
        const specs = [];
        if (c.transmission) specs.push({ icon: gearIcon(), text: displayVal(c.transmission) });
        if (c.seats) specs.push({ icon: seatIcon(), text: c.seats + ' места' });
        if (c.fuel) specs.push({ icon: fuelIcon(), text: displayVal(c.fuel) });
        specsEl.innerHTML = specs.map(s => `<div class="cc-spec-item">${s.icon}<span>${escHtml(String(s.text))}</span></div>`).join('');
      }

      // Availability
      const selFrom = filterState.from;
      const selTo = filterState.to;
      const isService = () => { const s = (c.status||'').toString().toLowerCase(); return s.includes('серв') || s==='service'; };
      const hasOverlap = () => {
        if (!selFrom || !selTo) return false;
        const rel = (reservations||[]).filter(r => r.carId===c.id && !(r.status && r.status.toUpperCase()==='DECLINED'));
        return rel.some(r => isOverlap(selFrom, selTo, r.from, r.to));
      };
      const available = !isService() && !hasOverlap();
      const btn = card.querySelector('.cc-btn');
      if (btn && !available) { btn.disabled = true; btn.classList.add('cc-btn-disabled'); }
    });

    // Clicks
    $$('[data-car-details]').forEach(el => el.onclick = () => openCarDetails(el.getAttribute('data-car-details')));
    $$('[data-details]').forEach(b => b.onclick = (e) => {
      const id = e.currentTarget.getAttribute('data-details');
      const q = new URLSearchParams({ car:id, pick:filterState.pick, drop:filterState.drop||filterState.pick, from:filterState.from||'', to:filterState.to||'' }).toString();
      navigate(`#/reserve?${q}&step=1`);
    });
  }

  /* ===== ABOUT US PAGE ===== */
  function mountAboutUsPage() {
    app.className = 'landing-wrap';
    app.innerHTML = `
      ${siteHeaderHTML('about-us')}

      <!-- ABOUT HERO -->
      <section class="au-hero" id="main-content">
        <h1 class="au-hero-title">За нас</h1>
        <p class="au-hero-breadcrumb"><a href="#/">Начало</a> / За нас</p>
      </section>

      <!-- WHY CHOOSE US -->
      <section class="au-why-section">
        <div class="au-why-inner">
          <div class="au-why-left">
            <h2 class="au-why-heading">Всяко пътуване<br>да бъде<br>незабравимо</h2>
          </div>
          <div class="au-why-right">
            <div class="au-why-grid">
              <div class="au-why-card">
                <div class="au-why-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
                </div>
                <h3>Разнообразие от марки</h3>
                <p>Разполагаме с богат автопарк от различни марки и класове автомобили, за да отговорим на всяка нужда — от градски коли до просторни джипове.</p>
              </div>
              <div class="au-why-card">
                <div class="au-why-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
                </div>
                <h3>Отлична поддръжка</h3>
                <p>Нашият екип е на разположение 7 дни в седмицата, за да ви помогне с резервации, въпроси и всичко необходимо по време на наема.</p>
              </div>
              <div class="au-why-card">
                <div class="au-why-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3>Максимална свобода</h3>
                <p>Без скрити такси и ограничения. Наемете кола и пътувайте свободно из цялата страна с пълна застраховка и пътна помощ.</p>
              </div>
              <div class="au-why-card">
                <div class="au-why-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <h3>Гъвкавост по всяко време</h3>
                <p>Резервирайте онлайн бързо и лесно. Предлагаме гъвкави условия за наем — от един ден до няколко месеца, с възможност за удължаване.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- VIDEO SECTION -->
      <section class="au-video-section">
        <div class="au-video-inner">
          <img src="/uploads/site/about-video.jpg" alt="Предаване на ключове за автомобил под наем" loading="lazy">
          <div class="au-video-overlay"></div>
        </div>
      </section>

      <!-- STATS -->
      <section class="au-stats-section">
        <div class="au-stats-inner">
          <div class="au-stat">
            <span class="au-stat-value">2 000+</span>
            <span class="au-stat-label">Доволни клиенти</span>
          </div>
          <div class="au-stat">
            <span class="au-stat-value">${cars.length}+</span>
            <span class="au-stat-label">Автомобила в автопарка</span>
          </div>
          <div class="au-stat">
            <span class="au-stat-value">10+</span>
            <span class="au-stat-label">Години опит</span>
          </div>
        </div>
      </section>

      <!-- MEMORIES -->
      <section class="au-memories-section">
        <div class="au-memories-inner">
          <div class="au-memories-text">
            <h2>Защо клиентите ни<br>се връщат отново</h2>
            <p>Ние вярваме, че качествената услуга се гради на доверие, прозрачност и внимание към детайла. Всеки автомобил е поддържан в отлично състояние.</p>
            <div class="au-memories-checks">
              <div class="au-mem-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Всички автомобили са технически изправни и редовно обслужвани.</span>
              </div>
              <div class="au-mem-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Пълна застраховка „Каско" и „Гражданска отговорност" за спокойно пътуване.</span>
              </div>
              <div class="au-mem-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Прозрачно ценообразуване — без скрити такси и допълнителни разходи.</span>
              </div>
              <div class="au-mem-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Плащане единствено по банков път — удобно и сигурно.</span>
              </div>
              <div class="au-mem-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Бърза и лесна онлайн резервация с потвърждение до минути.</span>
              </div>
              <div class="au-mem-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                <span>Гъвкави условия за удължаване на наемния период по всяко време.</span>
              </div>
            </div>
          </div>
          <div class="au-memories-img">
            <img src="/uploads/site/memories-family.jpg" alt="Щастливо семейство в кола под наем" loading="lazy">
          </div>
        </div>
      </section>

      <!-- REVIEWS -->
      <section class="au-reviews-section">
        <h2 class="au-reviews-title">Какво казват нашите клиенти</h2>
        <div class="au-reviews-grid">
          <div class="au-review-card">
            <div class="au-review-quote">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#6366F1" opacity="0.15"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
            </div>
            <p class="au-review-text">Наех кола за семейна почивка и останах изключително доволен. Автомобилът беше чист, в перфектно състояние, а обслужването — бързо и професионално. Определено ще се върна отново!</p>
            <div class="au-review-author">
              <img class="au-review-avatar" src="/uploads/site/face-georgi.jpg" alt="Георги Димитров">
              <div>
                <div class="au-review-name">Георги Димитров</div>
                <div class="au-review-stars">★★★★★</div>
              </div>
            </div>
          </div>
          <div class="au-review-card">
            <div class="au-review-quote">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#6366F1" opacity="0.15"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
            </div>
            <p class="au-review-text">Много удобен процес на резервация. Плащането по банков път е прозрачно и без изненади. Колата беше точно както в описанието. Препоръчвам на всеки, който търси надеждна услуга!</p>
            <div class="au-review-author">
              <img class="au-review-avatar" src="/uploads/site/face-maria.jpg" alt="Мария Иванова">
              <div>
                <div class="au-review-name">Мария Иванова</div>
                <div class="au-review-stars">★★★★★</div>
              </div>
            </div>
          </div>
          <div class="au-review-card">
            <div class="au-review-quote">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#6366F1" opacity="0.15"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
            </div>
            <p class="au-review-text">Използвам услугите им за служебни пътувания от година насам. Винаги коректни, гъвкави и отзивчиви. Фактурирането е бързо и точно. Отлично партньорство за бизнеса!</p>
            <div class="au-review-author">
              <img class="au-review-avatar" src="/uploads/site/face-petar.jpg" alt="Петър Стоянов">
              <div>
                <div class="au-review-name">Петър Стоянов</div>
                <div class="au-review-stars">★★★★★</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="au-faq-section" id="faq">
        <h2 class="au-faq-title">Често задавани въпроси</h2>
        <div class="au-faq-list" id="auFaqList">
          <div class="au-faq-item open">
            <button class="au-faq-q" aria-expanded="true" aria-controls="faq-a-1">
              <span>Как мога да резервирам автомобил?</span>
              <svg class="au-faq-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="au-faq-a" id="faq-a-1" role="region">
              <p>Резервацията е бърза и лесна — изберете автомобил от нашия автопарк, посочете дати за наемане и връщане, попълнете данните си и изпратете заявка. Ще се свържем с вас за потвърждение и подробности за плащането по банков път.</p>
            </div>
          </div>
          <div class="au-faq-item">
            <button class="au-faq-q" aria-expanded="false" aria-controls="faq-a-2">
              <span>Какъв е начинът на плащане?</span>
              <svg class="au-faq-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="au-faq-a" id="faq-a-2" role="region">
              <p>Плащането се извършва единствено по банков път. След потвърждение на резервацията ще получите проформа фактура с банковите реквизити. Наемът се счита за потвърден след получаване на плащането по нашата банкова сметка.</p>
            </div>
          </div>
          <div class="au-faq-item">
            <button class="au-faq-q" aria-expanded="false" aria-controls="faq-a-3">
              <span>Какви документи са необходими за наемане?</span>
              <svg class="au-faq-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="au-faq-a" id="faq-a-3" role="region">
              <p>Необходими са валидна шофьорска книжка (минимум 2 години стаж), лична карта или паспорт и навършени 21 години. За чуждестранни граждани може да се изисква международна шофьорска книжка.</p>
            </div>
          </div>
          <div class="au-faq-item">
            <button class="au-faq-q" aria-expanded="false" aria-controls="faq-a-4">
              <span>Включена ли е застраховка в цената на наема?</span>
              <svg class="au-faq-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="au-faq-a" id="faq-a-4" role="region">
              <p>Да, всички наши автомобили са с пълна застраховка „Гражданска отговорност" и „Каско". Допълнителни покрития и пътна помощ могат да бъдат уговорени при резервацията.</p>
            </div>
          </div>
          <div class="au-faq-item">
            <button class="au-faq-q" aria-expanded="false" aria-controls="faq-a-5">
              <span>Мога ли да удължа наемния период?</span>
              <svg class="au-faq-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="au-faq-a" id="faq-a-5" role="region">
              <p>Да, можете да удължите наемния период, като се свържете с нас поне 24 часа преди крайната дата. Удължаването подлежи на наличност и се заплаща допълнително по банков път. Ще получите актуализирана фактура.</p>
            </div>
          </div>
          <div class="au-faq-item">
            <button class="au-faq-q" aria-expanded="false" aria-controls="faq-a-6">
              <span>Какви са условията за анулиране на резервация?</span>
              <svg class="au-faq-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="au-faq-a" id="faq-a-6" role="region">
              <p>Безплатно анулиране е възможно до 48 часа преди началото на наемния период. При по-късно анулиране може да бъде удържана неустойка съгласно общите условия. Възстановяването на сумата се извършва по банков път.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA BANNER -->
      <section class="au-cta-section">
        <div class="au-cta-inner">
          <div class="au-cta-text">
            <h2>Търсите автомобил под наем?</h2>
            <p class="au-cta-phone">${companyInfo.phone || '+359 888 810 469'}</p>
            <p class="au-cta-desc">Свържете се с нас по телефон или разгледайте нашия автопарк онлайн. Ще ви помогнем да намерите идеалния автомобил за вашето пътуване.</p>
            <a href="#/vehicles" class="au-cta-btn">Разгледай автопарка</a>
          </div>
        </div>
      </section>

      ${siteFooterHTML()}
    `;
    bindHamburger();

    // FAQ accordion (with aria-expanded)
    const faqList = $('#auFaqList');
    if (faqList) {
      faqList.querySelectorAll('.au-faq-q').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = btn.closest('.au-faq-item');
          const wasOpen = item.classList.contains('open');
          faqList.querySelectorAll('.au-faq-item').forEach(i => {
            i.classList.remove('open');
            const b = i.querySelector('.au-faq-q');
            if (b) b.setAttribute('aria-expanded', 'false');
          });
          if (!wasOpen) {
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });
    }
  }

  /* ===== POLICIES PAGE ===== */
  // ── Policy placeholder tokens ──
  // These tokens are stored in DB and replaced at render-time with current companyInfo.
  // Admin sees the tokens (e.g. {{company_name}}); public site sees the real values.
  const POLICY_PLACEHOLDERS = {
    '{{company_name}}':    () => (companyInfo||{}).name    || 'Meniar.com',
    '{{company_eik}}':     () => (companyInfo||{}).eik     || '—',
    '{{company_address}}': () => { const c=companyInfo||{}; return (c.city ? 'гр. '+c.city+', ' : '')+(c.address || 'България'); },
    '{{company_email}}':   () => (companyInfo||{}).email   || 'info@meniar.com',
    '{{company_phone}}':   () => (companyInfo||{}).phone   || '+359 888 810 469',
    '{{company_phone_clean}}': () => ((companyInfo||{}).phone || '+359888810469').replace(/[\s-]/g,''),
    '{{extra_driver_price}}': () => Number((companyInfo||{}).extraDriverPrice ?? 10).toFixed(2),
    '{{insurance_price}}': () => Number((companyInfo||{}).insurancePrice ?? 15).toFixed(2),
  };

  /** Replace {{tokens}} in html with actual companyInfo values */
  function resolvePolicyPlaceholders(html) {
    if (!html) return html;
    let result = html;
    for (const [token, resolver] of Object.entries(POLICY_PLACEHOLDERS)) {
      // Use split/join for global replace (no regex escaping needed)
      result = result.split(token).join(resolver());
    }
    return result;
  }

  function getPolicySections() {
    return [
    { slug: 'privacy', title: 'Политика за поверителност', icon: 'fa-shield-halved',
      defaultContent: `<p class="pol-meta">Дата на последна актуализация: 08.02.2026</p>
<p><strong>{{company_name}}</strong> (администратор на данните), ЕИК {{company_eik}}, с адрес {{company_address}}, обработва лични данни според GDPR (EU 2016/679) и Закона за защита на личните данни.</p>

<h3>Какви данни събираме</h3>
<ul>
<li><strong>Идентичност:</strong> име, ЕГН/ЕИК, дата на раждане, адрес, телефон, имейл.</li>
<li><strong>Шофьорски права:</strong> номер, дата на изтичане.</li>
<li><strong>Резервация:</strong> дати, локации, автомобил.</li>
<li><strong>Плащане:</strong> данни за банков превод, депозит.</li>
<li><strong>Уеб:</strong> IP, cookies, посещения (Google Analytics).</li>
</ul>

<h3>Цели на обработката</h3>
<ul>
<li>Изпълнение на договор (резервация, наем).</li>
<li>Маркетинг (само при изрично съгласие).</li>
<li>Законови задължения (застраховки, данъци).</li>
</ul>
<p><strong>Основание:</strong> договор, съгласие, закон.</p>

<h3>Към кого споделяме данни</h3>
<p>Подизпълнители (застрахователи, платежни платформи), власти (ако е необходимо по закон). <strong>Не продаваме лични данни на трети страни.</strong></p>

<h3>Вашите права</h3>
<p>Достъп, коригиране, изтриване, възражение, преносимост. Пишете ни на <a href="mailto:{{company_email}}">{{company_email}}</a>. Срок за отговор: <strong>1 месец</strong>.</p>

<h3>Бисквитки</h3>
<p>Вижте нашата <a href="#/policies" onclick="setTimeout(()=>{const el=document.getElementById('pol-cookies');if(el)el.scrollIntoView({behavior:'smooth'})},100)">Политика за бисквитки</a>.</p>

<h3>Срок на съхранение</h3>
<ul>
<li>Договорни данни – <strong>5 години</strong>.</li>
<li>Маркетинг – до отмяна на съгласието.</li>
</ul>

<h3>Свържете се с нас</h3>
<p>Имейл: <a href="mailto:{{company_email}}">{{company_email}}</a> | Телефон: <a href="tel:{{company_phone_clean}}">{{company_phone}}</a></p>
<p>Жалби: Комисия за защита на личните данни (<a href="https://www.cpdp.bg" target="_blank" rel="noopener">www.cpdp.bg</a>).</p>` },

    { slug: 'terms', title: 'Условия за ползване', icon: 'fa-file-contract',
      defaultContent: `<p class="pol-meta">Дата на последна актуализация: 08.02.2026</p>

<h3>Обхват</h3>
<p>Тези условия регулират наема на автомобили чрез сайта на <strong>{{company_name}}</strong>. Клиентът (Наемател) приема условията при извършване на резервация.</p>

<h3>Изисквания за Наемател</h3>
<ul>
<li>Навършени <strong>21 години</strong> (23+ за премиум класове).</li>
<li>Минимум <strong>1 година</strong> шофьорски опит.</li>
<li>Валидна шофьорска книжка (ЕС формат).</li>
<li>Кредитна/дебитна карта за депозит.</li>
<li>Допълнителен водач – <strong>€{{extra_driver_price}}/ден</strong>.</li>
</ul>

<h3>Цената включва</h3>
<ul>
<li>Наем на автомобила.</li>
<li>Застраховка „Гражданска отговорност".</li>
<li>CDW + TP (самоучастие €500–1500).</li>
<li>Винетка за България.</li>
<li>Неограничен километраж.</li>
<li>ДДС 20%.</li>
<li>Зимни гуми (ноември–март).</li>
</ul>

<h3>Застраховки</h3>
<ul>
<li><strong>Гражданска отговорност (Third-party liability):</strong> Задължително покритие.</li>
<li><strong>CDW (Collision Damage Waiver):</strong> Покритие на щети до размера на самоучастието. Валидно само с полицейски протокол.</li>
<li><strong>TP (Theft Protection):</strong> Защита при кражба.</li>
<li><strong>Super CDW / Full Coverage:</strong> Намалява самоучастие до €0 — <strong>€{{insurance_price}}/ден</strong>.</li>
</ul>

<h3>Плащане и депозит</h3>
<p>Плащането се извършва по <strong>банков път</strong>. Депозит от <strong>€200–2000</strong> (блокиране на карта). Гориво: политика „пълен/пълен".</p>

<h3>Анулиране</h3>
<p>Безплатно анулиране до <strong>72 часа</strong> преди вземане. По-късно — таксува се 1 ден наем. Вижте <a href="#/policies" onclick="setTimeout(()=>{const el=document.getElementById('pol-cancellation');if(el)el.scrollIntoView({behavior:'smooth'})},100)">Политика за анулиране</a>.</p>

<h3>Отговорности на Наемателя</h3>
<ul>
<li>Без управление под влияние на алкохол/наркотици.</li>
<li>Спазване на Правилника за движение по пътищата.</li>
<li><strong>Забранено:</strong> офроуд шофиране, търговски транспорт.</li>
</ul>

<h3>Отказ от услуга</h3>
<p>При нарушаване на условията — наемателят поема отговорност за всички такси, глоби и щети.</p>

<h3>Законодателство</h3>
<p>Приложимо е <strong>българското право</strong>. Компетентен съд — гр. София.</p>` },

    { slug: 'cookies', title: 'Политика за бисквитки', icon: 'fa-cookie-bite',
      defaultContent: `<p class="pol-meta">Дата на последна актуализация: 08.02.2026</p>
<p>Използваме бисквитки за подобряване работата на сайта. Съгласие се дава чрез банера за бисквитки.</p>

<h3>Какво са бисквитки</h3>
<p>Бисквитките са малки текстови файлове, които се записват на вашето устройство. Те служат за управление на сесии, запомняне на предпочитания и анализ на трафика.</p>

<h3>Типове бисквитки</h3>
<table class="pol-table">
<thead><tr><th>Тип</th><th>Цел</th><th>Примери</th><th>Срок</th></tr></thead>
<tbody>
<tr><td><strong>Необходими</strong></td><td>Основни функции на сайта</td><td>session_id</td><td>Сесия</td></tr>
<tr><td><strong>Аналитика</strong></td><td>Статистика на посещенията</td><td>Google Analytics (_ga)</td><td>2 години</td></tr>
<tr><td><strong>Маркетинг</strong></td><td>Персонализирани реклами</td><td>Facebook Pixel</td><td>90 дни</td></tr>
</tbody>
</table>

<h3>Трети страни</h3>
<p>Бисквитки от трети страни могат да бъдат поставяни от: Google, Facebook.</p>

<h3>Вашите права</h3>
<p>Можете да оттеглите съгласието си по всяко време чрез банера за бисквитки или настройките на браузъра. Поддържаме GPC (Global Privacy Control).</p>
<p>За повече информация, вижте нашата <a href="#/policies" onclick="setTimeout(()=>{const el=document.getElementById('pol-privacy');if(el)el.scrollIntoView({behavior:'smooth'})},100)">Политика за поверителност</a>.</p>` },

    { slug: 'cancellation', title: 'Политика за анулиране и възстановяване', icon: 'fa-rotate-left',
      defaultContent: `<p class="pol-meta">Дата на последна актуализация: 08.02.2026</p>
<p>Резервации могат да бъдат анулирани онлайн или чрез връзка с нашия екип.</p>

<h3>Условия за анулиране</h3>
<table class="pol-table">
<thead><tr><th>Период преди вземане</th><th>Условие</th></tr></thead>
<tbody>
<tr><td><strong>Повече от 72 часа</strong></td><td>100% възстановяване на сумата</td></tr>
<tr><td><strong>24–72 часа</strong></td><td>50% такса от стойността на наема</td></tr>
<tr><td><strong>По-малко от 24 часа</strong></td><td>Такса в размер на 1 ден наем, без възстановяване на остатъка</td></tr>
<tr><td><strong>Неявяване (No-show)</strong></td><td>Пълната сума на резервацията се удържа</td></tr>
</tbody>
</table>

<h3>Процедура за възстановяване</h3>
<p>Възстановяването на суми се извършва в срок от <strong>5–10 работни дни</strong> по банков път по сметката, от която е направено плащането.</p>

<h3>Изключения</h3>
<p>При доказан <strong>форсмажор</strong> (природно бедствие, пандемия, внезапно заболяване с медицинско удостоверение) — сумата се възстановява в пълен размер, независимо от периода на анулиране.</p>

<h3>Свържете се с нас</h3>
<p>За анулиране или въпроси: <a href="mailto:{{company_email}}">{{company_email}}</a> | <a href="tel:{{company_phone_clean}}">{{company_phone}}</a></p>` },

    { slug: 'insurance', title: 'Застраховки', icon: 'fa-car-burst',
      defaultContent: `<p class="pol-meta">Дата на последна актуализация: 08.02.2026</p>

<h3>Гражданска отговорност (Third-party liability)</h3>
<p><strong>Задължително покритие</strong>, включено в цената на всеки наем. Покрива щети, причинени на трети лица — имуществени и неимуществени.</p>

<h3>CDW (Collision Damage Waiver)</h3>
<p>Ограничава отговорността на наемателя при щети по автомобила до размера на <strong>самоучастието (€500–1500)</strong>. Валидно е само при наличие на <strong>полицейски протокол</strong>.</p>
<p><strong>Изключения:</strong> небрежност, управление под влияние на алкохол/наркотици, нарушаване на условията за ползване.</p>

<h3>TP (Theft Protection)</h3>
<p>Защита при кражба на автомобила. Покритие до размера на самоучастието (<strong>€500–1500</strong>). Изисква полицейски протокол.</p>

<h3>Super CDW / Full Coverage</h3>
<p>Допълнителна опция на цена от <strong>€{{insurance_price}}/ден</strong>. Намалява самоучастието до <strong>€0</strong> — пълно покритие за спокойствие по пътищата.</p>

<h3>Допълнителни застраховки</h3>
<ul>
<li><strong>PAI (Personal Accident Insurance):</strong> Застраховка на водача и пътниците — покрива медицински разходи при произшествие.</li>
<li><strong>PEC (Personal Effects Coverage):</strong> Застраховка на личен багаж и вещи в автомобила.</li>
</ul>

<h3>Важно</h3>
<p>Всички застрахователни покрития са валидни само на територията на <strong>България</strong>, освен ако не е договорено друго. За пътуване в чужбина се свържете с нашия екип за допълнителна „Зелена карта".</p>
<p>За въпроси: <a href="mailto:{{company_email}}">{{company_email}}</a> | <a href="tel:{{company_phone_clean}}">{{company_phone}}</a></p>` }
  ];
  }

  async function mountPoliciesPage() {
    const POLICY_SECTIONS = getPolicySections();
    app.className = 'landing-wrap';
    // Load policies from API
    let policies = [];
    try {
      policies = await fetch(`${API_BASE}/api/policies`).then(r => r.json());
    } catch (e) { /* fallback to defaults */ }
    const policyMap = {};
    (policies || []).forEach(p => { policyMap[p.slug] = p; });

    // Auto-seed missing / empty policies into DB so admin can edit them later
    for (const sec of POLICY_SECTIONS) {
      const existing = policyMap[sec.slug];
      if (!existing || !existing.content || existing.content.trim() === '' || existing.content === '<p><br></p>') {
        try {
          const res = await fetch(`${API_BASE}/api/policies/${sec.slug}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ title: sec.title, content: sec.defaultContent })
          });
          if (res.ok) {
            const saved = await res.json();
            policyMap[sec.slug] = saved;
          }
        } catch (e) { /* ignore */ }
      }
    }

    const sectionsHTML = POLICY_SECTIONS.map((sec, idx) => {
      const saved = policyMap[sec.slug];
      const content = (saved && saved.content) ? saved.content : sec.defaultContent;
      const title = (saved && saved.title) ? saved.title : sec.title;
      return `
        <div class="pol-section" id="pol-${sec.slug}">
          <div class="pol-section-header">
            <div class="pol-section-icon"><i class="fa-solid ${sec.icon}"></i></div>
            <h2 class="pol-section-title">${title}</h2>
          </div>
          <div class="pol-section-body">${resolvePolicyPlaceholders(content)}</div>
        </div>
      `;
    }).join('');

    const tocHTML = POLICY_SECTIONS.map(sec => {
      const saved = policyMap[sec.slug];
      const title = (saved && saved.title) ? saved.title : sec.title;
      return `<a href="#pol-${sec.slug}" class="pol-toc-link" data-pol-anchor="pol-${sec.slug}"><i class="fa-solid ${sec.icon}"></i> ${title}</a>`;
    }).join('');

    app.innerHTML = `
      ${siteHeaderHTML('policies')}
      <section class="au-hero">
        <h1 class="au-hero-title">Условия и Политики</h1>
        <p class="au-hero-breadcrumb"><a href="#/">Начало</a> / Условия и Политики</p>
      </section>

      <section class="pol-content-section">
        <div class="pol-content-inner">
          <aside class="pol-toc">
            <h3 class="pol-toc-title">Съдържание</h3>
            ${tocHTML}
          </aside>
          <div class="pol-main">
            ${sectionsHTML}
          </div>
        </div>
      </section>

      <section class="au-cta-section">
        <div class="au-cta-inner">
          <div class="au-cta-text">
            <h2>Имате въпроси?</h2>
            <p class="au-cta-phone">${companyInfo.phone || '+359 888 810 469'}</p>
            <p class="au-cta-desc">Свържете се с нас по телефон или имейл. Нашият екип ще ви отговори в рамките на работния ден.</p>
            <a href="#footer" class="au-cta-btn">Свържете се с нас</a>
          </div>
        </div>
      </section>

      ${siteFooterHTML()}
    `;
    bindHamburger();

    // TOC smooth scroll
    $$('[data-pol-anchor]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(link.getAttribute('data-pol-anchor'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // highlight active
        $$('[data-pol-anchor]').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Highlight first TOC item
    const firstToc = $('[data-pol-anchor]');
    if (firstToc) firstToc.classList.add('active');

    // Scroll spy for TOC
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          $$('[data-pol-anchor]').forEach(l => l.classList.remove('active'));
          const activeLink = $(`[data-pol-anchor="${id}"]`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }, { rootMargin: '-100px 0px -60% 0px' });
    $$('.pol-section').forEach(sec => observer.observe(sec));
  }

  /* ===== ADMIN SITE IMAGES ===== */
  function renderAdminImages() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('images') + `
      <div class="panel" style="padding:16px;">
        <div class="header" style="padding:0 0 12px 0; border:0;">
          <h2>Снимки на сайта</h2>
        </div>
        <p style="color:#6B7280; font-size:13px; margin:0 0 16px;">
          Управлявайте всички декоративни снимки по сайта — фонове, секции, аватари на ревюта.
          <br>Препоръчителните размери са посочени до всяка снимка. Поддържани формати: JPG, PNG, WebP, AVIF (до 5 MB).
        </p>
        <div id="siteImagesGrid" style="display:grid; gap:16px;">
          <div style="text-align:center; color:#9CA3AF; padding:32px;">Зареждане...</div>
        </div>
      </div>
    `;

    loadSiteImages();

    async function loadSiteImages() {
      try {
        const slots = await fetch(API_BASE + '/api/site-images').then(r => r.json());
        const grid = $('#siteImagesGrid');
        if (!grid) return;

        const imgIcon = '<svg style="color:#9CA3AF;" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
        const uploadIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

        grid.innerHTML = slots.map(function(slot) {
          var isAvatar = slot.key.indexOf('face-') === 0;
          var thumbRadius = isAvatar ? '50%' : '10px';
          var preview = '';
          if (slot.currentUrl) {
            preview = '<img src="' + escHtml(slot.currentUrl) + '?t=' + Date.now() + '" alt="' + escHtml(slot.label) + '" style="width:100%;height:100%;object-fit:cover;display:block;">' +
                      '<svg style="display:none;color:#9CA3AF;" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
          } else {
            preview = imgIcon;
          }
          var statusBadge = slot.currentUrl
            ? '<span style="font-size:11px;color:#10B981;margin-left:8px;">✓ Качена</span>'
            : '<span style="font-size:11px;color:#EF4444;margin-left:8px;">✗ Няма снимка</span>';

          return '<div class="si-slot" data-key="' + escHtml(slot.key) + '" style="display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:center;padding:14px;border:1px solid #E5E7EB;border-radius:12px;background:#FAFAFA;">' +
            '<div style="width:140px;height:96px;border-radius:' + thumbRadius + ';overflow:hidden;background:#E5E7EB;display:grid;place-items:center;border:2px dashed #D1D5DB;">' +
              preview +
            '</div>' +
            '<div>' +
              '<div style="font-weight:600;font-size:14px;color:#111827;margin-bottom:2px;">' + escHtml(slot.label) + '</div>' +
              '<div style="font-size:12px;color:#6B7280;margin-bottom:8px;">Размер: <strong>' + escHtml(slot.hint) + '</strong></div>' +
              '<label class="btn-primary si-upload-label" data-key="' + escHtml(slot.key) + '" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;padding:6px 14px;border-radius:8px;">' +
                uploadIcon + ' Качи снимка' +
                '<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="si-file-input" style="display:none;">' +
              '</label>' +
              statusBadge +
            '</div>' +
          '</div>';
        }).join('');

        // Bind upload handlers via JS (not inline onchange, which CSP blocks)
        $$('.si-file-input').forEach(function(input) {
          input.addEventListener('change', function() {
            var key = input.closest('.si-upload-label').getAttribute('data-key');
            if (key) handleSiteImageUpload(key, input);
          });
        });

      } catch (err) {
        const grid = $('#siteImagesGrid');
        if (grid) grid.innerHTML = '<div style="color:#EF4444; padding:16px;">Грешка при зареждане на снимките.</div>';
        console.error('Failed to load site images:', err);
      }
    }

    async function handleSiteImageUpload(key, input) {
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) { alert('Файлът е по-голям от 5 MB.'); return; }

      const fd = new FormData();
      fd.append('image', file);

      // Show loading state
      const btn = input.closest('label');
      const origText = btn.innerHTML;
      btn.innerHTML = '<span style="font-size:12px;">Качване...</span>';
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';

      try {
        const resp = await fetch(API_BASE + '/api/site-images/' + encodeURIComponent(key), {
          method: 'POST',
          body: fd,
          headers: authHeaders()
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(function() { return {}; });
          throw new Error(errData.error || 'Upload failed');
        }
        alert('Снимката е качена успешно!');
        // Reload the images list to show updated thumbnails
        loadSiteImages();
      } catch (err) {
        alert('Грешка: ' + err.message);
        btn.innerHTML = origText;
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
      }
    }
  }

  /* ===== ADMIN NEWSLETTER ===== */
  function renderAdminNewsletter() {
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('newsletter') + `
      <div class="panel" style="padding:16px;">
        <div class="header" style="padding:0 0 12px 0; border:0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <h2>Абонати за бюлетин</h2>
          <span id="nlCount" style="font-size:13px; color:#6B7280;"></span>
        </div>
        <div id="nlList" style="margin-top:8px;">
          <div style="text-align:center; color:#9CA3AF; padding:32px;">Зареждане...</div>
        </div>
      </div>
    `;
    loadNewsletterList();

    async function loadNewsletterList() {
      const listEl = $('#nlList');
      const countEl = $('#nlCount');
      if (!listEl) return;
      try {
        const res = await fetch(API_BASE + '/api/newsletter', {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const list = await res.json();
        if (countEl) countEl.textContent = 'Общо: ' + list.length + ' абонат' + (list.length === 1 ? '' : 'а');
        if (!list.length) {
          listEl.innerHTML = '<div style="text-align:center; color:#9CA3AF; padding:32px;">Няма абонати все още.</div>';
          return;
        }
        const fmtDate = (d) => { const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('bg-BG', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); };
        listEl.innerHTML = `
          <div style="overflow-x:auto;">
            <table class="admin-table" style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#F3F4F6; text-align:left;">
                  <th style="padding:10px 14px; font-weight:600; color:#374151;">№</th>
                  <th style="padding:10px 14px; font-weight:600; color:#374151;">Имейл</th>
                  <th style="padding:10px 14px; font-weight:600; color:#374151;">Дата на абониране</th>
                  <th style="padding:10px 14px; font-weight:600; color:#374151; width:80px;"></th>
                </tr>
              </thead>
              <tbody>
                ${list.map((item, i) => `
                  <tr style="border-bottom:1px solid #E5E7EB;">
                    <td style="padding:10px 14px; color:#6B7280;">${i + 1}</td>
                    <td style="padding:10px 14px; font-weight:500;">
                      <a href="mailto:${escHtml(item.email)}" style="color:#4338CA; text-decoration:none;">${escHtml(item.email)}</a>
                    </td>
                    <td style="padding:10px 14px; color:#6B7280;">${fmtDate(item.createdAt)}</td>
                    <td style="padding:10px 14px; text-align:center;">
                      <button class="nl-del-btn" data-id="${escHtml(item.id)}" style="background:none; border:1px solid #EF4444; color:#EF4444; border-radius:6px; padding:4px 10px; cursor:pointer; font-size:12px; transition:all 0.15s;" title="Изтрий">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
            <button id="nlExportBtn" class="btn-secondary" style="font-size:13px; padding:8px 16px;">Експортирай CSV</button>
          </div>
        `;
        // Delete handlers
        $$('.nl-del-btn', listEl).forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('Изтриване на този абонат?')) return;
            const id = btn.dataset.id;
            btn.disabled = true;
            btn.textContent = '...';
            try {
              await fetch(API_BASE + '/api/newsletter/' + id, {
                method: 'DELETE'
              });
              loadNewsletterList();
            } catch (e) { alert('Грешка: ' + e.message); btn.disabled = false; btn.textContent = '✕'; }
          });
        });
        // Export CSV
        const exportBtn = $('#nlExportBtn', listEl);
        if (exportBtn) {
          exportBtn.addEventListener('click', () => {
            const csv = 'Имейл,Дата\n' + list.map(it => '"' + it.email + '","' + it.createdAt + '"').join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'newsletter_' + new Date().toISOString().slice(0, 10) + '.csv';
            a.click();
            URL.revokeObjectURL(url);
          });
        }
      } catch (e) {
        listEl.innerHTML = '<div style="color:#EF4444; padding:16px;">Грешка при зареждане: ' + escHtml(e.message) + '</div>';
      }
    }
  }

  /* ===== ADMIN POLICIES ===== */
  function renderAdminPolicies() {
    const POLICY_SECTIONS = getPolicySections();
    mountAdminIfNeeded(true);
    const root = $('#adminRoot');
    root.innerHTML = adminNav('policies') + `
      <div class="panel" style="padding:16px; margin-bottom:12px;">
        <div class="header" style="padding:0 0 12px 0; border:0;">
          <h2>Управление на политики и условия</h2>
        </div>
        <p style="color:#6B7280; font-size:13px; margin-bottom:16px;">Редактирайте съдържанието на всяка секция. Промените ще се отразят на публичната страница „Условия и Политики".</p>
        <div class="pol-admin-tabs" id="polAdminTabs">
          ${POLICY_SECTIONS.map((sec, idx) => `
            <button class="pol-admin-tab ${idx === 0 ? 'active' : ''}" data-pol-tab="${sec.slug}">
              <i class="fa-solid ${sec.icon}"></i> ${sec.title}
            </button>
          `).join('')}
        </div>
        <div id="polEditorWrap" style="margin-top:16px;">
          <div style="margin-bottom:12px;">
            <label style="font-weight:600; font-size:13px; color:#374151;">Заглавие на секцията</label>
            <input id="polTitle" class="input" style="margin-top:4px;">
          </div>
          <!-- Editor mode tabs -->
          <div class="pol-editor-mode-tabs">
            <button class="pol-editor-mode-tab active" data-editor-mode="visual"><i class="fa-solid fa-eye"></i> Визуален</button>
            <button class="pol-editor-mode-tab" data-editor-mode="source"><i class="fa-solid fa-code"></i> HTML код</button>
            <button class="pol-editor-mode-tab" data-editor-mode="preview"><i class="fa-solid fa-desktop"></i> Преглед</button>
          </div>
          <!-- Toolbar for visual mode -->
          <div id="polEditorToolbar" class="pol-editor-toolbar">
            <button type="button" data-cmd="bold" title="Удебелен"><i class="fa-solid fa-bold"></i></button>
            <button type="button" data-cmd="italic" title="Курсив"><i class="fa-solid fa-italic"></i></button>
            <button type="button" data-cmd="underline" title="Подчертан"><i class="fa-solid fa-underline"></i></button>
            <button type="button" data-cmd="strikeThrough" title="Зачертан"><i class="fa-solid fa-strikethrough"></i></button>
            <span class="pol-toolbar-sep"></span>
            <button type="button" data-cmd="formatBlock" data-val="H2" title="Заглавие H2"><i class="fa-solid fa-heading"></i>2</button>
            <button type="button" data-cmd="formatBlock" data-val="H3" title="Заглавие H3"><i class="fa-solid fa-heading"></i>3</button>
            <button type="button" data-cmd="formatBlock" data-val="P" title="Параграф"><i class="fa-solid fa-paragraph"></i></button>
            <span class="pol-toolbar-sep"></span>
            <button type="button" data-cmd="insertUnorderedList" title="Списък"><i class="fa-solid fa-list-ul"></i></button>
            <button type="button" data-cmd="insertOrderedList" title="Номериран списък"><i class="fa-solid fa-list-ol"></i></button>
            <span class="pol-toolbar-sep"></span>
            <button type="button" data-cmd="createLink" title="Добави връзка"><i class="fa-solid fa-link"></i></button>
            <button type="button" data-cmd="unlink" title="Премахни връзка"><i class="fa-solid fa-link-slash"></i></button>
            <span class="pol-toolbar-sep"></span>
            <button type="button" data-cmd="insertTable" title="Добави таблица"><i class="fa-solid fa-table"></i></button>
            <button type="button" data-cmd="removeFormat" title="Изчисти форматиране"><i class="fa-solid fa-eraser"></i></button>
          </div>
          <!-- Visual editor (contenteditable) -->
          <div id="polEditorVisual" class="pol-editor-visual" contenteditable="true"></div>
          <!-- Source editor (textarea) -->
          <textarea id="polEditorSource" class="pol-editor-source" style="display:none;"></textarea>
          <!-- Preview pane -->
          <div id="polEditorPreview" class="pol-editor-preview" style="display:none;"></div>

          <div style="display:flex; align-items:center; gap:12px; margin-top:16px; flex-wrap:wrap;">
            <button class="btn-primary" id="polSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Запази промените</button>
            <button class="btn" id="polDefaultBtn" style="background:#F3F4F6; color:#374151; border:1px solid #D1D5DB; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px;" title="Презареди текста по подразбиране за тази секция"><i class="fa-solid fa-rotate-left"></i> Текст по подразбиране</button>
            <span id="polSaveMsg" style="color:#10B981; font-size:13px; display:none;">✓ Записано успешно</span>
          </div>
        </div>
      </div>
    `;

    let currentSlug = POLICY_SECTIONS[0].slug;
    let policiesData = {};
    let editorMode = 'visual'; // 'visual' | 'source' | 'preview'

    const visualEl = $('#polEditorVisual');
    const sourceEl = $('#polEditorSource');
    const previewEl = $('#polEditorPreview');
    const toolbarEl = $('#polEditorToolbar');

    // --- Toolbar commands ---
    toolbarEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      e.preventDefault();
      const cmd = btn.getAttribute('data-cmd');
      const val = btn.getAttribute('data-val') || null;
      visualEl.focus();
      if (cmd === 'createLink') {
        const url = prompt('URL на връзката:', 'https://');
        if (url) document.execCommand('createLink', false, url);
      } else if (cmd === 'insertTable') {
        const rows = parseInt(prompt('Брой редове:', '3')) || 3;
        const cols = parseInt(prompt('Брой колони:', '3')) || 3;
        let html = '<table class="pol-table"><thead><tr>';
        for (let c = 0; c < cols; c++) html += '<th>Заглавие</th>';
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows - 1; r++) {
          html += '<tr>';
          for (let c = 0; c < cols; c++) html += '<td>—</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';
        document.execCommand('insertHTML', false, html);
      } else {
        document.execCommand(cmd, false, val);
      }
    });

    // --- Editor mode switching ---
    function setEditorMode(mode) {
      const prevMode = editorMode;
      // Sync content between modes before switching
      if (prevMode === 'visual' && mode !== 'visual') {
        sourceEl.value = visualEl.innerHTML;
      } else if (prevMode === 'source' && mode !== 'source') {
        visualEl.innerHTML = sourceEl.value;
      }
      editorMode = mode;
      visualEl.style.display = mode === 'visual' ? 'block' : 'none';
      sourceEl.style.display = mode === 'source' ? 'block' : 'none';
      previewEl.style.display = mode === 'preview' ? 'block' : 'none';
      toolbarEl.style.display = mode === 'visual' ? 'flex' : 'none';
      if (mode === 'preview') {
        // Read from whichever mode we came from
        const html = prevMode === 'source' ? sourceEl.value : visualEl.innerHTML;
        previewEl.innerHTML = html;
      }
      $$('[data-editor-mode]').forEach(t => t.classList.toggle('active', t.getAttribute('data-editor-mode') === mode));
    }

    $$('[data-editor-mode]').forEach(tab => {
      tab.addEventListener('click', () => setEditorMode(tab.getAttribute('data-editor-mode')));
    });

    // --- Get current editor content ---
    function getEditorContent() {
      if (editorMode === 'source') return sourceEl.value;
      return visualEl.innerHTML;
    }

    // --- Set editor content ---
    function setEditorContent(html) {
      visualEl.innerHTML = html;
      sourceEl.value = html;
    }

    // --- Load all policies – auto-seed missing ones ---
    async function loadPolicies() {
      try {
        const list = await fetch(`${API_BASE}/api/policies`).then(r => r.json());
        (list || []).forEach(p => { policiesData[p.slug] = p; });
      } catch (e) { /* use defaults */ }

      // Auto-seed: policies missing from DB or with empty content
      for (const sec of POLICY_SECTIONS) {
        const existing = policiesData[sec.slug];
        if (!existing || !existing.content || existing.content.trim() === '' || existing.content === '<p><br></p>') {
          try {
            const res = await fetch(`${API_BASE}/api/policies/${sec.slug}`, {
              method: 'PUT',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ title: sec.title, content: sec.defaultContent })
            });
            if (res.ok) {
              const saved = await res.json();
              policiesData[sec.slug] = saved;
            }
          } catch (e) { /* ignore seed errors */ }
        }
      }
    }

    // --- Show a policy in the editor ---
    function showPolicy(slug) {
      currentSlug = slug;
      const sec = POLICY_SECTIONS.find(s => s.slug === slug);
      const saved = policiesData[slug];
      const titleInput = $('#polTitle');
      titleInput.value = (saved && saved.title) ? saved.title : (sec ? sec.title : '');
      const content = (saved && saved.content && saved.content.trim() !== '') ? saved.content : (sec ? sec.defaultContent : '');
      setEditorContent(content);
      if (editorMode === 'preview') {
        previewEl.innerHTML = content;
      }
      // Update active tab
      $$('[data-pol-tab]').forEach(t => t.classList.toggle('active', t.getAttribute('data-pol-tab') === slug));
      const msg = $('#polSaveMsg');
      if (msg) msg.style.display = 'none';
    }

    // --- Tab clicks ---
    $$('[data-pol-tab]').forEach(tab => {
      tab.addEventListener('click', () => showPolicy(tab.getAttribute('data-pol-tab')));
    });

    // --- Save ---
    const saveBtn = $('#polSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const title = $('#polTitle').value.trim();
        const content = getEditorContent();
        if (!title) { alert('Моля, въведете заглавие.'); return; }
        try {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Запазване...';
          const res = await fetch(`${API_BASE}/api/policies/${currentSlug}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ title, content })
          });
          const saved = await res.json();
          policiesData[currentSlug] = saved;
          const msg = $('#polSaveMsg');
          if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
        } catch (e) {
          alert('Грешка при запазване');
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Запази промените';
        }
      });
    }

    // --- Reset to default ---
    const defaultBtn = $('#polDefaultBtn');
    if (defaultBtn) {
      defaultBtn.addEventListener('click', () => {
        const sec = POLICY_SECTIONS.find(s => s.slug === currentSlug);
        if (!sec) return;
        if (!confirm(`Сигурни ли сте, че искате да презаредите текста по подразбиране за "${sec.title}"?\n\nВсички ваши промени ще бъдат загубени.`)) return;
        $('#polTitle').value = sec.title;
        setEditorContent(sec.defaultContent);
      });
    }

    // --- Init ---
    loadPolicies().then(() => showPolicy(currentSlug));
  }

  /** Force-scroll to top — bypasses CSS scroll-behavior:smooth */
  function scrollToTop() {
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.documentElement.style.scrollBehavior = '';
      document.body.style.scrollBehavior = '';
    });
  }

  function renderRoute() {
    const hash = location.hash || '#/';
    // "Контакти" — scroll to footer on any page
    if (hash === '#footer') {
      const ft = document.getElementById('footer');
      if (ft) { ft.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    if (hash.startsWith('#/admin')) {
      // If not logged in, show login form
      if (!isAdminLoggedIn()) { renderAdminLogin(); scrollToTop(); return; }
      const path = hash.split('?')[0];
      if (path === '#/admin' || path === '#/admin/') { renderAdminDashboard(); scrollToTop(); return; }
      if (path === '#/admin/cars') { renderAdminCars(); scrollToTop(); return; }
      if (path === '#/admin/params') { renderAdminParams(); scrollToTop(); return; }
      if (path === '#/admin/settings') { renderAdminSettings(); scrollToTop(); return; }
      if (path === '#/admin/reservations') { renderAdminReservations(); scrollToTop(); return; }
      if (path === '#/admin/invoices') { renderAdminInvoices(); scrollToTop(); return; }
      if (path === '#/admin/policies') { renderAdminPolicies(); scrollToTop(); return; }
      if (path === '#/admin/images') { renderAdminImages(); scrollToTop(); return; }
      if (path === '#/admin/newsletter') { renderAdminNewsletter(); scrollToTop(); return; }
      renderAdminDashboard(); scrollToTop(); return;
    }
    if (hash.startsWith('#/reserve')) { renderWizard(); scrollToTop(); return; }
    if (hash.startsWith('#/vehicles')) {
      mountVehiclesPage(); scrollToTop();
      // Background refresh — re-render vehicles with fresh data
      refreshCars().then(() => { if ((location.hash||'').startsWith('#/vehicles')) renderVpResults(); }).catch(() => {});
      return;
    }
    if (hash.startsWith('#/about-us')) { mountAboutUsPage(); scrollToTop(); return; }
    if (hash.startsWith('#/policies')) { mountPoliciesPage(); scrollToTop(); return; }
    // default home
    mountSearchLayout();
    renderFilters();
    applyFilters();
    scrollToTop();
    // Background refresh — re-render homepage with fresh data
    refreshCars().then(() => {
      const h = location.hash || '#/';
      if (h === '#/' || h === '' || h === '#') { renderFilters(); applyFilters(); }
    }).catch(() => {});
  }

  // Kickoff router
  renderRoute();
})(); 


