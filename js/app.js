// App shell: portal gate + sidebar navigation for whichever screens the
// current portal grants access to. Exposes AppRouter.refresh() so other UI
// (e.g. the entry detail modal) can re-render whichever screen is currently
// on-screen after a data change, and AppRouter.goTo() so any screen can
// navigate elsewhere (used by the Dashboard's quick actions and the command
// palette).

const EMPLOYEE_TAB_KEYS = ['dashboard', 'putaway', 'search', 'baysearch', 'locations', 'palletLabels'];
const MANAGER_TAB_KEYS = [
  'dashboard',
  'putaway',
  'search',
  'baysearch',
  'locations',
  'products',
  'delivery',
  'stocktake',
  'barcodeLabels',
  'palletLabels',
];

const TAB_LABELS = {
  dashboard: 'Dashboard',
  putaway: 'Put-Away',
  search: 'Search',
  baysearch: 'Bay Search',
  locations: 'All Locations',
  products: 'Manage Products',
  delivery: 'Delivery Import',
  stocktake: 'Stock Take',
  barcodeLabels: 'Barcode Labels',
  palletLabels: 'Pallet Labels',
};

// Small line-icon per nav item, same stroke style as the portal-gate icons.
const TAB_ICONS = {
  dashboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  putaway:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="M3 7.5V16.5L12 21l9-4.5V7.5"/><path d="M12 12v9"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  baysearch:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  locations:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>',
  products:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 16h6M9 8h2"/></svg>',
  delivery:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  stocktake:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 2.5h6a1 1 0 0 1 1 1V5H8V3.5a1 1 0 0 1 1-1Z"/><path d="m9 13 2 2 4-4"/></svg>',
  barcodeLabels:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14M8 5v14M11 5v14M15 5v14M17 5v14M20 5v14"/></svg>',
  palletLabels:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M15 15h2.5M15 18h5M15 21h3"/></svg>',
};

const SCREENS = {
  dashboard: renderDashboardScreen,
  putaway: renderPutawayScreen,
  search: renderSearchScreen,
  baysearch: renderBaySearchScreen,
  locations: renderLocationsScreen,
  products: renderManageProductsScreen,
  delivery: renderDeliveryImportScreen,
  stocktake: renderStockTakeScreen,
  barcodeLabels: renderBarcodeLabelsScreen,
  palletLabels: renderPalletLabelsScreen,
};

const AppRouter = (() => {
  const root = document.getElementById('screen-root');
  const tabsNav = document.getElementById('tabs');
  const gate = document.getElementById('portal-gate');
  const appShell = document.getElementById('app-shell');
  const header = document.getElementById('app-header');
  const banner = document.getElementById('prototype-banner');
  const switchBtn = document.getElementById('switch-portal-btn');
  const gateStats = document.getElementById('portal-gate-stats');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarRoleLabel = document.getElementById('sidebar-role-label');
  const breadcrumb = document.getElementById('breadcrumb');
  const clockEl = document.getElementById('topbar-clock');
  let activeScreen = 'dashboard';

  function renderGateStats() {
    const stats = Store.getGateStats();
    gateStats.innerHTML = `<span class="stat-dot" aria-hidden="true"></span>${stats.totalLocations} locations tracked &middot; ${stats.itemsInStock.toLocaleString()} items in stock`;
  }

  function tabKeysForCurrentPortal() {
    return Portal.isManager() ? MANAGER_TAB_KEYS : EMPLOYEE_TAB_KEYS;
  }

  function buildTabs() {
    const keys = tabKeysForCurrentPortal();
    sidebarRoleLabel.textContent = Portal.isManager() ? 'Manager Workspace' : 'Employee Workspace';
    tabsNav.innerHTML = keys
      .map(
        (key) => `
      <button type="button" class="tab-btn" data-screen="${key}">
        <span class="tab-btn-icon" aria-hidden="true">${TAB_ICONS[key] || ''}</span>
        <span class="tab-btn-label">${TAB_LABELS[key]}</span>
      </button>
    `
      )
      .join('');
    tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });
  }

  function closeSidebarDrawer() {
    appShell.classList.remove('sidebar-open');
  }

  function showScreen(name) {
    activeScreen = name;
    setPrintPageSize(null);
    closeSidebarDrawer();
    tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    const roleLabel = Portal.isManager() ? 'Manager Portal' : 'Employee Portal';
    breadcrumb.innerHTML = `<span class="breadcrumb-role">${roleLabel}</span><span class="breadcrumb-sep" aria-hidden="true">/</span><span class="breadcrumb-current">${TAB_LABELS[name]}</span>`;
    SCREENS[name](root);
  }

  function enterApp() {
    gate.hidden = true;
    appShell.hidden = false;
    banner.hidden = false;
    root.hidden = false;
    buildTabs();
    showScreen('dashboard');
  }

  function showGate() {
    renderGateStats();
    gate.hidden = false;
    appShell.hidden = true;
    closeSidebarDrawer();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.type = 'password';
      const toggle = document.getElementById('login-password-toggle');
      if (toggle) {
        toggle.querySelector('.icon-eye-open').classList.remove('is-hidden-icon');
        toggle.querySelector('.icon-eye-closed').classList.add('is-hidden-icon');
        toggle.setAttribute('aria-label', 'Show password');
      }
    }
  }

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  gate.querySelectorAll('.portal-card').forEach((card) => {
    card.addEventListener('click', () => {
      Portal.set(card.dataset.portal);
      enterApp();
    });
  });

  switchBtn.addEventListener('click', () => {
    Portal.clear();
    showGate();
  });

  sidebarToggle.addEventListener('click', () => {
    appShell.classList.toggle('sidebar-open');
  });
  sidebarBackdrop.addEventListener('click', closeSidebarDrawer);

  setInterval(updateClock, 30000);
  updateClock();

  if (Portal.get()) {
    enterApp();
  } else {
    showGate();
  }

  return {
    refresh: () => showScreen(activeScreen),
    goTo: (name) => showScreen(name),
    tabKeysForCurrentPortal,
  };
})();

