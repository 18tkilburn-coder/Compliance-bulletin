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
//
// Pallet V2 note: this screen's pallet-limits and pallet-label-batch-history
// reads/writes go through PalletLabelsBackend (js/palletLabelsBackend.js),
// not Store, directly. That module transparently falls back to the
// original Store/localStorage behaviour when Supabase isn't configured, so
// every function below is written async/await purely to support that
// future path — with no Supabase project configured, every await below
// resolves on the same tick as before and nothing about this screen's
// behaviour changes.

// Pallet math, text rules, QR payload shape, and PDF assembly now live in
// js/labelEngine.js (shared with the Manual Generator, Phase 3) —
// LabelEngine.stripProteinWord / .parseSizeKey / .splitIntoPallets /
// .buildPalletQrPayload / .validatePalletLines / .buildPallets /
// .generatePalletLabelsPdf.

// A single pallet label's markup — top-level (not nested in
// renderPalletLabelsScreen) so the Dashboard's Last Shipment widget can
// reuse it for a label preview without duplicating the layout.
function labelHtml(pallet, index) {
  const payload = LabelEngine.buildPalletQrPayload(pallet);
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  // flavour/bbe/batchCodes are all optional (the Manual Generator, Phase
  // 3, may omit any of them) — only rendered when actually present.
  return `
    <div class="pallet-label" data-pallet-index="${index}">
      <div class="pallet-label-top">
        <div class="pallet-label-name-block">
          <div class="pallet-label-name">${escapeHtml(pallet.name)}</div>
          ${pallet.flavour ? `<div class="pallet-label-flavour">${escapeHtml(pallet.flavour)}</div>` : ''}
        </div>
      </div>
      <div class="pallet-label-divider"></div>
      <div class="pallet-label-bottom">
        <div class="pallet-label-info">
          <div>QTY : ${escapeHtml(String(pallet.quantity))}</div>
          ${pallet.bbe ? `<div>BBE : ${escapeHtml(pallet.bbe)}</div>` : ''}
          ${pallet.batchCodes && pallet.batchCodes.length ? `<div>BATCH : ${escapeHtml(LabelEngine.dedupeBatchCodes(pallet.batchCodes).join(', '))}</div>` : ''}
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
    // bbeDates collects every row's date (not just the first) — a single
    // product can have several batches with different best-before months,
    // which the reference automation shows as "08/29 / 10/29 / 11/29" on
    // one label (Per4m_Pallet_Label_Handover.md section 2.5/3.3). Deduped
    // and text-sorted into the final display string in importPackingSlipPdf.
    const group = { productText, flavour, batchCodes: [], quantity: 0, bbeDates: [], statedTotal: null };
    byKey.set(key, group);
    groups.push(group);
    return group;
  }

  function addRow(group, batch, month, yearFull, qty) {
    group.batchCodes.push(batch);
    group.quantity += Number(qty);
    group.bbeDates.push(formatBestBefore(month.padStart(2, '0'), yearFull.slice(-2)));
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

// Runs the full import: extract → parse → shape into the line objects the
// review grid is filled from, flagging any group whose computed sum
// doesn't match the slip's own "<product> Total" row.
async function importPackingSlipPdf(file) {
  const textLines = await extractPdfTextLines(file);
  const { groups, grandTotal } = parsePackingSlipLines(textLines);
  return { lines: packingSlipGroupsToLines(groups), grandTotal };
}

// Phase 4: turns the AI extraction (supabase/functions/extract-packing-slip)
// into exactly the same group shape parsePackingSlipLines() produces, so
// both import paths share packingSlipGroupsToLines() and everything after
// it. Quantities are re-added here from the individual batch rows rather
// than trusted from the model, so the subtotal/grand-total checks compare
// real arithmetic against what the sheet itself printed.
function packingSlipGroupsFromAiExtraction(extraction) {
  const groups = [];
  const byKey = new Map();
  (extraction.products || []).forEach((p) => {
    const productText = String(p.product_text || '').trim();
    const flavour = String(p.flavour || '').trim();
    const key = `${productText}\u0000${flavour}`.toLowerCase();
    let group = byKey.get(key);
    if (!group) {
      group = { productText, flavour, batchCodes: [], quantity: 0, bbeDates: [], statedTotal: null, uncertain: false };
      byKey.set(key, group);
      groups.push(group);
    }
    (p.rows || []).forEach((r) => {
      if (r.uncertain === true) group.uncertain = true;
      group.batchCodes.push(String(r.batch_code || '').trim());
      group.quantity += Number(r.quantity) || 0;
      group.bbeDates.push(formatBestBefore(String(r.bbe_month).padStart(2, '0'), String(r.bbe_year).slice(-2)));
    });
    if (Number.isInteger(p.stated_total)) {
      group.statedTotal = (group.statedTotal || 0) + p.stated_total;
    }
  });
  const grandTotal = Number.isInteger(extraction.grand_total) ? extraction.grand_total : null;
  return { groups, grandTotal };
}

// Shared by the PDF-text parser and the AI extraction: shapes parsed
// groups into the line objects the review grid is filled from, flagging
// any group whose computed sum doesn't match the slip's own
// "<product> Total" row.
function packingSlipGroupsToLines(groups) {
  return groups.map((g) => {
    const flagged = g.statedTotal !== null && g.statedTotal !== g.quantity;
    return {
      productText: g.productText,
      name: LabelEngine.stripProteinWord(g.productText),
      sizeKey: LabelEngine.parseSizeKey(g.productText),
      flavour: g.flavour,
      quantity: g.quantity,
      // Deduped, text-sorted, "/"-joined — matches the reference script's
      // `sorted(set(short_date(b[1]) for b in batches))` exactly, including
      // its documented quirk of sorting "MM/YY" as plain text (so a date
      // in one year can sort before an earlier date in a different year;
      // reproduced deliberately, not fixed, per the handover's own note
      // that no real delivery has shown it going wrong in practice).
      bbe: [...new Set(g.bbeDates)].sort().join(' / '),
      // bbeMonth/bbeYear: the single earliest date, kept for callers that
      // want one month/year pair. The review grid edits the full `bbe`
      // text instead, so a multi-date line stays editable without being
      // collapsed to one date.
      bbeMonth: [...new Set(g.bbeDates)].sort()[0]?.split('/')[0] || '',
      bbeYear: [...new Set(g.bbeDates)].sort()[0]?.split('/')[1] || '',
      batchCodes: g.batchCodes,
      // The sheet's own printed subtotal for this line (or null), shown
      // and editable in the review grid's "Sheet subtotal" column.
      statedTotal: g.statedTotal,
      // Set only by the AI path, when the model marked a row as hard to
      // read or hand-corrected.
      uncertain: !!g.uncertain,
      flagged,
      flagReason: flagged
        ? `Document's own subtotal for this line is ${g.statedTotal.toLocaleString()}, but its batch rows add up to ${g.quantity.toLocaleString()} — check against the delivery note.`
        : null,
    };
  });
}

