// Manage Products screen: search, filter, sort, edit, and delete catalogue
// products. Editing is also reachable from the Put-Away product dropdown via
// the same openProductEditModal() function, so both entry points stay in sync.

const PRODUCT_FILTER_OPTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'missing-sku', label: 'Missing SKU' },
  { value: 'missing-ean', label: 'Missing EAN' },
  { value: 'in-use', label: 'In active stock' },
  { value: 'unused', label: 'Not in active stock' },
];

const PRODUCT_SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'entries-desc', label: 'Active entries (most first)' },
  { value: 'entries-asc', label: 'Active entries (least first)' },
];

function matchesProductFilter(product, activeCount, filterValue) {
  switch (filterValue) {
    case 'missing-sku':
      return !product.sku;
    case 'missing-ean':
      return !product.ean;
    case 'in-use':
      return activeCount > 0;
    case 'unused':
      return activeCount === 0;
    case 'all':
    default:
      return true;
  }
}

function sortProductRows(rows, sortValue) {
  const sorted = rows.slice();
  switch (sortValue) {
    case 'name-desc':
      return sorted.sort((a, b) => b.product.name.localeCompare(a.product.name));
    case 'entries-desc':
      return sorted.sort((a, b) => b.count - a.count || a.product.name.localeCompare(b.product.name));
    case 'entries-asc':
      return sorted.sort((a, b) => a.count - b.count || a.product.name.localeCompare(b.product.name));
    case 'name-asc':
    default:
      return sorted.sort((a, b) => a.product.name.localeCompare(b.product.name));
  }
}

