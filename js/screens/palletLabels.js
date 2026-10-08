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

// Pallet labels drop the "Per4m" brand prefix and the word "Protein" from
// the packing slip's product text — e.g. "Per4m Advanced Protein 495g"
// becomes "Advanced 495g" on the printed label.
function stripProteinWord(text) {
  return text
    .replace(/\bPer4m\b/gi, '')
    .replace(/\bProtein\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
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

// Batch hyphens become periods in the QR payload only (not on the printed
// label) because a phone camera's QR reader treats a hyphenated number like
// "300926-11" as a phone number and offers to dial it instead of showing
// the scanned text.
function buildPalletQrPayload({ name, flavour, quantity, bbe, batchCodes }) {
  const batchForQr = batchCodes.map((b) => b.replace(/-/g, '.')).join(', ');
  return `${name} - ${flavour} | QTY ${quantity} | BBE ${bbe} | BATCH ${batchForQr}`;
}

// A single pallet label's markup — top-level (not nested in
// renderPalletLabelsScreen) so the Dashboard's Last Shipment widget can
// reuse it for a label preview without duplicating the layout.
function labelHtml(pallet, index) {
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

// ----- Packing-slip PDF import -----
// Lets a manager upload the actual packing-slip PDF instead of typing every
// line by hand. Only digital PDFs with a real text layer are supported (an
// exported/printed-to-PDF spreadsheet, not a photo) — a phone photo has no
// embedded text at all, so there is nothing here to extract it from; those
// still have to be entered on the manual table below.

let pdfWorkerConfigured = false;

// pdf.js needs its parsing worker as a separate script. The real file tree
// serves it from js/vendor/pdf.worker.min.js; the single-file artifact
// bundle instead inlines it as base64 text (see build-bundle.py) and turns
// it into a Blob URL here, so the same code works in both contexts.
function ensurePdfWorkerConfigured() {
  if (pdfWorkerConfigured) return;
  pdfWorkerConfigured = true;
  const inlineWorker = document.getElementById('pdf-worker-b64');
  if (inlineWorker) {
    const binary = atob(inlineWorker.textContent.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
  }
}

// pdf.js hands back text in disconnected fragments, not reading order.
// Reconstruct each printed line by clustering fragments whose baseline sits
// within a few px of each other (same row), then reading left to right.
async function extractPdfTextLines(file) {
  ensurePdfWorkerConfigured();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));

    const rows = [];
    items.forEach((item) => {
      const row = rows.find((r) => Math.abs(r.y - item.y) < 3);
      if (row) {
        row.items.push(item);
        row.y = (row.y + item.y) / 2;
      } else {
        rows.push({ y: item.y, items: [item] });
      }
    });

    rows
      .sort((a, b) => b.y - a.y) // PDF y increases upward — top of page first
      .forEach((row) => {
        const lineText = row.items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (lineText) lines.push(lineText);
      });
  }

  return lines;
}

// Splits "Per4m Advanced Protein 495g (Chocolate Hazelnut Wafer)" into the
// product+size text and the flavour in parentheses.
function splitProductAndFlavour(productFullText) {
  const match = productFullText.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (match) return { productText: match[1].trim(), flavour: match[2].trim() };
  return { productText: productFullText.trim(), flavour: '' };
}

// A packing-slip row has a fixed shape once reconstructed into one line of
// text: [Product (Flavour)]  BatchCode  LotNumber  MM/YYYY  Total. The
// product+flavour cell is blank on every row after the first for a given
// product (a merged/continuation cell), so those rows match the shorter
// pattern and inherit whichever product most recently started a group.
const PACKING_SLIP_ROW_WITH_PRODUCT = /^(.+?)\s+(\d{3,8}-\d{1,4})\s+(\d{3,8})\s+(\d{1,2})\/(\d{4})\s+(\d+)$/;
const PACKING_SLIP_ROW_CONTINUATION = /^(\d{3,8}-\d{1,4})\s+(\d{3,8})\s+(\d{1,2})\/(\d{4})\s+(\d+)$/;
const PACKING_SLIP_GROUP_TOTAL_ROW = /^(.+?)\s+Total\s+(\d+)$/i;
const PACKING_SLIP_GRAND_TOTAL_ROW = /^Grand\s*Total\s+(\d+)$/i;

// Turns the reconstructed text lines into one group per product+flavour,
// summing quantity and collecting every batch code under it — exactly the
// shape the manual-entry table already produces, so everything downstream
// (pallet splitting, totals check, label generation) runs unchanged.
function parsePackingSlipLines(textLines) {
  const groups = [];
  const byKey = new Map();
  let grandTotal = null;
  let currentProductFullText = null;

  function groupFor(productFullText) {
    const key = productFullText.trim().toLowerCase();
    if (byKey.has(key)) return byKey.get(key);
    const { productText, flavour } = splitProductAndFlavour(productFullText);
    const group = { productText, flavour, batchCodes: [], quantity: 0, bbeMonth: '', bbeYear: '', statedTotal: null };
    byKey.set(key, group);
    groups.push(group);
    return group;
  }

  function addRow(group, batch, month, yearFull, qty) {
    group.batchCodes.push(batch);
    group.quantity += Number(qty);
    if (!group.bbeMonth) {
      group.bbeMonth = month.padStart(2, '0');
      group.bbeYear = yearFull.slice(-2);
    }
  }

  textLines.forEach((line) => {
    let m = line.match(PACKING_SLIP_GRAND_TOTAL_ROW);
    if (m) {
      grandTotal = Number(m[1]);
      return;
    }
    m = line.match(PACKING_SLIP_GROUP_TOTAL_ROW);
    if (m) {
      const group = byKey.get(m[1].trim().toLowerCase());
      if (group) group.statedTotal = Number(m[2]);
      currentProductFullText = null;
      return;
    }
    m = line.match(PACKING_SLIP_ROW_WITH_PRODUCT);
    if (m) {
      currentProductFullText = m[1].trim();
      addRow(groupFor(currentProductFullText), m[2], m[4], m[5], m[6]);
      return;
    }
    m = line.match(PACKING_SLIP_ROW_CONTINUATION);
    if (m && currentProductFullText) {
      addRow(groupFor(currentProductFullText), m[1], m[3], m[4], m[5]);
    }
    // Anything else (page headers, column titles, trailer/ETA notes) is
    // ignored — it never matches a data-row or total-row shape.
  });

  return { groups, grandTotal };
}

// Runs the full import: extract → parse → shape into the same line objects
// readLines() produces from the manual table, flagging any group whose
// computed sum doesn't match the slip's own "<product> Total" row.
async function importPackingSlipPdf(file) {
  const textLines = await extractPdfTextLines(file);
  const { groups, grandTotal } = parsePackingSlipLines(textLines);

  const lines = groups.map((g) => {
    const flagged = g.statedTotal !== null && g.statedTotal !== g.quantity;
    return {
      productText: g.productText,
      name: stripProteinWord(g.productText),
      sizeKey: parseSizeKey(g.productText),
      flavour: g.flavour,
      quantity: g.quantity,
      bbeMonth: g.bbeMonth,
      bbeYear: g.bbeYear,
      bbe: g.bbeMonth && g.bbeYear ? formatBestBefore(g.bbeMonth, g.bbeYear) : '',
      batchCodes: g.batchCodes,
      flagged,
      flagReason: flagged
        ? `Document's own subtotal for this line is ${g.statedTotal.toLocaleString()}, but its batch rows add up to ${g.quantity.toLocaleString()} — check against the packing slip.`
        : null,
    };
  });

  return { lines, grandTotal };
}

// Packing-slip files over this size aren't kept as a copy in the history
// log (only their filename is) — localStorage has a small, fixed quota
// shared by the whole app, and every past batch's copy sits in it.
const MAX_STORED_SOURCE_FILE_BYTES = 4 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// Offers a stored file (as a data URL) back to the user for download. A
// plain `<a download>` click doesn't work inside the sandboxed iframe the
// published Artifact runs in, so when a `downloads` capability is present
// (the Artifact context) this goes through it instead; the real file-tree
// deployment has no such sandbox, so it falls straight through to the
// ordinary anchor-click trick there.
async function triggerFileDownload(dataUrl, filename) {
  const blob = await (await fetch(dataUrl)).blob();

  if (window.claude && typeof window.claude.use === 'function') {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        await downloads.save({ filename, data: blob });
        return;
      }
    } catch (err) {
      if (err && err.code === 'declined') return;
      // Any other failure (capability missing, unavailable, etc.) falls
      // through to the plain-link path below instead of leaving the
      // viewer with no way to get the file.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function formatPalletBatchDate(timestamp) {
  const d = new Date(timestamp);
  const datePart = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

// Set by openPalletLabelBatch() so a deep link (the Dashboard's Last
// Shipment widget) can land straight on one past batch's detail view
// instead of the Pallet Labels screen's default New Batch step.
let pendingPalletHistoryBatchId = null;

function openPalletLabelBatch(batchId) {
  pendingPalletHistoryBatchId = batchId;
  AppRouter.goTo('palletLabels');
}

function renderPalletLabelsScreen(root) {
  let rowCounter = 0;
  function nextRowId() {
    rowCounter += 1;
    return `prow_${rowCounter}`;
  }

  // Tracks the packing-slip file (if any) behind the batch currently being
  // built, so a successful Generate can save a copy of it into the history
  // log alongside the labels it produced.
  let currentSourceFile = null;
  let currentSourceFileDataUrl = null;

  if (pendingPalletHistoryBatchId) {
    const batchId = pendingPalletHistoryBatchId;
    pendingPalletHistoryBatchId = null;
    renderBatchDetail(batchId);
  } else {
    renderInputStep();
  }

  function subNavHtml(active) {
    return `
      <div class="sub-tabs">
        <button type="button" class="sub-tab-btn${active === 'new' ? ' active' : ''}" data-subtab="new">New Batch</button>
        <button type="button" class="sub-tab-btn${active === 'history' ? ' active' : ''}" data-subtab="history">Past Pallet Labels</button>
        <button type="button" class="sub-tab-btn${active === 'limits' ? ' active' : ''}" data-subtab="limits">Size Limits</button>
      </div>
    `;
  }

  function wireSubNav() {
    document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.subtab === 'new') {
          renderInputStep();
        } else if (btn.dataset.subtab === 'limits') {
          renderSizeLimitsTab();
        } else {
          renderHistoryList();
        }
      });
    });
  }

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
    currentSourceFile = null;
    currentSourceFileDataUrl = null;

    root.innerHTML = `
      ${subNavHtml('new')}
      <div class="card">
        <h2>Pallet Labels</h2>
        <p class="helper-text">
          Upload the packing slip PDF to generate pallet labels. Review the imported lines below &mdash; every
          pallet's quantity must add up to the grand total exactly before labels are produced.
        </p>
        <label class="upload-dropzone" id="pallet-upload-dropzone" for="pallet-file-input">
          <span class="upload-dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
          </span>
          <span class="upload-dropzone-text">Drag &amp; drop the packing slip PDF here, or click to choose a file</span>
          <span class="upload-dropzone-hint">PDF only &mdash; a digital export with real text, not a scanned photo.</span>
        </label>
        <input type="file" id="pallet-file-input" accept=".pdf,application/pdf" hidden />
        <div id="pallet-import-status"></div>
        <div id="pallet-import-summary"></div>
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

    function addRow(prefill) {
      const rowId = nextRowId();
      const tr = document.createElement('tr');
      tr.dataset.rowId = rowId;
      if (prefill && prefill.flagged) {
        tr.classList.add('pallet-line-flagged');
        tr.title = prefill.flagReason || '';
      }
      const p = prefill || {};
      const batchValue = p.batchCodes ? p.batchCodes.join(', ') : '';
      tr.innerHTML = `
        <td><input type="text" class="pallet-line-product" placeholder="e.g. Whey Protein 450g" value="${escapeHtml(p.productText || '')}" /></td>
        <td><input type="text" class="pallet-line-flavour" placeholder="e.g. Chocolate" value="${escapeHtml(p.flavour || '')}" /></td>
        <td><input type="number" class="pallet-line-qty" min="1" placeholder="500" value="${p.quantity || ''}" /></td>
        <td>
          <div class="line-item-bbd">
            <select class="pallet-line-bbe-month">
              <option value="">MM</option>
              ${bestBeforeMonthOptions()
                .map((m) => `<option value="${m}"${m === p.bbeMonth ? ' selected' : ''}>${m}</option>`)
                .join('')}
            </select>
            <select class="pallet-line-bbe-year">
              <option value="">YY</option>
              ${bestBeforeYearOptions()
                .map((y) => `<option value="${y}"${y === p.bbeYear ? ' selected' : ''}>${y}</option>`)
                .join('')}
            </select>
          </div>
        </td>
        <td><input type="text" class="pallet-line-batch" placeholder="e.g. 123-456" value="${escapeHtml(batchValue)}" /></td>
        <td><button type="button" class="btn btn-sm btn-danger pallet-line-remove">Remove</button></td>
      `;
      tr.querySelector('.pallet-line-remove').addEventListener('click', () => tr.remove());
      tbody.appendChild(tr);
    }

    document.getElementById('pallet-generate-btn').addEventListener('click', attemptGenerate);
    wirePdfImport(addRow, tbody);
    wireSubNav();
  }

  function wirePdfImport(addRow, tbody) {
    const dropzone = document.getElementById('pallet-upload-dropzone');
    const fileInput = document.getElementById('pallet-file-input');
    const statusEl = document.getElementById('pallet-import-status');
    const summaryEl = document.getElementById('pallet-import-summary');

    function handleFile(file) {
      const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!looksLikePdf) {
        showToast('Only PDF packing slips can be imported right now — photos and scanned images aren’t supported.');
        return;
      }

      statusEl.innerHTML = `
        <div class="analysing-state analysing-state-inline">
          <div class="spinner" aria-hidden="true"></div>
          <p class="analysing-text">Reading &ldquo;${escapeHtml(file.name)}&rdquo;&hellip;</p>
        </div>
      `;
      summaryEl.innerHTML = '';

      currentSourceFile = file;
      currentSourceFileDataUrl = null;
      if (file.size <= MAX_STORED_SOURCE_FILE_BYTES) {
        readFileAsDataUrl(file)
          .then((dataUrl) => {
            currentSourceFileDataUrl = dataUrl;
          })
          .catch(() => {});
      }

      importPackingSlipPdf(file)
        .then(({ lines, grandTotal }) => {
          statusEl.innerHTML = '';
          if (!lines.length) {
            summaryEl.innerHTML = `
              <p class="pallet-totals-mismatch">
                Couldn&rsquo;t find any recognisable packing-slip rows in &ldquo;${escapeHtml(file.name)}&rdquo;.
                It may be a scanned image rather than a digital PDF with real text &mdash; try exporting it directly
                from the system that made it, or a different file.
              </p>
            `;
            return;
          }

          tbody.innerHTML = '';
          lines.forEach((line) => addRow(line));

          if (grandTotal !== null) {
            document.getElementById('pallet-grand-total').value = grandTotal;
          }

          const flaggedLines = lines.filter((l) => l.flagged);
          const computedTotal = lines.reduce((sum, l) => sum + l.quantity, 0);
          const totalMatches = grandTotal === null || computedTotal === grandTotal;

          summaryEl.innerHTML = `
            <p class="${flaggedLines.length || !totalMatches ? 'pallet-totals-mismatch' : 'pallet-totals-ok'}">
              Imported ${lines.length} line${lines.length === 1 ? '' : 's'} from &ldquo;${escapeHtml(file.name)}&rdquo;
              (${computedTotal.toLocaleString()} units${grandTotal !== null ? ` vs. the slip's stated grand total of ${grandTotal.toLocaleString()}` : ''}).
              ${totalMatches ? '' : ' These do not match — check the lines below.'}
              ${flaggedLines.length
                ? ` ${flaggedLines.length} line${flaggedLines.length === 1 ? '' : 's'} flagged (highlighted below): its batch rows don't add up to the slip's own subtotal for that product.`
                : ' Every line’s batch rows matched the slip’s own subtotal for that product.'}
              Review every row against the packing slip before generating.
            </p>
          `;
        })
        .catch((err) => {
          statusEl.innerHTML = '';
          summaryEl.innerHTML = `
            <p class="pallet-totals-mismatch">
              Couldn&rsquo;t read &ldquo;${escapeHtml(file.name)}&rdquo;: ${escapeHtml(err && err.message ? err.message : 'unknown error')}.
              Try the file again, or a different export of the same packing slip.
            </p>
          `;
        });
    }

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
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
      if (file) handleFile(file);
    });
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
      return { error: 'Upload a packing slip PDF first' };
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

    const batchRecord = Store.addPalletLabelBatch({
      filename: currentSourceFile ? currentSourceFile.name : '',
      sourceFileDataUrl: currentSourceFileDataUrl,
      pallets,
      grandTotal,
    });

    feedbackEl.innerHTML = `
      <p class="pallet-totals-ok">
        Totals check passed: ${palletSumCheck.toLocaleString()} across ${pallets.length} pallet${pallets.length === 1 ? '' : 's'} = grand total ${grandTotal.toLocaleString()}.
        Saved to <button type="button" class="link-btn" id="pallet-view-history-link">Past Pallet Labels</button> as &ldquo;${escapeHtml(batchRecord.name)}&rdquo;.
      </p>
    `;
    const historyLink = document.getElementById('pallet-view-history-link');
    if (historyLink) {
      historyLink.addEventListener('click', () => renderBatchDetail(batchRecord.id));
    }

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

  // ----- Past Pallet Labels (history log) -----

  function renderHistoryList() {
    const batches = Store.getPalletLabelBatches();

    root.innerHTML = `
      ${subNavHtml('history')}
      <div class="card">
        <h2>Past Pallet Labels</h2>
        ${
          batches.length
            ? `<div class="delivery-history-list" id="pallet-history-list">${batches
                .map(
                  (b) => `
                <div class="delivery-history-row" data-batch-id="${escapeHtml(b.id)}" role="button" tabindex="0">
                  <div class="delivery-history-main">
                    <div class="delivery-history-filename">${escapeHtml(b.name)}</div>
                    <div class="delivery-history-meta">
                      Generated ${escapeHtml(formatPalletBatchDate(b.generatedAt))} &middot;
                      ${b.grandTotal.toLocaleString()} unit${b.grandTotal === 1 ? '' : 's'}${
                    b.sourceFileDataUrl ? ' &middot; original PDF saved' : b.filename ? ' &middot; original PDF not kept (too large)' : ' &middot; entered manually'
                  }
                    </div>
                  </div>
                  <div class="delivery-history-row-right">
                    <div class="delivery-history-count">${b.pallets.length} label${b.pallets.length === 1 ? '' : 's'}</div>
                    <button type="button" class="btn btn-sm btn-danger pallet-batch-delete-btn" data-batch-id="${escapeHtml(
                      b.id
                    )}" aria-label="Delete batch">Delete</button>
                  </div>
                </div>
              `
                )
                .join('')}</div>`
            : '<div class="empty-state">No pallet labels generated yet. Create one from the New Batch tab.</div>'
        }
      </div>
    `;
    wireSubNav();

    const list = document.getElementById('pallet-history-list');
    if (!list) return;

    function handleActivate(e) {
      const deleteBtn = e.target.closest('.pallet-batch-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        confirmDeleteBatchRow(deleteBtn.dataset.batchId);
        return;
      }
      const row = e.target.closest('.delivery-history-row');
      if (row) renderBatchDetail(row.dataset.batchId);
    }

    list.addEventListener('click', handleActivate);
    list.addEventListener('keydown', (e) => {
      if (e.target.closest('.pallet-batch-delete-btn')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate(e);
      }
    });
  }

  function confirmDeleteBatchRow(id) {
    const rowEl = document.querySelector(`.delivery-history-row[data-batch-id="${id}"]`);
    if (!rowEl) return;
    const batch = Store.getPalletLabelBatchById(id);

    rowEl.removeAttribute('role');
    rowEl.removeAttribute('tabindex');
    rowEl.innerHTML = `
      <div class="confirm-prompt delivery-row-confirm">
        <p class="confirm-message">Delete &ldquo;${escapeHtml(
          batch ? batch.name : 'this batch'
        )}&rdquo;? This removes it from the history log permanently &mdash; it does not affect stock already put away.</p>
        <div class="confirm-actions">
          <button type="button" class="btn" id="cancel-delete-pallet-batch">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete-pallet-batch">Yes, delete</button>
        </div>
      </div>
    `;
    document.getElementById('cancel-delete-pallet-batch').addEventListener('click', (e) => {
      e.stopPropagation();
      renderHistoryList();
    });
    document.getElementById('confirm-delete-pallet-batch').addEventListener('click', (e) => {
      e.stopPropagation();
      Store.deletePalletLabelBatch(id);
      showToast('Pallet label batch deleted');
      renderHistoryList();
    });
  }

  function renderBatchDetail(batchId) {
    const batch = Store.getPalletLabelBatchById(batchId);
    if (!batch) {
      renderHistoryList();
      return;
    }

    const labelsHtml = batch.pallets.map((p, i) => labelHtml(p, i, batch.pallets.length)).join('');

    root.innerHTML = `
      ${subNavHtml('history')}
      <div class="card pallet-preview-card">
        <div class="delivery-label-header">
          <div class="delivery-name-row" id="pallet-batch-name-row">
            <h2 id="pallet-batch-name-display">${escapeHtml(batch.name)}</h2>
            <button type="button" class="icon-btn" id="rename-pallet-batch-btn" aria-label="Rename batch">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
          </div>
          <button type="button" class="btn btn-sm btn-danger" id="delete-pallet-batch-detail-btn">Delete</button>
        </div>
        <p class="helper-text">
          Generated ${escapeHtml(formatPalletBatchDate(batch.generatedAt))}${
      batch.filename ? ` &middot; ${escapeHtml(batch.filename)}` : ' &middot; entered manually'
    } &middot; ${batch.pallets.length} label${batch.pallets.length === 1 ? '' : 's'} &middot;
          ${batch.grandTotal.toLocaleString()} unit${batch.grandTotal === 1 ? '' : 's'} total.
        </p>
        ${
          batch.sourceFileDataUrl
            ? `<button type="button" class="btn btn-sm mt-sm" id="pallet-download-source-btn">Download original packing slip PDF</button>`
            : ''
        }
        <div class="delivery-label-header mt-sm">
          <h2>Labels</h2>
          <button type="button" class="btn btn-primary btn-sm" id="print-pallet-batch-btn">Print All</button>
        </div>
        <div class="pallet-label-stack" id="pallet-batch-label-stack">${labelsHtml}</div>
      </div>
    `;
    wireSubNav();

    document.querySelectorAll('#pallet-batch-label-stack .pallet-label-name-block').forEach((block) => {
      const top = block.closest('.pallet-label-top');
      fitPalletNameBlock(block, top.clientHeight);
    });

    document.getElementById('print-pallet-batch-btn').addEventListener('click', () => {
      setPrintPageSize('6in 4in');
      window.print();
    });

    const downloadBtn = document.getElementById('pallet-download-source-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        downloadBtn.disabled = true;
        triggerFileDownload(batch.sourceFileDataUrl, batch.filename || 'packing-slip.pdf')
          .catch((err) => {
            showToast(`Couldn't download the file: ${err && err.message ? err.message : 'unknown error'}`);
          })
          .finally(() => {
            downloadBtn.disabled = false;
          });
      });
    }

    document.getElementById('rename-pallet-batch-btn').addEventListener('click', () => {
      const nameRow = document.getElementById('pallet-batch-name-row');
      nameRow.innerHTML = `
        <input type="text" id="pallet-batch-name-input" value="${escapeHtml(batch.name)}" />
        <button type="button" class="btn btn-sm btn-primary" id="save-pallet-batch-name-btn">Save</button>
        <button type="button" class="btn btn-sm" id="cancel-pallet-batch-name-btn">Cancel</button>
      `;
      const input = document.getElementById('pallet-batch-name-input');
      input.focus();
      input.select();

      function saveRename() {
        const newName = input.value.trim();
        if (!newName) {
          showToast('Name is required');
          return;
        }
        Store.renamePalletLabelBatch(batchId, newName);
        showToast('Renamed');
        renderBatchDetail(batchId);
      }

      document.getElementById('save-pallet-batch-name-btn').addEventListener('click', saveRename);
      document.getElementById('cancel-pallet-batch-name-btn').addEventListener('click', () => renderBatchDetail(batchId));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          renderBatchDetail(batchId);
        }
      });
    });

    document.getElementById('delete-pallet-batch-detail-btn').addEventListener('click', () => {
      const header = document.querySelector('.pallet-preview-card .delivery-label-header');
      header.outerHTML = `
        <div class="confirm-prompt delivery-delete-confirm">
          <p class="confirm-message">Delete &ldquo;${escapeHtml(
            batch.name
          )}&rdquo;? This removes it from the history log permanently &mdash; it does not affect stock already put away.</p>
          <div class="confirm-actions">
            <button type="button" class="btn" id="cancel-delete-pallet-batch-detail">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirm-delete-pallet-batch-detail">Yes, delete</button>
          </div>
        </div>
      `;
      document.getElementById('cancel-delete-pallet-batch-detail').addEventListener('click', () => {
        renderBatchDetail(batchId);
      });
      document.getElementById('confirm-delete-pallet-batch-detail').addEventListener('click', () => {
        Store.deletePalletLabelBatch(batchId);
        showToast('Pallet label batch deleted');
        renderHistoryList();
      });
    });
  }

  // ----- Size Limits (max qty per pallet, by product weight/size) -----

  function renderSizeLimitsTab() {
    root.innerHTML = `
      ${subNavHtml('limits')}
      <div class="card">
        <h2>Pallet Size Limits</h2>
        <p class="helper-text">
          Max quantity per pallet for each product weight/size &mdash; used to split a packing-slip line into
          pallets. A size is added here automatically the first time a generate needs one it doesn't recognise,
          or add one directly below. Never guessed or borrowed from a similar size.
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
    wireSubNav();
    renderPalletLimitsTable();
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
