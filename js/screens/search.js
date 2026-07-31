// Search / Lookup screen: find a product/batch and see every location holding it.

function renderSearchScreen(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Search Stock</h2>
      <div class="search-input-wrap">
        <input type="text" id="stock-search" placeholder="Search by product name, SKU, or batch code&hellip;" autocomplete="off" />
      </div>
      <div id="search-results"></div>
    </div>
  `;

  const input = document.getElementById('stock-search');
  const resultsEl = document.getElementById('search-results');

  input.addEventListener('input', () => renderResults(input.value));
  renderResults('');

  function renderResults(query) {
    if (!query.trim()) {
      resultsEl.innerHTML = `<div class="empty-state">Start typing to search product name, SKU, or batch code.</div>`;
      return;
    }

    const results = Store.searchStock(query);
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-state">No matching stock found.</div>`;
      return;
    }

    resultsEl.innerHTML = results
      .map(
        (r) => `
      <div class="result-item">
        <div class="result-main">
          <div class="product-name">${escapeHtml(r.product.name)}</div>
          <div class="meta-line">Batch ${escapeHtml(r.batchCode)}${
          r.product.sku ? ` &middot; SKU ${escapeHtml(r.product.sku)}` : ''
        }</div>
          <div class="meta-line">Best Before ${escapeHtml(r.bestBefore)} &middot; Qty ${escapeHtml(String(r.quantity))}</div>
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
