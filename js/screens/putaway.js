// Put-Away screen: log a batch of stock onto a location.

function renderPutawayScreen(root) {
  let selectedProduct = null;
  let selectedLocationCode = null;

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
            <button type="button" class="btn btn-scan" id="scan-barcode-btn">Scan barcode</button>
          </div>
        </div>

        <div class="field">
          <label>Date</label>
          <input type="date" id="date-logged" />
        </div>

        <div class="field">
          <label>Quantity</label>
          <input type="number" id="quantity" min="1" placeholder="e.g. 40" />
        </div>

        <div class="field">
          <label>Location</label>
          <div class="field-row">
            <div class="field searchable-select" id="location-select-wrap"></div>
            <button type="button" class="btn btn-scan" id="scan-location-btn">Scan location QR</button>
          </div>
        </div>

        <div class="field">
          <label>Logged by</label>
          <select id="logged-by">
            <option value="">Select staff&hellip;</option>
            ${STAFF_NAMES.map((n) => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>

        <button type="submit" class="btn btn-primary btn-block">Save</button>
      </form>
    </div>
  `;

  document.getElementById('date-logged').value = todayISO();

  renderProductField();
  renderLocationField();

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

    wireDropdown(input, list, (query) => {
      const matches = Store.findProducts(query).slice(0, 8);
      const items = matches.map((p) => ({
        html: `<div class="item-title">${escapeHtml(p.name)}</div>${
          p.sku ? `<div class="item-sub">${escapeHtml(p.sku)}</div>` : ''
        }`,
        onSelect: () => {
          selectedProduct = p;
          renderProductField();
        },
      }));

      const trimmed = query.trim();
      if (trimmed) {
        items.push({
          html: `+ Create new product &ldquo;${escapeHtml(trimmed)}&rdquo;`,
          className: 'create-new',
          onSelect: () => openNewProductForm(trimmed),
        });
      }
      return items;
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
    const occupied = new Set(
      Store.getLocationOverview()
        .filter((l) => l.status === 'Occupied')
        .map((l) => l.code)
    );

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

  // Simulates a barcode scan capturing the product's batch code + date.
  // Real build: replace with camera-based barcode scanning (e.g. via a device camera API).
  document.getElementById('scan-barcode-btn').addEventListener('click', () => {
    document.getElementById('batch-code').value = randomBatchCode();
    document.getElementById('date-logged').value = todayISO();
    showToast('Barcode scanned (simulated)');
  });

  // Simulates scanning a location QR code by picking a random unoccupied bay.
  // Real build: replace with camera-based QR scanning.
  document.getElementById('scan-location-btn').addEventListener('click', () => {
    const unoccupied = Store.getUnoccupiedLocations();
    if (!unoccupied.length) {
      showToast('No unoccupied locations available');
      return;
    }
    selectedLocationCode = randomChoice(unoccupied);
    renderLocationField();
    showToast(`Scanned location ${selectedLocationCode} (simulated)`);
  });

  document.getElementById('putaway-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      showToast('Please select a product');
      return;
    }
    const batchCode = document.getElementById('batch-code').value.trim();
    if (!batchCode) {
      showToast('Please enter a batch code');
      return;
    }
    const dateLogged = document.getElementById('date-logged').value;
    if (!dateLogged) {
      showToast('Please select a date');
      return;
    }
    const quantity = Number(document.getElementById('quantity').value);
    if (!quantity || quantity <= 0) {
      showToast('Please enter a valid quantity');
      return;
    }
    if (!selectedLocationCode) {
      showToast('Please select a location');
      return;
    }
    const loggedBy = document.getElementById('logged-by').value;
    if (!loggedBy) {
      showToast('Please select who is logging this');
      return;
    }

    Store.addStockEntry({
      productId: selectedProduct.id,
      batchCode,
      dateLogged,
      quantity,
      locationCode: selectedLocationCode,
      loggedBy,
    });

    showToast(`Saved: ${quantity} x ${selectedProduct.name} to ${selectedLocationCode}`);
    renderPutawayScreen(root);
  });
}
