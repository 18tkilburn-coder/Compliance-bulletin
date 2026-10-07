// Pallet Label Generator (Manager portal only): turns a packing slip into
// one 6x4" QR label per pallet. Each product line is split into pallets
// that never exceed the max quantity for its size (full pallets first,
// remainder on the last pallet), and the sum of every pallet's quantity
// must match the packing slip's grand total exactly before labels are
// generated — nothing prints until that check passes.
//
// This is a standalone generator, separate from Delivery Import: it's
// driven by a packing slip and produces pallet-level logistics labels,
// not per-unit stock entries, so it doesn't touch the pending-delivery
// or stock-entry data at all.

function stripProteinWord(text) {
  return text.replace(/\bProtein\b/gi, '').replace(/\s+/g, ' ').trim();
}

// Pulls the trailing size token (e.g. "33g", "1.2kg") off a product+size
// string for the pallet-limit lookup. Falls back to the whole string
// (lowercased) for sizeless products like "ISOLATE ZERO".
function parseSizeKey(productSizeText) {
  const match = productSizeText.match(/(\d+(?:\.\d+)?\s*(?:kg|g))\s*$/i);
  if (match) return match[1].replace(/\s+/g, '').toLowerCase();
  return productSizeText.trim().toLowerCase();
}

// Full pallets of `maxPerPallet` first, remainder last — e.g. 500 at a
// limit of 168 becomes [168, 168, 164].
function splitIntoPallets(totalQty, maxPerPallet) {
  const pallets = [];
  let remaining = totalQty;
  while (remaining > 0) {
    pallets.push(Math.min(maxPerPallet, remaining));
    remaining -= Math.min(maxPerPallet, remaining);
  }
  return pallets;
}

function buildPalletQrPayload({ name, flavour, qty, bbe, batchCodes }) {
  const batchForQr = batchCodes.map((b) => b.replace(/-/g, '.')).join(', ');
  return `${name} - ${flavour} | ${qty} x | ${bbe} | ${batchForQr}`;
}

// Shrinks the name+flavour block's font size until it fits the available
// height above the info/QR row, at the label's full width. A simplified
// stand-in for the spec's dynamic text-fit algorithm — because this region
// is always laid out above the info/QR row (never beside it), the "full
// width vs QR-safe width" fallback the spec describes doesn't apply here.
function fitPalletNameBlock(blockEl, maxHeightPx) {
  let size = 44;
  blockEl.style.fontSize = size + 'px';
  while (size > 14 && blockEl.scrollHeight > maxHeightPx) {
    size -= 2;
    blockEl.style.fontSize = size + 'px';
  }
}

