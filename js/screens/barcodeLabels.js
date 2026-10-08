// Barcode Label Generator (Manager portal only): prints product barcode
// labels matching the ones already used in the warehouse — a Code 128
// barcode holding the product's EAN, with the EAN digits, SKU, description
// and variant printed underneath, centred. Either a single 6x4" label or an
// A4 sheet of 10 copies of the same label.
//
// Spec: the barcode always holds the EAN, never the SKU — a barcode holding
// the SKU will scan, but the stock system won't recognise it. EANs are
// registered numbers and are never guessed; if one isn't known yet, ask
// before generating.

function formatBarcodeBatchDate(timestamp) {
  const d = new Date(timestamp);
  const datePart = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

function renderBarcodeLabelsScreen(root) {
  let selectedProduct = null;

  renderInputStep();

  function subNavHtml(active) {
    return `
      <div class="sub-tabs">
        <button type="button" class="sub-tab-btn${active === 'new' ? ' active' : ''}" data-subtab="new">New Label</button>
        <button type="button" class="sub-tab-btn${active === 'history' ? ' active' : ''}" data-subtab="history">Past Barcode Labels</button>
      </div>
    `;
  }

  function wireSubNav() {
    document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.subtab === 'new') {
          renderInputStep();
        } else {
          renderHistoryList();
        }
      });
    });
  }

  function renderInputStep() {
  root.innerHTML = `
    ${subNavHtml('new')}
    <div class="card" id="barcode-input-card">
      <h2>Barcode Labels</h2>
      <p class="helper-text">
        Generates a product barcode label matching the ones already used on site: a Code 128 barcode of the EAN,
        with the EAN, SKU, description and variant printed underneath.
      </p>
      <div class="field">
        <label>Product</label>
        <div class="searchable-select" id="barcode-product-select-wrap"></div>
      </div>

      <div class="field">
        <label>EAN (required &mdash; never guess this)</label>
        <input type="text" id="barcode-ean" placeholder="13-digit GS1 number, e.g. 5061097266873" inputmode="numeric" />
        <div class="helper-text" id="barcode-ean-check"></div>
      </div>

      <div class="field">
        <label>SKU</label>
        <input type="text" id="barcode-sku" placeholder="e.g. PFJUG003" />
      </div>

      <div class="field">
        <label>Description</label>
        <input type="text" id="barcode-description" placeholder="e.g. Per4m Jug 1500ml" />
      </div>

      <div class="field">
        <label>Variant (optional)</label>
        <input type="text" id="barcode-variant" placeholder="e.g. CLEAR/WHITE LID" />
      </div>

      <div class="field">
        <label>Output</label>
        <select id="barcode-output">
          <option value="single">Single label (6 x 4&quot;)</option>
          <option value="sheet" selected>A4 sheet (10 copies)</option>
        </select>
      </div>

      <button type="button" class="btn btn-primary btn-block" id="generate-barcode-btn">Generate Label</button>
    </div>
    <div id="barcode-preview-wrap"></div>
  `;

  renderProductField();
  wireSubNav();

  const eanInput = document.getElementById('barcode-ean');
  const skuInput = document.getElementById('barcode-sku');
  const descriptionInput = document.getElementById('barcode-description');
  const eanCheckEl = document.getElementById('barcode-ean-check');

  eanInput.addEventListener('input', updateEanCheck);

  function updateEanCheck() {
    const ean = eanInput.value.trim();
    if (!ean) {
      eanCheckEl.textContent = '';
      eanCheckEl.className = 'helper-text';
      return;
    }
    if (isValidEan13(ean)) {
      eanCheckEl.textContent = 'Check digit OK.';
      eanCheckEl.className = 'helper-text barcode-ean-ok';
    } else {
      eanCheckEl.textContent = 'This doesn’t look like a valid 13-digit EAN — double-check it before printing.';
      eanCheckEl.className = 'helper-text barcode-ean-warn';
    }
  }

  function renderProductField() {
    const wrap = document.getElementById('barcode-product-select-wrap');

    if (selectedProduct) {
      wrap.innerHTML = `
        <div class="selected-chip">
          <span>${escapeHtml(selectedProduct.name)}${
        selectedProduct.sku ? ` &middot; ${escapeHtml(selectedProduct.sku)}` : ''
      }</span>
          <button type="button" id="barcode-clear-product" aria-label="Clear product">&times;</button>
        </div>
      `;
      document.getElementById('barcode-clear-product').addEventListener('click', () => {
        selectedProduct = null;
        renderProductField();
      });
      return;
    }

    wrap.innerHTML = `
      <input type="text" id="barcode-product-search" placeholder="Search products by name or SKU&hellip; (optional)" autocomplete="off" />
      <div class="dropdown-list" id="barcode-product-dropdown" hidden></div>
    `;

    const input = document.getElementById('barcode-product-search');
    const list = document.getElementById('barcode-product-dropdown');

    wireDropdown(input, list, (query) => {
      const matches = Store.findProducts(query).slice(0, 8);
      return matches.map((p) => ({
        html: `
          <div class="item-title">${escapeHtml(p.name)}</div>
          ${p.sku ? `<div class="item-sub">${escapeHtml(p.sku)}</div>` : ''}
        `,
        onSelect: () => {
          selectedProduct = p;
          renderProductField();
          skuInput.value = p.sku || '';
          eanInput.value = p.ean || '';
          descriptionInput.value = p.name;
          updateEanCheck();
          if (!p.ean) {
            showToast(`"${p.name}" has no EAN saved yet — enter one below, or add it in Manage Products`);
          }
        },
      }));
    });
  }

  document.getElementById('generate-barcode-btn').addEventListener('click', () => {
    const ean = eanInput.value.trim();
    const sku = skuInput.value.trim();
    const description = descriptionInput.value.trim();
    const variant = document.getElementById('barcode-variant').value.trim();
    const output = document.getElementById('barcode-output').value;

    if (!ean) {
      showToast('EAN is required — never guess it, it’s a registered number');
      eanInput.focus();
      return;
    }
    if (!sku) {
      showToast('SKU is required');
      skuInput.focus();
      return;
    }
    if (!description) {
      showToast('Description is required');
      descriptionInput.focus();
      return;
    }
    if (!isValidEan13(ean)) {
      showToast('EAN check digit is invalid — double-check the number before printing');
    }

    Store.addBarcodeLabelBatch({ ean, sku, description, variant, output });
    renderBarcodePreview({ ean, sku, description, variant, output });
  });
  }

  function renderBarcodePreview({ ean, sku, description, variant, output }) {
    const previewWrap = document.getElementById('barcode-preview-wrap');
    const lines = [ean, sku, description, variant ? `(${variant.toUpperCase()})` : ''].filter(Boolean);

    if (output === 'single') {
      previewWrap.innerHTML = `
        <div class="card barcode-label-card">
          <div class="delivery-label-header">
            <h2>Preview</h2>
            <button type="button" class="btn btn-primary btn-sm" id="print-barcode-btn">Print</button>
          </div>
          <div class="barcode-sheet barcode-sheet-single" id="barcode-sheet">
            <div class="barcode-label barcode-label-single">
              <svg class="barcode-svg" data-ean="${escapeHtml(ean)}" data-barwidth="2" data-barheight="90"></svg>
              <div class="barcode-text barcode-text-single">
                ${lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      const labelsHtml = Array.from({ length: 10 })
        .map(
          () => `
        <div class="barcode-label barcode-label-sheet">
          <svg class="barcode-svg" data-ean="${escapeHtml(ean)}" data-barwidth="1.3" data-barheight="34"></svg>
          <div class="barcode-text barcode-text-sheet">
            ${lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
          </div>
        </div>
      `
        )
        .join('');
      previewWrap.innerHTML = `
        <div class="card barcode-label-card">
          <div class="delivery-label-header">
            <h2>Preview</h2>
            <button type="button" class="btn btn-primary btn-sm" id="print-barcode-btn">Print</button>
          </div>
          <p class="helper-text">10 copies of the same label, 2 columns &times; 5 rows. Print at 100% / Actual size, not Fit to page.</p>
          <div class="barcode-sheet barcode-sheet-a4" id="barcode-sheet">${labelsHtml}</div>
        </div>
      `;
    }

    document.querySelectorAll('.barcode-svg').forEach((svg) => {
      JsBarcode(svg, svg.dataset.ean, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: Number(svg.dataset.barwidth),
        height: Number(svg.dataset.barheight),
      });
    });

    document.getElementById('print-barcode-btn').addEventListener('click', () => {
      setPrintPageSize(output === 'single' ? '6in 4in' : 'A4');
      window.print();
    });
    previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ----- Past Barcode Labels (history log) -----

  function renderHistoryList() {
    const batches = Store.getBarcodeLabelBatches();

    root.innerHTML = `
      ${subNavHtml('history')}
      <div class="card">
        <h2>Past Barcode Labels</h2>
        ${
          batches.length
            ? `<div class="delivery-history-list" id="barcode-history-list">${batches
                .map(
                  (b) => `
                <div class="delivery-history-row" data-batch-id="${escapeHtml(b.id)}" role="button" tabindex="0">
                  <div class="delivery-history-main">
                    <div class="delivery-history-filename">${escapeHtml(b.description)}${
                    b.variant ? ` &mdash; ${escapeHtml(b.variant)}` : ''
                  }</div>
                    <div class="delivery-history-meta">
                      Generated ${escapeHtml(formatBarcodeBatchDate(b.generatedAt))} &middot;
                      ${escapeHtml(b.sku || 'No SKU')} &middot; EAN ${escapeHtml(b.ean)} &middot;
                      ${b.output === 'single' ? '1 label' : 'A4 sheet (10 copies)'}
                    </div>
                  </div>
                  <div class="delivery-history-row-right">
                    <button type="button" class="btn btn-sm btn-danger barcode-batch-delete-btn" data-batch-id="${escapeHtml(
                      b.id
                    )}" aria-label="Delete batch">Delete</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : '<div class="empty-state">No barcode labels generated yet. Create one from the New Label tab.</div>'
        }
      </div>
    `;
    wireSubNav();

    const list = document.getElementById('barcode-history-list');
    if (!list) return;

    function handleActivate(e) {
      const deleteBtn = e.target.closest('.barcode-batch-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        confirmDeleteBarcodeBatchRow(deleteBtn.dataset.batchId);
        return;
      }
      const row = e.target.closest('.delivery-history-row');
      if (row) renderBatchDetail(row.dataset.batchId);
    }

    list.addEventListener('click', handleActivate);
    list.addEventListener('keydown', (e) => {
      if (e.target.closest('.barcode-batch-delete-btn')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate(e);
      }
    });
  }

  function confirmDeleteBarcodeBatchRow(id) {
    const rowEl = document.querySelector(`.delivery-history-row[data-batch-id="${id}"]`);
    if (!rowEl) return;
    const batch = Store.getBarcodeLabelBatchById(id);

    rowEl.removeAttribute('role');
    rowEl.removeAttribute('tabindex');
    rowEl.innerHTML = `
      <div class="confirm-prompt delivery-row-confirm">
        <p class="confirm-message">Delete &ldquo;${escapeHtml(
          batch ? batch.description : 'this label'
        )}&rdquo;? This removes it from the history log permanently.</p>
        <div class="confirm-actions">
          <button type="button" class="btn" id="cancel-delete-barcode-batch">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete-barcode-batch">Yes, delete</button>
        </div>
      </div>
    `;
    document.getElementById('cancel-delete-barcode-batch').addEventListener('click', (e) => {
      e.stopPropagation();
      renderHistoryList();
    });
    document.getElementById('confirm-delete-barcode-batch').addEventListener('click', (e) => {
      e.stopPropagation();
      Store.deleteBarcodeLabelBatch(id);
      showToast('Barcode label deleted');
      renderHistoryList();
    });
  }

  function renderBatchDetail(batchId) {
    const batch = Store.getBarcodeLabelBatchById(batchId);
    if (!batch) {
      renderHistoryList();
      return;
    }

    root.innerHTML = `
      ${subNavHtml('history')}
      <div class="card">
        <div class="delivery-label-header">
          <h2>${escapeHtml(batch.description)}</h2>
          <button type="button" class="btn btn-sm btn-danger" id="delete-barcode-batch-detail-btn">Delete</button>
        </div>
        <p class="helper-text">
          Generated ${escapeHtml(formatBarcodeBatchDate(batch.generatedAt))} &middot; ${escapeHtml(batch.sku || 'No SKU')}
          &middot; EAN ${escapeHtml(batch.ean)}${batch.variant ? ` &middot; ${escapeHtml(batch.variant)}` : ''}
        </p>
      </div>
      <div id="barcode-preview-wrap"></div>
    `;
    wireSubNav();

    renderBarcodePreview({
      ean: batch.ean,
      sku: batch.sku,
      description: batch.description,
      variant: batch.variant,
      output: batch.output,
    });

    document.getElementById('delete-barcode-batch-detail-btn').addEventListener('click', () => {
      Store.deleteBarcodeLabelBatch(batchId);
      showToast('Barcode label deleted');
      renderHistoryList();
    });
  }
}
