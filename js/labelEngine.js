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

  // Full pallets of `maxPerPallet` first, remainder last.
  function splitIntoPallets(totalQty, maxPerPallet) {
    const pallets = [];
    let remaining = totalQty;
    while (remaining > 0) {
      pallets.push(Math.min(maxPerPallet, remaining));
      remaining -= Math.min(maxPerPallet, remaining);
    }
    return pallets;
  }

  // Batch hyphens become periods in the QR payload only (not on the
  // printed label) — some phone QR readers misread a hyphenated number as
  // a phone number.
  function buildPalletQrPayload({ name, flavour, quantity, bbe, batchCodes }) {
    const batchForQr = batchCodes.map((b) => b.replace(/-/g, '.')).join(', ');
    return `${name} - ${flavour} | QTY ${quantity} | BBE ${bbe} | BATCH ${batchForQr}`;
  }

  // Validation modes (see PALLET_LABELS_V2_DECISION_RECORD.md C.4):
  // 'strict-total-match' — the automatic/document-derived path. Every
  //   line's quantity must sum to exactly the supplied grandTotal, or
  //   nothing is produced — catches a misread document.
  // 'free-form' — the manual path (Phase 3). No grand total to reconcile
  //   against; only rejects a nonsensical (zero/negative) quantity.
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

  // Looks up each line's pallet-size limit and splits it into pallets.
  // Returns { missingSizes } if any line's size has no saved limit yet —
  // never guesses or borrows a similar size's limit.
  function buildPallets(lines, limits) {
    const missingSizes = [...new Set(lines.filter((l) => limits[l.sizeKey] === undefined).map((l) => l.sizeKey))];
    if (missingSizes.length) return { missingSizes };

    const pallets = [];
    lines.forEach((line) => {
      const maxPerPallet = limits[line.sizeKey];
      splitIntoPallets(line.quantity, maxPerPallet).forEach((qty) => {
        pallets.push({ ...line, quantity: qty });
      });
    });
    return { pallets };
  }

  // ---- Real, downloadable PDF generation (pdf-lib) ----
  // One 6x4in page per pallet. The QR code is drawn as vector-filled
  // squares read directly from qrcode.js's own module matrix
  // (getModuleCount/isDark) rather than rasterised from its SVG output —
  // stays sharp at any zoom/print scale and keeps the file small.
  const PAGE_W_PT = 432; // 6in at 72pt/inch
  const PAGE_H_PT = 288; // 4in at 72pt/inch
  const MARGIN_PT = 18;

  async function generatePalletLabelsPdf(pallets) {
    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const doc = await PDFDocument.create();
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const contentW = PAGE_W_PT - MARGIN_PT * 2;

    for (const pallet of pallets) {
      const page = doc.addPage([PAGE_W_PT, PAGE_H_PT]);

      let nameSize = 26;
      while (nameSize > 10 && boldFont.widthOfTextAtSize(pallet.name, nameSize) > contentW) nameSize -= 1;
      let flavourSize = Math.max(8, Math.round(nameSize * 0.6));
      while (flavourSize > 8 && regularFont.widthOfTextAtSize(pallet.flavour, flavourSize) > contentW) flavourSize -= 1;

      let y = PAGE_H_PT - MARGIN_PT - nameSize;
      page.drawText(pallet.name, { x: MARGIN_PT, y, size: nameSize, font: boldFont, color: rgb(0, 0, 0) });
      y -= flavourSize + 6;
      page.drawText(pallet.flavour, { x: MARGIN_PT, y, size: flavourSize, font: regularFont, color: rgb(0.2, 0.2, 0.2) });

      const dividerY = PAGE_H_PT * 0.52;
      page.drawLine({
        start: { x: MARGIN_PT, y: dividerY },
        end: { x: PAGE_W_PT - MARGIN_PT, y: dividerY },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });

      const infoLines = [`QTY ${pallet.quantity}`, `BBE ${pallet.bbe}`, `BATCH ${pallet.batchCodes.join(', ')}`];
      let infoY = dividerY - 22;
      infoLines.forEach((line) => {
        page.drawText(line, { x: MARGIN_PT, y: infoY, size: 12, font: regularFont, color: rgb(0, 0, 0) });
        infoY -= 16;
      });

      const qr = qrcode(0, 'M');
      qr.addData(buildPalletQrPayload(pallet));
      qr.make();
      const moduleCount = qr.getModuleCount();
      const qrSizePt = 110;
      const cell = qrSizePt / moduleCount;
      const qrX = PAGE_W_PT - MARGIN_PT - qrSizePt;
      const qrY = MARGIN_PT;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            page.drawRectangle({
              x: qrX + col * cell,
              y: qrY + (moduleCount - row - 1) * cell, // PDF y grows upward; QR row 0 is the top row
              width: cell,
              height: cell,
              color: rgb(0, 0, 0),
            });
          }
        }
      }
    }

    const bytes = await doc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  return {
    stripProteinWord,
    parseSizeKey,
    splitIntoPallets,
    buildPalletQrPayload,
    validatePalletLines,
    buildPallets,
    generatePalletLabelsPdf,
  };
})();
