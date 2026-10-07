// Dashboard: the landing screen for both portals. Gives a quick read on
// what's happening in the warehouse (stock levels, what's awaiting
// put-away, recent activity) plus one-click links into the rest of the
// portal's screens, so staff don't have to start every session on the
// Put-Away form.

const QUICK_ACTION_DESCRIPTIONS = {
  putaway: 'Log new stock into a location',
  search: 'Find stock by product, SKU, or batch code',
  baysearch: "Look up what's in a picking bay",
  locations: 'Browse racking occupancy',
  products: 'Add, edit, or remove catalogue products',
  delivery: 'Upload a delivery note and generate QR labels',
  stocktake: 'Printable snapshot of all current stock',
  barcodeLabels: 'Generate product barcode labels',
  palletLabels: 'Generate QR pallet labels from a packing slip',
};

function dashboardTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diffMin = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

const DASHBOARD_STAT_ICONS = {
  locations:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>',
  stock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="M3 7.5V16.5L12 21l9-4.5V7.5"/><path d="M12 12v9"/></svg>',
  pending:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  products:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 16h6M9 8h2"/></svg>',
  deliveries:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
};

function renderDashboardScreen(root) {
  const isManager = Portal.isManager();
  const gateStats = Store.getGateStats();
  const pendingCount = Store.getPendingDeliveryItems().length;
  const recentEntries = Store.getRecentStockEntries(6);

  const statTiles = [
    { label: 'Locations Tracked', value: gateStats.totalLocations, icon: 'locations' },
    { label: 'Items In Stock', value: gateStats.itemsInStock.toLocaleString(), icon: 'stock' },
    { label: 'Awaiting Put-Away', value: pendingCount, icon: 'pending' },
  ];
  if (isManager) {
    statTiles.push({ label: 'Products Catalogued', value: Store.getProducts().length, icon: 'products' });
    statTiles.push({ label: 'Deliveries Logged', value: Store.getDeliveryRecords().length, icon: 'deliveries' });
  }

  const tabKeys = (isManager ? MANAGER_TAB_KEYS : EMPLOYEE_TAB_KEYS).filter((key) => key !== 'dashboard');
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  root.innerHTML = `
    <div class="card dashboard-welcome-card">
      <p class="dashboard-eyebrow">${dayLabel}</p>
      <h1 class="dashboard-headline">${isManager ? 'Your warehouse, at a glance.' : 'Ready when you are.'}</h1>
      <p class="helper-text">
        ${isManager
          ? "Here's the current state of the warehouse, plus quick links into everything you manage."
          : "Here's the current state of the warehouse, plus quick links to get moving."}
      </p>
      <div class="stat-tile-grid">
        ${statTiles
          .map(
            (t) => `
          <div class="stat-tile">
            <span class="stat-tile-icon" aria-hidden="true">${DASHBOARD_STAT_ICONS[t.icon] || ''}</span>
            <span class="stat-tile-body">
              <span class="stat-tile-value">${t.value}</span>
              <span class="stat-tile-label">${t.label}</span>
            </span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="card">
      <h2>Quick Actions</h2>
      <div class="quick-actions-grid" id="dashboard-quick-actions">
        ${tabKeys
          .map(
            (key) => `
          <button type="button" class="quick-action-card" data-screen="${key}">
            <span class="quick-action-icon" aria-hidden="true">${TAB_ICONS[key] || ''}</span>
            <span class="quick-action-text">
              <span class="quick-action-title">${TAB_LABELS[key]}</span>
              <span class="quick-action-desc">${QUICK_ACTION_DESCRIPTIONS[key] || ''}</span>
            </span>
          </button>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="card">
      <h2>Recent Activity</h2>
      <div id="dashboard-recent-activity">
        ${
          recentEntries.length
            ? recentEntries
                .map(
                  (r) => `
            <div class="result-item" data-entry-id="${escapeHtml(r.id)}" role="button" tabindex="0">
              <div class="result-main">
                <div class="product-name">${r.product ? escapeHtml(r.product.name) : 'Unknown product'}</div>
                <div class="meta-line">Qty ${escapeHtml(String(r.quantity))} &middot; ${dashboardTimeAgo(r.loggedAt)}</div>
              </div>
              <div class="result-loc">
                <div class="location-code-pill">${escapeHtml(r.locationCode)}</div>
                <div class="status-badge ${formatStatusClass(r.status)}">${escapeHtml(r.status)}</div>
              </div>
            </div>
          `
                )
                .join('')
            : '<div class="empty-state">No stock activity yet.</div>'
        }
      </div>
    </div>

    ${isManager ? dashboardRecentDeliveriesHtml() : ''}
  `;

  document.getElementById('dashboard-quick-actions').addEventListener('click', (e) => {
    const card = e.target.closest('.quick-action-card');
    if (card) AppRouter.goTo(card.dataset.screen);
  });

  const activityEl = document.getElementById('dashboard-recent-activity');
  function activateEntry(e) {
    const item = e.target.closest('.result-item');
    if (item) openEntryDetail(item.dataset.entryId);
  }
  activityEl.addEventListener('click', activateEntry);
  activityEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateEntry(e);
    }
  });

  const deliveriesEl = document.getElementById('dashboard-recent-deliveries');
  if (deliveriesEl) {
    deliveriesEl.addEventListener('click', () => AppRouter.goTo('delivery'));
    deliveriesEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        AppRouter.goTo('delivery');
      }
    });
  }
}

function dashboardRecentDeliveriesHtml() {
  const deliveries = Store.getDeliveryRecords().slice(0, 3);
  return `
    <div class="card">
      <h2>Recent Deliveries</h2>
      <div class="delivery-history-list" id="dashboard-recent-deliveries" role="button" tabindex="0">
        ${
          deliveries.length
            ? deliveries
                .map(
                  (d) => `
            <div class="delivery-history-row" style="cursor: default;">
              <div class="delivery-history-main">
                <div class="delivery-history-filename">${escapeHtml(d.name)}</div>
                <div class="delivery-history-meta">Processed ${escapeHtml(
                  new Date(d.importedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                )}</div>
              </div>
              <div class="delivery-history-count">${d.items.length} label${d.items.length === 1 ? '' : 's'}</div>
            </div>
          `
                )
                .join('')
            : '<div class="empty-state">No deliveries confirmed yet.</div>'
        }
      </div>
      <p class="helper-text mt-sm">Click to open Delivery Import &rarr; Past Deliveries.</p>
    </div>
  `;
}
