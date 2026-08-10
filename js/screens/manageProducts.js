// Manage Products screen: view, edit, and delete catalogue products.
// Editing is also reachable from the Put-Away product dropdown via the same
// openProductEditModal() function, so both entry points stay in sync.

function renderManageProductsScreen(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Manage Products</h2>
      <div class="product-list" id="product-list"></div>
    </div>
  `;

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
            <div class="product-row-sub">${p.sku ? escapeHtml(p.sku) : 'No SKU'} &middot; ${count} active ${
          count === 1 ? 'entry' : 'entries'
        }${p.minStock > 0 ? ` &middot; Min stock ${escapeHtml(String(p.minStock))}` : ''}</div>
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
      <label>Minimum stock level (optional, for alerts)</label>
      <input
        type="number"
        id="edit-product-min-stock"
        min="0"
        placeholder="e.g. 20"
        value="${product.minStock ? escapeHtml(String(product.minStock)) : ''}"
      />
      <div class="helper-text">Flagged in Stock Alerts when total quantity on hand falls below this.</div>
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
    const minStockRaw = document.getElementById('edit-product-min-stock').value;
    const minStock = minStockRaw ? Number(minStockRaw) : 0;
    Store.updateProduct(productId, { name, sku, minStock });
    closeModal();
    showToast(`"${name}" updated`);
    if (onSaved) onSaved();
  });
}
