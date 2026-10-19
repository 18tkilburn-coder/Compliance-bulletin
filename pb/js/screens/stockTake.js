// Stock Take screen (Manager portal only): a full printable snapshot of
// current stock across racking and picking bays.

function renderStockTakeScreen(root) {
  const rows = Store.getStockTakeRows();

  root.innerHTML = `
    <div class="card stock-take-card">
      <div class="stock-take-header">
        <h2>Stock Take</h2>
        <button type="button" class="btn btn-primary" id="print-stock-take-btn">Print</button>
      </div>
      <p class="helper-text">Full snapshot of current stock across racking and picking bays &mdash; ${rows.length} ${
    rows.length === 1 ? 'entry' : 'entries'
  }.</p>
      <div class="table-scroll">
        <table class="stock-take-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Batch</th>
              <th>Best Before</th>
              <th>Qty</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (r) => `
              <tr>
                <td>${escapeHtml(r.product ? r.product.name : 'Unknown product')}</td>
                <td>${r.product && r.product.sku ? escapeHtml(r.product.sku) : '&mdash;'}</td>
                <td>${r.batchCode ? escapeHtml(r.batchCode) : '&mdash;'}</td>
                <td>${r.bestBefore ? escapeHtml(r.bestBefore) : '&mdash;'}</td>
                <td class="num">${escapeHtml(String(r.quantity))}</td>
                <td>${escapeHtml(r.locationCode)}</td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="6" class="empty-state">No stock currently logged.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('print-stock-take-btn').addEventListener('click', () => {
    window.print();
  });
}
