// Put-Away screen: log a batch of stock onto a location.

function renderPutawayScreen(root) {
  let selectedProduct = null;
  let selectedLocationCode = null;
  // Set when a "Scan QR Label" click matches a pending delivery item, so the
  // item can be cleared from the pending list on successful save (not on
  // scan — an abandoned form shouldn't lose it).
  let scannedPendingItemId = null;

  root.innerHTML = `
    <div class="card">
      <h2>Put Stock Away</h2>
      <form id="putaway-form">
        <div class="field">
          <label>Product</label>
          <div class="searchable-select" id="product-select-wrap"></div>
        </div>

        <div class="field">
          <label>Batch code</label>
          <div class="field-row">
            <div class="field">
              <input type="text" id="batch-code" placeholder="e.g. 48213" autocomplete="off" />
            </div>
            <button type="button" class="btn btn-scan" id="scan-qr-btn">Scan QR Label</button>
          </div>
        </div>

        <div class="field">
          <label>Best before</label>
          <div class="field-row">
            <div class="field">
              <select id="best-before-month">
                <option value="">Month</option>
                ${bestBeforeMonthOptions()
                  .map((m) => `<option value="${m}">${m}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="field">
              <select id="best-before-year">
                <option value="">Year</option>
                ${bestBeforeYearOptions()
                  .map((y) => `<option value="${y}">${y}</option>`)
                  .join('')}
              </select>
            </div>
          </div>
          <div class="helper-text">Displayed as MM/YY, e.g. 06/28 for June 2028.</div>
        </div>

        <div class="field">
          <label>Quantity</label>
          <input type="number" id="quantity" min="1" placeholder="e.g. 40" />
        </div>

        <div class="field">
          <label>Location</label>
          <div class="searchable-select" id="location-select-wrap"></div>
        </div>

        <div class="field">
          <label>Logged by</label>
          <div id="logged-by-wrap"></div>
        </div>

        <button type="submit" class="btn btn-primary btn-block">Save</button>
      </form>
    </div>
  `;

  renderProductField();
  renderLocationField();
  renderLoggedByField();

  function renderProductField() {
    const wrap = document.getElementById('product-select-wrap');

    if (selectedProduct) {
      wrap.innerHTML = `
        <div class="selected-chip">
          <span>${escapeHtml(selectedProduct.name)}${
        selectedProduct.sku ? ` &middot; ${escapeHtml(selectedProduct.sku)}` : ''
      }</span>
          <button type="button" id="clear-product" aria-label="Clear product">&times;</button>
        </div>
      `;
      document.getElementById('clear-product').addEventListener('click', () => {
        selectedProduct = null;
        // Clearing the product invalidates any scan match against it.
        scannedPendingItemId = null;
        renderProductField();
      });
      return;
    }

    wrap.innerHTML = `
      <input type="text" id="product-search" placeholder="Search products by name or SKU&hellip;" autocomplete="off" />
      <div class="dropdown-list" id="product-dropdown" hidden></div>
      <div class="inline-form" id="new-product-form" hidden>
        <h3>Create new product</h3>
        <div class="field">
          <label>Name (required)</label>
          <input type="text" id="new-product-name" />
        </div>
        <div class="field">
          <label>SKU (optional)</label>
          <input type="text" id="new-product-sku" />
        </div>
        <div class="inline-form-actions">
          <button type="button" class="btn btn-primary" id="new-product-save">Add product</button>
          <button type="button" class="btn" id="new-product-cancel">Cancel</button>
        </div>
      </div>
    `;

    const input = document.getElementById('product-search');
    const list = document.getElementById('product-dropdown');

    // Creating/editing products is a manager-only capability — employees see
    // matches only, with no create-new or inline-edit entry points.
    const canManageProducts = Portal.isManager();

    const dropdown = wireDropdown(input, list, (query) => {
      const matches = Store.findProducts(query).slice(0, 8);
      const items = matches.map((p) => ({
        html: canManageProducts
          ? `
          <div class="dropdown-item-row">
            <div class="dropdown-item-text">
              <div class="item-title">${escapeHtml(p.name)}</div>
              ${p.sku ? `<div class="item-sub">${escapeHtml(p.sku)}</div>` : ''}
            </div>
            <button type="button" class="dropdown-item-edit-btn" data-keep-open data-product-id="${escapeHtml(
              p.id
            )}">Edit</button>
          </div>
        `
          : `
            <div class="item-title">${escapeHtml(p.name)}</div>
            ${p.sku ? `<div class="item-sub">${escapeHtml(p.sku)}</div>` : ''}
          `,
        onSelect: () => {
          selectedProduct = p;
          renderProductField();
        },
      }));

      const trimmed = query.trim();
      if (trimmed && canManageProducts) {
        items.push({
          html: `+ Create new product &ldquo;${escapeHtml(trimmed)}&rdquo;`,
          className: 'create-new',
          onSelect: () => openNewProductForm(trimmed),
        });
      }
      return items;
    });

    // Editing a product from the search results updates it in place and
    // just refreshes this list — it doesn't select the product or touch
    // the rest of the form. (No-op for employees: no edit button is ever
    // rendered for them to click.)
    list.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.dropdown-item-edit-btn');
      if (editBtn) {
        openProductEditModal(editBtn.dataset.productId, () => dropdown.refresh());
      }
    });
  }

  function openNewProductForm(prefillName) {
    document.getElementById('product-dropdown').hidden = true;
    const formWrap = document.getElementById('new-product-form');
    formWrap.hidden = false;

    const nameInput = document.getElementById('new-product-name');
    nameInput.value = prefillName || '';
    document.getElementById('new-product-sku').value = '';
    nameInput.focus();

    document.getElementById('new-product-save').addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Product name is required');
        return;
      }
      const sku = document.getElementById('new-product-sku').value.trim();
      const product = Store.addProduct({ name, sku });
      selectedProduct = product;
      renderProductField();
      showToast(`"${product.name}" added to catalogue`);
    });

    document.getElementById('new-product-cancel').addEventListener('click', () => {
      formWrap.hidden = true;
    });
  }

  function renderLocationField() {
    const wrap = document.getElementById('location-select-wrap');

    if (selectedLocationCode) {
      wrap.innerHTML = `
        <div class="selected-chip">
          <span>${escapeHtml(selectedLocationCode)}</span>
          <button type="button" id="clear-location" aria-label="Clear location">&times;</button>
        </div>
      `;
      document.getElementById('clear-location').addEventListener('click', () => {
        selectedLocationCode = null;
        renderLocationField();
      });
      return;
    }

    wrap.innerHTML = `
      <input type="text" id="location-search" placeholder="Search locations&hellip;" autocomplete="off" />
      <div class="dropdown-list" id="location-dropdown" hidden></div>
    `;

    const input = document.getElementById('location-search');
    const list = document.getElementById('location-dropdown');
    const occupied = Store.getOccupiedLocationCodes();

    wireDropdown(input, list, (query) => {
      const matches = Store.findLocations(query).slice(0, 10);
      return matches.map((code) => ({
        html: `<div class="item-title">${code}</div><div class="item-sub">${
          occupied.has(code) ? 'Occupied' : 'Empty'
        }</div>`,
        onSelect: () => {
          selectedLocationCode = code;
          renderLocationField();
        },
      }));
    });
  }

  function renderLoggedByField(preselect) {
    const wrap = document.getElementById('logged-by-wrap');
    const staff = Store.getStaff();

    wrap.innerHTML = `
      <select id="logged-by">
        <option value="">Select staff&hellip;</option>
        ${staff
          .map(
            (n) =>
              `<option value="${escapeHtml(n)}"${n === preselect ? ' selected' : ''}>${escapeHtml(n)}</option>`
          )
          .join('')}
        <option value="__add_person__">+ Add another person</option>
      </select>
      <div class="inline-form" id="new-staff-form" hidden>
        <h3>Add staff member</h3>
        <div class="field">
          <label>Name (required)</label>
          <input type="text" id="new-staff-name" />
        </div>
        <div class="inline-form-actions">
          <button type="button" class="btn btn-primary" id="new-staff-save">Add person</button>
          <button type="button" class="btn" id="new-staff-cancel">Cancel</button>
        </div>
      </div>
    `;

    const select = document.getElementById('logged-by');
    const formWrap = document.getElementById('new-staff-form');

    select.addEventListener('change', () => {
      if (select.value === '__add_person__') {
        select.value = '';
        formWrap.hidden = false;
        document.getElementById('new-staff-name').focus();
      }
    });

    document.getElementById('new-staff-save').addEventListener('click', () => {
      const nameInput = document.getElementById('new-staff-name');
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Name is required');
        return;
      }
      const canonicalName = Store.addStaffMember(name);
      renderLoggedByField(canonicalName);
      showToast(`"${canonicalName}" added`);
    });

    document.getElementById('new-staff-cancel').addEventListener('click', () => {
      formWrap.hidden = true;
    });
  }

  // Simulates scanning a printed QR label (generated via Delivery Import) to
  // auto-fill Product, Batch Code, and Best Before. If a pending delivery
  // item exists it "finds" one of those at random; otherwise it falls back
  // to a plain random simulation so the form still works standalone. Real
  // build: replace with camera-based QR scanning via the device camera API.
  document.getElementById('scan-qr-btn').addEventListener('click', () => {
    const pendingItem = Store.getRandomPendingDeliveryItem();

    if (pendingItem && pendingItem.product) {
      selectedProduct = pendingItem.product;
      renderProductField();
      document.getElementById('batch-code').value = pendingItem.batchCode;
      const [month, year] = pendingItem.bestBefore.split('/');
      document.getElementById('best-before-month').value = month || '';
      document.getElementById('best-before-year').value = year || '';
      scannedPendingItemId = pendingItem.id;
      showToast(`QR label scanned: ${pendingItem.product.name} (batch ${pendingItem.batchCode})`);
      return;
    }

    document.getElementById('batch-code').value = randomBatchCode();
    const { month, year } = randomBestBefore();
    document.getElementById('best-before-month').value = month;
    document.getElementById('best-before-year').value = year;
    scannedPendingItemId = null;
    showToast('QR label scanned (simulated)');
  });

  document.getElementById('putaway-form').addEventListener('submit', (e) => {
    e.preventDefault();

    // Only Product and Location are required — every other field is optional.
    if (!selectedProduct) {
      showToast('Please select a product');
      return;
    }
    if (!selectedLocationCode) {
      showToast('Please select a location');
      return;
    }

    const batchCode = document.getElementById('batch-code').value.trim();
    const bestBeforeMonth = document.getElementById('best-before-month').value;
    const bestBeforeYear = document.getElementById('best-before-year').value;
    const bestBefore = bestBeforeMonth && bestBeforeYear ? formatBestBefore(bestBeforeMonth, bestBeforeYear) : '';
    const quantityRaw = document.getElementById('quantity').value;
    const quantity = quantityRaw ? Number(quantityRaw) : 0;
    const loggedBy = document.getElementById('logged-by').value;

    Store.addStockEntry({
      productId: selectedProduct.id,
      batchCode,
      bestBefore,
      quantity,
      locationCode: selectedLocationCode,
      loggedBy,
    });

    // Only clear the pending delivery item once the put-away actually saves.
    if (scannedPendingItemId) {
      Store.removePendingDeliveryItem(scannedPendingItemId);
    }

    showToast(`Saved: ${quantity} x ${selectedProduct.name} to ${selectedLocationCode}`);
    renderPutawayScreen(root);
  });
}
