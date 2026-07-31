// All-Locations Overview screen: a flat, glanceable list of every racking bay.
// Clicking an occupied bay's entry opens the same stock entry detail view
// used by the Search screen.

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
  grid.addEventListener('click', handleEntryActivate);
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleEntryActivate(e);
    }
  });

  function handleEntryActivate(e) {
    const item = e.target.closest('.location-entry');
    if (item) openEntryDetail(item.dataset.entryId);
  }
}

function renderLocationRow(loc) {
  const isEmpty = loc.status === 'Empty';
  const contents = loc.entries
    .map(
      (e) => `
        <div class="location-entry" data-entry-id="${escapeHtml(e.id)}" role="button" tabindex="0">
          <div class="contents-line">${escapeHtml(e.product ? e.product.name : 'Unknown product')} &mdash; ${escapeHtml(
        String(e.quantity)
      )} units</div>
          <div class="contents-sub">Batch ${escapeHtml(e.batchCode)} &middot; Best Before ${escapeHtml(
        e.bestBefore
      )} &middot; ${escapeHtml(e.status)}</div>
        </div>
      `
    )
    .join('');

  return `
    <div class="location-row ${isEmpty ? 'empty' : ''}">
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
