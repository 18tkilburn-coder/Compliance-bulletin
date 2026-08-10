// Search / Lookup screen: find a product/batch and see every location holding it.

const SEARCH_SORT_OPTIONS = [
  { value: 'bbd-asc', label: 'Best Before (soonest first)' },
  { value: 'qty-desc', label: 'Quantity (high to low)' },
  { value: 'qty-asc', label: 'Quantity (low to high)' },
  { value: 'location-asc', label: 'Location (A-Z)' },
  { value: 'logged-desc', label: 'Date Logged (newest first)' },
  { value: 'logged-asc', label: 'Date Logged (oldest first)' },
];

// Entries with no best-before sort to the end regardless of direction.
function bestBeforeSortKey(bb) {
  if (!bb) return Infinity;
  const [month, year] = bb.split('/');
  return Number(year) * 100 + Number(month);
}

function sortSearchResults(results, sortValue) {
  const sorted = results.slice();
  switch (sortValue) {
    case 'qty-desc':
      return sorted.sort((a, b) => b.quantity - a.quantity);
    case 'qty-asc':
      return sorted.sort((a, b) => a.quantity - b.quantity);
    case 'location-asc':
      return sorted.sort((a, b) => a.locationCode.localeCompare(b.locationCode));
    case 'logged-desc':
      return sorted.sort((a, b) => (b.loggedAt || 0) - (a.loggedAt || 0));
    case 'logged-asc':
      return sorted.sort((a, b) => (a.loggedAt || 0) - (b.loggedAt || 0));
    case 'bbd-asc':
    default:
      return sorted.sort((a, b) => bestBeforeSortKey(a.bestBefore) - bestBeforeSortKey(b.bestBefore));
  }
}

function renderSearchScreen(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Search Stock</h2>
      <div class="search-input-wrap">
        <input type="text" id="stock-search" placeholder="Search by product name, SKU, or batch code&hellip;" autocomplete="off" />
      </div>
      <div class="field">
        <label>Sort by</label>
        <select id="search-sort">
          ${SEARCH_SORT_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>
      <div id="search-results"></div>
    </div>
  `;

  const input = document.getElementById('stock-search');
  const sortSelect = document.getElementById('search-sort');
  const resultsEl = document.getElementById('search-results');

  input.addEventListener('input', () => renderResults(input.value));
  sortSelect.addEventListener('change', () => renderResults(input.value));
  resultsEl.addEventListener('click', handleResultActivate);
  resultsEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleResultActivate(e);
    }
  });
  renderResults('');

  function handleResultActivate(e) {
    const item = e.target.closest('.result-item');
    if (item) openEntryDetail(item.dataset.entryId);
  }

  function renderResults(query) {
    if (!query.trim()) {
      resultsEl.innerHTML = `<div class="empty-state">Start typing to search product name, SKU, or batch code.</div>`;
      return;
    }

    const results = sortSearchResults(Store.searchStock(query), sortSelect.value);
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-state">No matching stock found.</div>`;
      return;
    }

    resultsEl.innerHTML = results
      .map(
        (r) => `
      <div class="result-item" data-entry-id="${escapeHtml(r.id)}" role="button" tabindex="0">
        <div class="result-main">
          <div class="product-name">${escapeHtml(r.product.name)}</div>
          <div class="meta-line">Batch ${r.batchCode ? escapeHtml(r.batchCode) : '&mdash;'}${
          r.product.sku ? ` &middot; SKU ${escapeHtml(r.product.sku)}` : ''
        }</div>
          <div class="meta-line">Best Before ${
            r.bestBefore ? escapeHtml(r.bestBefore) : '&mdash;'
          } &middot; Qty ${escapeHtml(String(r.quantity))}</div>
        </div>
        <div class="result-loc">
          <div class="location-code-pill">${escapeHtml(r.locationCode)}</div>
          <div class="status-badge ${formatStatusClass(r.status)}">${escapeHtml(r.status)}</div>
        </div>
      </div>
    `
      )
      .join('');
  }
}