function renderPalletLabelsScreen(root) {
  let rowCounter = 0;
  function nextRowId() {
    rowCounter += 1;
    return `prow_${rowCounter}`;
  }

  renderInputStep();

  function limitsReferenceHtml() {
    const limits = Store.getPalletLimits();
    const rows = Object.keys(limits)
      .sort()
      .map((size) => `<div class="pallet-limit-row"><span>${escapeHtml(size)}</span><span>${limits[size].toLocaleString()}</span></div>`)
      .join('');
    return `
      <details class="pallet-limits-ref">
        <summary>Pallet size limits (${Object.keys(limits).length})</summary>
        <div class="pallet-limit-list">${rows}</div>
      </details>
    `;
  }

  function renderInputStep() {
    root.innerHTML = `
      <div class="card">
        <h2>Pallet Labels</h2>
        <p class="helper-text">
          Enter each line from the packing slip, then generate pallet labels. Every pallet's quantity must add up
          to the grand total exactly before labels are produced.
        </p>
        ${limitsReferenceHtml()}
        <div class="table-scroll">
          <table class="line-items-table pallet-input-table" id="pallet-lines-table">
            <thead>
              <tr>
                <th>Product + size</th>
                <th>Flavour</th>
                <th>Qty</th>
                <th>BBE</th>
                <th>Batch code(s)</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="pallet-lines-body"></tbody>
          </table>
        </div>
        <button type="button" class="btn mt-sm" id="pallet-add-row-btn">+ Add row</button>

        <div class="field mt-sm">
          <label>Grand total (from the packing slip)</label>
          <input type="number" id="pallet-grand-total" min="0" placeholder="e.g. 500" />
        </div>

        <div id="pallet-generate-feedback"></div>

        <button type="button" class="btn btn-primary btn-block mt-sm" id="pallet-generate-btn">Generate Pallet Labels</button>
      </div>
      <div id="pallet-missing-size-wrap"></div>
      <div id="pallet-preview-wrap"></div>
    `;

    const tbody = document.getElementById('pallet-lines-body');

    function addRow() {
      const rowId = nextRowId();
      const tr = document.createElement('tr');
      tr.dataset.rowId = rowId;
      tr.innerHTML = `
        <td><input type="text" class="pallet-line-product" placeholder="e.g. Whey Protein 450g" /></td>
        <td><input type="text" class="pallet-line-flavour" placeholder="e.g. Chocolate" /></td>
        <td><input type="number" class="pallet-line-qty" min="1" placeholder="500" /></td>
        <td>
          <div class="line-item-bbd">
            <select class="pallet-line-bbe-month">
              <option value="">MM</option>
              ${bestBeforeMonthOptions()
                .map((m) => `<option value="${m}">${m}</option>`)
                .join('')}
            </select>
            <select class="pallet-line-bbe-year">
              <option value="">YY</option>
              ${bestBeforeYearOptions()
                .map((y) => `<option value="${y}">${y}</option>`)
                .join('')}
            </select>
          </div>
        </td>
        <td><input type="text" class="pallet-line-batch" placeholder="e.g. 123-456" /></td>
        <td><button type="button" class="btn btn-sm btn-danger pallet-line-remove">Remove</button></td>
      `;
      tr.querySelector('.pallet-line-remove').addEventListener('click', () => tr.remove());
      tbody.appendChild(tr);
    }

    addRow();
    document.getElementById('pallet-add-row-btn').addEventListener('click', addRow);
    document.getElementById('pallet-generate-btn').addEventListener('click', attemptGenerate);
  }

  function readLines() {
    const rows = Array.from(document.querySelectorAll('#pallet-lines-body tr'));
    const lines = [];
    for (const row of rows) {
      const productText = row.querySelector('.pallet-line-product').value.trim();
      const flavour = row.querySelector('.pallet-line-flavour').value.trim();
      const qtyRaw = row.querySelector('.pallet-line-qty').value;
      const month = row.querySelector('.pallet-line-bbe-month').value;
      const year = row.querySelector('.pallet-line-bbe-year').value;
      const batchRaw = row.querySelector('.pallet-line-batch').value.trim();

      if (!productText || !flavour || !qtyRaw || !month || !year || !batchRaw) {
        return { error: 'Every row needs a product + size, flavour, quantity, best-before, and at least one batch code' };
      }

      lines.push({
        productText,
        name: stripProteinWord(productText),
        sizeKey: parseSizeKey(productText),
        flavour,
        quantity: Number(qtyRaw),
        bbe: formatBestBefore(month, year),
        batchCodes: batchRaw.split(',').map((b) => b.trim()).filter(Boolean),
      });
    }
    if (!lines.length) {
      return { error: 'Add at least one line from the packing slip' };
    }
    return { lines };
  }

  function attemptGenerate() {
    const feedbackEl = document.getElementById('pallet-generate-feedback');
    const missingWrap = document.getElementById('pallet-missing-size-wrap');
    const previewWrap = document.getElementById('pallet-preview-wrap');
    feedbackEl.innerHTML = '';
    missingWrap.innerHTML = '';
    previewWrap.innerHTML = '';

    const { lines, error } = readLines();
    if (error) {
      showToast(error);
      return;
    }

    const grandTotalRaw = document.getElementById('pallet-grand-total').value;
    if (!grandTotalRaw) {
      showToast('Enter the packing slip’s grand total');
      return;
    }
    const grandTotal = Number(grandTotalRaw);

    const limits = Store.getPalletLimits();
    const missingSizes = [...new Set(lines.filter((l) => limits[l.sizeKey] === undefined).map((l) => l.sizeKey))];

    if (missingSizes.length) {
      renderMissingSizePrompt(missingSizes, () => attemptGenerate());
      return;
    }

    const sumQty = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (sumQty !== grandTotal) {
      feedbackEl.innerHTML = `
        <p class="pallet-totals-mismatch">
          Line quantities add up to ${sumQty.toLocaleString()}, but the grand total is ${grandTotal.toLocaleString()}.
          Fix the lines or the grand total before generating &mdash; nothing is produced until these match exactly.
        </p>
      `;
      return;
    }

    const pallets = [];
    lines.forEach((line) => {
      const maxPerPallet = limits[line.sizeKey];
      splitIntoPallets(line.quantity, maxPerPallet).forEach((qty) => {
        pallets.push({ ...line, quantity: qty });
      });
    });

    const palletSumCheck = pallets.reduce((sum, p) => sum + p.quantity, 0);
    feedbackEl.innerHTML = `<p class="pallet-totals-ok">Totals check passed: ${palletSumCheck.toLocaleString()} across ${pallets.length} pallet${pallets.length === 1 ? '' : 's'} = grand total ${grandTotal.toLocaleString()}.</p>`;

    renderPalletPreview(pallets);
  }

  function renderMissingSizePrompt(missingSizes, onSaved) {
    const missingWrap = document.getElementById('pallet-missing-size-wrap');
    missingWrap.innerHTML = `
      <div class="card pallet-missing-size-card">
        <h2>Pallet limit needed</h2>
        <p class="helper-text">
          ${missingSizes.length === 1 ? 'This size isn’t' : 'These sizes aren’t'} in the pallet limits table yet.
          Enter the max quantity per pallet for ${missingSizes.length === 1 ? 'it' : 'each'} &mdash; never guessed or borrowed from a similar size.
        </p>
        ${missingSizes
          .map(
            (size) => `
          <div class="field">
            <label>Max qty per pallet for &ldquo;${escapeHtml(size)}&rdquo;</label>
            <input type="number" class="pallet-missing-size-input" data-size="${escapeHtml(size)}" min="1" placeholder="e.g. 288" />
          </div>
        `
          )
          .join('')}
        <button type="button" class="btn btn-primary btn-block" id="pallet-save-limits-btn">Save &amp; Continue</button>
      </div>
    `;

    document.getElementById('pallet-save-limits-btn').addEventListener('click', () => {
      const inputs = Array.from(document.querySelectorAll('.pallet-missing-size-input'));
      for (const input of inputs) {
        const value = input.value;
        if (!value || Number(value) <= 0) {
          showToast(`Enter a max quantity for "${input.dataset.size}"`);
          input.focus();
          return;
        }
      }
      inputs.forEach((input) => Store.setPalletLimit(input.dataset.size, input.value));
      showToast('Pallet limit saved');
      missingWrap.innerHTML = '';
      onSaved();
    });
  }

  function labelHtml(pallet, index, total) {
    const payload = buildPalletQrPayload(pallet);
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    return `
      <div class="pallet-label" data-pallet-index="${index}">
        <div class="pallet-label-top">
          <div class="pallet-label-name-block">
            <div class="pallet-label-name">${escapeHtml(pallet.name)}</div>
            <div class="pallet-label-flavour">${escapeHtml(pallet.flavour)}</div>
          </div>
        </div>
        <div class="pallet-label-divider"></div>
        <div class="pallet-label-bottom">
          <div class="pallet-label-info">
            <div>QTY ${escapeHtml(String(pallet.quantity))}</div>
            <div>BBE ${escapeHtml(pallet.bbe)}</div>
            <div>BATCH ${escapeHtml(pallet.batchCodes.join(', '))}</div>
          </div>
          <div class="pallet-label-qr">${qr.createSvgTag(4)}</div>
        </div>
      </div>
    `;
  }

  function renderPalletPreview(pallets) {
    const previewWrap = document.getElementById('pallet-preview-wrap');
    const labelsHtml = pallets.map((p, i) => labelHtml(p, i, pallets.length)).join('');

    previewWrap.innerHTML = `
      <div class="card pallet-preview-card">
        <div class="delivery-label-header">
          <h2>Pallet Labels</h2>
          <button type="button" class="btn btn-primary btn-sm" id="print-pallet-labels-btn">Print All</button>
        </div>
        <p class="helper-text">${pallets.length} label${pallets.length === 1 ? '' : 's'}, one 6 &times; 4&quot; page each.</p>
        <div class="pallet-label-stack" id="pallet-label-stack">${labelsHtml}</div>
      </div>
    `;

    document.querySelectorAll('.pallet-label-name-block').forEach((block) => {
      const top = block.closest('.pallet-label-top');
      fitPalletNameBlock(block, top.clientHeight);
    });

    document.getElementById('print-pallet-labels-btn').addEventListener('click', () => {
      setPrintPageSize('6in 4in');
      window.print();
    });
    previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
