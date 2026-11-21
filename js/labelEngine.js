// Pallet Labels V2, Phase 2 — shared Label Engine.
//
// Pure, UI-free module used by both the automatic (packing-slip/AI) and
// manual label-generation workflows: pallet-size math, QR payload
// construction, exact-vs-free-form total validation, and real PDF
// assembly (pdf-lib). No DOM, no Store, no Supabase — this file doesn't
// know or care where its input came from or where its output goes.
//
// Per4m-specific text rules (stripping "Per4m"/"Protein" from the printed
// name) are isolated in their own small function rather than mixed into
// the general logic, so a different business's rules can be swapped in
// later without touching the pallet math or PDF assembly.
//
// Fidelity note: the PDF layout/sizing/merge/cap/warning-page logic in
// this file is a deliberate, line-by-line port of the original Per4m
// Python automation (`gen_current_trailer10_variant.py`, supplied in the
// handover package), verified against that script and its example output
// PDFs — not a redesign. Every constant and formula below has a matching
// comment pointing at the Python line it reproduces, so a future reviewer
// can audit fidelity without re-deriving it.

const LabelEngine = (() => {
  function stripProteinWord(text) {
    return text
      .replace(/\bPer4m\b/gi, '')
      .replace(/\bProtein\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseSizeKey(productSizeText) {
    const match = productSizeText.match(/(\d+(?:\.\d+)?\s*(?:kg|g))\s*$/i);
    if (match) return match[1].replace(/\s+/g, '').toLowerCase();
    return productSizeText.trim().toLowerCase();
  }

  // Full pallets of `maxPerPallet` first, remainder last (Python: split_pallets).
  function splitIntoPallets(totalQty, maxPerPallet) {
    const pallets = [];
    let remaining = totalQty;
    while (remaining > 0) {
      pallets.push(Math.min(maxPerPallet, remaining));
      remaining -= Math.min(maxPerPallet, remaining);
    }
    return pallets;
  }

  // First-seen-order de-duplication — the original script de-dupes batch
  // codes this way before printing/encoding them (`if b[0] not in codes`),
  // even when the same code legitimately appears on two source rows (e.g.
  // split across two LOT lines on the packing slip).
  function dedupeBatchCodes(codes) {
    const seen = [];
    (codes || []).forEach((code) => {
      if (!seen.includes(code)) seen.push(code);
    });
    return seen;
  }

  // Batch hyphens become periods in the QR payload only (not on the
  // printed label) — some phone QR readers misread a hyphenated number as
  // a phone number. Product/flavour are upper-cased in the payload,
  // matching the original script's `.upper()` on every printed/encoded
  // field. flavour/bbe/batchCodes are optional (the Manual Generator,
  // Phase 3, may omit any of them, a capability the original automation
  // never had) — a blank one is left out of the payload entirely.
  function buildPalletQrPayload({ name, flavour, quantity, bbe, batchCodes }) {
    const upperName = (name || '').toUpperCase();
    const upperFlavour = (flavour || '').toUpperCase();
    const parts = [upperFlavour ? `${upperName} - ${upperFlavour}` : upperName, `QTY ${quantity}`];
    if (bbe) parts.push(`BBE ${bbe}`);
    const codes = dedupeBatchCodes(batchCodes);
    if (codes.length) {
      parts.push(`BATCH ${codes.map((b) => b.replace(/-/g, '.')).join(', ')}`);
    }
    return parts.join(' | ');
  }

  // Validation modes (see PALLET_LABELS_V2_DECISION_RECORD.md C.4):
  // 'strict-total-match' — the automatic/document-derived path, matching
  //   the original script's `assert grand == SHEET_TOTAL` (checked here
  //   against the pre-split line totals, before any merge/cap is applied —
  //   see buildPallets). 'free-form' — the manual path (Phase 3): no
  //   grand total to reconcile against, only rejects a nonsensical
  //   (zero/negative) quantity.
  function validatePalletLines(lines, { mode, grandTotal }) {
    if (mode === 'strict-total-match') {
      const sumQty = lines.reduce((sum, l) => sum + l.quantity, 0);
      if (sumQty !== grandTotal) {
        return {
          ok: false,
          error: `Line quantities add up to ${sumQty.toLocaleString()}, but the grand total is ${grandTotal.toLocaleString()}. Fix the lines or the grand total before generating — nothing is produced until these match exactly.`,
        };
      }
      return { ok: true };
    }
    for (const line of lines) {
      if (!line.quantity || line.quantity <= 0) {
        return { ok: false, error: `"${line.name || line.productText}" needs a quantity greater than zero.` };
      }
    }
    return { ok: true };
  }

  // Looks up each line's pallet-size limit, splits it into pallets, then
  // applies the original script's two documented post-split adjustments,
  // in order:
  //  1. 5% merge: if there's more than one pallet, the last pallet is
  //     under max, and it's <= 5% of max, fold it into the previous
  //     pallet instead of giving it its own (near-empty) label.
  //  2. 105% cap: any pallet left over max but <= 105% of max is printed
  //     as exactly max — the excess units are silently dropped from the
  //     labels. This is the original script's own documented behaviour
  //     (Per4m_Pallet_Label_Handover.md section 3.6), not an improvement
  //     this app is adding — it's being reproduced deliberately, and it
  //     silently reduces the true total exactly as the original does.
  // Returns { missingSizes } if any line's size has no saved limit yet —
  // this app's existing "never guess a pallet limit" hard-stop, which the
  // original script does NOT have (a known bug in the original — see
  // handover section 4.7 point 5) and is kept here as a deliberate
  // improvement, not reverted to match the bug.
  function buildPallets(lines, limits) {
    const missingSizes = [...new Set(lines.filter((l) => limits[l.sizeKey] === undefined).map((l) => l.sizeKey))];
    if (missingSizes.length) return { missingSizes };

    const pallets = [];
    lines.forEach((line) => {
      const maxPerPallet = limits[line.sizeKey];
      let parts = splitIntoPallets(line.quantity, maxPerPallet);

      // 5% merge (Python: parts[:-2] + [parts[-2] + parts[-1]]).
      if (parts.length > 1 && parts[parts.length - 1] < maxPerPallet && parts[parts.length - 1] <= 0.05 * maxPerPallet) {
        const last = parts[parts.length - 1];
        parts = parts.slice(0, -2).concat([parts[parts.length - 2] + last]);
      }

      // 105% cap: a pallet over max but within 5% of it prints as max,
      // dropping the excess (Python: mx if f else q for q, f in zip(...)).
      parts = parts.map((q) => (maxPerPallet < q && q <= 1.05 * maxPerPallet ? maxPerPallet : q));

      parts.forEach((qty) => pallets.push({ ...line, quantity: qty }));
    });
    return { pallets };
  }

  // Which pallets are "not full" for the warning page: has a known max,
  // under it, and not exactly half of it (half-full pallets are
  // deliberately excluded — Python: `qty < max and qty * 2 != max`).
  function computeNonFullPallets(pallets, limits) {
    return pallets
      .filter((p) => {
        const mx = limits[p.sizeKey];
        return mx && p.quantity < mx && p.quantity * 2 !== mx;
      })
      .map((p) => ({
        label: `${(p.name || '').toUpperCase()}${p.flavour ? ' - ' + p.flavour.toUpperCase() : ''}`,
        qty: p.quantity,
        max: limits[p.sizeKey],
      }));
  }

  // ---- Real, downloadable PDF generation (pdf-lib) ----
  // One 6x4in page per pallet, preceded by the warning page(s), exactly
  // mirroring draw_all() in the original script. All measurements below
  // are the original script's own constants (PAGE_W/PAGE_H/MARGIN/
  // QR_SIZE/NARROW_WIDTH etc.), not estimates.
  const PAGE_W_PT = 432; // 6in
  const PAGE_H_PT = 288; // 4in
  const MARGIN_PT = 14.4; // 0.2in — Python: MARGIN = 0.2 * INCH
  const QR_SIZE_PT = 135; // 1.875in — Python: QR_SIZE = 1.875 * INCH
  const FULL_WIDTH_PT = PAGE_W_PT - 2 * MARGIN_PT; // Python: FULL_WIDTH
  const QR_X_PT = PAGE_W_PT - MARGIN_PT - QR_SIZE_PT; // Python: QR_X
  const QR_Y_PT = MARGIN_PT; // Python: QR_Y
  const NARROW_WIDTH_PT = QR_X_PT - MARGIN_PT - 0.15 * 72; // Python: NARROW_WIDTH (0.15in gap beside the QR)
  const QR_TOP_PT = MARGIN_PT + QR_SIZE_PT; // Python: QR_TOP

  function wrapWords(font, text, size, width) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = (cur + ' ' + w).trim();
      if (font.widthOfTextAtSize(t, size) <= width) {
        cur = t;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Shrinks `text` to the first size (floor 6pt) at which it wraps within
  // `maxLines` lines all fitting `width` — Python: fit(). Note: the
  // original's `minimum` parameter is accepted but never actually used in
  // the Python function body; its real floor is always 6, regardless of
  // what's passed in (verified by reading the code, not assumed from the
  // handover's prose, which says "min 9" — the prose is wrong, the code's
  // floor is 6).
  function fitText(font, text, width, start, maxLines) {
    function ok(lines, s) {
      return lines.length <= maxLines && lines.every((l) => font.widthOfTextAtSize(l, s) <= width);
    }
    let s = start;
    while (s >= 6) {
      const lines = wrapWords(font, text, s, width);
      if (ok(lines, s)) return { lines, size: s };
      s -= 1;
    }
    return { lines: wrapWords(font, text, 6, width), size: 6 };
  }

  // Word-wraps the product/flavour line, switching per-line between
  // FULL_WIDTH and NARROW_WIDTH depending on whether that line's baseline
  // would dip into the QR's vertical band — Python: wrap_var(). Returns
  // null if it can't be made to fit within maxLines at this size (the
  // caller then tries a smaller size).
  function wrapVar(font, text, s, maxLines, y0, lh) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    const widthFor = (k) => (y0 - lh * (k + 1) >= QR_TOP_PT ? FULL_WIDTH_PT : NARROW_WIDTH_PT);
    for (const w of words) {
      const t = (cur + ' ' + w).trim();
      if (font.widthOfTextAtSize(t, s) <= widthFor(lines.length)) {
        cur = t;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines || lines.some((l, i) => font.widthOfTextAtSize(l, s) > widthFor(i))) {
      return null;
    }
    return lines;
  }

  // The full per-label text-fit search: s from 140 down to 12, first size
  // where everything fits wins — Python: `for s in range(140, 11, -1)`.
  function buildLabelLayout(font, { name, flavour, quantity, bbeText, batchText }, top, avail) {
    function layoutAtSize(s) {
      const pLines = name ? wrapVar(font, name, s, 1, top, s * 1.05) : [];
      if (pLines === null) return null;
      const fLines = wrapVar(font, flavour || '', s, 3, top - pLines.length * s * 1.05, s * 1.1);
      if (fLines === null) return null;

      const q = Math.max(15, Math.min(60, Math.round(s * 0.62 * 1.5))); // Python: q ratio
      const bbeStart = Math.max(12, Math.round(q * 0.75)); // Python: bbe ratio
      const gap = Math.max(24, Math.round(0.6 * s));
      // BBE and batch are optional on manually entered labels: a blank one
      // gets no line at all (not an empty "BBE :" / "BATCH :"), matching
      // the QR payload and the on-screen preview. When both are present —
      // every delivery-note label — the layout is exactly as before.
      const batchFit = batchText
        ? fitText(font, `BATCH : ${batchText}`.replace(/\s+$/, ''), NARROW_WIDTH_PT, Math.max(10, Math.min(33, bbeStart + 2)), 3)
        : { lines: [], size: bbeStart };
      const bbeFit = bbeText ? fitText(font, `BBE : ${bbeText}`, NARROW_WIDTH_PT, bbeStart, 2) : { lines: [], size: bbeStart };

      const parts = [
        [pLines, s, s * 1.05, 0],
        [fLines, s, s * 1.1, 0],
        [[`QTY : ${quantity}`], q, q * 1.1, gap],
        [bbeFit.lines, bbeFit.size, bbeFit.size * 1.15, 0],
        [batchFit.lines, batchFit.size, batchFit.size * 1.15, 0],
      ];
      const total = parts.reduce((sum, [ls, , lh, g]) => sum + ls.length * lh + g, 0);
      return { parts, total };
    }

    for (let s = 140; s >= 12; s--) {
      const r = layoutAtSize(s);
      if (r && r.total <= avail) return r;
    }
    throw new Error(
      `"${name}${flavour ? ' - ' + flavour : ''}" doesn't fit on a 6x4in label even at the smallest size — shorten the flavour or check the data.`
    );
  }

  function drawVectorQr(page, payload, x, y, sizePt) {
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    const moduleCount = qr.getModuleCount();
    // border=4 in the original (qrcode library's own quiet zone) is baked
    // into the rasterised image before it's scaled to QR_SIZE; reproduced
    // here by sizing cells against (moduleCount + 8) and insetting the
    // actual dark/light modules by 4 cells from each edge, so the printed
    // quiet zone is the same proportion of the 1.875in box.
    const cell = sizePt / (moduleCount + 8);
    const inset = 4 * cell;
    const { PDFLib } = window;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          page.drawRectangle({
            x: x + inset + col * cell,
            y: y + inset + (moduleCount - row - 1) * cell, // PDF y grows upward; QR row 0 is the top row
            width: cell,
            height: cell,
            color: PDFLib.rgb(0, 0, 0),
          });
        }
      }
    }
  }

  // One 6x4in page per pallet, preceded by the warning page(s) — Python:
  // draw_all(). `limits` is only needed to compute the warning page
  // (which pallets are non-full); the pallets themselves already carry
  // their final (post-merge/cap) quantity from buildPallets().
  async function generatePalletLabelsPdf(pallets, limits) {
    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const doc = await PDFDocument.create();
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold); // Python: FONT = "Helvetica-Bold", used for everything except the caption
    const regularFont = await doc.embedFont(StandardFonts.Helvetica); // Python: "Helvetica" 7pt caption only

    // ---- Warning page(s): "WARNING: NOT FULL PALLETS" ----
    const rem = limits ? computeNonFullPallets(pallets, limits) : [];
    const rowsPerPage = Math.floor((PAGE_H_PT - 2 * MARGIN_PT - 34) / 12.5); // Python: int((PAGE_H - 2*MARGIN - 34) // lh), = 18
    const pages = [];
    for (let i = 0; i < rem.length; i += rowsPerPage) pages.push(rem.slice(i, i + rowsPerPage));
    if (!pages.length) pages.push([]);

    pages.forEach((chunk, pi) => {
      const page = doc.addPage([PAGE_W_PT, PAGE_H_PT]);
      const title = 'WARNING: NOT FULL PALLETS' + (pages.length > 1 ? ` (${pi + 1}/${pages.length})` : '');
      page.drawText(title, { x: MARGIN_PT, y: PAGE_H_PT - MARGIN_PT - 17, size: 17, font: boldFont, color: rgb(0, 0, 0) });
      let y = PAGE_H_PT - MARGIN_PT - 17 - 20;
      if (!rem.length) {
        page.drawText('NONE - ALL PALLETS ARE FULL', { x: MARGIN_PT, y, size: 12, font: boldFont, color: rgb(0, 0, 0) });
      }
      chunk.forEach(({ label, qty, max }) => {
        const txt = `${label} : ${qty} / ${max}`;
        let f = 10;
        while (boldFont.widthOfTextAtSize(txt, f) > FULL_WIDTH_PT && f > 5) f -= 0.25;
        page.drawText(txt, { x: MARGIN_PT, y, size: f, font: boldFont, color: rgb(0, 0, 0) });
        y -= 12.5;
      });
    });

    // ---- One label page per pallet ----
    for (const pallet of pallets) {
      const page = doc.addPage([PAGE_W_PT, PAGE_H_PT]);

      const name = (pallet.name || '').toUpperCase();
      const flavour = (pallet.flavour || '').toUpperCase();
      const codes = dedupeBatchCodes(pallet.batchCodes);
      const batchText = codes.join(', ');
      const bbeText = pallet.bbe || '';

      const payload = buildPalletQrPayload(pallet);
      drawVectorQr(page, payload, QR_X_PT, QR_Y_PT, QR_SIZE_PT);

      const top = PAGE_H_PT - MARGIN_PT - 0.05 * 72; // Python: top = PAGE_H - MARGIN - 0.05*INCH
      const avail = top - MARGIN_PT;
      const { parts } = buildLabelLayout(boldFont, { name, flavour, quantity: pallet.quantity, bbeText, batchText }, top, avail);

      // Hard stop if a batch code would be lost at the chosen size —
      // Python: `assert code in all_text, f"lost batch {code}"`.
      const allText = parts.map(([ls]) => ls.join(' ')).join(' ');
      codes.forEach((code) => {
        if (!allText.includes(code)) {
          throw new Error(`Batch code "${code}" would be lost on the "${pallet.name}" label — generation stopped.`);
        }
      });

      let cy = top;
      parts.forEach(([lines, size, lh, g]) => {
        cy -= g;
        lines.forEach((l) => {
          cy -= lh;
          page.drawText(l, { x: MARGIN_PT, y: cy, size, font: boldFont, color: rgb(0, 0, 0) });
        });
      });

      // Caption, centred under the QR — Python: drawCentredString.
      const caption = 'Scan for full details';
      const captionWidth = regularFont.widthOfTextAtSize(caption, 7);
      page.drawText(caption, {
        x: QR_X_PT + QR_SIZE_PT / 2 - captionWidth / 2,
        y: QR_Y_PT - 0.14 * 72,
        size: 7,
        font: regularFont,
        color: rgb(0, 0, 0),
      });
    }

    const bytes = await doc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  return {
    stripProteinWord,
    parseSizeKey,
    splitIntoPallets,
    dedupeBatchCodes,
    buildPalletQrPayload,
    validatePalletLines,
    buildPallets,
    computeNonFullPallets,
    generatePalletLabelsPdf,
  };
})();