// For 'split' mode: compares each line's entered quantity with what its
// pallet labels would actually show, by running each line on its own
// through the unchanged LabelEngine.buildPallets(). The 5% remainder merge
// keeps the total; the 105% cap can lower it (the excess is dropped, as in
// the original automation). Returns one entry per line that differs, with
// its 1-based position in `lines`. Lines whose size has no limit yet are
// skipped (the missing-limit prompt handles those first).
function palletQuantityDiscrepancies(lines, limits) {
  const out = [];
  lines.forEach((line, i) => {
    const built = LabelEngine.buildPallets([line], limits);
    if (built.missingSizes) return;
    const onLabels = built.pallets.reduce((sum, p) => sum + p.quantity, 0);
    if (onLabels !== line.quantity) {
      out.push({
        row: i + 1,
        label: `${line.productText || line.name}${line.flavour ? ` (${line.flavour})` : ''}`,
        entered: line.quantity,
        onLabels,
        max: limits[line.sizeKey],
        pallets: built.pallets.map((p) => p.quantity),
      });
    }
  });
  return out;
}

// Review-grid best-before field: accepts "8/29", "08/29", "08/2029", or
// several dates separated by " / ", commas or spaces. Returns the same
// deduped, text-sorted "MM/YY / MM/YY" string the import path produces
// (matching the reference automation's display), or ok:false if anything
// in the field isn't a valid month/year. An empty field is ok with ''.
function normaliseBestBeforeText(raw) {
  const text = String(raw || '').trim();
  if (!text) return { ok: true, value: '' };
  const dates = [];
  const pattern = /(\d{1,2})\/(\d{4}|\d{2})(?!\d)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const month = Number(match[1]);
    if (month < 1 || month > 12) return { ok: false, value: '' };
    dates.push(formatBestBefore(String(month).padStart(2, '0'), match[2].slice(-2)));
  }
  const leftover = text.replace(pattern, '').replace(/[\s\/,;]+/g, '');
  if (!dates.length || leftover) return { ok: false, value: '' };
  return { ok: true, value: [...new Set(dates)].sort().join(' / ') };
}

