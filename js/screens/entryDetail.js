// Stock entry detail view: opened as a modal from a Search result, or from an
// occupied location on the All Locations screen (via a short picker list when
// that bay holds more than one entry). Lets staff swap the entry's location,
// remove a partial quantity, or remove it completely — each removal action
// requires an inline "are you sure?" confirmation before it takes effect.

// Opens the picker list for a location's entries, or the detail view directly
// if there's only one entry in that bay.
function openLocationEntries(code) {
  const loc = Store.getLocationOverview().find((l) => l.code === code);
  if (!loc || !loc.entries.length) {
    showToast('No stock in this location');
    return;
  }
  if (loc.entries.length === 1) {
    openEntryDetail(loc.entries[0].id);
    return;
  }
  renderLocationEntriesList(loc);
}

function renderLocationEntriesList(loc) {
  openModal(`
    <div class="modal-header">
      <h2>${escapeHtml(loc.code)}</h2>
      <button type="button" class="modal-close" id="modal-close-btn" aria-label="Close">&times;</button>
    </div>
    <div class="helper-text mt-sm">This bay holds ${loc.entries.length} items. Select one to view details.</div>
    <div class="entry-list" id="entry-list">
      ${loc.entries
        .map(
          (e) => `
        <div class="entry-list-item" data-entry-id="${escapeHtml(e.id)}" role="button" tabindex="0">
          <div class="entry-list-main">
            <div class="entry-list-name">${escapeHtml(e.product ? e.product.name : 'Unknown product')}</div>
            <div class="entry-list-meta">Batch ${e.batchCode ? escapeHtml(e.batchCode) : '&mdash;'} &middot; Qty ${escapeHtml(
            String(e.quantity)
          )}</div>
          </div>
          <span class="status-badge ${formatStatusClass(e.status)}">${escapeHtml(e.status)}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `);

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  const list = document.getElementById('entry-list');
  list.addEventListener('click', handleActivate);
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate(e);
    }
  });

  function handleActivate(e) {
    const item = e.target.closest('.entry-list-item');
    if (item) openEntryDetail(item.dataset.entryId);
  }
}

function openEntryDetail(entryId) {
  const entry = Store.getStockEntryById(entryId);
  if (!entry) {
    showToast('Stock entry not found');
    return;
  }
  renderEntryDetail(entry);
}

function renderEntryDetail(entry) {
  const isRemoved = entry.status === 'Removed';
  const productName = entry.product ? entry.product.name : 'Unknown product';

  openModal(`
    <div class="modal-header">
      <h2>Stock Entry</h2>
      <button type="button" class="modal-close" id="modal-close-btn" aria-label="Close">&times;</button>
    </div>

    <div class="detail-fields">
      <div class="detail-field">
        <span class="detail-label">Product</span>
        <span class="detail-value">${escapeHtml(productName)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Batch code</span>
        <span class="detail-value">${entry.batchCode ? escapeHtml(entry.batchCode) : '—'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Best before</span>
        <span class="detail-value">${entry.bestBefore ? escapeHtml(entry.bestBefore) : '—'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Quantity</span>
        <span class="detail-value">${escapeHtml(String(entry.quantity))}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Location</span>
        <span class="detail-value">${escapeHtml(entry.locationCode)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Logged by</span>
        <span class="detail-value">${entry.loggedBy ? escapeHtml(entry.loggedBy) : '—'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-label">Status</span>
        <span class="status-badge ${formatStatusClass(entry.status)}">${escapeHtml(entry.status)}</span>
      </div>
    </div>

    ${
      isRemoved
        ? '<div class="empty-state">This entry has been removed and can no longer be edited.</div>'
        : `
      <div class="action-section">
        <h3>Swap location</h3>
        <div class="searchable-select" id="swap-location-wrap"></div>
        <button type="button" class="btn btn-primary btn-block mt-sm" id="swap-location-btn" disabled>Swap location</button>
      </div>

      <div class="action-section" id="remove-qty-section"></div>

      <div class="action-section" id="remove-all-section"></div>
    `
    }
  `);

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  if (isRemoved) return;

  wireSwapLocation(entry);
  wireRemovePartial(entry);
  wireRemoveCompletely(entry);
}

function wireSwapLocation(entry) {
  let selectedCode = null;

  renderField();

  function renderField() {
    const wrap = document.getElementById('swap-location-wrap');
    const swapBtn = document.getElementById('swap-location-btn');

    if (selectedCode) {
      wrap.innerHTML = `
        <div class="selected-chip">
          <span>${escapeHtml(selectedCode)}</span>
          <button type="button" id="clear-swap-location" aria-label="Clear location">&times;</button>
        </div>
      `;
      document.getElementById('clear-swap-location').addEventListener('click', () => {
        selectedCode = null;
        renderField();
      });
      swapBtn.disabled = false;
      return;
    }

    swapBtn.disabled = true;
    wrap.innerHTML = `
      <input type="text" id="swap-location-search" placeholder="Search locations&hellip;" autocomplete="off" />
      <div class="dropdown-list" id="swap-location-dropdown" hidden></div>
    `;

    const input = document.getElementById('swap-location-search');
    const list = document.getElementById('swap-location-dropdown');
    const occupied = new Set(
      Store.getLocationOverview()
        .filter((l) => l.status === 'Occupied')
        .map((l) => l.code)
    );

    wireDropdown(input, list, (query) => {
      const matches = Store.findLocations(query).slice(0, 10);
      return matches.map((code) => ({
        html: `<div class="item-title">${code}</div><div class="item-sub">${
          code === entry.locationCode ? 'Current location' : occupied.has(code) ? 'Occupied' : 'Empty'
        }</div>`,
        onSelect: () => {
          selectedCode = code;
          renderField();
        },
      }));
    });
  }

  document.getElementById('swap-location-btn').addEventListener('click', () => {
    if (!selectedCode) return;
    if (selectedCode === entry.locationCode) {
      showToast('Choose a different location to swap to');
      return;
    }
    const fromCode = entry.locationCode;
    const productName = entry.product ? entry.product.name : 'Entry';
    Store.swapEntryLocation(entry.id, selectedCode);
    closeModal();
    showToast(`Moved ${productName} from ${fromCode} to ${selectedCode}`);
    AppRouter.refresh();
  });
}

function wireRemovePartial(entry) {
  const section = document.getElementById('remove-qty-section');

  renderInput();

  function renderInput(prefillAmount) {
    section.innerHTML = `
      <h3>Remove partial quantity</h3>
      <div class="field-row">
        <div class="field">
          <input type="number" id="remove-qty-input" min="1" max="${entry.quantity}" placeholder="e.g. 10" value="${
      prefillAmount ? escapeHtml(String(prefillAmount)) : ''
    }" />
        </div>
        <button type="button" class="btn" id="remove-qty-btn">Remove qty</button>
      </div>
      <div class="helper-text">Current quantity: ${entry.quantity}. Removing all of it marks the entry fully removed.</div>
    `;

    document.getElementById('remove-qty-btn').addEventListener('click', () => {
      const input = document.getElementById('remove-qty-input');
      const amount = Number(input.value);

      if (!amount || amount <= 0) {
        showToast('Enter a quantity greater than zero');
        return;
      }
      if (amount > entry.quantity) {
        showToast(`Cannot remove more than the current quantity (${entry.quantity})`);
        return;
      }
      renderConfirm(amount);
    });
  }

  function renderConfirm(amount) {
    const productName = entry.product ? entry.product.name : 'Entry';
    const remaining = entry.quantity - amount;

    section.innerHTML = `
      <h3>Remove partial quantity</h3>
      <div class="confirm-prompt">
        <p class="confirm-message">Remove ${amount} x ${escapeHtml(productName)}? ${
      remaining > 0
        ? `${remaining} will remain at ${escapeHtml(entry.locationCode)}.`
        : `This removes the last of it &mdash; the entry will be fully removed.`
    }</p>
        <div class="confirm-actions">
          <button type="button" class="btn" id="cancel-remove-qty">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-remove-qty">Yes, remove</button>
        </div>
      </div>
    `;

    document.getElementById('cancel-remove-qty').addEventListener('click', () => renderInput(amount));
    document.getElementById('confirm-remove-qty').addEventListener('click', () => {
      Store.reduceEntryQuantity(entry.id, amount);
      closeModal();
      showToast(
        remaining > 0
          ? `Removed ${amount} x ${productName}. ${remaining} remaining at ${entry.locationCode}.`
          : `Removed all ${productName} from ${entry.locationCode}`
      );
      AppRouter.refresh();
    });
  }
}

function wireRemoveCompletely(entry) {
  const section = document.getElementById('remove-all-section');

  renderButton();

  function renderButton() {
    section.innerHTML = `
      <h3>Remove completely</h3>
      <button type="button" class="btn btn-danger btn-block" id="remove-all-btn">Remove completely</button>
    `;
    document.getElementById('remove-all-btn').addEventListener('click', renderConfirm);
  }

  function renderConfirm() {
    const productName = entry.product ? entry.product.name : 'this entry';

    section.innerHTML = `
      <h3>Remove completely</h3>
      <div class="confirm-prompt">
        <p class="confirm-message">Remove ${escapeHtml(productName)}${
      entry.batchCode ? ` (batch ${escapeHtml(entry.batchCode)})` : ''
    } from ${escapeHtml(entry.locationCode)}? This cannot be undone.</p>
        <div class="confirm-actions">
          <button type="button" class="btn" id="cancel-remove-all">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-remove-all">Yes, remove</button>
        </div>
      </div>
    `;

    document.getElementById('cancel-remove-all').addEventListener('click', renderButton);
    document.getElementById('confirm-remove-all').addEventListener('click', () => {
      Store.removeEntryCompletely(entry.id);
      closeModal();
      showToast(`Removed ${productName} from ${entry.locationCode}`);
      AppRouter.refresh();
    });
  }
}