// ----- Login page: show/hide password toggle. Cosmetic only — the
// username/password fields are never read or validated; signing in is
// still done by picking a portal card, same as before this redesign. -----
(() => {
  const toggle = document.getElementById('login-password-toggle');
  const passwordInput = document.getElementById('login-password');
  if (!toggle || !passwordInput) return;
  const openEye = toggle.querySelector('.icon-eye-open');
  const closedEye = toggle.querySelector('.icon-eye-closed');

  toggle.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    openEye.classList.toggle('is-hidden-icon', !showing);
    closedEye.classList.toggle('is-hidden-icon', showing);
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
})();

// ----- Command palette: optional power-user quick-jump (Cmd/Ctrl+K). -----
(() => {
  const trigger = document.getElementById('command-palette-trigger');
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-palette-input');
  const list = document.getElementById('command-palette-list');
  let highlighted = 0;

  function currentItems() {
    return AppRouter.tabKeysForCurrentPortal().map((key) => ({ key, label: TAB_LABELS[key] }));
  }

  function renderList(query) {
    const q = query.trim().toLowerCase();
    const items = currentItems().filter((item) => !q || item.label.toLowerCase().includes(q));
    highlighted = 0;

    if (!items.length) {
      list.innerHTML = '<div class="command-palette-empty">No screens match &ldquo;' + escapeHtml(query) + '&rdquo;</div>';
      return;
    }

    list.innerHTML = items
      .map(
        (item, i) => `
      <button type="button" class="command-palette-item${i === 0 ? ' highlighted' : ''}" data-screen="${item.key}">
        <span class="command-palette-item-icon" aria-hidden="true">${TAB_ICONS[item.key] || ''}</span>
        <span>${escapeHtml(item.label)}</span>
      </button>
    `
      )
      .join('');

    list.querySelectorAll('.command-palette-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        AppRouter.goTo(btn.dataset.screen);
        close();
      });
    });
  }

  function open() {
    if (document.getElementById('app-shell').hidden) return;
    overlay.hidden = false;
    input.value = '';
    renderList('');
    input.focus();
  }

  function close() {
    overlay.hidden = true;
  }

  function moveHighlight(delta) {
    const items = list.querySelectorAll('.command-palette-item');
    if (!items.length) return;
    items[highlighted]?.classList.remove('highlighted');
    highlighted = (highlighted + delta + items.length) % items.length;
    items[highlighted].classList.add('highlighted');
    items[highlighted].scrollIntoView({ block: 'nearest' });
  }

  trigger.addEventListener('click', open);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = list.querySelector('.command-palette-item.highlighted');
      if (active) {
        AppRouter.goTo(active.dataset.screen);
        close();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay.hidden) open();
      else close();
    } else if (e.key === 'Escape' && !overlay.hidden) {
      close();
    }
  });
})();
