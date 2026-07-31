// All-Locations Overview screen: a flat, glanceable list of every racking bay.

function renderLocationsScreen(root) {
  const overview = Store.getLocationOverview();

  root.innerHTML = `
    <div class="card">
      <h2>All Locations</h2>
      <div class="location-grid">
        ${overview.map((loc) => renderLocationRow(loc)).join('')}
      </div>
    </div>
  `;
}

function renderLocationRow(loc) {
  const isEmpty = loc.status === 'Empty';
  const contents = loc.entries
    .map(
      (e) => `
        <div class="contents-line">${escapeHtml(e.product ? e.product.name : 'Unknown product')} &mdash; ${escapeHtml(
        String(e.quantity)
      )} units</div>
        <div class="contents-sub">Batch ${escapeHtml(e.batchCode)} &middot; Best Before ${escapeHtml(
        e.bestBefore
      )} &middot; ${escapeHtml(e.status)}</div>
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
