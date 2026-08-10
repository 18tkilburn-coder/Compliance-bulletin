// Stock Alerts screen: read-only list of products currently below their
// minimum stock level. Visible in both portals — only the Manager portal's
// product edit modal can change the minimum threshold itself.

function renderStockAlertsScreen(root) {
  const lowStock = Store.getLowStockProducts();

  root.innerHTML = `
    <div class="card">
      <h2>Stock Alerts</h2>
      ${
        lowStock.length
          ? `<div class="alert-list">
              ${lowStock
                .map(
                  (p) => `
                <div class="alert-row">
                  <div class="alert-row-main">
                    <div class="alert-row-name">${escapeHtml(p.name)}</div>
                    <div class="alert-row-sub">${escapeHtml(String(p.totalQuantity))} in stock &middot; minimum ${escapeHtml(
                    String(p.minStock)
                  )}</div>
                  </div>
                  <span class="status-badge status-low-stock">Low Stock</span>
                </div>
              `
                )
                .join('')}
            </div>`
          : `<div class="empty-state">No products are currently below their minimum stock level.</div>`
      }
    </div>
  `;
}
