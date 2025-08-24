(() => {
  const apiBase = '';

  async function http(method, path, body) {
    const res = await fetch(apiBase + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const detail = typeof data === 'string' ? data : data?.detail || res.statusText;
      throw new Error(detail);
    }
    return data;
  }

  async function addRoute(prefix, nextHop) {
    return http('POST', '/routes', { prefix, next_hop: nextHop });
  }
  async function listRoutes() {
    return http('GET', '/routes');
  }
  async function lookup(ip) {
    return http('GET', `/lookup/${encodeURIComponent(ip)}`);
  }
  async function deleteRoute(prefix) {
    return http('DELETE', `/routes/${encodeURIComponent(prefix)}`);
  }

  function qs(sel) { return document.querySelector(sel); }

  const addRouteForm = qs('#addRouteForm');
  const prefixEl = qs('#prefix');
  const nextHopEl = qs('#nextHop');
  const lookupForm = qs('#lookupForm');
  const lookupIpEl = qs('#lookupIp');
  const lookupResultEl = qs('#lookupResult');
  const routesTableBody = qs('#routesTable tbody');
  const refreshBtn = qs('#refreshRoutes');
  const toggleRoutesBtn = qs('#toggleRoutes');
  const routesCollapsible = qs('#routesSectionBody');
  const routesCollapsibleInner = qs('#routesSectionBody .collapsible-inner');
  const themeToggleBtn = qs('#themeToggle');
  const viewTableBtn = qs('#viewTable');
  const viewCardsBtn = qs('#viewCards');
  const routesCards = qs('#routesCards');
  const routesSearch = qs('#routesSearch');
  const toastContainer = qs('#toastContainer');
  const flashOverlay = qs('#flashOverlay');

  const helpBtn = qs('#helpBtn');
  const helpModal = qs('#helpModal');
  const closeHelp = qs('#closeHelp');
  const closeHelpFooter = qs('#closeHelpFooter');

  function setLookupResult(text, isError) {
    lookupResultEl.hidden = false;
    lookupResultEl.textContent = text;
    lookupResultEl.style.borderColor = isError ? '#ff6b6b' : '#1f2a46';
    lookupResultEl.style.color = isError ? '#ffb3b3' : '';
  }

  function hashColor(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  function createAvatarDataUrl(key) {
    const fill = hashColor(key);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">\n  <circle cx="32" cy="32" r="30" fill="${fill}"/>\n  <text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="700">IP</text>\n</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function getAvatarUrl(key) {
    if (!getAvatarUrl.cache) getAvatarUrl.cache = new Map();
    const cache = getAvatarUrl.cache;
    if (cache.has(key)) return cache.get(key);
    const url = createAvatarDataUrl(key);
    cache.set(key, url);
    return url;
  }

  async function refreshRoutes() {
    try {
      const routes = await listRoutes();
      renderRoutes(routes);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function renderRoutes(allRoutes) {
    const term = (routesSearch.value || '').toLowerCase().trim();
    const routes = term ? allRoutes.filter(r => `${r.prefix} ${r.next_hop || r.nextHop}`.toLowerCase().includes(term)) : allRoutes;
    // Table
    routesTableBody.innerHTML = '';
    for (const r of routes) {
      const tr = document.createElement('tr');
      const tdP = document.createElement('td');
      tdP.className = 'prefix-cell';
      const tdN = document.createElement('td');
      const tdA = document.createElement('td');
      tdA.className = 'actions';
      const img = document.createElement('img');
      img.className = 'avatar';
      img.alt = '';
      img.src = getAvatarUrl(r.prefix);
      const span = document.createElement('span');
      span.textContent = r.prefix;
      tdP.appendChild(img);
      tdP.appendChild(span);
      tdN.textContent = r.next_hop || r.nextHop || r.nextHop;
      const delBtn = document.createElement('button');
      delBtn.className = 'del';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete route ${r.prefix}?`)) return;
        try { await deleteRoute(r.prefix); await refreshRoutes(); showToast('Route deleted', 'success'); } catch (e) { showToast(e.message, 'error'); }
      });
      tdA.appendChild(delBtn);
      tr.appendChild(tdP); tr.appendChild(tdN); tr.appendChild(tdA);
      routesTableBody.appendChild(tr);
    }

    // Cards
    routesCards.innerHTML = '';
    for (const r of routes) {
      const card = document.createElement('div');
      card.className = 'route-card';
      const row1 = document.createElement('div'); row1.className = 'row';
      const pfx = document.createElement('div'); pfx.innerHTML = `<div class=\"meta\">Prefix</div><div class=\"with-avatar\"><img class=\"avatar\" alt=\"\" src=\"${getAvatarUrl(r.prefix)}\" /> <span>${r.prefix}</span></div>`;
      const nh = document.createElement('div'); nh.innerHTML = `<div class="meta">Next Hop</div><div>${r.next_hop || r.nextHop || r.nextHop}</div>`;
      row1.appendChild(pfx); row1.appendChild(nh);
      const row2 = document.createElement('div'); row2.className = 'row actions';
      const delBtn = document.createElement('button'); delBtn.className = 'del'; delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete route ${r.prefix}?`)) return;
        try { await deleteRoute(r.prefix); await refreshRoutes(); showToast('Route deleted', 'success'); } catch (e) { showToast(e.message, 'error'); }
      });
      row2.appendChild(delBtn);
      card.appendChild(row1); card.appendChild(row2);
      routesCards.appendChild(card);
    }
  }

  addRouteForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const prefix = prefixEl.value.trim();
    const nextHop = nextHopEl.value.trim();
    if (!prefix || !nextHop) return;
    try {
      await addRoute(prefix, nextHop);
      prefixEl.value = '';
      nextHopEl.value = '';
      await refreshRoutes();
      showToast('Route added', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  lookupForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const ip = lookupIpEl.value.trim();
    if (!ip) return;
    try {
      const res = await lookup(ip);
      setLookupResult(`Match: ${res.match_prefix} → ${res.next_hop}`, false);
      showToast('Lookup successful', 'success');
      triggerFlash(true);
    } catch (e) {
      setLookupResult(e.message || 'No matching route found', true);
      showToast(e.message || 'No match', 'error');
      triggerFlash(false);
    }
  });

  refreshBtn.addEventListener('click', refreshRoutes);

  // Collapsible: show/hide routes table with animation and persisted state
  const STORAGE_KEY = 'routesCollapsed';
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setToggleLabel(collapsed) {
    toggleRoutesBtn.textContent = collapsed ? 'Show Table' : 'Hide Table';
    toggleRoutesBtn.setAttribute('aria-expanded', String(!collapsed));
  }

  function collapse(animate = true) {
    if (!routesCollapsible) return;
    localStorage.setItem(STORAGE_KEY, '1');
    setToggleLabel(true);
    if (!animate || prefersReducedMotion) {
      routesCollapsible.classList.add('is-collapsed');
      routesCollapsible.style.height = '0px';
      return;
    }
    const from = routesCollapsible.scrollHeight || routesCollapsibleInner.scrollHeight;
    routesCollapsible.style.height = from + 'px';
    requestAnimationFrame(() => {
      routesCollapsible.classList.add('is-collapsed');
      routesCollapsible.style.height = '0px';
    });
  }

  function expand(animate = true) {
    if (!routesCollapsible) return;
    localStorage.removeItem(STORAGE_KEY);
    setToggleLabel(false);
    routesCollapsible.classList.remove('is-collapsed');
    if (!animate || prefersReducedMotion) {
      routesCollapsible.style.height = '';
      return;
    }
    const to = routesCollapsibleInner.scrollHeight;
    routesCollapsible.style.height = '0px';
    requestAnimationFrame(() => {
      routesCollapsible.style.height = to + 'px';
    });
    const onEnd = (e) => {
      if (e.target !== routesCollapsible) return;
      routesCollapsible.style.height = '';
      routesCollapsible.removeEventListener('transitionend', onEnd);
    };
    routesCollapsible.addEventListener('transitionend', onEnd);
  }

  function initCollapsible() {
    const collapsed = localStorage.getItem(STORAGE_KEY) === '1';
    setToggleLabel(collapsed);
    if (collapsed) {
      routesCollapsible.classList.add('is-collapsed');
      routesCollapsible.style.height = '0px';
    }
  }

  toggleRoutesBtn.addEventListener('click', () => {
    const collapsed = localStorage.getItem(STORAGE_KEY) === '1';
    if (collapsed) expand(true); else collapse(true);
  });

  initCollapsible();

  // View switch: Table / Cards
  function setView(mode) {
    const isTable = mode === 'table';
    viewTableBtn.setAttribute('aria-selected', String(isTable));
    viewCardsBtn.setAttribute('aria-selected', String(!isTable));
    qs('#routesTable').hidden = !isTable;
    routesCards.hidden = isTable;
    localStorage.setItem('routesView', isTable ? 'table' : 'cards');
  }
  viewTableBtn.addEventListener('click', () => setView('table'));
  viewCardsBtn.addEventListener('click', () => setView('cards'));
  const initialView = localStorage.getItem('routesView') || 'table';
  setView(initialView);

  // Search filter
  routesSearch.addEventListener('input', refreshRoutes);

  // Theme toggle
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleBtn.setAttribute('aria-pressed', String(theme === 'light'));
    localStorage.setItem('theme', theme);
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }
  themeToggleBtn.addEventListener('click', toggleTheme);
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  // Toasts
  function showToast(message, type = 'success', timeout = 2200) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => { el.remove(); }, timeout);
  }

  function triggerFlash(ok) {
    if (!flashOverlay) return;
    flashOverlay.classList.remove('show-success', 'show-error');
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add(ok ? 'show-success' : 'show-error');
  }

  function openHelp() { helpModal.setAttribute('open', ''); helpModal.setAttribute('aria-hidden', 'false'); }
  function closeHelpModal() { helpModal.removeAttribute('open'); helpModal.setAttribute('aria-hidden', 'true'); }
  helpBtn.addEventListener('click', openHelp);
  closeHelp.addEventListener('click', closeHelpModal);
  closeHelpFooter.addEventListener('click', closeHelpModal);

  window.RoutingUI = { refreshRoutes };
})();


