// App shell: tab navigation between the three screens.

(function initApp() {
  const root = document.getElementById('screen-root');
  const tabButtons = document.querySelectorAll('.tab-btn');

  const SCREENS = {
    putaway: renderPutawayScreen,
    search: renderSearchScreen,
    locations: renderLocationsScreen,
  };

  function showScreen(name) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
    SCREENS[name](root);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  showScreen('putaway');
})();