function renderManageProductsScreen(root) {
  root.innerHTML = `
    <div class="card">
      <div class="manage-products-header">
        <h2>Manage Products</h2>
        <button type="button" class="btn btn-sm" id="refresh-products-btn">Refresh Products</button>
      </div>
      <p class="helper-text">
        Refresh checks the product catalogue snapshot bundled with this build for anything not yet in your list.
        Prototype note: a static page can't live-query per4mbetter.com from the browser (no cross-origin access) —
        the real build would run this check on a server. Existing products and any edits you've made are never touched.
      </p>
      <div class="search-input-wrap">
        <input type="text" id="product-search" placeholder="Search by product name, SKU, or EAN&hellip;" autocomplete="off" />
      </div>
      <div class="product-toolbar">
        <div class="field">
          <label>Filter</label>
          <select id="product-filter">
            ${PRODUCT_FILTER_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Sort by</label>
          <select id="product-sort">
            ${PRODUCT_SORT_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="helper-text" id="product-count-label"></p>
      <div class="product-list" id="product-list"></div>
    </div>
    <div class="card">
      <h2>Pallet Size Limits</h2>
      <p class="helper-text">
        Max quantity per pallet for each product weight/size &mdash; used by the Pallet Labels generator to split a
        packing-slip line into pallets. A size is added here automatically the first time Pallet Labels needs one
        it doesn't recognise, or add one directly below. Never guessed or borrowed from a similar size.
      </p>
      <div class="table-scroll">
        <table class="line-items-table" id="pallet-limits-table">
          <thead>
            <tr>
              <th>Size</th>
              <th>Max qty per pallet</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="pallet-limits-body"></tbody>
        </table>
      </div>
      <div class="inline-form-actions mt-sm">
        <input type="text" id="new-pallet-size-input" placeholder="e.g. 1kg" />
        <input type="number" id="new-pallet-limit-input" placeholder="e.g. 288" min="1" />
        <button type="button" class="btn btn-primary" id="add-pallet-limit-btn">Add</button>
      </div>
    </div>
  `;

  renderPalletLimitsTable();

  document.getElementById('refresh-products-btn').addEventListener('click', () => {
    const added = Store.refreshProductsFromCatalog();
    if (added.length) {
      showToast(`${added.length} new product${added.length === 1 ? '' : 's'} added: ${added.join(', ')}`);
    } else {
      showToast('No new products found in the catalogue snapshot');
    }
    renderProductList();
  });

  const searchInput = document.getElementById('product-search');
  const filterSelect = document.getElementById('product-filter');
  const sortSelect = document.getElementById('product-sort');

  searchInput.addEventListener('input', renderProductList);
  filterSelect.addEventListener('change', renderProductList);
  sortSelect.addEventListener('change', renderProductList);

  renderProductList();

  function renderProductList() {
    const allProducts = Store.getProducts();
    const listEl = document.getElementById('product-list');
    const countLabel = document.getElementById('product-count-label');

    if (!allProducts.length) {
      countLabel.textContent = '';
      listEl.innerHTML = '<div class="empty-state">No products in the catalogue yet.</div>';
      return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const filterValue = filterSelect.value;
    const sortValue = sortSelect.value;

    let rows = allProducts.map((p) => ({ product: p, count: Store.getActiveEntryCountForProduct(p.id) }));

    if (query) {
      rows = rows.filter(({ product: p }) => {
        return (
          p.name.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.ean && p.ean.toLowerCase().includes(query))
        );
      });
    }

    rows = rows.filter(({ product: p, count }) => matchesProductFilter(p, count, filterValue));
    rows = sortProductRows(rows, sortValue);

    countLabel.textContent = `Showing ${rows.length} of ${allProducts.length} product${allProducts.length === 1 ? '' : 's'}.`;

    if (!rows.length) {
      listEl.innerHTML = '<div class="empty-state">No products match your search and filters.</div>';
      return;
    }

    listEl.innerHTML = rows
      .map(({ product: p, count }) => {
        return `
        <div class="product-row" id="product-row-${escapeHtml(p.id)}">
          <div class="product-row-main">
            <div class="product-row-name">${escapeHtml(p.name)}</div>
            <div class="product-row-sub">${p.sku ? escapeHtml(p.sku) : 'No SKU'}${
          p.ean ? ` &middot; EAN ${escapeHtml(p.ean)}` : ''
        } &middot; ${count} active ${count === 1 ? 'entry' : 'entries'}</div>
          </div>
          <div class="product-row-actions">
            <button type="button" class="btn btn-sm" data-action="edit" data-product-id="${escapeHtml(p.id)}">Edit</button>
            <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-product-id="${escapeHtml(
              p.id
            )}">Delete</button>
          </div>
        </div>
      `;
      })
      .join('');

    listEl.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openProductEditModal(btn.dataset.productId, renderProductList);
      });
    });

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteClick(btn.dataset.productId));
    });
  }

  function handleDeleteClick(productId) {
    const product = Store.getProducts().find((p) => p.id === productId);
    if (!product) return;

    const activeCount = Store.getActiveEntryCountForProduct(productId);
    if (activeCount > 0) {
      showToast(
        `Can't delete "${product.name}" — it's still in ${activeCount} active stock ${
          activeCount === 1 ? 'entry' : 'entries'
        }. Remove those first.`
      );
      return;
    }

    const rowEl = document.getElementById(`product-row-${productId}`);
    rowEl.innerHTML = `
      <div class="confirm-prompt product-row-confirm">
        <p class="confirm-message">Delete &ldquo;${escapeHtml(product.name)}&rdquo;? This cannot be undone.</p>
        <div class="confirm-actions">
          <button type="button" class="btn" id="cancel-delete-product">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete-product">Yes, delete</button>
        </div>
      </div>
    `;

    document.getElementById('cancel-delete-product').addEventListener('click', renderProductList);
    document.getElementById('confirm-delete-product').addEventListener('click', () => {
      const result = Store.deleteProduct(productId);
      if (!result.deleted) {
        showToast(
          `Can't delete "${product.name}" — it's still in ${result.activeCount} active stock ${
            result.activeCount === 1 ? 'entry' : 'entries'
          }. Remove those first.`
        );
        renderProductList();
        return;
      }
      showToast(`"${product.name}" deleted from the catalogue`);
      renderProductList();
    });
  }

  function renderPalletLimitsTable() {
    const limits = Store.getPalletLimits();
    const sizes = Object.keys(limits).sort();
    const body = document.getElementById('pallet-limits-body');

    body.innerHTML = sizes.length
      ? sizes
          .map(
            (size) => `
        <tr data-size="${escapeHtml(size)}">
          <td>${escapeHtml(size)}</td>
          <td><input type="number" class="pallet-limit-edit-input" min="1" value="${limits[size]}" data-size="${escapeHtml(
              size
            )}" /></td>
          <td><button type="button" class="btn btn-sm btn-danger pallet-limit-delete-btn" data-size="${escapeHtml(
            size
          )}">Delete</button></td>
        </tr>
      `
          )
          .join('')
      : '<tr><td colspan="3"><div class="empty-state">No pallet sizes recorded yet.</div></td></tr>';

    body.querySelectorAll('.pallet-limit-edit-input').forEach((input) => {
      input.addEventListener('change', () => {
        const value = Number(input.value);
        if (!value || value <= 0) {
          showToast('Enter a max quantity greater than zero');
          renderPalletLimitsTable();
          return;
        }
        Store.setPalletLimit(input.dataset.size, value);
        showToast(`Pallet limit for "${input.dataset.size}" updated`);
      });
    });

    body.querySelectorAll('.pallet-limit-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        Store.deletePalletLimit(btn.dataset.size);
        showToast(`Removed pallet limit for "${btn.dataset.size}"`);
        renderPalletLimitsTable();
      });
    });

    document.getElementById('add-pallet-limit-btn').addEventListener('click', () => {
      const sizeInput = document.getElementById('new-pallet-size-input');
      const limitInput = document.getElementById('new-pallet-limit-input');
      const size = sizeInput.value.trim().toLowerCase().replace(/\s+/g, '');
      const limit = Number(limitInput.value);

      if (!size) {
        showToast('Enter a size, e.g. "1kg"');
        sizeInput.focus();
        return;
      }
      if (!limit || limit <= 0) {
        showToast('Enter a max quantity greater than zero');
        limitInput.focus();
        return;
      }

      Store.setPalletLimit(size, limit);
      showToast(`Pallet limit for "${size}" saved`);
      sizeInput.value = '';
      limitInput.value = '';
      renderPalletLimitsTable();
    });
  }
}

