// App shell: portal gate + tab navigation for whichever screens the current
// portal grants access to. Exposes AppRouter.refresh() so other UI (e.g. the
// entry detail modal) can re-render whichever screen is currently on-screen
// after a data change.

const EMPLOYEE_TAB_KEYS = ['putaway', 'search', 'baysearch', 'locations', 'alerts'];
const MANAGER_TAB_KEYS = ['putaway', 'search', 'baysearch', 'locations', 'alerts', 'products', 'stocktake'];

const TAB_LABELS = {
  putaway: 'Put-Away',
  search: 'Search',
  baysearch: 'Bay Search',
  locations: 'All Locations',
  alerts: 'Stock Alerts',
  products: 'Manage Products',
  stocktake: 'Stock Take',
};

const SCREENS = {
  putaway: renderPutawayScreen,
  search: renderSearchScreen,
  baysearch: renderBaySearchScreen,
  locations: renderLocationsScreen,
  alerts: renderStockAlertsScreen,
  products: renderManageProductsScreen,
  stocktake: renderStockTakeScreen,
};

const AppRouter = (() => {
  const root = document.getElementById('screen-root');
  const tabsNav = document.getElementById('tabs');
  const gate = document.getElementById('portal-gate');
  const header = document.getElementById('app-header');
  const banner = document.getElementById('prototype-banner');
  const switchBtn = document.getElementById('switch-portal-btn');
  const gateStats = document.getElementById('portal-gate-stats');
  let activeScreen = 'putaway';

  function renderGateStats() {
    const stats = Store.getGateStats();
    gateStats.innerHTML = `<span class="stat-dot" aria-hidden="true"></span>${stats.totalLocations} locations tracked &middot; ${stats.itemsInStock.toLocaleString()} items in stock`;
  }

  function tabKeysForCurrentPortal() {
    return Portal.isManager() ? MANAGER_TAB_KEYS : EMPLOYEE_TAB_KEYS;
  }

  function buildTabs() {
    const keys = tabKeysForCurrentPortal();
    tabsNav.innerHTML = keys
      .map((key) => `<button type="button" class="tab-btn" data-screen="${key}">${TAB_LABELS[key]}</button>`)
      .join('');
    tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });
  }

  function showScreen(name) {
    activeScreen = name;
    tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    SCREENS[name](root);
  }

  function enterApp() {
    gate.hidden = true;
    header.hidden = false;
    banner.hidden = false;
    root.hidden = false;
    buildTabs();
    showScreen('putaway');
  }

  function showGate() {
    renderGateStats();
    gate.hidden = false;
    header.hidden = true;
    banner.hidden = true;
    root.hidden = true;
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

  if (Portal.get()) {
    enterApp();
  } else {
    showGate();
  }

  return {
    refresh: () => showScreen(activeScreen),
  };
})();
