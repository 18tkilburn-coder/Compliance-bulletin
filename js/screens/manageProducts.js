// Manage Products screen: view, edit, and delete catalogue products.
// Editing is also reachable from the Put-Away product dropdown via the same
// openProductEditModal() function, so both entry points stay in sync.

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
      <div class="product-list" id="product-list"></div>
    </div>
  `;

  document.getElementById('refresh-products-btn').addEventListener('click', () => {
    const added = Store.refreshProductsFromCatalog();
    if (added.length) {
      showToast(`${added.length} new product${added.length === 1 ? '' : 's'} added: ${added.join(', ')}`);
    } else {
      showToast('No new products found in the catalogue snapshot');
    }
    renderProductList();
  });

  renderProductList();

  function renderProductList() {
    const products = Store.getProducts();
    const listEl = document.getElementById('product-list');

    if (!products.length) {
      listEl.innerHTML = '<div class="empty-state">No products in the catalogue yet.</div>';
      return;
    }

    listEl.innerHTML = products
      .map((p) => {
        const count = Store.getActiveEntryCountForProduct(p.id);
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
