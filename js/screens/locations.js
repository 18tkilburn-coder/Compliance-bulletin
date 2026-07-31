// All-Locations Overview screen: a flat, glanceable list of every racking bay.
// Clicking an occupied bay opens the stock entry detail view directly if it
// holds a single entry, or a short picker list first if it holds more than one.

function renderLocationsScreen(root) {
  const overview = Store.getLocationOverview();

  root.innerHTML = `
    <div class="card">
      <h2>All Locations</h2>
      <div class="location-grid" id="location-grid">
        ${overview.map((loc) => renderLocationRow(loc)).join('')}
      </div>
    </div>
  `;

  const grid = document.getElementById('location-grid');
  grid.addEventListener('click', handleLocationActivate);
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLocationActivate(e);
    }
  });

  function handleLocationActivate(e) {
    const row = e.target.closest('.location-row[data-location-code]');
    if (row) openLocationEntries(row.dataset.locationCode);
  }
}

function renderLocationRow(loc) {
  const isEmpty = loc.status === 'Empty';
  const contents = loc.entries
    .map(
      (e) => `
        <div class="entry-summary">
          <div class="contents-line">${escapeHtml(e.product ? e.product.name : 'Unknown product')} &mdash; ${escapeHtml(
        String(e.quantity)
      )} units</div>
          <div class="contents-sub">Batch ${e.batchCode ? escapeHtml(e.batchCode) : '&mdash;'} &middot; Best Before ${
        e.bestBefore ? escapeHtml(e.bestBefore) : '&mdash;'
      } &middot; ${escapeHtml(e.status)}</div>
        </div>
      `
    )
    .join('');

  return `
    <div class="location-row ${isEmpty ? 'empty' : 'clickable'}" ${
    isEmpty ? '' : `data-location-code="${escapeHtml(loc.code)}" role="button" tabindex="0"`
  }>
      <div class="location-code">${escapeHtml(loc.code)}</div>
      <div class="location-contents">
        ${isEmpty ? '<div class="contents-sub">No stock logged</div>' : contents}
      </div>
      <div class="location-status">
        <span class="status-badge ${isEmpty ? 'status-empty' : 'status-occupied'}">${loc.status}</span>
      </div>
    </div>
  `;
}
