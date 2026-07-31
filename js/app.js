// App shell: tab navigation between the four screens.
// Exposes AppRouter.refresh() so other UI (e.g. the entry detail modal) can
// re-render whichever screen is currently on-screen after a data change.

const AppRouter = (() => {
  const root = document.getElementById('screen-root');
  const tabButtons = document.querySelectorAll('.tab-btn');
  let activeScreen = 'putaway';

  const SCREENS = {
    putaway: renderPutawayScreen,
    search: renderSearchScreen,
    locations: renderLocationsScreen,
    products: renderManageProductsScreen,
  };

  function showScreen(name) {
    activeScreen = name;
    tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    SCREENS[name](root);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  showScreen('putaway');

  return {
    refresh: () => showScreen(activeScreen),
  };
})();