// Packing-slip files over this size aren't kept as a copy in the history
// log (only their filename is) when falling back to localStorage — that
// store has a small, fixed quota shared by the whole app, and every past
// batch's copy sits in it. The Supabase path (via PalletLabelsBackend) has
// no such cap, since it stores the file in Supabase Storage rather than as
// a base64 string inside the record itself — this constant only governs
// the legacy, no-Supabase-configured fallback behaviour.
const MAX_STORED_SOURCE_FILE_BYTES = 4 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// Offers a stored file back to the user for download. A plain `<a
// download>` click doesn't work inside the sandboxed iframe the published
// Artifact runs in, so when a `downloads` capability is present (the
// Artifact context) this goes through it instead; the real file-tree
// deployment has no such sandbox, so it falls straight through to the
// ordinary anchor-click trick there. Accepts a Blob directly (rather than
// always re-fetching a data URL) so the Supabase Storage download path
// (which already has the bytes in hand) doesn't need a round-trip through
// a data: URL just to get back to a Blob.
async function triggerBlobDownload(blob, filename) {
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

// Legacy path: the batch's source file is a base64 data URL stored
// directly in the record (today's localStorage-only behaviour).
async function triggerFileDownload(dataUrl, filename) {
  const blob = await (await fetch(dataUrl)).blob();
  return triggerBlobDownload(blob, filename);
}

function formatPalletBatchDate(timestamp) {
  const d = new Date(timestamp);
  const datePart = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}

// A batch's original source file may have been kept one of two ways
// depending on which backend produced it: a base64 data URL embedded
// directly in the record (the localStorage-only fallback, capped at
// MAX_STORED_SOURCE_FILE_BYTES), or a path into Supabase Storage (the
// Supabase-configured path, which has no such size cap). Exactly one of
// these two fields is ever set on a given batch, never both.
// Download name for a generated labels PDF. Drops the uploaded file's own
// extension (a batch is often named after its "slip.pdf" or "photo.jpg",
// which used to give "slip.pdf.pdf"), replaces characters unsafe in
// filenames, and adds exactly one ".pdf". "slip.pdf-labels" ->
// "slip-labels.pdf".
function labelsPdfFilename(base) {
  const cleaned = String(base || '')
    .replace(/(\.(pdf|jpe?g|png|webp))+(?=-labels$|$)/gi, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${cleaned || 'pallet-labels'}.pdf`;
}

// History text for a batch's quantity: the units actually on its labels
// (the sum of its pallets), plus the delivery note's grand total when the
// pallet cap made the two differ.
function batchUnitsText(batch) {
  const onLabels = (batch.pallets || []).reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  const text = `${onLabels.toLocaleString()} unit${onLabels === 1 ? '' : 's'} on labels`;
  return batch.grandTotal !== onLabels ? `${text} (grand total ${batch.grandTotal.toLocaleString()})` : text;
}

function batchHasSourceFile(batch) {
  return !!(batch.sourceFileDataUrl || batch.sourceFilePath);
}

// Human-readable summary of whether/how a batch's original file was kept,
// for the history list and batch detail helper text.
function sourceFileStatusText(batch) {
  if (batch.sourceFileDataUrl || batch.sourceFilePath) return 'original PDF saved';
  if (batch.filename) return 'original PDF not kept (too large)';
  return 'entered manually';
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
  // ----- Label Generator (unified) -----
  // One place to make labels. Two ways in — upload a delivery note (parsed
  // locally, or read by AI for photos/scans) or type the lines by hand —
  // and both land in the SAME review grid below, with the same row
  // functions, the same validation and the same hand-off to LabelEngine,
  // history and the PDF. Replaces the old separate "New Batch" and "Quick
  // Labels" tabs; their two behaviours survive as the grid's two label
  // modes:
  //   'split'   — each line is split into pallets by its size limit and
  //               the line total must match the grand total exactly
  //               (LabelEngine 'strict-total-match'; the old New Batch).
  //   'per-row' — each row is exactly one label, BBE/batch optional
  //               (LabelEngine 'free-form'; the old Quick Labels).

  let rowCounter = 0;
  function nextRowId() {
    rowCounter += 1;
    return `prow_${rowCounter}`;
  }

  // Tracks the delivery-note file (if any) behind the batch currently being
  // built, so a successful Generate can save a copy of it into the history
  // log alongside the labels it produced.
  let currentSourceFile = null;
  let currentSourceFileDataUrl = null;
  // Set when the AI import has already put the file in Storage, so saving
  // the batch reuses it instead of uploading again.
  let currentSourceFilePath = null;
  let aiAvailable = false;

  // What the review grid is currently showing: where the lines came from,
  // which label mode applies, and any notes the extraction left.
  let review = null;

  if (pendingPalletHistoryBatchId) {
    const batchId = pendingPalletHistoryBatchId;
    pendingPalletHistoryBatchId = null;
    renderBatchDetail(batchId);
  } else {
    renderGeneratorLanding();
  }

  function subNavHtml(active) {
    return `
      <div class="sub-tabs">
        <button type="button" class="sub-tab-btn${active === 'generate' ? ' active' : ''}" data-subtab="generate">Label Generator</button>
        <button type="button" class="sub-tab-btn${active === 'history' ? ' active' : ''}" data-subtab="history">Past Pallet Labels</button>
        <button type="button" class="sub-tab-btn${active === 'limits' ? ' active' : ''}" data-subtab="limits">Size Limits</button>
      </div>
    `;
  }

  function wireSubNav() {
    document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.subtab === 'generate') {
          renderGeneratorLanding();
        } else if (btn.dataset.subtab === 'limits') {
          renderSizeLimitsTab();
        } else {
          renderHistoryList();
        }
      });
    });
  }

  async function limitsReferenceHtml() {
    const limits = await PalletLabelsBackend.getPalletLimits();
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

  function resetSource() {
    currentSourceFile = null;
    currentSourceFileDataUrl = null;
    currentSourceFilePath = null;
  }

  // ----- Step 1: landing — choose how to supply the information -----

  async function renderGeneratorLanding() {
    resetSource();
    review = null;
    aiAvailable = await PalletLabelsBackend.aiExtractionAvailable().catch(() => false);

    root.innerHTML = `
      ${subNavHtml('generate')}
      <div class="card">
        <h2>Label Generator</h2>
        <p class="helper-text">
          Choose how to supply the label details. Either way you&rsquo;ll check and edit every line in the
          same review table before any labels are made.
        </p>
        <div class="label-gen-choices">
          <button type="button" class="label-gen-choice" id="label-gen-upload">
            <span class="label-gen-choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            </span>
            <span class="label-gen-choice-title">Upload delivery note</span>
            <span class="label-gen-choice-text">${
              aiAvailable
                ? 'A PDF, or a photo of the printed sheet. The lines are read for you to check.'
                : 'A PDF exported from the supplier&rsquo;s system. The lines are read for you to check.'
            }</span>
          </button>
          <button type="button" class="label-gen-choice" id="label-gen-manual">
            <span class="label-gen-choice-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>
            </span>
            <span class="label-gen-choice-title">Manual entry</span>
            <span class="label-gen-choice-text">Type the product, quantity, best-before and batch details yourself.</span>
          </button>
        </div>
      </div>
    `;
    wireSubNav();
    document.getElementById('label-gen-upload').addEventListener('click', renderUploadStep);
    document.getElementById('label-gen-manual').addEventListener('click', () =>
      renderReviewGrid({ source: 'manual', mode: 'per-row', filename: '', warnings: [], grandTotal: null, lines: [{}] })
    );
  }

  // ----- Step 2a: upload a delivery note -----

  function renderUploadStep() {
    resetSource();
    const dropzoneText = aiAvailable
      ? 'Drag &amp; drop the delivery note (PDF or photo) here, or click to choose a file'
      : 'Drag &amp; drop the delivery note PDF here, or click to choose a file';
    const dropzoneHint = aiAvailable
      ? 'PDF or a clear photo (JPEG/PNG/WebP). Photos and scanned PDFs are read by AI &mdash; you&rsquo;ll check every line next.'
      : 'PDF only &mdash; a digital export with real text, not a scanned photo.';
    const acceptTypes = aiAvailable
      ? '.pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
      : '.pdf,application/pdf';

    root.innerHTML = `
      ${subNavHtml('generate')}
      <div class="card">
        <button type="button" class="link-btn label-gen-back" id="label-gen-back">&larr; Back</button>
        <h2>Upload delivery note</h2>
        <label class="upload-dropzone" id="pallet-upload-dropzone" for="pallet-file-input">
          <span class="upload-dropzone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M12 4 7 9M12 4l5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
          </span>
          <span class="upload-dropzone-text">${dropzoneText}</span>
          <span class="upload-dropzone-hint">${dropzoneHint}</span>
        </label>
        <input type="file" id="pallet-file-input" accept="${acceptTypes}" ${aiAvailable ? 'capture="environment"' : ''} hidden />
        <div id="pallet-import-status"></div>
        <div id="pallet-import-summary"></div>
      </div>
    `;
    wireSubNav();
    document.getElementById('label-gen-back').addEventListener('click', renderGeneratorLanding);
    wireDeliveryNoteImport();
  }

  function wireDeliveryNoteImport() {
    const dropzone = document.getElementById('pallet-upload-dropzone');
    const fileInput = document.getElementById('pallet-file-input');
    const statusEl = document.getElementById('pallet-import-status');
    const summaryEl = document.getElementById('pallet-import-summary');

    // Bumped on every new file, so a slow AI read of an earlier file can't
    // replace the screen after a newer file has been chosen.
    let importToken = 0;

    function showReadingStatus(file, viaAi) {
      statusEl.innerHTML = `
        <div class="analysing-state analysing-state-inline">
          <div class="spinner" aria-hidden="true"></div>
          <p class="analysing-text">${viaAi ? 'Reading with AI' : 'Reading'} &ldquo;${escapeHtml(file.name)}&rdquo;&hellip;${
            viaAi ? ' This can take up to a minute.' : ''
          }</p>
        </div>
      `;
    }

    // Phase 4: photo or scanned PDF -> Edge Function -> the same line shape
    // as the PDF-text parser.
    function importWithAi(file, token) {
      if (token === importToken) showReadingStatus(file, true);
      return PalletLabelsBackend.extractPackingSlipWithAi(file).then(({ extraction, sourceFilePath }) => {
        if (token === importToken) currentSourceFilePath = sourceFilePath;
        const { groups, grandTotal } = packingSlipGroupsFromAiExtraction(extraction);
        return {
          lines: packingSlipGroupsToLines(groups),
          grandTotal,
          viaAi: true,
          warnings: Array.isArray(extraction.warnings) ? extraction.warnings : [],
        };
      });
    }

    function handleFile(file) {
      const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const looksLikeImage = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!looksLikePdf && !(aiAvailable && looksLikeImage)) {
        showToast(
          aiAvailable
            ? 'Use a PDF or a JPEG/PNG/WebP photo of the delivery note.'
            : 'Only PDF delivery notes can be imported right now — photos and scanned images aren’t supported.'
        );
        return;
      }

      const token = ++importToken;
      showReadingStatus(file, !looksLikePdf);
      summaryEl.innerHTML = '';

      currentSourceFile = file;
      currentSourceFileDataUrl = null;
      currentSourceFilePath = null;
      if (file.size <= MAX_STORED_SOURCE_FILE_BYTES) {
        readFileAsDataUrl(file)
          .then((dataUrl) => {
            if (token === importToken) currentSourceFileDataUrl = dataUrl;
          })
          .catch(() => {});
      }

      // A digital PDF is parsed locally first (free, instant, exact). Only a
      // PDF with no recognisable rows (typically a scan) or a photo goes to AI.
      const importPromise = looksLikePdf
        ? importPackingSlipPdf(file).then((result) =>
            result.lines.length || !aiAvailable ? { ...result, viaAi: false, warnings: [] } : importWithAi(file, token)
          )
        : importWithAi(file, token);

      importPromise
        .then(({ lines, grandTotal, viaAi, warnings }) => {
          if (token !== importToken) return;
          statusEl.innerHTML = '';
          if (!lines.length) {
            const warningsHtml = warnings.length
              ? `<ul class="pallet-ai-warnings">${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
              : '';
            summaryEl.innerHTML = `
              <p class="pallet-totals-mismatch">
                ${
                  viaAi
                    ? `The AI couldn&rsquo;t find any delivery-note rows in &ldquo;${escapeHtml(file.name)}&rdquo;. Try a sharper, well-lit photo of the whole sheet.`
                    : `Couldn&rsquo;t find any recognisable delivery-note rows in &ldquo;${escapeHtml(file.name)}&rdquo;. It may be a scanned image rather than a digital PDF with real text &mdash; try exporting it directly from the system that made it, or a different file.`
                }
              </p>
              ${warningsHtml}
              <button type="button" class="btn mt-sm" id="label-gen-manual-instead">Enter the lines manually instead</button>
            `;
            document.getElementById('label-gen-manual-instead').addEventListener('click', () =>
              renderReviewGrid({ source: 'manual', mode: 'split', filename: file.name, warnings: [], grandTotal: null, lines: [{}] })
            );
            return;
          }
          renderReviewGrid({
            source: viaAi ? 'ai' : 'pdf',
            mode: 'split',
            filename: file.name,
            warnings,
            grandTotal,
            lines,
          });
        })
        .catch((err) => {
          if (token !== importToken) return;
          statusEl.innerHTML = '';
          summaryEl.innerHTML = `
            <p class="pallet-totals-mismatch">
              Couldn&rsquo;t read &ldquo;${escapeHtml(file.name)}&rdquo;: ${escapeHtml(err && err.message ? err.message : 'unknown error')}.
              Try the file again, or a different export of the same delivery note.
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

  // ----- Step 3: the shared review grid -----

  // `initial`: { source: 'manual'|'pdf'|'ai', mode: 'split'|'per-row',
  // filename, warnings[], grandTotal (number|null), lines[] } where each
  // line is the shape packingSlipGroupsToLines() produces (or {} for a
  // blank manual row).
  async function renderReviewGrid(initial) {
    review = {
      source: initial.source,
      mode: initial.mode,
      filename: initial.filename || '',
      warnings: initial.warnings || [],
      attempted: false,
      // Pallet limits, kept so the totals line can warn about units the
      // pallet cap would leave off the labels while the user is editing.
      limits: await PalletLabelsBackend.getPalletLimits().catch(() => ({})),
      lossAcknowledged: null,
    };
    const limitsHtml = await limitsReferenceHtml();

    const sourceText =
      review.source === 'ai'
        ? `Read by AI from &ldquo;${escapeHtml(review.filename)}&rdquo;. Every line is marked <strong>Needs checking</strong> until you tick it.`
        : review.source === 'pdf'
          ? `Imported from &ldquo;${escapeHtml(review.filename)}&rdquo;.`
          : 'Entered by hand.';
    const warningsHtml = review.warnings.length
      ? `
        <div class="label-review-warnings">
          <strong>Notes from the AI about this delivery note:</strong>
          <ul class="pallet-ai-warnings">${review.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
        </div>
      `
      : '';

    root.innerHTML = `
      ${subNavHtml('generate')}
      <div class="card">
        <button type="button" class="link-btn label-gen-back" id="label-gen-back">&larr; Start again</button>
        <h2>Review labels</h2>
        <p class="helper-text">${sourceText} Edit anything that&rsquo;s wrong before generating.</p>
        ${warningsHtml}

        <fieldset class="label-mode">
          <legend>How to make labels</legend>
          <label class="label-mode-option">
            <input type="radio" name="label-mode" value="split"${review.mode === 'split' ? ' checked' : ''} />
            <span><strong>Split into pallets</strong> &mdash; each line is split by its size limit; the lines must add up to the grand total.</span>
          </label>
          <label class="label-mode-option">
            <input type="radio" name="label-mode" value="per-row"${review.mode === 'per-row' ? ' checked' : ''} />
            <span><strong>One label per row</strong> &mdash; exactly as entered; best-before and batch are optional.</span>
          </label>
        </fieldset>

        ${limitsHtml}

        <div class="table-scroll label-review-scroll">
          <table class="line-items-table label-review-table" id="label-review-table">
            <thead>
              <tr>
                <th class="label-review-check-col">Checked</th>
                <th>Product + size</th>
                <th>Flavour</th>
                <th>Qty</th>
                <th class="label-review-subtotal-col">Sheet subtotal</th>
                <th>Best before</th>
                <th>Batch code(s)</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="label-review-body"></tbody>
          </table>
        </div>
        <button type="button" class="btn mt-sm" id="label-review-add">+ Add row</button>

        <div class="label-review-totals">
          <div class="field">
            <label for="pallet-grand-total" id="pallet-grand-total-label">Grand total</label>
            <input type="number" id="pallet-grand-total" min="0" inputmode="numeric" placeholder="e.g. 500" />
          </div>
          <p class="label-review-sum" id="label-review-sum" aria-live="polite"></p>
        </div>

        <div id="pallet-generate-feedback" aria-live="polite"></div>

        <button type="button" class="btn btn-primary btn-block mt-sm" id="pallet-generate-btn">Confirm &amp; Generate Labels</button>
      </div>
      <div id="pallet-missing-size-wrap"></div>
      <div id="pallet-preview-wrap"></div>
    `;
    wireSubNav();

    const tbody = document.getElementById('label-review-body');
    const grandTotalInput = document.getElementById('pallet-grand-total');
    if (initial.grandTotal !== null && initial.grandTotal !== undefined) grandTotalInput.value = initial.grandTotal;

    (initial.lines.length ? initial.lines : [{}]).forEach((line) =>
      addReviewRow(tbody, line, { needsCheck: review.source === 'ai' || !!line.flagged || !!line.uncertain })
    );

    document.getElementById('label-gen-back').addEventListener('click', () => {
      if (window.confirm('Start again? Everything in this review table will be cleared.')) renderGeneratorLanding();
    });
    document.getElementById('label-review-add').addEventListener('click', () => {
      const tr = addReviewRow(tbody, {}, { needsCheck: false });
      tr.querySelector('.label-review-product').focus();
      refreshReview();
    });
    document.querySelectorAll('input[name="label-mode"]').forEach((radio) =>
      radio.addEventListener('change', () => {
        review.mode = radio.value;
        refreshReview();
      })
    );
    grandTotalInput.addEventListener('input', refreshReview);
    tbody.addEventListener('input', refreshReview);
    tbody.addEventListener('change', refreshReview);
    document.getElementById('pallet-generate-btn').addEventListener('click', attemptGenerate);

    refreshReview();
  }

  // One editable row. `needsCheck` rows (AI-read, or subtotal mismatch, or
  // flagged uncertain) carry a "Checked" tickbox that must be ticked
  // before generating — extracted values are never treated as confirmed
  // just because nobody edited them.
  function addReviewRow(tbody, prefill, { needsCheck }) {
    const p = prefill || {};
    const tr = document.createElement('tr');
    tr.dataset.rowId = nextRowId();
    if (needsCheck) {
      tr.dataset.needsCheck = '1';
      tr.dataset.baseNeedsCheck = '1';
    }
    // Subtotal mismatches are re-checked live in validateReview(), so only
    // the AI's own "unsure" marker is kept as a fixed reason here.
    if (p.uncertain) tr.dataset.reason = 'The AI was unsure about part of this line — check it against the delivery note.';
    const batchValue = p.batchCodes ? p.batchCodes.join(', ') : '';
    const bbeValue = p.bbe || (p.bbeMonth && p.bbeYear ? formatBestBefore(p.bbeMonth, p.bbeYear) : '');
    const statedTotal = p.statedTotal === null || p.statedTotal === undefined ? '' : p.statedTotal;
    tr.innerHTML = `
      <td data-label="Checked" class="label-review-check-col">${checkCellHtml(needsCheck)}</td>
      <td data-label="Product + size"><input type="text" class="label-review-product" aria-label="Product and size" placeholder="e.g. Whey Protein 450g" value="${escapeHtml(p.productText || p.name || '')}" /></td>
      <td data-label="Flavour"><input type="text" class="label-review-flavour" aria-label="Flavour" placeholder="e.g. Chocolate" value="${escapeHtml(p.flavour || '')}" /></td>
      <td data-label="Qty"><input type="number" class="label-review-qty" aria-label="Quantity" min="1" step="1" inputmode="numeric" placeholder="500" value="${p.quantity || ''}" /></td>
      <td data-label="Sheet subtotal" class="label-review-subtotal-col"><input type="number" class="label-review-subtotal" aria-label="Sheet subtotal" min="0" step="1" inputmode="numeric" placeholder="—" value="${statedTotal}" /></td>
      <td data-label="Best before"><input type="text" class="label-review-bbe" aria-label="Best before (MM/YY)" placeholder="MM/YY" value="${escapeHtml(bbeValue)}" /></td>
      <td data-label="Batch code(s)"><input type="text" class="label-review-batch" aria-label="Batch codes, comma separated" placeholder="e.g. 123-456, 123-457" value="${escapeHtml(batchValue)}" /></td>
      <td class="label-review-actions">
        <button type="button" class="btn btn-sm label-review-duplicate" aria-label="Duplicate this row">Duplicate</button>
        <button type="button" class="btn btn-sm btn-danger label-review-remove" aria-label="Remove this row">Remove</button>
      </td>
    `;
    tr.querySelector('.label-review-remove').addEventListener('click', () => {
      tr.remove();
      refreshReview();
    });
    tr.querySelector('.label-review-duplicate').addEventListener('click', () => {
      // A copy is a new line the user made, so it starts unflagged; the
      // original keeps its own check state.
      const copy = readReviewRow(tr);
      const newTr = addReviewRow(tbody, {
        productText: copy.productText,
        flavour: copy.flavour,
        quantity: copy.qtyRaw,
        bbe: copy.bbeRaw,
        batchCodes: copy.batchCodes,
        statedTotal: null,
      }, { needsCheck: false });
      tr.after(newTr);
      refreshReview();
    });
    tbody.appendChild(tr);
    return tr;
  }

  function checkCellHtml(needsCheck) {
    return needsCheck
      ? '<label class="label-review-check"><input type="checkbox" class="label-review-checked" aria-label="I have checked this line against the delivery note" /> <span>Checked</span></label>'
      : '<span class="label-review-check-na">&mdash;</span>';
  }

  function setRowNeedsCheck(tr, needsCheck) {
    if (needsCheck) tr.dataset.needsCheck = '1';
    else delete tr.dataset.needsCheck;
    tr.querySelector('.label-review-check-col').innerHTML = checkCellHtml(needsCheck);
  }

  function readReviewRow(tr) {
    const checkbox = tr.querySelector('.label-review-checked');
    return {
      productText: tr.querySelector('.label-review-product').value.trim(),
      flavour: tr.querySelector('.label-review-flavour').value.trim(),
      qtyRaw: tr.querySelector('.label-review-qty').value.trim(),
      subtotalRaw: tr.querySelector('.label-review-subtotal').value.trim(),
      bbeRaw: tr.querySelector('.label-review-bbe').value.trim(),
      batchCodes: tr
        .querySelector('.label-review-batch')
        .value.split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      needsCheck: tr.dataset.needsCheck === '1',
      checked: !!(checkbox && checkbox.checked),
    };
  }

  // Validates every row for the current mode. Returns per-row problems
  // (keyed by field, for highlighting) plus the lines ready for LabelEngine.
  function validateReview() {
    const rows = Array.from(document.querySelectorAll('#label-review-body tr'));
    const mode = review.mode;
    const problems = [];
    const lines = [];
    let unchecked = 0;

    rows.forEach((tr, index) => {
      const r = readReviewRow(tr);
      const n = index + 1;
      const bad = {};
      const qty = Number(r.qtyRaw);
      if (!r.productText) bad.product = 'needs a product';
      if (!r.qtyRaw || !Number.isInteger(qty) || qty <= 0) bad.qty = 'needs a whole-number quantity above zero';
      const bbe = normaliseBestBeforeText(r.bbeRaw);
      if (!bbe.ok) bad.bbe = 'best-before must be MM/YY (several dates separated by " / ")';
      if (mode === 'split') {
        if (!r.flavour) bad.flavour = 'needs a flavour';
        if (bbe.ok && !bbe.value) bad.bbe = 'needs a best-before date';
        if (!r.batchCodes.length) bad.batch = 'needs at least one batch code';
      }
      if (r.subtotalRaw !== '' && (!Number.isInteger(Number(r.subtotalRaw)) || Number(r.subtotalRaw) < 0)) {
        bad.subtotal = 'sheet subtotal must be a whole number';
      }
      if (r.needsCheck && !r.checked) unchecked += 1;
      Object.keys(bad).forEach((field) => problems.push({ row: n, field, message: bad[field] }));

      // Fields are only highlighted once the user has tried to generate,
      // so a fresh blank row doesn't open already marked as wrong.
      tr.querySelectorAll('input').forEach((input) => input.classList.remove('is-invalid'));
      const fieldClass = {
        product: '.label-review-product',
        flavour: '.label-review-flavour',
        qty: '.label-review-qty',
        subtotal: '.label-review-subtotal',
        bbe: '.label-review-bbe',
        batch: '.label-review-batch',
      };
      if (review.attempted) {
        Object.keys(bad).forEach((field) => tr.querySelector(fieldClass[field]).classList.add('is-invalid'));
      }

      // Live subtotal check: the sheet's own printed subtotal against the
      // quantity on this line. A mismatch flags the row and makes it need
      // an explicit tick, exactly like an AI-read line.
      // AI-read and import-flagged rows always need the tick; a row that
      // only needs it because of a subtotal mismatch goes back to normal
      // once the mismatch is fixed.
      const mismatch = r.subtotalRaw !== '' && r.qtyRaw !== '' && Number(r.subtotalRaw) !== qty;
      const shouldNeedCheck = tr.dataset.baseNeedsCheck === '1' || mismatch;
      if (shouldNeedCheck !== r.needsCheck) {
        setRowNeedsCheck(tr, shouldNeedCheck);
        if (shouldNeedCheck) unchecked += 1;
        else if (!r.checked) unchecked -= 1;
      }
      const reason = mismatch
        ? `The delivery note's own subtotal for this line is ${Number(r.subtotalRaw).toLocaleString()}, but the quantity is ${qty.toLocaleString()} — check it against the delivery note.`
        : tr.dataset.reason || '';
      const checkbox = tr.querySelector('.label-review-checked');
      tr.classList.toggle('pallet-line-flagged', !!reason || (!!checkbox && !checkbox.checked));
      tr.title = reason;

      if (!Object.keys(bad).length) {
        lines.push(
          mode === 'split'
            ? {
                productText: r.productText,
                name: LabelEngine.stripProteinWord(r.productText),
                sizeKey: LabelEngine.parseSizeKey(r.productText),
                flavour: r.flavour,
                quantity: qty,
                bbe: bbe.value,
                batchCodes: r.batchCodes,
              }
            : {
                // Same shape the old Quick Labels produced: the product
                // exactly as typed, one label per row.
                name: r.productText,
                flavour: r.flavour,
                quantity: qty,
                bbe: bbe.value,
                batchCodes: r.batchCodes,
              }
        );
      }
    });

    const grandRaw = document.getElementById('pallet-grand-total').value.trim();
    const grandTotal = grandRaw === '' ? null : Number(grandRaw);
    return { rowCount: rows.length, problems, unchecked, lines, grandTotal, grandRaw };
  }

  // Re-runs validation after every edit, so the totals line, the flagged
  // rows and the field highlights are always current.
  function refreshReview() {
    if (!review) return;
    const mode = review.mode;
    const table = document.getElementById('label-review-table');
    if (!table) return;
    const { rowCount, problems, unchecked, grandTotal, lines } = validateReview();
    table.classList.toggle('mode-per-row', mode === 'per-row');
    // The Checked column only appears while at least one row needs a tick.
    table.classList.toggle('has-checks', !!document.querySelector('#label-review-body tr[data-needs-check="1"]'));
    document.getElementById('pallet-grand-total-label').textContent =
      mode === 'split' ? 'Grand total (from the delivery note) — required' : 'Grand total (optional — checked if entered)';

    const rows = Array.from(document.querySelectorAll('#label-review-body tr'));
    const sum = rows.reduce((total, tr) => {
      const q = Number(tr.querySelector('.label-review-qty').value);
      return total + (Number.isFinite(q) ? q : 0);
    }, 0);
    const sumEl = document.getElementById('label-review-sum');
    let sumText = `${rowCount} line${rowCount === 1 ? '' : 's'} &middot; quantities add up to <strong>${sum.toLocaleString()}</strong>`;
    let sumClass = '';
    if (grandTotal !== null && Number.isFinite(grandTotal)) {
      const diff = sum - grandTotal;
      sumText += diff === 0 ? ' &mdash; matches the grand total.' : ` &mdash; <strong>${Math.abs(diff).toLocaleString()} ${diff > 0 ? 'over' : 'under'}</strong> the grand total of ${grandTotal.toLocaleString()}.`;
      sumClass = diff === 0 ? 'is-ok' : 'is-bad';
    } else if (mode === 'split') {
      sumText += ' &mdash; enter the delivery note&rsquo;s grand total.';
      sumClass = 'is-bad';
    } else {
      sumText += '.';
    }
    // Live preview of the pallet cap's effect, from the currently valid lines.
    let lossClass = '';
    if (mode === 'split' && review.limits) {
      const lost = palletQuantityDiscrepancies(lines, review.limits).reduce((sum, d) => sum + (d.entered - d.onLabels), 0);
      if (lost > 0) {
        sumText += ` <strong>The pallet rules would leave ${lost.toLocaleString()} unit${lost === 1 ? '' : 's'} off the labels</strong> &mdash; details when you generate.`;
        lossClass = ' has-loss';
      }
    }
    if (unchecked) sumText += ` ${unchecked} line${unchecked === 1 ? '' : 's'} still need${unchecked === 1 ? 's' : ''} checking.`;
    if (problems.length && review.attempted) {
      sumText += ` ${problems.length} field${problems.length === 1 ? '' : 's'} need${problems.length === 1 ? 's' : ''} fixing.`;
    }
    sumEl.innerHTML = sumText;
    sumEl.className = `label-review-sum ${sumClass}${lossClass}`;
  }

  async function attemptGenerate() {
    const feedbackEl = document.getElementById('pallet-generate-feedback');
    const missingWrap = document.getElementById('pallet-missing-size-wrap');
    const previewWrap = document.getElementById('pallet-preview-wrap');
    feedbackEl.innerHTML = '';
    missingWrap.innerHTML = '';
    previewWrap.innerHTML = '';

    const mode = review.mode;
    review.attempted = true;
    const { rowCount, problems, unchecked, lines, grandTotal, grandRaw } = validateReview();
    refreshReview();
    const errors = [];
    if (!rowCount) errors.push('Add at least one line.');
    problems.forEach((p) => errors.push(`Row ${p.row}: ${p.message}.`));
    if (unchecked) {
      errors.push(
        `${unchecked} line${unchecked === 1 ? '' : 's'} marked as needing checking ${unchecked === 1 ? 'is' : 'are'} not ticked. Compare ${
          unchecked === 1 ? 'it' : 'each one'
        } with the delivery note, correct anything wrong, then tick Checked.`
      );
    }
    if (grandRaw !== '' && (!Number.isInteger(grandTotal) || grandTotal < 0)) errors.push('The grand total must be a whole number.');
    if (mode === 'split' && grandRaw === '') errors.push('Enter the delivery note’s grand total.');
    if (errors.length) {
      feedbackEl.innerHTML = `
        <div class="pallet-totals-mismatch">
          Nothing has been generated yet. Fix the following first:
          <ul class="label-review-errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
        </div>
      `;
      feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    let pallets;
    let savedGrandTotal;
    if (mode === 'split') {
      const limits = await PalletLabelsBackend.getPalletLimits();
      // Missing-size check first, same order as before: a manager should be
      // asked for a pallet limit even if the total also happens to be wrong
      // yet, rather than the two warnings fighting over which shows first.
      const built = LabelEngine.buildPallets(lines, limits);
      if (built.missingSizes) {
        renderMissingSizePrompt(built.missingSizes, () => attemptGenerate());
        return;
      }
      const validation = LabelEngine.validatePalletLines(lines, { mode: 'strict-total-match', grandTotal });
      if (!validation.ok) {
        feedbackEl.innerHTML = `<p class="pallet-totals-mismatch">${escapeHtml(validation.error)}</p>`;
        return;
      }
      review.limits = limits;
      // The splitting rules (unchanged) can print fewer units than were
      // entered: the 105% cap prints a slightly-over pallet as exactly the
      // limit. Nothing is saved until the operator has seen exactly what
      // would be lost and confirmed it for this exact set of lines.
      const discrepancies = palletQuantityDiscrepancies(lines, limits);
      if (discrepancies.length) {
        // Tied to every line (in order), the grand total and the outcome,
        // so changing any row, quantity, product, size limit or the grand
        // total needs a fresh confirmation.
        const signature = JSON.stringify({
          lines: lines.map((l) => [l.productText, l.flavour, l.sizeKey, l.quantity, l.bbe, l.batchCodes]),
          grandTotal,
          discrepancies: discrepancies.map((d) => [d.row, d.entered, d.onLabels, d.max]),
        });
        if (review.lossAcknowledged !== signature) {
          renderLossAcknowledgement(discrepancies, signature);
          return;
        }
      }
      pallets = built.pallets;
      savedGrandTotal = grandTotal;
    } else {
      const validation = LabelEngine.validatePalletLines(lines, { mode: 'free-form' });
      if (!validation.ok) {
        feedbackEl.innerHTML = `<p class="pallet-totals-mismatch">${escapeHtml(validation.error)}</p>`;
        return;
      }
      // Each row IS one label — no pallet-size splitting applies here.
      pallets = lines;
      const sum = pallets.reduce((total, p) => total + p.quantity, 0);
      if (grandTotal !== null && sum !== grandTotal) {
        feedbackEl.innerHTML = `<p class="pallet-totals-mismatch">The rows add up to ${sum.toLocaleString()}, but the grand total entered is ${grandTotal.toLocaleString()}. Fix the rows, or clear the grand total.</p>`;
        return;
      }
      savedGrandTotal = sum;
    }

    const palletSumCheck = pallets.reduce((total, p) => total + p.quantity, 0);
    let batchRecord;
    try {
      batchRecord = await PalletLabelsBackend.addPalletLabelBatch({
        filename: currentSourceFile ? currentSourceFile.name : '',
        sourceFileDataUrl: currentSourceFileDataUrl,
        existingSourceFilePath: currentSourceFilePath,
        pallets,
        grandTotal: savedGrandTotal,
      });
    } catch (err) {
      feedbackEl.innerHTML = `
        <p class="pallet-totals-mismatch">
          The lines checked out, but saving this batch failed: ${escapeHtml(err && err.message ? err.message : 'unknown error')}.
          Nothing was saved to history — try again.
        </p>
      `;
      return;
    }

    // Reports what the labels actually cover, which can be less than the
    // delivery note's grand total when the pallet cap has applied.
    const unlabelled = mode === 'split' ? savedGrandTotal - palletSumCheck : 0;
    feedbackEl.innerHTML = `
      <p class="pallet-totals-ok">
        ${
          mode === 'split'
            ? `Lines matched the grand total of ${savedGrandTotal.toLocaleString()}. Generated ${pallets.length} pallet label${
                pallets.length === 1 ? '' : 's'
              } covering <strong>${palletSumCheck.toLocaleString()} unit${palletSumCheck === 1 ? '' : 's'}</strong>.${
                unlabelled > 0
                  ? ` <strong>${unlabelled.toLocaleString()} unit${unlabelled === 1 ? ' is' : 's are'} not on any label</strong>, as you confirmed.`
                  : ''
              }`
            : `${pallets.length} label${pallets.length === 1 ? '' : 's'} created, covering <strong>${palletSumCheck.toLocaleString()} unit${palletSumCheck === 1 ? '' : 's'}</strong>.`
        }
        Saved to <button type="button" class="link-btn" id="pallet-view-history-link">Past Pallet Labels</button> as &ldquo;${escapeHtml(batchRecord.name)}&rdquo;.
      </p>
    `;
    const historyLink = document.getElementById('pallet-view-history-link');
    if (historyLink) {
      historyLink.addEventListener('click', () => renderBatchDetail(batchRecord.id));
    }

    renderPalletPreview(pallets);
  }

  // Shown instead of generating when the pallet rules would leave units off
  // the labels. Lists each affected row and needs a tick plus a button
  // press; the confirmation only holds for this exact set of lines.
  function renderLossAcknowledgement(discrepancies, signature) {
    const feedbackEl = document.getElementById('pallet-generate-feedback');
    const totalLost = discrepancies.reduce((sum, d) => sum + (d.entered - d.onLabels), 0);
    feedbackEl.innerHTML = `
      <div class="pallet-totals-mismatch label-loss-panel">
        <p class="label-loss-title">
          Nothing has been generated yet: <strong>${totalLost.toLocaleString()} unit${totalLost === 1 ? '' : 's'}</strong>
          would not appear on any label.
        </p>
        <p>
          The pallet rules print a pallet that is up to 5% over its size limit as exactly the limit, so the extra units
          aren&rsquo;t shown on any label:
        </p>
        <ul class="label-review-errors">
          ${discrepancies
            .map(
              (d) => `<li>Row ${d.row}, ${escapeHtml(d.label)}: ${d.entered.toLocaleString()} entered, labels would show
                ${d.onLabels.toLocaleString()} (${d.pallets.map((q) => q.toLocaleString()).join(' + ')}, limit ${d.max.toLocaleString()} per pallet).
                <strong>${(d.entered - d.onLabels).toLocaleString()} not labelled.</strong></li>`
            )
            .join('')}
        </ul>
        <p>Correct the quantities in the table if this isn&rsquo;t intended. Otherwise confirm to generate anyway.</p>
        <label class="label-loss-ack">
          <input type="checkbox" id="label-loss-ack" />
          <span>I understand ${totalLost.toLocaleString()} unit${totalLost === 1 ? '' : 's'} will not be on any label.</span>
        </label>
        <button type="button" class="btn btn-primary mt-sm" id="label-loss-continue">Generate anyway</button>
      </div>
    `;
    document.getElementById('label-loss-continue').addEventListener('click', () => {
      if (!document.getElementById('label-loss-ack').checked) {
        showToast('Tick the box to confirm the unlabelled units first');
        return;
      }
      review.lossAcknowledged = signature;
      attemptGenerate();
    });
    feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    document.getElementById('pallet-save-limits-btn').addEventListener('click', async () => {
      const inputs = Array.from(document.querySelectorAll('.pallet-missing-size-input'));
      for (const input of inputs) {
        const value = input.value;
        if (!value || Number(value) <= 0) {
          showToast(`Enter a max quantity for "${input.dataset.size}"`);
          input.focus();
          return;
        }
      }
      for (const input of inputs) {
        await PalletLabelsBackend.setPalletLimit(input.dataset.size, input.value);
      }
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
          <div class="delivery-label-header-actions">
            <button type="button" class="btn btn-sm" id="download-pallet-labels-btn">Download PDF</button>
            <button type="button" class="btn btn-primary btn-sm" id="print-pallet-labels-btn">Print All</button>
          </div>
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
    wireDownloadPdfButton('download-pallet-labels-btn', pallets, 'pallet-labels');
    previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Shared by both the fresh-preview and history-detail views: generates a
  // real PDF via LabelEngine and triggers a download, reusing the same
  // triggerBlobDownload path Supabase-sourced file downloads already use.
  function wireDownloadPdfButton(btnId, pallets, filenameBase) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Generating…';
      try {
        const limits = await PalletLabelsBackend.getPalletLimits();
        const blob = await LabelEngine.generatePalletLabelsPdf(pallets, limits);
        await triggerBlobDownload(blob, labelsPdfFilename(filenameBase));
      } catch (err) {
        showToast(`Couldn't generate the PDF: ${err && err.message ? err.message : 'unknown error'}`);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  // ----- Past Pallet Labels (history log) -----

  async function renderHistoryList() {
    const batches = await PalletLabelsBackend.getPalletLabelBatches();

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
                      ${batchUnitsText(b)} &middot;
                      ${escapeHtml(sourceFileStatusText(b))}
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

  async function confirmDeleteBatchRow(id) {
    const rowEl = document.querySelector(`.delivery-history-row[data-batch-id="${id}"]`);
    if (!rowEl) return;
    const batch = await PalletLabelsBackend.getPalletLabelBatchById(id);

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
    document.getElementById('confirm-delete-pallet-batch').addEventListener('click', async (e) => {
      e.stopPropagation();
      await PalletLabelsBackend.deletePalletLabelBatch(id);
      showToast('Pallet label batch deleted');
      renderHistoryList();
    });
  }

  async function renderBatchDetail(batchId) {
    const batch = await PalletLabelsBackend.getPalletLabelBatchById(batchId);
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
          ${batchUnitsText(batch)}.
        </p>
        ${
          batchHasSourceFile(batch)
            ? `<button type="button" class="btn btn-sm mt-sm" id="pallet-download-source-btn">Download original packing slip PDF</button>`
            : ''
        }
        <div class="delivery-label-header mt-sm">
          <h2>Labels</h2>
          <div class="delivery-label-header-actions">
            <button type="button" class="btn btn-sm" id="download-pallet-batch-btn">Download PDF</button>
            <button type="button" class="btn btn-primary btn-sm" id="print-pallet-batch-btn">Print All</button>
          </div>
        </div>
        <div class="pallet-label-stack" id="pallet-batch-label-stack">${labelsHtml}</div>
      </div>
    `;
    wireSubNav();

    document.querySelectorAll('#pallet-batch-label-stack .pallet-label-name-block').forEach((block) => {
      const top = block.closest('.pallet-label-top');
      fitPalletNameBlock(block, top.clientHeight);
    });

    // "-labels" keeps a reprint distinct from the original delivery note's
    // own file, which is often what the batch is named after.
    wireDownloadPdfButton('download-pallet-batch-btn', batch.pallets, `${batch.name}-labels`);

    document.getElementById('print-pallet-batch-btn').addEventListener('click', () => {
      setPrintPageSize('6in 4in');
      window.print();
    });

    const downloadBtn = document.getElementById('pallet-download-source-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        downloadBtn.disabled = true;
        try {
          if (batch.sourceFilePath) {
            // Supabase Storage path: fetch the bytes through the backend
            // module (which applies the same business-scoped RLS-backed
            // client the rest of this screen uses) rather than assuming
            // any particular public URL shape.
            const blob = await PalletLabelsBackend.downloadSourceFile(batch.sourceFilePath);
            await triggerBlobDownload(blob, batch.filename || 'packing-slip.pdf');
          } else {
            await triggerFileDownload(batch.sourceFileDataUrl, batch.filename || 'packing-slip.pdf');
          }
        } catch (err) {
          showToast(`Couldn't download the file: ${err && err.message ? err.message : 'unknown error'}`);
        } finally {
          downloadBtn.disabled = false;
        }
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

      async function saveRename() {
        const newName = input.value.trim();
        if (!newName) {
          showToast('Name is required');
          return;
        }
        await PalletLabelsBackend.renamePalletLabelBatch(batchId, newName);
        showToast('Renamed');
        renderBatchDetail(batchId);
      }

      document.getElementById('save-pallet-batch-name-btn').addEventListener('click', saveRename);
      document.getElementById('cancel-pallet-batch-name-btn').addEventListener('click', () => {
        renderBatchDetail(batchId);
      });
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
      document.getElementById('confirm-delete-pallet-batch-detail').addEventListener('click', async () => {
        await PalletLabelsBackend.deletePalletLabelBatch(batchId);
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

  async function renderPalletLimitsTable() {
    const limits = await PalletLabelsBackend.getPalletLimits();
    const sizes = Object.keys(limits).sort();
    const body = document.getElementById('pallet-limits-body');
    if (!body) return; // the screen may have navigated away before this resolved

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
      input.addEventListener('change', async () => {
        const value = Number(input.value);
        if (!value || value <= 0) {
          showToast('Enter a max quantity greater than zero');
          renderPalletLimitsTable();
          return;
        }
        await PalletLabelsBackend.setPalletLimit(input.dataset.size, value);
        showToast(`Pallet limit for "${input.dataset.size}" updated`);
      });
    });

    body.querySelectorAll('.pallet-limit-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await PalletLabelsBackend.deletePalletLimit(btn.dataset.size);
        showToast(`Removed pallet limit for "${btn.dataset.size}"`);
        renderPalletLimitsTable();
      });
    });

    document.getElementById('add-pallet-limit-btn').addEventListener('click', async () => {
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

      await PalletLabelsBackend.setPalletLimit(size, limit);
      showToast(`Pallet limit for "${size}" saved`);
      sizeInput.value = '';
      limitInput.value = '';
      renderPalletLimitsTable();
    });
  }
}
