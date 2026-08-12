// Delivery Import screen (Manager portal only): upload a delivery note,
// review a simulated extraction of its line items, then generate printable
// QR labels for each. Confirmed items become "pending delivery items" that
// the Put-Away screen's "Scan QR Label" button can later match against, and
// are also saved as a permanent delivery record so past deliveries stay
// browsable (and their labels reprintable) even after being put away.

function renderDeliveryImportScreen(root) {
  let rowCounter = 0;
  function nextRowId() {
    rowCounter += 1;
    return `row_${rowCounter}`;
  }
  let currentFilename = '';

  renderUploadStep();

  // ----- Sub-nav shared across every step (New Delivery / Past Deliveries) -----

  function subNavHtml(active) {
    return `
      <div class="sub-tabs">
        <button type="button" class="sub-tab-btn${active === 'new' ? ' active' : ''}" data-subtab="new">New Delivery</button>
        <button type="button" class="sub-tab-btn${active === 'history' ? ' active' : ''}" data-subtab="history">Past Deliveries</button>
      </div>
    `;
  }

  function wireSubNav() {
    document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.subtab === 'new') {
          renderUploadStep();
        } else {
          renderPastDeliveriesList();
        }
      });
    });
  }

  // ----- Step 1: Upload -----

  function renderUploadStep() {
    root.innerHTML = `
      ${subNavHtml('new')}
      <div class="card">
        <h2>Delivery Import</h2>
        <p class="helper-text">
          Upload a delivery note (PDF, Word, or a photo) to extract its line items and generate QR labels for Put-Away.
        </p>
        <label class="upload-dropzone" id="upload-dropzone" for="delivery-file-input">
          <span class="upload-dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
          </span>
          <span class="upload-dropzone-text">Drag &amp; drop a delivery note here, or click to choose a file</span>
          <span class="upload-dropzone-hint">PDF, DOCX, or image</span>
        </label>
        <input type="file" id="delivery-file-input" accept=".pdf,.doc,.docx,image/*" hidden />
      </div>
    `;
    wireSubNav();

    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('delivery-file-input');

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    });
  }

  function handleFileSelected(file) {
    currentFilename = file.name;
    renderAnalysingStep(file.name);

    // Prototype only: no real document-processing/AI backend exists yet.
    // The real build would send the uploaded file to a document-extraction
    // service and parse its response into line items. Here we just fake a
    // plausible result using the existing product catalogue after a short
    // delay, to demonstrate the review → generate → print → scan workflow.
    setTimeout(() => {
      const items = generateMockExtraction();
      renderReviewStep(items);
    }, 1400);
  }

  function renderAnalysingStep(filename) {
    root.innerHTML = `
      ${subNavHtml('new')}
      <div class="card">
        <h2>Delivery Import</h2>
        <div class="analysing-state">
          <div class="spinner" aria-hidden="true"></div>
          <p class="analysing-text">Analysing &ldquo;${escapeHtml(filename)}&rdquo;&hellip;</p>
        </div>
      </div>
    `;
    wireSubNav();
  }

  function generateMockExtraction() {
    const products = Store.getProducts();
    if (!products.length) return [];
    const count = Math.min(randomInt(3, 6), products.length);
    const chosen = shuffle(products).slice(0, count);
    return chosen.map((p) => {
      const [min, max] = p.qtyRange || [10, 50];
      const { month, year } = randomBestBefore();
      return {
        rowId: nextRowId(),
        productId: p.id,
        batchCode: randomBatchCode(),
        bestBeforeMonth: month,
        bestBeforeYear: year,
        quantity: randomInt(min, max),
      };
    });
  }

  // ----- Step 2: Review -----

  function renderReviewStep(items) {
    const products = Store.getProducts();

    root.innerHTML = `
      ${subNavHtml('new')}
      <div class="card">
        <h2>Review Extracted Line Items</h2>
        <p class="helper-text">
          This is a simulated extraction &mdash; check each row against the delivery note and correct anything before generating labels.
        </p>
        <div class="table-scroll">
          <table class="line-items-table" id="line-items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch code</th>
                <th>Best before</th>
                <th>Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="line-items-body"></tbody>
          </table>
        </div>
        <button type="button" class="btn mt-sm" id="add-row-btn">+ Add row</button>
        <div class="inline-form-actions mt-sm">
          <button type="button" class="btn" id="cancel-import-btn">Cancel</button>
          <button type="button" class="btn btn-primary" id="confirm-generate-btn">Confirm &amp; Generate Labels</button>
        </div>
      </div>
    `;
    wireSubNav();

    const tbody = document.getElementById('line-items-body');

    function productOptionsHtml(selectedId) {
      return products
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}"${p.id === selectedId ? ' selected' : ''}>${escapeHtml(p.name)}</option>`
        )
        .join('');
    }

    function monthOptionsHtml(selected) {
      return bestBeforeMonthOptions()
        .map((m) => `<option value="${m}"${m === selected ? ' selected' : ''}>${m}</option>`)
        .join('');
    }

    function yearOptionsHtml(selected) {
      return bestBeforeYearOptions()
        .map((y) => `<option value="${y}"${y === selected ? ' selected' : ''}>${y}</option>`)
        .join('');
    }

    function addRow(item) {
      const tr = document.createElement('tr');
      tr.dataset.rowId = item.rowId;
      tr.innerHTML = `
        <td><select class="line-item-product">${productOptionsHtml(item.productId)}</select></td>
        <td><input type="text" class="line-item-batch" value="${escapeHtml(item.batchCode || '')}" placeholder="e.g. 48213" /></td>
        <td>
          <div class="line-item-bbd">
            <select class="line-item-bbd-month">
              <option value="">MM</option>
              ${monthOptionsHtml(item.bestBeforeMonth)}
            </select>
            <select class="line-item-bbd-year">
              <option value="">YY</option>
              ${yearOptionsHtml(item.bestBeforeYear)}
            </select>
          </div>
        </td>
        <td><input type="number" class="line-item-qty" min="1" value="${item.quantity || ''}" /></td>
        <td><button type="button" class="btn btn-sm btn-danger line-item-remove">Remove</button></td>
      `;
      tr.querySelector('.line-item-remove').addEventListener('click', () => tr.remove());
      tbody.appendChild(tr);
    }

    if (items.length) {
      items.forEach(addRow);
    } else {
      addRow({ rowId: nextRowId(), productId: products[0] && products[0].id, batchCode: '', quantity: '' });
    }

    document.getElementById('add-row-btn').addEventListener('click', () => {
      addRow({ rowId: nextRowId(), productId: products[0] && products[0].id, batchCode: '', quantity: '' });
    });

    document.getElementById('cancel-import-btn').addEventListener('click', () => {
      renderUploadStep();
    });

    document.getElementById('confirm-generate-btn').addEventListener('click', () => {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (!rows.length) {
        showToast('Add at least one line item first');
        return;
      }

      const confirmedItems = [];
      for (const row of rows) {
        const productId = row.querySelector('.line-item-product').value;
        const batchCode = row.querySelector('.line-item-batch').value.trim();
        const month = row.querySelector('.line-item-bbd-month').value;
        const year = row.querySelector('.line-item-bbd-year').value;
        const quantityRaw = row.querySelector('.line-item-qty').value;

        if (!productId || !batchCode || !month || !year || !quantityRaw || Number(quantityRaw) < 1) {
          showToast('Every row needs a product, batch code, best before, and quantity');
          return;
        }

        confirmedItems.push({
          productId,
          batchCode,
          bestBefore: formatBestBefore(month, year),
          quantity: quantityRaw,
        });
      }

      const created = Store.addPendingDeliveryItems(confirmedItems);
      const record = Store.addDeliveryRecord({ filename: currentFilename, items: created });
      renderDeliveryDetail(record.id, 'new');
    });
  }

  // ----- Step 3: Labels (freshly confirmed, or revisiting a past delivery) -----

  function buildQrPayload(product, item) {
    return [product.name, product.sku || '', item.batchCode, item.bestBefore].join('|');
  }

  function labelCardHtml(item) {
    if (!item.product) return '';
    const payload = buildQrPayload(item.product, item);
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    return `
      <div class="qr-label" data-item-id="${escapeHtml(item.id)}">
        <label class="qr-label-select">
          <input type="checkbox" class="qr-label-checkbox" data-item-id="${escapeHtml(item.id)}" aria-label="Select this label" />
        </label>
        <div class="qr-label-code">${qr.createSvgTag(4)}</div>
        <div class="qr-label-text">${escapeHtml(String(item.quantity))} &times; ${escapeHtml(item.product.name)}</div>
        <div class="qr-label-sub">Batch ${escapeHtml(item.batchCode)} &middot; BBD ${escapeHtml(item.bestBefore)}</div>
      </div>
    `;
  }

  function renderDeliveryDetail(deliveryId, activeSubTab) {
    const delivery = Store.getDeliveryRecordById(deliveryId);
    if (!delivery) {
      renderPastDeliveriesList();
      return;
    }

    const labelsHtml = delivery.items.map(labelCardHtml).join('');
    const dateStr = formatDeliveryDate(delivery.importedAt);

    root.innerHTML = `
      ${subNavHtml(activeSubTab)}
      <div class="card qr-label-card">
        <div class="delivery-label-header">
          <h2>QR Labels</h2>
        </div>
        <p class="helper-text">
          ${delivery.filename ? `${escapeHtml(delivery.filename)} &middot; ` : ''}${escapeHtml(dateStr)} &middot;
          ${delivery.items.length} label${delivery.items.length === 1 ? '' : 's'}.
          Scan one from the Put-Away screen to auto-fill Product, Batch Code, and Best Before.
        </p>

        <div class="label-select-toolbar">
          <label class="select-all-toggle">
            <input type="checkbox" id="select-all-labels" />
            Select all
          </label>
          <div class="label-select-actions">
            <button type="button" class="btn btn-sm" id="print-selected-btn" disabled>Print Selected</button>
            <button type="button" class="btn btn-primary btn-sm" id="print-all-btn">Print All</button>
          </div>
        </div>

        <div class="qr-label-grid" id="qr-label-grid">${labelsHtml}</div>
      </div>
      ${activeSubTab === 'new' ? '<button type="button" class="btn mt-sm" id="import-another-btn">Import Another Delivery</button>' : ''}
    `;
    wireSubNav();

    const grid = document.getElementById('qr-label-grid');
    const selectAll = document.getElementById('select-all-labels');
    const printSelectedBtn = document.getElementById('print-selected-btn');
    const printAllBtn = document.getElementById('print-all-btn');

    function updatePrintSelectedState() {
      const anyChecked = grid.querySelectorAll('.qr-label-checkbox:checked').length > 0;
      printSelectedBtn.disabled = !anyChecked;
    }

    grid.querySelectorAll('.qr-label-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        cb.closest('.qr-label').classList.toggle('selected', cb.checked);
        updatePrintSelectedState();
      });
    });

    selectAll.addEventListener('change', () => {
      const checked = selectAll.checked;
      grid.querySelectorAll('.qr-label-checkbox').forEach((cb) => {
        cb.checked = checked;
        cb.closest('.qr-label').classList.toggle('selected', checked);
      });
      updatePrintSelectedState();
    });

    printAllBtn.addEventListener('click', () => {
      grid.classList.remove('print-selected-only');
      window.print();
    });

    printSelectedBtn.addEventListener('click', () => {
      if (printSelectedBtn.disabled) {
        showToast('Select at least one label to print');
        return;
      }
      grid.classList.add('print-selected-only');
      window.print();
    });

    const importAnotherBtn = document.getElementById('import-another-btn');
    if (importAnotherBtn) {
      importAnotherBtn.addEventListener('click', () => renderUploadStep());
    }
  }

  // ----- Past Deliveries -----

  function formatDeliveryDate(timestamp) {
    const d = new Date(timestamp);
    const datePart = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${timePart}`;
  }

  function renderPastDeliveriesList() {
    const deliveries = Store.getDeliveryRecords();

    root.innerHTML = `
      ${subNavHtml('history')}
      <div class="card">
        <h2>Past Deliveries</h2>
        ${
          deliveries.length
            ? `<div class="delivery-history-list" id="delivery-history-list">${deliveries
                .map(
                  (d) => `
                <div class="delivery-history-row" data-delivery-id="${escapeHtml(d.id)}" role="button" tabindex="0">
                  <div class="delivery-history-main">
                    <div class="delivery-history-filename">${escapeHtml(d.filename || 'Untitled delivery')}</div>
                    <div class="delivery-history-meta">${escapeHtml(formatDeliveryDate(d.importedAt))}</div>
                  </div>
                  <div class="delivery-history-count">${d.items.length} label${d.items.length === 1 ? '' : 's'}</div>
                </div>
              `
                )
                .join('')}</div>`
            : '<div class="empty-state">No deliveries confirmed yet. Import one from the New Delivery tab.</div>'
        }
      </div>
    `;
    wireSubNav();

    const list = document.getElementById('delivery-history-list');
    if (!list) return;

    function activateRow(e) {
      const row = e.target.closest('.delivery-history-row');
      if (row) renderDeliveryDetail(row.dataset.deliveryId, 'history');
    }

    list.addEventListener('click', activateRow);
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateRow(e);
      }
    });
  }
}
