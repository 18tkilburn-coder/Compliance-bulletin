// Bay Search screen: look up what should currently be sitting in a floor /
// picking bay (A01a, A01b … A10a, A10b). Separate from the racking system —
// picking bays are their own set of locations, searched here by bay code.
// Visually consistent with the Search screen (same result card style).

function renderBaySearchScreen(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Bay Search</h2>
      <p class="helper-text bay-search-intro">Look up what should currently be in a floor/picking bay (A01a, A01b&hellip; A10a, A10b).</p>
      <div class="search-input-wrap">
        <input type="text" id="bay-search-input" placeholder="Search by picking bay code, e.g. A03a&hellip;" autocomplete="off" />
      </div>
      <div id="bay-search-results"></div>
    </div>
  `;

  const input = document.getElementById('bay-search-input');
  const resultsEl = document.getElementById('bay-search-results');

  input.addEventListener('input', () => renderResults(input.value));
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
      resultsEl.innerHTML = `<div class="empty-state">Start typing a picking bay code to see what should be there.</div>`;
      return;
    }

    const results = Store.searchPickingBayStock(query);
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-state">No matching picking bay stock found.</div>`;
      return;
    }

    resultsEl.innerHTML = results
      .map(
        (r) => `
      <div class="result-item" data-entry-id="${escapeHtml(r.id)}" role="button" tabindex="0">
        <div class="result-main">
          <div class="product-name">${escapeHtml(r.product ? r.product.name : 'Unknown product')}</div>
          <div class="meta-line">Batch ${r.batchCode ? escapeHtml(r.batchCode) : '&mdash;'}${
          r.product && r.product.sku ? ` &middot; SKU ${escapeHtml(r.product.sku)}` : ''
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