// Shared edit modal used both here and from the Put-Away product dropdown.
function openProductEditModal(productId, onSaved) {
  const product = Store.getProducts().find((p) => p.id === productId);
  if (!product) {
    showToast('Product not found');
    return;
  }

  openModal(`
    <div class="modal-header">
      <h2>Edit Product</h2>
      <button type="button" class="modal-close" id="modal-close-btn" aria-label="Close">&times;</button>
    </div>
    <div class="field">
      <label>Name (required)</label>
      <input type="text" id="edit-product-name" value="${escapeHtml(product.name)}" />
    </div>
    <div class="field">
      <label>SKU (optional)</label>
      <input type="text" id="edit-product-sku" value="${escapeHtml(product.sku || '')}" />
    </div>
    <div class="field">
      <label>EAN / barcode number (optional)</label>
      <input type="text" id="edit-product-ean" value="${escapeHtml(product.ean || '')}" placeholder="13-digit GS1 number, e.g. 5061097266873" inputmode="numeric" />
      <div class="helper-text">Used by the Barcode Label Generator. Never guess this — it's a registered number.</div>
    </div>
    <button type="button" class="btn btn-primary btn-block" id="edit-product-save">Save changes</button>
  `);

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  document.getElementById('edit-product-save').addEventListener('click', () => {
    const name = document.getElementById('edit-product-name').value.trim();
    if (!name) {
      showToast('Product name is required');
      return;
    }
    const sku = document.getElementById('edit-product-sku').value.trim();
    const ean = document.getElementById('edit-product-ean').value.trim();
    if (ean && !isValidEan13(ean)) {
      showToast('That EAN doesn\'t look right — check digit mismatch. Saved anyway; double-check it.');
    }
    Store.updateProduct(productId, { name, sku, ean });
    closeModal();
    showToast(`"${name}" updated`);
    if (onSaved) onSaved();
  });
}
