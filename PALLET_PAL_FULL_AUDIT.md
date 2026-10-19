# Pallet Pal — Full Codebase & Capability Audit

*A reference document for pitching Pallet Pal to warehouse businesses. Every claim in this document is backed by a specific file in the codebase — file paths are given in brackets throughout so every statement can be independently verified against the source.*

*Scope note: the codebase ships as two parallel, functionally identical instances — "Per4m Warehouse" (repo root) and "PB Wholesale" (`pb/` folder) — that are the same product under two different brand skins (see §1 and §13). Every screen, button and data rule documented below applies equally to both instances unless stated otherwise. To avoid repeating everything twice, this document describes the product once and calls out the branding mechanism separately.*

---

## Table of Contents

1. Executive Overview
2. Problems It Solves
3. Complete Feature Catalogue
4. Screen-by-Screen Walkthrough
5. User Roles and Permissions
6. Workflows
7. Data Model
8. Labels, Printing and Scanning
9. Reporting and Exports
10. Integrations and Automations
11. Technical Overview
12. Setup and Onboarding
13. Customisation
14. Limitations, Gaps and Risks
15. Roadmap Suggestions
16. Sales Positioning
17. Glossary

---

## 1. Executive Overview

### What Pallet Pal is

Pallet Pal is a browser-based warehouse location-tracking and labelling system. It runs entirely as a single-page web application with no server-side backend of its own — every screen is plain HTML/CSS/JavaScript, and all data (products, stock, locations, deliveries, labels, staff accounts) is stored in the browser's `localStorage` (`js/store.js`). It is currently built and seeded around one real business's operation (Per4m Nutrition's warehouse — racking layout, product catalogue, staff names) and duplicated wholesale into a second branded copy for a second business ("PB Wholesale") as a proof of concept that the same system can serve more than one company (`pb/` directory, entirely).

At its core, Pallet Pal answers four questions a warehouse team asks dozens of times a day:

- **What do we have?** (products, batches, quantities, best-before dates)
- **Where is it?** (which racking bay or picking bay)
- **What needs printing?** (pallet logistics labels, product barcode labels, QR put-away labels)
- **Who did what, and when?** (who logged stock, when a delivery was processed, when a label batch was generated)

### Who it's for

Small-to-mid-sized warehouses that currently run on a mix of spreadsheets, paper pick sheets, and institutional memory ("Dave knows where the Chocolate Whey is"). It's aimed at operations with:

- A handful of staff (the seed data models 4 named staff members — `js/data.js`)
- A rack/bay layout simple enough to represent as short alphanumeric codes (e.g. `A01c`, `A05a`)
- A need to print pallet/product/put-away labels regularly
- No existing investment in a heavyweight WMS (Warehouse Management System) and no appetite for one's cost or implementation time

### The core problem it solves

Paper-and-spreadsheet warehouse tracking breaks down in three specific ways that Pallet Pal targets directly:

1. **"Where did we put it?"** — paper systems rely on someone writing a location down correctly and someone else finding that piece of paper later. Pallet Pal makes location the first-class, searchable, structured field it should be (`js/screens/search.js`, `js/screens/locations.js`, `js/screens/baySearch.js`).
2. **Label-making is a side quest.** Many small operations hand-write or Word-document their pallet and product labels, which is slow and error-prone (wrong EAN, wrong batch, mismatched totals). Pallet Pal turns label generation into a structured, validated workflow with an **exact quantity check before anything is allowed to print** (`js/screens/palletLabels.js`).
3. **Nobody can see the whole picture at once.** A spreadsheet tells you what's in a cell; it doesn't tell you what's overdue for put-away, what shipped last, or what's about to go out of date. The Dashboard screen surfaces this at a glance (`js/screens/dashboard.js`).

### How it differs from spreadsheets and paper systems

| | Spreadsheet / paper | Pallet Pal |
|---|---|---|
| Finding stock | Ctrl+F in a shared file, or walking the aisles | Type a product, SKU, or batch code into Search; get every location it's in instantly |
| Who's allowed to edit what | Nothing stops anyone from editing anything | Manager vs Employee portals show different tab sets (`js/app.js`) |
| Printing a pallet label | Manual retype into Word/Excel, manual math on how many pallets a quantity needs | Upload the packing slip PDF; the system extracts line items, splits them into pallets automatically against saved per-size limits, and won't let you print until the numbers add up exactly |
| History | Whatever's left in the spreadsheet's edit history (usually nothing) | Every delivery, every pallet-label batch, every barcode-label batch is kept as a permanent, reopenable, reprintable record |
| Staff accountability | A handwritten initial, if that | Every stock entry records who logged it; every account has a name and role |

### How it differs from off-the-shelf WMS software

Full commercial WMS platforms (e.g. the category Pallet Pal is positioned against) typically bring: multi-warehouse support, carrier/freight integration, inventory forecasting, EDI, barcode-scanner hardware integration, role-based permission enforcement at the server, and ERP/accounting integrations. Pallet Pal **deliberately does none of that** today — see §14 for the full, honest list of what's missing. What it offers instead, which is exactly what a business outgrowing spreadsheets usually wants first, is:

- A fast, no-training-required interface staff can use on day one
- Purpose-built label generation that matches the business's actual label formats (not a generic template)
- Zero setup cost or server infrastructure (a static file, opened in a browser)
- A clear, honest "prototype" framing in-product (`#prototype-banner` is shown permanently — see §14) rather than overselling itself as production-grade

This is, as the in-app banner itself states, a **prototype**: there is no real backend, no real authentication, and no real external integrations. It is a complete, working demonstration of the *workflow* a warehouse business would want, built to be evaluated, demoed, and — if a business wants to buy it — used as the functional spec for a production build. Section 14 of this document is devoted entirely to being honest about that line.

---

## 2. Problems It Solves

Each entry below follows: **the problem → how it's usually handled without Pallet Pal → how Pallet Pal handles it → the benefit.**

### 2.1 "Where is this batch of stock?"

- **Problem:** Staff need to find a specific product/batch somewhere in a warehouse with dozens of racking bays.
- **Without Pallet Pal:** Walk the aisles, or search a shared spreadsheet that's only as accurate as the last person who remembered to update it.
- **With Pallet Pal:** Type the product name, SKU, or batch code into Search (`js/screens/search.js`); every active stock entry matching it appears instantly with its exact location code, quantity, best-before date, and status. Results can be sorted six ways (soonest best-before, quantity, location, date logged).
- **Benefit:** Seconds instead of minutes; no dependency on one person's memory.

### 2.2 "What's sitting in this specific picking bay right now?"

- **Problem:** Floor/picking-bay stock turns over fast; staff restocking or picking need to know what's *supposed* to be in a bay without walking back and forth.
- **Without Pallet Pal:** Physically check, or trust a whiteboard.
- **With Pallet Pal:** Bay Search (`js/screens/baySearch.js`) looks up by bay code (e.g. `A03a`) and shows every active entry logged against it.
- **Benefit:** Picking and replenishment staff can plan a run before walking the floor.

### 2.3 "Is this bay empty or full, and what's near it?"

- **Problem:** Getting a bird's-eye view of rack occupancy from a spreadsheet means scrolling through rows; from paper, means walking the whole aisle.
- **Without Pallet Pal:** A printed rack diagram that's out of date within a day.
- **With Pallet Pal:** All Locations (`js/screens/locations.js`) shows every racking bay in one flat, colour-coded (Occupied/Empty) list, with contents visible inline and a click-through to full detail.
- **Benefit:** Instant occupancy overview for planning put-away or a stock take walk.

### 2.4 "How many pallets does this packing slip need, and have we counted right?"

- **Problem:** Turning a delivery/outbound packing slip into physical pallet labels is manual arithmetic — how many pallets does 500 units of a product need if a pallet holds 168? Get it wrong and you print the wrong number of labels, or mislabel a part-pallet.
- **Without Pallet Pal:** Manual division, usually in someone's head, usually on the warehouse floor, under time pressure.
- **With Pallet Pal:** The Pallet Label Generator (`js/screens/palletLabels.js`) either reads the packing-slip PDF directly or accepts manual entry, automatically splits each product line into full pallets (using a per-size-name maximum, e.g. 288 units for 900g tubs) plus one remainder pallet, and — critically — **refuses to generate any labels at all unless the pallet quantities sum to exactly the packing slip's stated grand total.** If a product size has no saved pallet limit yet, it stops and asks for one rather than guessing.
- **Benefit:** Arithmetic errors in pallet counts become structurally impossible; the system catches a mismatched total before a single label is printed, not after a truck is already loaded wrong.

### 2.5 "Did the delivery note's own subtotal actually match what we counted?"

- **Problem:** Packing slips often print a sub-total per product; if the individual batch rows under it don't actually add up to that stated subtotal (a typo on the supplier's end, a misread line), nobody usually notices until stock doesn't reconcile weeks later.
- **Without Pallet Pal:** Nothing catches this; it surfaces as an inventory discrepancy much later.
- **With Pallet Pal:** The PDF import (`js/screens/palletLabels.js`, `parsePackingSlipLines`) compares every product group's computed total (from its own batch rows) against the slip's own stated "`<product> Total`" line, and visually flags (highlighted row + explanatory tooltip) any mismatch before the manager generates anything.
- **Benefit:** Catches supplier/document errors at the point of import, not months later during a stock take.

### 2.6 "What barcode label do we print for this product, and is the number even valid?"

- **Problem:** Barcode labels need the exact registered EAN; a single mistyped digit produces a label that scans to the wrong product or doesn't scan at all.
- **Without Pallet Pal:** No independent check; whatever's typed goes to print.
- **With Pallet Pal:** The Barcode Label Generator (`js/screens/barcodeLabels.js`) runs a live EAN-13 check-digit validation (`js/data.js`, `isValidEan13`) as you type and visibly warns if the number is wrong before printing.
- **Benefit:** Catches typos before they become mislabelled stock.

### 2.7 "We've just taken delivery of stock — how do we get it onto the system and racked correctly?"

- **Problem:** Turning a paper/PDF delivery note into both (a) a physical put-away label and (b) a system record of what arrived is two disconnected manual jobs.
- **Without Pallet Pal:** Someone retypes the delivery note into a spreadsheet; someone else (or the same person, later) writes out put-away labels by hand.
- **With Pallet Pal:** Delivery Import (`js/screens/deliveryImport.js`) takes an uploaded delivery note, extracts line items (simulated extraction in this prototype — see §14), lets a manager review/correct each line, then generates one printable QR label per item. Each confirmed item is tracked as "awaiting put-away" until it's actually scanned and saved on the Put-Away screen.
- **Benefit:** One workflow takes a delivery from "paperwork" to "printed labels ready to go on pallets" with an audit trail of exactly what was expected to arrive.

### 2.8 "A staff member put stock away — how do we log it without a 10-field form slowing them down?"

- **Problem:** Manual stock-in logging (writing product, batch, quantity, location, date, and who did it on paper or into a spreadsheet) is slow and often skipped under pressure.
- **Without Pallet Pal:** Staff often just don't log it, or log it incompletely, "to do later."
- **With Pallet Pal:** The Put-Away screen (`js/screens/putaway.js`) only strictly requires a product and a location — everything else (batch, best-before, quantity, who logged it) is optional, so a quick entry takes seconds, while a full one still captures everything needed for traceability. "Scan QR Label" auto-fills product/batch/best-before from a previously generated delivery label in one click.
- **Benefit:** Lowers the friction of logging enough that staff actually do it, without sacrificing the ability to capture full detail when it matters.

### 2.9 "We need to do a stock take — where do we even start?"

- **Problem:** Manually walking every bay and cross-referencing a spreadsheet for a stock take is slow and error-prone.
- **Without Pallet Pal:** Printed, manually-compiled spreadsheet export, frequently out of date the moment it's printed.
- **With Pallet Pal:** Stock Take (`js/screens/stockTake.js`) produces a live, one-click-printable snapshot of every active stock entry across both racking and picking bays, sorted by location.
- **Benefit:** An always-current stock take sheet with zero manual compilation.

### 2.10 "A new hire starts Monday — how do they get a login, and how do we keep track of who has access?"

- **Problem:** Ad-hoc account creation (shared passwords, a sticky note, "just use my login") is common in small warehouses and is both insecure and untrackable.
- **Without Pallet Pal:** Shared logins, no central list of who has an account, no easy way to revoke access when someone leaves.
- **With Pallet Pal:** Manage Users (`js/screens/manageUsers.js`) lets a manager create a named account with a role (Employee/Manager) in seconds; the system auto-generates a readable temporary password (no ambiguous 0/O/1/l/I characters) shown on screen to hand over; a full Active Accounts list is always visible, with one-click delete.
- **Benefit:** A real, auditable record of who has access, created in seconds, with no email server or IT department required to see it working end-to-end (see §14 for the very real caveat that this is record-keeping only, not yet wired to actual authentication).

### 2.11 "We run two different brands/companies out of the same team — do we need two separate systems?"

- **Problem:** Multi-brand or multi-site operations often end up either paying for two separate software licences, or forcing everything into one system that then confuses the two operations' data.
- **Without Pallet Pal:** Two logins, two tools, or one tool with brand-mixing risk.
- **With Pallet Pal:** The product already demonstrates running two fully separate, independently-branded instances (Per4m orange theme, PB Wholesale blue theme) from the same codebase, with **completely separate stock/product/location/delivery data** (different `localStorage` key prefixes — see §7 and §13) but a **shared staff-account list** so one login works across both, and a single one-click "Switch System" button in the top bar to jump between them.
- **Benefit:** Proves the system can be resold/re-skinned per customer, or run multiple brands under one roof, without a rebuild.

---

## 3. Complete Feature Catalogue

Features are grouped by warehouse area. Every feature lists: what it does step by step, who uses it, where it lives, every input/field/option, what happens behind the scenes, edge cases, the business benefit, and a completeness status.

Status definitions used throughout this section:
- **Complete** — fully working for its intended (prototype) scope, no known missing pieces within that scope.
- **Partial** — works, but a core part of the real-world job is simulated, stubbed, or manual rather than automatic (explained in each case).
- **Unfinished** — present in the UI but not wired to real functionality, or missing a piece that would block real use.

---

### 3.1 Receiving

#### F1. Delivery Note Upload
- **Description:** A manager uploads a delivery note file to begin the import process.
- **Step by step:** Open Delivery Import → New Delivery tab → drag a file onto the dropzone or click it to open a file picker → file accepted → "Analysing…" spinner shown for ~1.4 seconds → review table appears.
- **Role:** Manager only (not in `EMPLOYEE_TAB_KEYS`).
- **Screen:** Delivery Import → New Delivery (`js/screens/deliveryImport.js`, `renderUploadStep`).
- **Inputs:** One file, accepted types `.pdf`, `.doc`, `.docx`, or any image (`accept=".pdf,.doc,.docx,image/*"`). Drag-and-drop or click-to-browse, both wired to the same handler.
- **Behind the scenes:** The uploaded file's name is stored (`currentFilename`) for later use as the delivery's default display name. **No actual parsing of the file's content happens** — see Edge cases.
- **Edge cases / error handling:** No file-type validation beyond the browser's file picker filter; a drag-and-drop of an unsupported file is accepted without complaint (its content is never read). No file-size limit here (contrast with Pallet Labels' PDF import, which does cap storage of the original file).
- **Business benefit:** A single, obvious drop target for the paperwork that currently lives on a clipboard.
- **Status: Partial.** The upload UI and workflow are complete and real, but the "Analysing…" step does not actually read the uploaded file at all — see F2.

#### F2. Simulated Line-Item Extraction
- **Description:** After "analysing," the system produces a table of line items for the manager to review.
- **Step by step:** Automatic, immediately follows F1.
- **Role:** Manager.
- **Screen:** Delivery Import → New Delivery (`generateMockExtraction`).
- **Inputs:** None (fully automatic).
- **Behind the scenes:** Picks 3–6 **random existing catalogue products**, assigns each a random batch code, a random best-before 3–36 months out, and a random quantity drawn from that product's seeded quantity range. This is explicitly documented in the code as a stand-in: *"Prototype only: no real document-processing/AI backend exists yet… fake a plausible result… to demonstrate the review → generate → print → scan workflow."*
- **Edge cases:** If there are zero products in the catalogue, extraction returns an empty list and the review table opens with one blank manually-added row instead.
- **Business benefit (once real):** This is the single highest-value piece of future work in the entire system — see §15. Today it demonstrates the *shape* of the workflow convincingly, but **the content shown is never actually read from the uploaded file.**
- **Status: Unfinished** (functionally simulated; this is the single most important thing to flag to a prospective buyer before they see a live demo).

#### F3. Review & Edit Extracted Line Items
- **Description:** An editable table where every extracted (or manually added) line can be corrected before labels are generated.
- **Step by step:** For each row, pick the Product from a dropdown of every catalogue product, type/edit the Batch code, pick Best-Before month/year, type/edit Quantity, or remove the row entirely. Click "+ Add row" for more, or "Confirm & Generate Labels" when done.
- **Role:** Manager.
- **Screen:** Delivery Import → New Delivery, Review step (`renderReviewStep`).
- **Inputs:** Per row — Product (`<select>` of every product in the catalogue), Batch code (free text), Best Before month (`<select>` 01–12) and year (`<select>`, current year +0..+6, last two digits), Quantity (number). Table-level: "+ Add row" button, "Cancel" (returns to upload step, discarding everything), "Confirm & Generate Labels."
- **Behind the scenes:** On confirm, every row is validated (see Edge cases), then turned into: (a) new **pending delivery items** (`Store.addPendingDeliveryItems`) that the Put-Away screen can later match against a simulated QR scan, and (b) a permanent **delivery record** (`Store.addDeliveryRecord`) that stores the filename, a default name, the confirmed items, and an `importedAt` timestamp.
- **Edge cases:** Every row must have a product, batch code, both best-before parts, and a quantity ≥ 1, or the whole confirm action is blocked with a toast naming what's missing — no partial save. Cancelling at this stage discards the entire extraction with no undo.
- **Business benefit:** Catches extraction/typing mistakes before they become printed labels or logged stock.
- **Status: Complete** (as a review/edit UI over whatever line items exist, regardless of their source).

#### F4. QR Put-Away Label Generation & Printing
- **Description:** Turns each confirmed delivery line into a printable QR label that, when later "scanned" on Put-Away, auto-fills the product/batch/best-before.
- **Step by step:** Immediately after confirming F3, a grid of QR labels appears, one per line item. Tick individual labels (or "Select all") and click "Print Selected," or click "Print All" to print every label regardless of selection.
- **Role:** Manager (to generate); any role can later "scan" one from Put-Away.
- **Screen:** Delivery Import → New Delivery, Labels step (`renderDeliveryDetail`, `labelCardHtml`).
- **Inputs:** Per-label checkbox; "Select all" checkbox; "Print Selected" / "Print All" buttons; an inline rename control for the delivery's display name; a "Delete" button for the whole delivery.
- **Behind the scenes:** Each label's QR code encodes `product name|SKU|batch code|best before` (`buildQrPayload`), generated client-side via the bundled `qrcode.js` library. "Print Selected" temporarily tags the grid with a CSS class that hides unchecked labels only for the print job; "Print All" always prints everything regardless of any checkbox state.
- **Edge cases:** A line item whose product has since been deleted from the catalogue renders as a blank label (`if (!item.product) return '';`) rather than a broken one.
- **Business benefit:** No manual label writing; the exact same structured data captured on review becomes the exact data auto-filled later at Put-Away, removing a re-entry step and its error risk.
- **Status: Complete.**

#### F5. Past Deliveries History
- **Description:** A permanent, browsable log of every delivery ever confirmed, independent of whether its stock has since been put away.
- **Step by step:** Delivery Import → "Past Deliveries" tab → list of every delivery (name, processed date, label count) → click a row to reopen its full label grid (reprintable) → "Delete" (row-level icon or inside the detail view) asks for confirmation before permanently removing the history record.
- **Role:** Manager.
- **Screen:** Delivery Import → Past Deliveries (`renderPastDeliveriesList`, `renderDeliveryDetail`, `confirmDeleteDeliveryRow`).
- **Inputs:** Click-to-open row; inline rename (pencil icon, with Enter/Escape keyboard support); Delete with an inline "are you sure?" confirmation (not a browser `confirm()` dialog).
- **Behind the scenes:** Reading a past delivery's detail renders the exact same label grid component as a fresh import, from the stored record — nothing is regenerated. Deleting a delivery record removes only the history entry; it explicitly does **not** touch stock entries already put away from it, nor any still-pending items (`deleteDeliveryRecord` comment: *"stock already put away … is a separate Stock Entry and is untouched"*).
- **Edge cases:** Deleting a delivery that still has unscanned pending items leaves those items orphaned in the "awaiting put-away" count with no way to trace them back to a deleted delivery's name — a minor traceability gap.
- **Business benefit:** Full historical paper-trail of every delivery processed, each one still reprintable without re-uploading or re-keying anything.
- **Status: Complete.**

---

### 3.2 Put-Away

#### F6. Put Stock Away Form
- **Description:** The core "log stock onto a location" form — the single most frequently used screen for day-to-day staff.
- **Step by step:** Search/select a Product → optionally type/scan a Batch code → optionally pick Best Before month/year → optionally type a Quantity → search/select a Location → optionally pick who's Logged By → Save.
- **Role:** Employee and Manager (on both portals' tab lists).
- **Screen:** Put-Away (`js/screens/putaway.js`).
- **Inputs:**
  - **Product** — type-ahead search over name/SKU, max 8 suggestions shown; a chip once selected with an "×" to clear and search again.
  - **Batch code** — free text.
  - **Scan QR Label** — button (see F7).
  - **Best before** — two `<select>`s (month 01–12, year current..+6).
  - **Quantity** — number input, `min="1"` (not browser-enforced as required — see Edge cases).
  - **Location** — type-ahead search over every racking *and* picking-bay code, shows Occupied/Empty per match.
  - **Logged by** — `<select>` of saved staff names, plus "+ Add another person" which reveals an inline name field.
- **Behind the scenes:** On submit, only Product and Location are hard-required; everything else can be left blank. Saves a new stock entry (`Store.addStockEntry`) with `status: 'In Stock'` and a server-side (well, client-side) `loggedAt` timestamp. If the entry matches a "scanned" pending delivery item, that pending item is deleted from the awaiting-put-away list **only on successful save**, never on scan alone (so an abandoned form doesn't silently lose a pending item).
- **Edge cases:** Quantity left blank saves as `0` rather than blocking the save. Batch code and best-before are entirely optional — a stock entry can exist with no batch traceability at all if a user skips them. After saving, the whole form resets and the screen re-renders from scratch (no "save and add another with same product" shortcut).
- **Business benefit:** The lowest-friction possible path from "stock in hand" to "stock on the system," while still supporting full detail capture when needed.
- **Status: Complete.**

#### F7. Scan QR Label (simulated camera scan)
- **Description:** A button that stands in for pointing a camera at a printed delivery QR label.
- **Step by step:** Click "Scan QR Label" on the Put-Away form → if any delivery items are awaiting put-away, one is picked at random and its product/batch/best-before auto-fill the form; otherwise a fully random product/batch/best-before is filled in as a standalone demo.
- **Role:** Employee and Manager.
- **Screen:** Put-Away (`js/screens/putaway.js`, the `scan-qr-btn` handler).
- **Inputs:** A single button click; no camera permission, no actual image/QR decoding.
- **Behind the scenes:** `Store.getRandomPendingDeliveryItem()` — genuinely random selection among whatever's pending, not "the next one in a queue," so repeated clicks will jump between different pending items unpredictably.
- **Edge cases:** Because selection is random rather than sequential, a warehouse with many pending items can't reliably "work through the list" by repeatedly scanning — this is a workflow limitation worth flagging (see §14).
- **Business benefit (when real):** Removes manual retyping of product/batch/best-before at put-away time, matching the physical act of scanning a label stuck to the pallet.
- **Status: Partial** (explicitly, intentionally simulated — the code comments say so directly; a real build would read the device camera, as the always-visible prototype banner also states).

#### F8. Inline "Create New Product"
- **Description:** Lets a manager add a brand-new catalogue product without leaving the Put-Away form.
- **Step by step:** Type a product name with no existing match → "+ Create new product "X"" appears at the bottom of the suggestion list → click it → an inline form appears pre-filled with the typed name → optionally add a SKU → "Add product."
- **Role:** Manager only (`Portal.isManager()` gates whether this option even appears — employees only ever see matches, never a create option).
- **Screen:** Put-Away, product field (`js/screens/putaway.js`, `openNewProductForm`).
- **Inputs:** Name (required), SKU (optional).
- **Behind the scenes:** `Store.addProduct` assigns a new unique ID, trims inputs, sets `dateAdded` to today, leaves `ean` and `createdBy` blank. The newly created product is immediately selected into the form so put-away can continue without a second search.
- **Edge cases:** Blank name is blocked with a toast; no duplicate-name check exists at all — two products can be created with the exact same name (see §14).
- **Business benefit:** Staff never get blocked by "the product isn't in the system yet" at the exact moment they need to log it.
- **Status: Complete**, with the duplicate-name gap noted.

#### F9. Inline Product Edit (from Put-Away's dropdown)
- **Description:** A manager can edit a product's Name/SKU/EAN directly from the Put-Away search results, without navigating to Manage Products.
- **Step by step:** Search a product → click "Edit" next to a result (manager only) → modal opens → change fields → Save.
- **Role:** Manager only.
- **Screen:** Put-Away's product dropdown (manager-only "Edit" button) → shared modal defined in `js/screens/manageProducts.js` (`openProductEditModal`), reused verbatim from Manage Products.
- **Inputs:** Name (required), SKU (optional), EAN (optional, 13-digit check-digit warning).
- **Behind the scenes:** Updates the product in place; does not alter or touch any existing stock entries (they only ever store a `productId` reference, so the change is reflected everywhere instantly).
- **Edge cases:** Editing from here does **not** select the product into the Put-Away form or change anything else about the in-progress entry — it's a pure side-effect edit.
- **Business benefit:** One less screen switch for a manager fixing a typo'd SKU mid-task.
- **Status: Complete.**

#### F10. Inline "Add Staff Member"
- **Description:** Adds a new name to the "Logged by" list without leaving Put-Away.
- **Step by step:** Open the "Logged by" dropdown → "+ Add another person" → inline name field appears → type a name → "Add person."
- **Role:** Employee and Manager (anyone using Put-Away).
- **Screen:** Put-Away (`js/screens/putaway.js`, `renderLoggedByField`).
- **Inputs:** Name (required).
- **Behind the scenes:** `Store.addStaffMember` case-insensitively dedupes against the existing staff list before adding, and returns the canonical (already-saved) spelling if a case-insensitive match exists, which is then auto-selected in the dropdown.
- **Edge cases:** No role, email, or login is implied by this at all — this is a plain list of names for attribution purposes only, and is **entirely separate** from the Manage Users account system (see §7 and §14 for the important distinction between "Staff" names and "User" accounts).
- **Business benefit:** New starters can be attributed on stock entries from their very first shift, with zero admin setup.
- **Status: Complete.**

---

### 3.3 Location Management

#### F11. All Locations Overview
- **Description:** A flat, always-current list of every racking location and what (if anything) is in it.
- **Step by step:** Open All Locations → scan the grid → click any occupied row → if it holds exactly one stock entry, its detail opens directly; if it holds more than one, a short picker list opens first.
- **Role:** Employee and Manager.
- **Screen:** All Locations (`js/screens/locations.js`).
- **Inputs:** None beyond clicking/activating a row (keyboard-accessible via Enter/Space).
- **Behind the scenes:** `Store.getLocationOverview()` joins every racking code against active stock entries and products, computing Occupied/Empty per row live on every visit — this is not a cached or manually-maintained view.
- **Edge cases:** This screen is racking-only; picking bays never appear here (they have their own screen, F12) — a deliberate separation documented in the code comments.
- **Business benefit:** One glance tells a manager exactly how full the warehouse is and where the free space is, without walking it.
- **Status: Complete.**

#### F12. Bay Search
- **Description:** Looks up what should currently be sitting in a specific floor/picking bay.
- **Step by step:** Type a bay code (e.g. `A03a`) → matching active entries in that bay appear.
- **Role:** Employee and Manager.
- **Screen:** Bay Search (`js/screens/baySearch.js`).
- **Inputs:** Free-text search box, matched against picking-bay codes only (never racking codes).
- **Behind the scenes:** `Store.searchPickingBayStock` filters active entries to only those whose location is in the picking-bay set, then by the typed substring.
- **Edge cases:** An empty search shows a prompt rather than every bay; a bay with multiple products shows multiple result cards (unlike All Locations, there's no "one bay, multiple items" picker here — every matching entry is listed flat).
- **Business benefit:** Lets picking/replenishment staff check a bay's contents before walking to it.
- **Status: Complete.**

---

### 3.4 Stock Tracking & Search

#### F13. Search Stock
- **Description:** Full-text search across every active stock entry by product name, SKU, or batch code.
- **Step by step:** Type a query → results appear live as you type → pick a sort order → click a result to open its detail.
- **Role:** Employee and Manager.
- **Screen:** Search (`js/screens/search.js`).
- **Inputs:** Search box; Sort-by dropdown with 6 options — Best Before (soonest first), Quantity (high→low / low→high), Location (A–Z), Date Logged (newest/oldest first).
- **Behind the scenes:** `Store.searchStock` matches against product name, SKU, and batch code case-insensitively; sorting is applied client-side after the match (`sortSearchResults`). Entries with no best-before sort to the very end regardless of direction.
- **Edge cases:** An empty query shows a prompt rather than every entry (prevents an overwhelming unfiltered dump by default).
- **Business benefit:** The single fastest way for any staff member to answer "where is X and how much do we have."
- **Status: Complete.**

#### F14. Stock Entry Detail — View
- **Description:** A modal showing every field recorded against one stock entry.
- **Step by step:** Opened from Search, All Locations, Bay Search, or Dashboard's Recent Activity — click any result card.
- **Role:** Employee and Manager (every surface that opens it is available to both roles).
- **Screen:** Modal overlay (`js/screens/entryDetail.js`, `renderEntryDetail`).
- **Inputs:** None (read view); if not "Removed," three actions appear below it (F15–F17).
- **Behind the scenes:** `Store.getStockEntryById` joins the entry against its product record live.
- **Edge cases:** A "Removed" entry shows all fields but no action controls — the code explicitly states it "can no longer be edited."
- **Business benefit:** One click, from anywhere stock is shown, to the full record and every action available on it.
- **Status: Complete.**

#### F15. Swap Location
- **Description:** Moves an existing stock entry to a different location without re-entering any of its other details.
- **Step by step:** Open an entry's detail → "Swap location" → search/select a new location (shows "Current location" / "Occupied" / "Empty" per option) → "Swap location" button.
- **Role:** Employee and Manager.
- **Screen:** Entry Detail modal (`wireSwapLocation`).
- **Inputs:** A searchable location picker.
- **Behind the scenes:** `Store.swapEntryLocation` is a thin wrapper that only changes the `locationCode` field — quantity, batch, product etc. are untouched.
- **Edge cases:** Picking the entry's own current location is explicitly blocked with a toast ("Choose a different location to swap to").
- **Business benefit:** Correcting a mis-shelved pallet or reorganising the floor takes one search and one click, with no risk of losing the rest of the entry's data in the process.
- **Status: Complete.**

#### F16. Remove Partial Quantity
- **Description:** Reduces a stock entry's quantity (e.g. partial pick/despatch) without deleting the whole entry, unless it reaches zero.
- **Step by step:** Open entry detail → "Remove partial quantity" → type an amount → inline confirmation message states exactly what will remain (or that this is the last of it) → confirm.
- **Role:** Employee and Manager.
- **Screen:** Entry Detail modal (`wireRemovePartial`).
- **Inputs:** Number input, `min="1"`, `max="<current quantity>"`.
- **Behind the scenes:** `Store.reduceEntryQuantity` subtracts the amount; if the remainder is ≤ 0 the entry's status becomes `'Removed'` and quantity is forced to 0; otherwise status becomes `'Partially Removed'` and the entry stays in place with the new quantity.
- **Edge cases:** Entering more than the current quantity, zero, or a non-number is all blocked with a specific toast message for each case before any confirmation step is even shown.
- **Business benefit:** Models real warehouse behaviour (partial picks, partial despatches, breakages) accurately rather than forcing an all-or-nothing removal.
- **Status: Complete.**

#### F17. Remove Completely
- **Description:** Marks a stock entry as fully removed (used up, shipped out, or written off).
- **Step by step:** Open entry detail → "Remove completely" → inline "are you sure?" confirmation naming the product, batch, and location → confirm.
- **Role:** Employee and Manager.
- **Screen:** Entry Detail modal (`wireRemoveCompletely`).
- **Inputs:** A single confirm/cancel pair.
- **Behind the scenes:** `Store.removeEntryCompletely` sets `status: 'Removed'`; the entry is never deleted from storage, only excluded from every "active" view from then on (`getActiveEntries` filters by `status !== 'Removed'`) — so it remains as a historical record in raw storage, though no screen in the app currently surfaces removed entries for review (see §14).
- **Edge cases:** None beyond the standard confirmation step; this action cannot be undone through the UI once confirmed.
- **Business benefit:** A clean, explicit way to retire a stock entry that matches reality, while technically preserving the record for any future reporting feature.
- **Status: Complete** for the removal action itself; **Partial** in that removed entries, while preserved in data, are currently a dead end with no screen to view them again (a real audit-trail/history view is a natural next feature — see §15).

---

### 3.5 Labels

#### F18. Barcode Label Generator
- **Description:** Produces a printable product barcode label (Code 128 barcode of the product's EAN, with EAN/SKU/description/variant printed underneath) matching the format already used on site.
- **Step by step:** Optionally search/select an existing product (auto-fills SKU/EAN/description) → enter/confirm EAN (required), SKU (required), Description (required), Variant (optional) → choose Single label (6×4") or A4 sheet (10 copies) → Generate Label → Print.
- **Role:** Manager only.
- **Screen:** Barcode Labels (`js/screens/barcodeLabels.js`).
- **Inputs:** Product search (optional convenience only — nothing downstream requires a linked product); EAN (free text, numeric, live check-digit validation); SKU (free text); Description (free text); Variant (free text, optional, upper-cased on the label); Output (`single` / `sheet`).
- **Behind the scenes:** Barcode rendered client-side via the bundled `JsBarcode` library in `CODE128` format. The check digit is computed with the standard EAN-13 algorithm (`eanCheckDigit`/`isValidEan13` in `js/data.js`) — a 1/3 digit-weighting checksum. If the selected product has no EAN saved, a toast nudges the manager to add one in Manage Products. Every generated label (regardless of whether printed) is saved permanently to history (`Store.addBarcodeLabelBatch`) the moment "Generate Label" is clicked — not only on print.
- **Edge cases:** An invalid check digit does **not** block generation or printing — it only shows a warning toast ("This doesn't look like a valid 13-digit EAN — double-check it before printing") and proceeds anyway, by design (the manager may know something the checksum doesn't, e.g. a non-standard internal code).
- **Business benefit:** Guarantees every printed barcode label uses the exact same layout and catches the single most common barcode error (a mistyped digit) before it reaches a product.
- **Status: Complete.**

#### F19. Barcode Labels History
- **Description:** Every barcode label ever generated, browsable and reprintable.
- **Step by step:** Barcode Labels → "Past Barcode Labels" tab → list → click a row to reopen its exact preview → "Delete" with confirmation.
- **Role:** Manager.
- **Screen:** Barcode Labels → Past Barcode Labels (`renderHistoryList`, `renderBatchDetail`).
- **Inputs:** Click-to-open; Delete with inline confirmation.
- **Behind the scenes:** Reopening re-renders the exact same barcode/label markup from the stored record (ean, sku, description, variant, output) — nothing is re-entered.
- **Edge cases:** None beyond standard delete confirmation.
- **Business benefit:** Reprinting a lost/damaged label for a product already labelled before takes one click, with no risk of a slightly different layout the second time.
- **Status: Complete.**

#### F20. Pallet Label Generator — Packing-Slip PDF Import
- **Description:** Reads a digital (text-based) packing-slip PDF and automatically reconstructs its product/batch/quantity lines into the pallet-labels input table.
- **Step by step:** Pallet Labels → New Batch → drag/drop or choose the packing-slip PDF → "Reading…" spinner → the input table is pre-filled, the Grand Total field is pre-filled from the document's own stated grand total, and a summary states how many lines were imported and whether the computed total matches the stated one.
- **Role:** Manager only.
- **Screen:** Pallet Labels → New Batch (`js/screens/palletLabels.js`, `wirePdfImport`, `importPackingSlipPdf`).
- **Inputs:** One PDF file (type/extension checked: `application/pdf` or `.pdf`).
- **Behind the scenes:** Uses the bundled `pdf.js` library to extract every text fragment with its page coordinates, clusters fragments into printed lines by baseline proximity (within 3px), then parses each reconstructed line against four fixed regular-expression shapes: a full product+batch+lot+date+quantity row, a "continuation" row (same product, blank product cell), a per-product "Total" row, and the document's own "Grand Total" row. Product text has "Per4m" and "Protein" stripped for the printed label (`stripProteinWord`) and a trailing size token (e.g. `450g`, `1.2kg`) extracted for the pallet-limit lookup (`parseSizeKey`). Any group whose batch-row sum doesn't match the slip's own stated subtotal for that product is flagged. Files ≤ 4MB are also kept as a saved copy (base64 data URL) for later re-download; larger files are not stored, only their filename.
- **Edge cases:** A scanned/photographed PDF with no real text layer produces zero recognised rows and a clear message explaining why ("may be a scanned image… try exporting it directly… or a different file"); a corrupt/unreadable file shows the underlying error message. The parser is a **fixed-format parser** tied to one specific packing-slip layout (see §14) — a differently formatted packing slip will silently extract nothing useful or extract it wrong, with no fallback OCR or AI step.
- **Business benefit:** Converts a 30+ line packing slip into a ready-to-check label batch in seconds instead of manual re-keying, while still surfacing anything that doesn't add up before anything prints.
- **Status: Partial** — fully functional and genuinely parses real PDF text (not simulated, unlike F2), but tightly coupled to one document layout; this is real, working regex-based parsing, with the caveat that it is not general-purpose document understanding.

#### F21. Pallet Label Generator — Manual Line Entry
- **Description:** The same input table as F20, but filled in by hand — either as the only path (no PDF available) or to add/correct rows after an import.
- **Step by step:** Click "+ Add row" for each product/size line → fill in Product + size, Flavour, Qty, Best Before, Batch code(s) (comma-separated for multiple) → repeat.
- **Role:** Manager only.
- **Screen:** Pallet Labels → New Batch (`renderInputStep`, `readLines`).
- **Inputs:** Per row — Product + size (free text, e.g. "Whey Protein 450g"), Flavour (free text), Qty (number), Best Before month/year, Batch code(s) (comma-separated free text), Remove-row button.
- **Behind the scenes:** `readLines()` validates every row has all six pieces of information before any generation is attempted, parsing the batch-code field on commas into an array.
- **Edge cases:** A single missing field in any row blocks the entire generate action with a specific error toast — there is no partial-generate.
- **Business benefit:** Keeps the label-generation workflow fully usable even with no PDF at all, e.g. a verbally-communicated order or a non-digital packing slip.
- **Status: Complete.**

#### F22. Pallet Splitting & Exact-Total Validation
- **Description:** The core business logic of the whole screen — turns each product line's total quantity into the correct number of physical pallet labels, and refuses to print anything unless the arithmetic is provably correct.
- **Step by step:** After lines are entered/imported and the Grand Total is filled in, click "Generate Pallet Labels." The system checks every line's product-size against a saved per-size pallet limit table; if any size is unrecognised, it stops and asks for the limit first (F23) before continuing. It then checks that every line's quantity sums to exactly the entered Grand Total — if not, it shows the mismatch and generates nothing. Only once both checks pass does it split each line into pallets (full pallets at the size's max, one remainder pallet) and render the actual labels.
- **Role:** Manager only.
- **Screen:** Pallet Labels → New Batch (`attemptGenerate`, `splitIntoPallets`).
- **Inputs:** Grand Total (number, required).
- **Behind the scenes:** `splitIntoPallets(totalQty, maxPerPallet)` is simple greedy packing — e.g. 500 units at a 168-per-pallet limit becomes pallets of `[168, 168, 164]`. The generated batch (all its pallets, the grand total, the source filename/PDF if any) is saved permanently to history immediately upon a successful generate.
- **Edge cases:** The exact-match requirement is absolute — being off by even 1 unit blocks every label in the batch from being produced, by design ("nothing is produced until these match exactly").
- **Business benefit:** This is the feature most directly responsible for preventing a wrong-count pallet shipment — the single most expensive kind of warehouse mistake to discover after the fact.
- **Status: Complete.**

#### F23. Missing Pallet-Size-Limit Prompt
- **Description:** When a product size has never had a pallet limit recorded, the system stops and makes the manager enter one rather than guessing or defaulting.
- **Step by step:** Triggered automatically inside F22 when an unrecognised size is found → a form appears asking for the max quantity per pallet for each missing size → Save & Continue → generation resumes automatically with the new limit applied.
- **Role:** Manager only.
- **Screen:** Pallet Labels → New Batch (`renderMissingSizePrompt`).
- **Inputs:** One number input per missing size, required, > 0.
- **Behind the scenes:** `Store.setPalletLimit` saves the new limit permanently (same table as F24) before re-attempting the generate call.
- **Edge cases:** Leaving any missing-size field blank or ≤ 0 blocks continuing with a toast naming which size needs a value.
- **Business benefit:** A new product size can never silently be mislabelled with a guessed or borrowed pallet limit — a direct business rule (stated explicitly in the code's comments) carried into the UI as an enforced stop.
- **Status: Complete.**

#### F24. Pallet Label Print & Preview
- **Description:** Renders and prints the actual label stack — one physical 6×4" page per pallet.
- **Step by step:** After a successful generate, the label stack renders on screen → "Print All" → browser print dialog, pre-set to a 6×4" page size.
- **Role:** Manager only.
- **Screen:** Pallet Labels → New Batch, after generation, and Past Pallet Labels → batch detail (identical rendering, `labelHtml`).
- **Inputs:** "Print All" button.
- **Behind the scenes:** Each label embeds a QR code encoding `name - flavour | QTY n | BBE mm/yy | BATCH codes` (`buildPalletQrPayload`) — with hyphens in batch codes converted to periods **inside the QR payload only** (not on the printed text), because some phone QR readers mis-interpret a hyphenated number as a phone number and offer to dial it instead of showing the text. A dynamic font-sizing routine (`fitPalletNameBlock`) shrinks the product name/flavour text until it fits the label's available height, so long product names never overflow or get cut off. `setPrintPageSize('6in 4in')` forces the physical print page size via a dynamically injected CSS `@page` rule (necessary because Chromium's print pipeline doesn't reliably honour the alternative, named-page CSS). Each label is forced onto its own page via `break-after: page`.
- **Edge cases:** None beyond what's already enforced upstream (F22) before this step is ever reachable.
- **Business benefit:** What prints physically matches the label format staff already use, at the correct physical size, with zero manual page-size fiddling in the print dialog.
- **Status: Complete.**

#### F25. Pallet Labels History
- **Description:** Every pallet-label batch ever generated, kept permanently, reprintable, renameable, deletable, with the original PDF downloadable if one was used and small enough to have been kept.
- **Step by step:** Pallet Labels → "Past Pallet Labels" → list (name, date, unit total, label count, whether the original PDF was kept) → click to open full detail → rename (pencil icon) / delete (with confirmation) / "Download original packing slip PDF" (if kept) / "Print All" again.
- **Role:** Manager only.
- **Screen:** Pallet Labels → Past Pallet Labels (`renderHistoryList`, `renderBatchDetail`).
- **Inputs:** Rename text field; Delete confirmation; Download button.
- **Behind the scenes:** The download button re-constitutes the stored base64 data URL into a `Blob` and triggers a file save — using a special-cased path through a `window.claude` "downloads" capability when running inside the published Claude Artifact sandbox (where a plain `<a download>` click doesn't work), falling back to the ordinary browser download-link trick everywhere else.
- **Edge cases:** A batch whose source file was over 4MB (or entered manually) simply has no download button — the history list explicitly states "original PDF not kept (too large)" or "entered manually" so this is never a silent gap.
- **Business benefit:** A manager can answer "what did we ship on pallet labels three weeks ago, and can I get the original paperwork back" without digging through email or a filing cabinet.
- **Status: Complete.**

#### F26. Pallet Size Limits Management
- **Description:** A dedicated table of every product-size → max-quantity-per-pallet rule the system knows, editable directly.
- **Step by step:** Pallet Labels → "Size Limits" tab → table of every known size and its limit → edit any limit inline (auto-saves on blur/change) → delete a size's rule → add a brand new size + limit pair.
- **Role:** Manager only.
- **Screen:** Pallet Labels → Size Limits (`renderSizeLimitsTab`). **Note:** this was specifically moved onto its own tab (separate from the label-generation workflow) at the user's request during development, rather than being buried inside Manage Products.
- **Inputs:** Per-row editable number input (max qty); per-row Delete; new-size text input + new-limit number input + Add button.
- **Behind the scenes:** Backed by a single flat object (`per4m_pallet_limits` / `pb_pallet_limits`), keyed by a normalised size string (lower-cased, spaces stripped). Ten sizes are pre-seeded (`PALLET_LIMITS_SEED` in `js/data.js`: 30g/33g/450g/495g/800g/810g/900g/1.2kg/1.8kg/2kg).
- **Edge cases:** A size typed with different spacing/casing than an existing one (e.g. "1 KG" vs "1kg") would **not** be recognised as the same key unless it normalises identically — worth noting as a data-entry risk (see §14).
- **Business benefit:** The single source of truth behind F22's pallet math is fully visible and correctable by the business itself, with no hidden/hardcoded values a developer would need to change on their behalf.
- **Status: Complete.**

---

### 3.6 Picking & Despatch

There is **no dedicated Picking or Despatch feature** in the codebase today. The closest existing functionality is:

- **Picking:** Bay Search (F12) tells staff what should be in a bay before they pick from it, and Remove Partial Quantity (F16) records a pick as a quantity reduction against a stock entry. There is no formal pick list, pick-by-order, or wave-picking feature.
- **Despatch:** The Pallet Label Generator (F18–F26) produces outbound logistics labels from a packing slip, which is the outbound-facing half of despatch, but there is no shipment/order record, no carrier integration, no proof-of-delivery capture, and no "mark as despatched" state anywhere in the data model.

This is flagged here deliberately, per the audit brief's instruction to document only what exists — see §14 and §15 for this as both an honest gap and a roadmap opportunity.

---

### 3.7 Reporting

#### F27. Dashboard
- **Description:** The landing screen for both portals — an at-a-glance summary plus one-click links into everything else.
- **Step by step:** Opens automatically on login; nothing to "do," only to read and click through.
- **Role:** Employee and Manager (content differs by role — see below).
- **Screen:** Dashboard (`js/screens/dashboard.js`).
- **Inputs:** None directly; every tile/card/row is a navigation shortcut.
- **Fields/content shown:**
  - **Stat tiles:** Locations Tracked, Items In Stock (always); Products Catalogued, Deliveries Logged (**manager only**).
  - **Quick Actions grid:** one card per screen available to the current role (excluding Dashboard itself), each with an icon and one-line description.
  - **Recent Activity:** the 6 most recently logged active stock entries, each clickable straight into its detail modal, with a relative "time ago" label (just now / Xm ago / Xh ago / yesterday / Xd ago / a plain date beyond a week).
  - **Last Shipment** (**manager only**): the most recent pallet-label batch — name, product summary, label count, total units, label size, generated date, a live label preview, and an "Open & Print" shortcut straight into that batch's detail view.
  - **Recent Deliveries** (**manager only**): the last 3 confirmed deliveries, click-through to Delivery Import → Past Deliveries.
- **Behind the scenes:** Every figure is computed live from the current store state on every visit — nothing here is cached or pre-aggregated.
- **Edge cases:** Every empty state (no activity yet, no shipments yet, no deliveries yet) has its own explicit "nothing here yet" message rather than a blank gap.
- **Business benefit:** Answers "what's the state of the warehouse right now" in the time it takes the page to load, and gets staff to the right screen in one click instead of hunting the sidebar.
- **Status: Complete.**

#### F28. Stock Take
- **Description:** A complete, always-current, one-click-printable snapshot of every active stock entry in the warehouse.
- **Step by step:** Open Stock Take → full table renders (Product, SKU, Batch, Best Before, Qty, Location) → "Print."
- **Role:** Manager only.
- **Screen:** Stock Take (`js/screens/stockTake.js`).
- **Inputs:** "Print" button only — no filtering, sorting, or search controls on this screen.
- **Behind the scenes:** `Store.getStockTakeRows()` returns every active entry (racking + picking bays combined) sorted by location code.
- **Edge cases:** An empty warehouse shows a single "No stock currently logged" row rather than an empty table.
- **Business benefit:** A physical stock-take walk can be done against a sheet that was accurate to the second it was printed, with zero manual compilation.
- **Status: Complete** as a flat report; **no filtering/grouping/export options exist** on this specific screen (see §9).

---

### 3.8 Admin

#### F29. Manage Products — Catalogue Browser
- **Description:** Search, filter, sort, and manage every product in the catalogue from one screen.
- **Step by step:** Type to search name/SKU/EAN → pick a Filter (All / Missing SKU / Missing EAN / In active stock / Not in active stock) → pick a Sort (Name A–Z/Z–A, Active entries most/least first) → results update live → Edit or Delete any row.
- **Role:** Manager only.
- **Screen:** Manage Products (`js/screens/manageProducts.js`).
- **Inputs:** Search box; Filter dropdown (5 options); Sort dropdown (4 options); per-row Edit/Delete buttons.
- **Behind the scenes:** Every row also shows a live count of how many active stock entries currently reference that product (`Store.getActiveEntryCountForProduct`).
- **Edge cases:** None beyond standard empty/no-match states.
- **Business benefit:** A manager can answer "which products have no SKU yet" or "what's sitting unused in the catalogue" in one click via the filter, without manually scanning hundreds of rows.
- **Status: Complete.**

#### F30. Manage Products — Refresh From Catalogue Snapshot
- **Description:** A one-click button that adds any product from the build's baked-in reference catalogue that isn't already in the live product list, without touching anything that already exists.
- **Step by step:** Click "Refresh Products" → a toast reports how many (if any) new products were added and their names.
- **Role:** Manager only.
- **Screen:** Manage Products (`refreshProductsFromCatalog` button).
- **Inputs:** A single button, no parameters.
- **Behind the scenes:** `Store.refreshProductsFromCatalog()` compares the live product list's names (case-insensitively) against the hardcoded `PRODUCT_SEED` array in `js/data.js` and additively inserts anything missing — it is explicitly **not** a live fetch from any website; the code comments spell out that a static client-only page has no way to call an external API for this, and that this only ever re-syncs against whatever snapshot of the catalogue happened to be baked into this specific build.
- **Edge cases:** Existing products — including any a manager has since edited — are never overwritten; this is additive-only.
- **Business benefit:** As currently built, limited: it only ever catches up the list to match a catalogue snapshot frozen at build time, which will go stale the moment the business's real product range changes. A real version of this would need a live product-feed integration (see §15).
- **Status: Partial** — the mechanism works exactly as designed, but what it syncs against is a hardcoded snapshot, not a live source, and that snapshot is one specific business's catalogue (see §14).

#### F31. Manage Products — Edit Product
- **Description:** Edit a product's Name, SKU, and EAN.
- **Step by step:** Click "Edit" on any product row → modal → change fields → Save.
- **Role:** Manager only.
- **Screen:** Manage Products / Put-Away's product dropdown — shared modal (`openProductEditModal`).
- **Inputs:** Name (required), SKU (optional), EAN (optional, numeric, check-digit-validated with a non-blocking warning).
- **Behind the scenes:** As F9 — in-place update, instantly reflected everywhere via the shared `productId` reference.
- **Edge cases:** Blank name blocked; invalid EAN warned but not blocked.
- **Business benefit:** Keeps the catalogue accurate without ever needing to touch stock entries.
- **Status: Complete.**

#### F32. Manage Products — Delete Product
- **Description:** Permanently removes a product from the catalogue, but only if nothing currently references it.
- **Step by step:** Click "Delete" → if the product has active stock entries, a toast names exactly how many and blocks the deletion; otherwise an inline confirmation appears → confirm.
- **Role:** Manager only.
- **Screen:** Manage Products.
- **Inputs:** Delete button, inline confirm/cancel.
- **Behind the scenes:** `Store.deleteProduct` re-checks the active-entry count at the moment of confirming (not just when the button was first clicked), closing a small race-condition window where stock could theoretically have been logged against it in between.
- **Edge cases:** The double-check at confirm time is a deliberate, specific safeguard documented in the code.
- **Business benefit:** Impossible to accidentally delete a product that's still physically in the warehouse, with a specific, actionable reason shown every time it's blocked.
- **Status: Complete.**

#### F33. Manage Users — Create Account
- **Description:** A manager creates a login account for a new or existing staff member, with an auto-generated password.
- **Step by step:** Manage Users → enter Full name, Email, pick Role (Employee/Manager) → "Create Account" → a confirmation card shows the generated password with a "Copy" button.
- **Role:** Manager only.
- **Screen:** Manage Users (`js/screens/manageUsers.js`).
- **Inputs:** Full name (required), Email (required, must contain "@"), Role (`<select>`: Employee/Manager).
- **Behind the scenes:** `Store.addUser` blocks creation if the email already has an account (case-insensitive match across **both** Per4m and PB Wholesale's account lists — see F35); generates a 10-character password from a fixed alphabet that deliberately excludes ambiguous characters (`0/O`, `1/l/I`) so it can be read aloud or retyped without confusion; the password is shown once, on screen, with a clipboard-copy button, because — as the code states directly — there is no real email-sending capability in this prototype to deliver it any other way.
- **Edge cases:** Blank name/invalid email blocked before any account is created; a duplicate email shows the specific existing-account error rather than silently failing.
- **Business benefit:** A new starter can have a working login, visibly, in under 30 seconds, with the password never needing to be invented or shared insecurely by the manager themselves.
- **Status: Complete** as record-keeping; **Partial** as authentication — see F36 and §14 for the critical caveat that this account is not actually required, or even checked, to log into the system today.

#### F34. Manage Users — Active Accounts List
- **Description:** A live list of every account that's been created, with role and creation date.
- **Step by step:** Scroll the Active Accounts card → see name, email, role badge, created date for every account → Delete any with confirmation.
- **Role:** Manager only.
- **Screen:** Manage Users.
- **Inputs:** Per-row Delete button with inline confirm.
- **Behind the scenes:** Sorted newest-first; the count label ("N active accounts") updates live.
- **Edge cases:** None beyond standard confirm.
- **Business benefit:** A manager can answer "who currently has access" in one glance — something a shared-password setup can never answer.
- **Status: Complete.**

#### F35. Manage Users — Shared Across Brands
- **Description:** An account created on either the Per4m or PB Wholesale instance automatically appears, and can be managed, on **both**.
- **Step by step:** Create a user on one instance → switch to the other instance (System Switch button) → the same account is already listed under Active Accounts there too. Delete it from either side and it disappears from both.
- **Role:** Manager (on either instance).
- **Screen:** Manage Users, on both instances (`js/store.js`, `pb/js/store.js`).
- **Behind the scenes:** Both instances run on the same browser origin, just under different `localStorage` key prefixes for everything else (stock, products, etc. — see §7). User accounts are the deliberate exception: `getUsers()` reads **both** instances' user keys, merges them (by account ID, own-instance entries taking precedence on a clash), and **writes the merged result back to both keys every time it's read** — a self-healing sync that also repairs any drift if the two lists were ever out of step. `addUser` and `deleteUser` both write to both keys directly as well.
- **Edge cases:** This sync only works because both instances are served from the same origin (same domain/port) — if the two brands were ever hosted on genuinely separate domains, this entire mechanism would stop working, since `localStorage` cannot be shared across origins (see §13/§14).
- **Business benefit:** One real-world use case this directly demonstrates: a warehouse running two brands/clients from the same floor with the same staff doesn't need two separate sets of logins maintained by hand.
- **Status: Complete**, within the same-origin constraint noted above.

---

### 3.9 System & Navigation

#### F36. Portal Gate (Login Screen)
- **Description:** The first screen anyone sees — a branded "Pallet Pal" gate asking for an email and password, then a Manager/Employee portal choice.
- **Step by step:** Enter any email, enter any password (or click the eye icon to reveal it), optionally click "Forgot password?," then click either the Employee Portal or Manager Portal card to enter.
- **Role:** Everyone (pre-login).
- **Screen:** Portal Gate (`index.html`/`pb/index.html`, `js/app.js`).
- **Inputs:** Email field (`type="email"`); Password field with a show/hide toggle; "Forgot password?" link; two portal-selection cards (Employee / Manager).
- **Behind the scenes:** **The email and password fields are read by nothing.** Clicking either portal card is the entire "authentication" — it calls `Portal.set('manager'|'employee')` and immediately enters the app. No credential is checked, stored against, or even read at all from either field (`js/portal.js` and `js/app.js` are explicit about this in their own comments: *"This is NOT security: it only controls which tabs/UI are shown."*). The session choice persists in `localStorage` so a page reload returns straight into the app rather than back to this gate.
- **Edge cases:** Literally any text (or nothing at all) in either field reaches the same outcome — there is no validation to fail.
- **Business benefit (once real):** The visual flow a real login would follow is already fully built and ready for a real auth backend to be dropped in behind it.
- **Status: Unfinished** as authentication; **Complete** as a cosmetic UI shell — this is the single most important item for a prospective buyer to understand clearly (see §14, §5, §11).

#### F37. Forgot Password
- **Description:** A link below the password field.
- **Step by step:** Click it → a toast appears: *"Demo environment — there's no password to reset. Any email and password signs you in."*
- **Role:** Everyone (pre-login).
- **Screen:** Portal Gate (`js/app.js`).
- **Behind the scenes:** No email is sent, no reset flow exists; the click handler only shows the toast.
- **Business benefit (once real):** Placeholder for where a real password-reset flow would go.
- **Status: Unfinished** — present and honestly labelled as non-functional.

#### F38. Show/Hide Password Toggle
- **Description:** An eye icon inside the password field that toggles its visibility.
- **Step by step:** Click the eye icon → field switches between masked and plain text, icon swaps correspondingly, with the `aria-label` updating too.
- **Role:** Everyone (pre-login).
- **Screen:** Portal Gate.
- **Behind the scenes:** Toggles the input's `type` attribute between `password` and `text`; purely cosmetic since the field's value is never read anyway.
- **Status: Complete** (as a UI affordance).

#### F39. Log Out
- **Description:** Ends the current portal session and returns to the login gate.
- **Step by step:** Click "Log Out" in the sidebar footer → returns to the Portal Gate; logging back in always lands on Dashboard, never wherever you left off.
- **Role:** Employee and Manager.
- **Screen:** Sidebar footer, every screen (`js/app.js`, `logoutBtn` handler).
- **Behind the scenes:** `Portal.clear()` removes the session key from `localStorage`; the gate's email/password fields and visibility state are reset for the next person.
- **Edge cases:** Because the session is just a `localStorage` flag, "logging out" on one browser tab does not affect any other open tab's session until that tab is itself reloaded.
- **Business benefit:** Lets a shared warehouse terminal be safely handed between an employee and a manager session.
- **Status: Complete.**

#### F40. Command Palette (Quick Jump)
- **Description:** A keyboard-driven jump-to-any-screen search, in the style of modern productivity software.
- **Step by step:** Press Cmd/Ctrl+K (or click "Quick jump…" in the sidebar) → type part of a screen name → use ↑/↓ to highlight, Enter to jump, or click directly → Esc to dismiss.
- **Role:** Employee and Manager (the list of jumpable screens is filtered to whatever that role's tab set includes).
- **Screen:** Global overlay, available from any screen (`js/app.js`, the command-palette IIFE).
- **Inputs:** Search text; keyboard navigation.
- **Behind the scenes:** Only usable once inside the app (`if (document.getElementById('app-shell').hidden) return;` blocks it from the login gate).
- **Edge cases:** No matches shows an explicit "No screens match…" message.
- **Business benefit:** A faster path to any screen for anyone comfortable with keyboard shortcuts, without the sidebar needing to be visible or expanded.
- **Status: Complete.**

#### F41. System Switch (Per4m ↔ PB Wholesale)
- **Description:** A single always-visible button in the top bar that jumps between the two branded instances.
- **Step by step:** Click "Switch to PB Wholesale" (or "Switch to Per4m," depending which instance you're on) in the top-right of the header → the other instance's login gate (or, if a session already exists there, straight into its app) loads.
- **Role:** Employee and Manager (visible to both — it is not a manager-only control).
- **Screen:** Top bar, every screen, both instances (`js/app.js`, `#system-switch-btn`).
- **Behind the scenes:** A plain `<a href>` link; its target is computed at load time to cope with two different deployment shapes — the real file tree (`pb/index.html` ↔ `../index.html`) versus the single-file bundled demo (`pb.html` ↔ `index.html`) — detected via the presence of a bundle-only marker element.
- **Edge cases:** Switching instances does **not** carry over the current portal session (Manager/Employee) or screen — the other instance's own independent login state applies (except the shared user-account list, F35).
- **Business benefit:** Demonstrates, concretely and clickably, that the same underlying product can run as more than one branded storefront with one click between them — a direct sales proof-point for multi-brand/multi-client resale (see §16).
- **Status: Complete.**

#### F42. Responsive Sidebar / Mobile Drawer
- **Description:** Below a 900px viewport width, the sidebar collapses into a slide-in drawer opened by a hamburger button, rather than staying permanently docked.
- **Step by step:** On a narrow screen, tap the hamburger icon in the top bar → sidebar slides in from the left over a dimmed backdrop → tap the backdrop, or any navigation item, to close it again.
- **Role:** Employee and Manager, on any device below the breakpoint.
- **Screen:** Global (`css/styles.css`, `@media (max-width: 900px)`; `js/app.js` toggle handlers).
- **Behind the scenes:** Pure CSS transform-based slide animation, respecting `prefers-reduced-motion` (disables the transition for users who've asked their OS to reduce motion).
- **Business benefit:** The system is directly usable on a warehouse tablet or phone, not just a desktop terminal — see §11 for the full mobile/tablet usability discussion.
- **Status: Complete.**

#### F43. Prototype Banner
- **Description:** A permanent, dismissable-only-by-not-existing banner shown on every screen inside the app shell.
- **Step by step:** Always visible once logged in; reads: *"PROTOTYPE — scanning is simulated for this demo. The final build will use live camera barcode scanning."*
- **Role:** Everyone, every screen, no way to hide it.
- **Screen:** Just below the top bar, globally (`index.html`, `#prototype-banner`).
- **Behind the scenes:** Static HTML, always rendered, never hidden by any user action — it is only hidden automatically by the browser's print styles (`@media print`) so it never appears on a printed label or report.
- **Business benefit:** Sets honest expectations for anyone demoing or evaluating the system that scanning is currently simulated — directly relevant to how this document should be used in a sales conversation (see §16).
- **Status: Complete** (as an intentional, permanent disclosure — not a bug).

## 4. Screen-by-Screen Walkthrough

This section maps every distinct screen/page in the app — its purpose, everything visible on it, every button, and where each action leads. Features already fully detailed in §3 are referenced by their F-number rather than re-described.

### 4.1 Portal Gate (`#portal-gate`, `index.html`)
**Purpose:** Entry point and (cosmetic) login.
**Visible:** "PALLET PAL" logotype; "Warehouse Hub" tagline; Email field; Password field with show/hide eye icon; "Forgot password?" link; "Sign in as" label; two large cards — Employee Portal ("Log stock, search, and manage locations") and Manager Portal ("Full access — manage stock, products, and stock takes"); a small italic note ("Demo environment — any email and password will sign you in").
**Buttons/actions:**
- Eye icon → F38 (toggle password visibility).
- "Forgot password?" → F37 (toast only).
- Employee Portal card → sets session to employee, leads to **Dashboard** (4.2) with the employee tab set.
- Manager Portal card → sets session to manager, leads to **Dashboard** (4.2) with the manager tab set.

### 4.2 Dashboard (`renderDashboardScreen`)
**Purpose:** Landing screen after login; at-a-glance summary + shortcuts.
**Visible:** Date-stamped welcome headline (different copy for manager vs employee); stat tiles (F27); "Quick Actions" grid (one card per available screen); "Recent Activity" list (last 6 entries); manager-only: "Last Shipment" card, "Recent Deliveries" card.
**Buttons/actions:**
- Any Quick Action card → jumps straight to that screen (same destination as clicking its sidebar tab).
- Any Recent Activity row → opens **Stock Entry Detail modal** (4.11).
- "Open & Print" (Last Shipment, manager only) → opens that pallet batch's detail inside **Pallet Labels → Past Pallet Labels** (4.10.2).
- Recent Deliveries card (manager only) → jumps to **Delivery Import → Past Deliveries** (4.5.2).

### 4.3 Put-Away (`renderPutawayScreen`)
**Purpose:** Log stock onto a location. See F6–F10 for full field-by-field detail.
**Visible:** One form — Product (searchable), Batch code + "Scan QR Label" button, Best Before (month/year), Quantity, Location (searchable), Logged By (dropdown), Save button.
**Buttons/actions:**
- "Scan QR Label" → F7 (auto-fills fields).
- "+ Create new product" (manager only, appears in product search results) → inline create form (F8).
- "Edit" next to a product search result (manager only) → **Stock Entry Detail-style modal**, specifically the Product Edit modal (F9).
- "+ Add another person" (Logged By dropdown) → inline add-staff form (F10).
- Save → stays on Put-Away, form resets, success toast shown.

### 4.4 Search (`renderSearchScreen`)
**Purpose:** Find stock by product/SKU/batch. See F13.
**Visible:** Search box, Sort-by dropdown (6 options), results list (or an empty-state prompt if nothing typed yet).
**Buttons/actions:**
- Any result row → opens **Stock Entry Detail modal** (4.11).

### 4.5 Bay Search (`renderBaySearchScreen`)
**Purpose:** Look up contents of a floor/picking bay. See F12.
**Visible:** Intro helper text, search box, results list.
**Buttons/actions:**
- Any result row → opens **Stock Entry Detail modal** (4.11).

### 4.6 All Locations (`renderLocationsScreen`)
**Purpose:** Flat racking-location overview. See F11.
**Visible:** Grid of every racking location (code, contents summary or "No stock logged," Occupied/Empty badge).
**Buttons/actions:**
- Click any Occupied row → if it holds one entry, opens **Stock Entry Detail modal** (4.11) directly; if more than one, opens the **Location Entries picker modal** (4.12) first.
- Empty rows are not clickable at all.

### 4.7 Manage Products (manager only) (`renderManageProductsScreen`)
**Purpose:** Full catalogue CRUD. See F29–F32.
**Visible:** "Refresh Products" button + explanatory note; search box; Filter dropdown (5 options); Sort dropdown (4 options); product count label; product rows (name, SKU/EAN/active-count, Edit/Delete buttons).
**Buttons/actions:**
- "Refresh Products" → F30.
- "Edit" per row → **Product Edit modal** (shared with F9).
- "Delete" per row → inline confirm, blocked with an explanation if the product is still active somewhere (F32).

### 4.8 Manage Users (manager only) (`renderManageUsersScreen`)
**Purpose:** Staff account administration, shared across both brand instances. See F33–F35.
**Visible:** "Add a User" card (Full name, Email, Role, "Create Account" button, result area showing the generated password + Copy button); "Active Accounts" card (count label, list of every account with role badge and created date, per-row Delete).
**Buttons/actions:**
- "Create Account" → F33.
- "Copy" (on the password result card) → copies the password to the clipboard.
- "Delete" per account row → inline confirm (F34).

### 4.9 Delivery Import (manager only) — three states under one screen
**Purpose:** Turn a delivery note into QR put-away labels. See F1–F5.

**4.9.1 New Delivery → Upload step** (`renderUploadStep`)
**Visible:** Sub-nav ("New Delivery" / "Past Deliveries"); drag-and-drop dropzone; hidden file input.
**Buttons/actions:** Drop or click to choose a file → **Analysing step** → **Review step**.

**4.9.2 New Delivery → Review step** (`renderReviewStep`)
**Visible:** Editable table (Product dropdown, Batch code, Best Before month/year, Qty, Remove button, per row); "+ Add row"; "Cancel"; "Confirm & Generate Labels."
**Buttons/actions:**
- "+ Add row" → blank row appended.
- Row "Remove" → deletes that row from the table only (no confirmation — it hasn't been saved yet).
- "Cancel" → discards everything, back to Upload step.
- "Confirm & Generate Labels" → validates every row, then **Labels step**.

**4.9.3 New Delivery → Labels step / Past Deliveries detail** (`renderDeliveryDetail`)
**Visible:** Delivery name (editable via pencil icon) + Delete button; processed-date/filename/label-count helper text; "Select all" checkbox; "Print Selected" / "Print All" buttons; grid of QR label cards, each individually selectable; (from New Delivery only) "Import Another Delivery" button.
**Buttons/actions:**
- Pencil icon → inline rename (Save/Cancel, Enter/Escape supported).
- "Delete" → inline confirm → **Past Deliveries list** (4.9.4).
- Checkboxes / Select all → toggles which labels "Print Selected" will print.
- "Print Selected" / "Print All" → browser print dialog.
- "Import Another Delivery" → back to **Upload step**.

**4.9.4 Past Deliveries** (`renderPastDeliveriesList`)
**Visible:** Sub-nav; list of every delivery (name, processed date, label count, per-row Delete).
**Buttons/actions:**
- Any row (not the Delete button) → **Labels step / detail view** (4.9.3), with its sub-nav shown as "history" rather than "new."
- Per-row Delete → inline confirm.

### 4.10 Pallet Labels (manager and employee — unusually, not manager-restricted) — four states
**Purpose:** Packing-slip-to-pallet-label pipeline. See F18–F26.

**4.10.1 New Batch** (`renderInputStep`)
**Visible:** Sub-nav ("New Batch" / "Past Pallet Labels" / "Size Limits"); drag-and-drop PDF dropzone; import status/summary text; collapsible "Pallet size limits" reference list; editable line-items table (Product+size, Flavour, Qty, BBE, Batch code(s), Remove); "+ Add row" (implicit via empty state — rows are added by import or manually); Grand Total field; generate feedback area; "Generate Pallet Labels" button.
**Buttons/actions:**
- Drop/choose PDF → F20 (auto-fills table + grand total).
- Row Remove → deletes that row.
- "Generate Pallet Labels" → F22; may detour into the **Missing Size prompt** (4.10.1a) first.
- After a successful generate, a "Past Pallet Labels" link appears inline in the success message → **Past Pallet Labels detail** (4.10.3).

**4.10.1a Missing Size Prompt** (`renderMissingSizePrompt`, appears inline above the table)
**Visible:** One number input per newly-encountered size; "Save & Continue."
**Buttons/actions:** "Save & Continue" → saves the limit(s), then automatically re-attempts Generate.

**4.10.2 Past Pallet Labels** (`renderHistoryList`)
**Visible:** Sub-nav; list of every batch (name, generated date, unit total, whether the original PDF was kept, label count, per-row Delete).
**Buttons/actions:** Any row → **Batch Detail** (4.10.3); per-row Delete → inline confirm.

**4.10.3 Batch Detail** (`renderBatchDetail`)
**Visible:** Batch name (editable via pencil) + Delete button; generated-date/filename/label-count/unit-total helper text; "Download original packing slip PDF" (only if one was kept); "Print All"; the full label stack.
**Buttons/actions:** Pencil → rename; Delete → inline confirm → **Past Pallet Labels list**; Download → file save; Print All → browser print dialog.

**4.10.4 Size Limits** (`renderSizeLimitsTab`)
**Visible:** Sub-nav; table of every size + its max-qty-per-pallet (editable inline) + per-row Delete; "add a new size" row (text input + number input + Add button).
**Buttons/actions:** Inline edit (auto-saves on change); Delete per row; Add → new size+limit pair saved.

### 4.11 Stock Entry Detail Modal (`renderEntryDetail`, overlay — not a standalone screen)
**Purpose:** View and act on one stock entry. See F14–F17.
**Visible:** Product, Batch code, Best Before, Quantity, Location, Logged By, Status — all read-only; if not Removed: "Swap location" section, "Remove partial quantity" section, "Remove completely" section.
**Buttons/actions:** Close (×); Swap location (search + confirm, F15); Remove qty (amount + confirm, F16); Remove completely (confirm, F17). Any action closes the modal and refreshes whichever screen was open underneath it.

### 4.12 Location Entries Picker Modal (`renderLocationEntriesList`, overlay)
**Purpose:** Disambiguates which entry to open when a bay holds more than one, from the All Locations screen only.
**Visible:** Bay code as title; "This bay holds N items" helper text; a clickable list of every entry in that bay (product, batch, quantity, status badge).
**Buttons/actions:** Close (×); any row → **Stock Entry Detail Modal** (4.11), replacing this picker.

### 4.13 Barcode Labels (manager only) — three states
**Purpose:** Product barcode label generation. See F18–F19.

**4.13.1 New Label** (`renderInputStep` inside `barcodeLabels.js`)
**Visible:** Sub-nav ("New Label" / "Past Barcode Labels"); explanatory helper text; Product search (optional); EAN field + live check-digit message; SKU field; Description field; Variant field; Output dropdown (Single / A4 sheet); "Generate Label" button; preview area (appears after generating).
**Buttons/actions:** Selecting a product auto-fills SKU/EAN/Description; "Generate Label" → F18, renders the preview below; "Print" (in the preview card, appears only after generating) → browser print dialog, forced to the correct physical page size for the chosen output.

**4.13.2 Past Barcode Labels** (`renderHistoryList`)
**Visible:** Sub-nav; list of every generated label (description/variant, generated date, SKU, EAN, output type, per-row Delete).
**Buttons/actions:** Any row → **Batch Detail** (4.13.3); per-row Delete → inline confirm.

**4.13.3 Batch Detail** (`renderBatchDetail`)
**Visible:** Sub-nav; description as title + Delete button; generated-date/SKU/EAN/variant helper text; the same preview-and-print card as 4.13.1.
**Buttons/actions:** Delete → confirm, back to history; Print → browser print dialog.

### 4.14 Stock Take (manager only) (`renderStockTakeScreen`)
**Purpose:** Full printable current-stock snapshot. See F28.
**Visible:** Entry count; a full table (Product, SKU, Batch, Best Before, Qty, Location); "Print" button.
**Buttons/actions:** "Print" → browser print dialog, pre-styled to a clean black-on-white table layout.

### 4.15 Command Palette Overlay (`#command-palette-overlay`, global, not a tab)
**Purpose:** Keyboard quick-jump. See F40.
**Visible:** Search input, Esc hint, a filtered/highlightable list of every screen available to the current role.
**Buttons/actions:** Click or Enter on any item → jumps straight to that screen, closing the overlay.

---

## 5. User Roles and Permissions

### 5.1 The two roles

There are exactly two roles in the entire system, chosen at the Portal Gate and stored as a single string (`'employee'` or `'manager'`) in `localStorage` (`js/portal.js`):

| | Employee | Manager |
|---|---|---|
| Dashboard | ✅ (basic stat tiles, Recent Activity) | ✅ (+ Products Catalogued / Deliveries Logged stats, + Last Shipment, + Recent Deliveries) |
| Put-Away | ✅ full use | ✅ full use, **plus** can create new products and edit products inline from the dropdown |
| Search | ✅ | ✅ |
| Bay Search | ✅ | ✅ |
| All Locations | ✅ | ✅ |
| Pallet Labels (generate / history / size limits) | ✅ **full access** | ✅ full access |
| Manage Products | ❌ not in tab list | ✅ |
| Manage Users | ❌ not in tab list | ✅ |
| Delivery Import | ❌ not in tab list | ✅ |
| Stock Take | ❌ not in tab list | ✅ |
| Barcode Labels | ❌ not in tab list | ✅ |

This table is drawn directly from `EMPLOYEE_TAB_KEYS` and `MANAGER_TAB_KEYS` in `js/app.js`. The one detail worth calling out explicitly: **Pallet Labels is available to Employees, not just Managers** — unlike every other "admin"-flavoured screen. This appears to be an intentional choice (warehouse floor staff generating their own pallet labels without waiting on a manager), but it's worth confirming with any real customer whether that matches their intended controls, since it's the one screen where an Employee can create permanent, business-wide label-history records and edit the shared pallet-size-limits table.

### 5.2 How access is controlled

Access control is **entirely a UI-rendering decision, not an enforced permission system.** Specifically:

- `Portal.isManager()` (`js/portal.js`) just checks whether the stored string equals `'manager'`.
- The sidebar only ever renders tab buttons for the keys in the current role's list (`buildTabs()` in `js/app.js`).
- The Command Palette only ever lists the current role's keys too.
- `Store.addProduct`/edit from Put-Away's dropdown is gated by a local `canManageProducts = Portal.isManager()` check purely to decide whether to *render* the Edit/create-new UI at all — not by any check inside `Store` itself.

**There is no server, so there is nothing to enforce this centrally** — a point the code's own comments make unprompted (`js/portal.js`: *"This is NOT security: it only controls which tabs/UI are shown. A real build must replace this with actual staff login and server-side checks before employee/manager access can be trusted."*). Concretely: every `Store` function and every screen-render function is reachable by directly calling it from the browser's developer console regardless of the active portal — e.g. an Employee session could call `AppRouter.goTo('users')` from the console and reach the Manage Users screen, because `AppRouter.goTo` performs no role check of its own. This is appropriate and expected for a client-only prototype with no backend, but it is the single most important caveat for a buyer evaluating this as a security boundary — see §14.

### 5.3 Staff ("Logged By") vs. Users (login accounts) — an important distinction

These are two entirely separate, unconnected lists, and conflating them is an easy mistake to make when reading this system for the first time:

- **Staff** (`Store.getStaff`/`addStaffMember`, `per4m_staff`/`pb_staff`) — a flat list of names only, used purely for the "Logged By" field on Put-Away. No email, no password, no role, no login capability. Seeded with 4 names (`STAFF_SEED`: Ricky, Nick, Leighton, Tom).
- **Users** (`Store.getUsers`/`addUser`/`deleteUser`, shared `per4m_users`/`pb_users`) — real account records with name, email, role, and an auto-generated password, managed from Manage Users. **These accounts are never checked against the Portal Gate's login fields** — see F36. Creating a "Manager" user here does **not** grant that person anything the Portal Gate doesn't already give away for free to anyone who clicks the Manager Portal card.

A real build would need these two concepts either merged or explicitly linked (e.g. "Logged By" becomes a picker over actual user accounts) — see §15.

### 5.4 What happens if an Employee tries to reach a Manager-only screen

Nothing stops them except the absence of a visible button — see §5.2. There is no "Access denied" screen anywhere in the codebase; the gating is 100% about what gets a clickable entry point, never about checking a request after the fact.

---

## 6. Workflows

Each workflow below is a complete, verified, step-by-step path through the real screens and buttons described in §3–§4, referencing the exact F-numbers involved.

### 6.1 End-to-end: Goods In → Put-Away → Locate → Pick/Despatch

1. **Goods In (Receiving).** A manager logs in (Manager Portal card) and opens **Delivery Import**. They upload the delivery note (F1). After the simulated extraction (F2), they review and correct every line (F3) and click "Confirm & Generate Labels" (F4). Each line becomes a printable QR label and a permanent delivery record (F5).
2. **Labels are printed.** The manager selects and prints the QR labels (F4) and physically attaches them to the incoming pallets/boxes.
3. **Put-Away.** Any staff member (Employee or Manager) opens **Put-Away**, clicks "Scan QR Label" (F7) to "scan" one of the just-printed labels — in this prototype, this either matches a real pending item or falls back to a random demo fill — fills in/confirms the Location, and clicks Save (F6). The matched pending item is removed from the "awaiting put-away" count.
4. **Locate.** Any staff member can now find that stock via **Search** (F13) by product/SKU/batch, via **All Locations** (F11) by browsing racking occupancy, or via **Bay Search** (F12) if it went into a picking bay.
5. **Pick / Despatch.** There is no dedicated pick-list workflow (§3.6). In practice, staff would use Search or Bay Search to find the stock, then record the pick as either a **Remove Partial Quantity** (F16, if some remains) or **Remove Completely** (F17, if all of it is taken) from the Stock Entry Detail modal. For outbound pallet logistics labelling specifically, a manager would separately use the **Pallet Label Generator** (F20–F26) against the outbound packing slip.

### 6.2 End-to-end: New Product Launch

1. A manager opens **Manage Products** and either clicks "Refresh Products" (F30, to pull in anything from the build's bundled catalogue snapshot) or adds the product one-off from **Put-Away**'s "+ Create new product" (F8).
2. The manager edits the new product (F31/F9) to add its SKU and EAN as soon as those are known — never guessed.
3. Once an EAN exists, the manager opens **Barcode Labels**, searches for the product (auto-fills SKU/EAN/Description), and generates a label (F18), printing either a single label or a full A4 sheet of 10.
4. If the new product also needs a pallet size added (a weight/size never seen before), the first time a pallet-label batch references it, the system will stop and ask for its per-pallet limit (F23) — there's no need to pre-configure this separately.

### 6.3 End-to-end: Outbound Pallet Shipment

1. A manager opens **Pallet Labels → New Batch** and uploads the outbound packing-slip PDF (F20), or enters its lines manually (F21).
2. The manager reviews the imported/typed lines against the real paperwork, paying attention to any row highlighted as flagged (its batch rows didn't match the slip's own stated subtotal).
3. The manager enters (or confirms the auto-filled) Grand Total and clicks "Generate Pallet Labels" (F22).
4. If any product size has no saved pallet limit yet, the manager is stopped and asked to enter it (F23) before anything proceeds.
5. If the line totals don't sum to the grand total exactly, nothing is generated — the mismatch is shown and the manager must fix the lines or the total first.
6. Once the totals check passes, the labels render (one per pallet) and the manager prints them (F24), each on its own 6×4" page.
7. The batch is saved permanently (F25) — reopenable, reprintable, renameable, and (if the source PDF was ≤4MB) the original file can be re-downloaded later.

### 6.4 End-to-end: Stock Take

1. A manager opens **Stock Take**.
2. The full current-stock table (all racking + picking bays, sorted by location) is already on screen — no setup step.
3. The manager clicks "Print" (F28) and walks the floor with the printed sheet to physically verify it, or reviews it on a tablet.
4. Any discrepancy found is corrected back on the relevant **Stock Entry Detail modal** (Swap Location / Remove Partial / Remove Completely, F15–F17) or by logging missed stock via **Put-Away** (F6).

### 6.5 End-to-end: New Staff Member Onboarding

1. A manager opens **Manage Users** and creates an account (name, email, role) (F33).
2. The generated password is copied and handed to the new starter by whatever channel the business actually uses (there is no automated email — F33 is explicit about this).
3. Separately, if the new starter needs to appear in the "Logged By" dropdown on Put-Away (a different, unconnected list — see §5.3), either they or a manager adds their name there the first time they use the form (F10).
4. The new starter can log in immediately — using **any** email and password at the Portal Gate, since F36 confirms the account created in step 1 is never actually checked.

### 6.6 "Day in the Life" — Employee

- **Start of shift:** Opens the browser, lands on the Portal Gate (or, if the browser remembers the session, straight into the app), clicks Employee Portal.
- **Dashboard:** Glances at Items In Stock / Awaiting Put-Away stat tiles and the Recent Activity feed to see what's happened since last shift.
- **Receiving stock:** Uses Put-Away repeatedly through the shift — scanning (simulated) or manually entering product/batch/location for each delivery as it's unpacked.
- **Answering a pick query:** A colleague asks where a specific batch is; the employee opens Search, types the batch code, and reads off the location.
- **Checking a bay before restocking:** Opens Bay Search to confirm what's currently logged in a specific picking bay before adding more to it.
- **Generating a pallet label:** If tasked with preparing an outbound pallet, opens Pallet Labels and runs the same workflow a manager would (this screen isn't manager-restricted).
- **End of shift:** Clicks Log Out if handing over a shared terminal to the next shift or a manager.

### 6.7 "Day in the Life" — Manager

- **Start of day:** Logs in via Manager Portal; Dashboard shows the fuller picture (Last Shipment, Recent Deliveries, Products Catalogued, Deliveries Logged, in addition to everything an employee sees).
- **Morning delivery:** Processes an incoming delivery note end-to-end via Delivery Import (upload → review → generate QR labels), then hands the printed labels to floor staff for Put-Away.
- **Catalogue maintenance:** Periodically visits Manage Products to clean up missing SKUs/EANs (using the Filter dropdown), or to refresh against the bundled catalogue snapshot after new products launch.
- **Staffing:** Uses Manage Users when a new hire starts or someone leaves (create/delete accounts), independent of which brand instance they're currently on, since accounts are shared.
- **Outbound shipment:** Runs the Pallet Label Generator against the day's outbound packing slip, resolving any flagged lines or missing size prompts before printing.
- **Barcode needs:** Generates a fresh sheet of product barcode labels via Barcode Labels whenever stock needs relabelling.
- **End of day / week:** Opens Stock Take, prints the current snapshot, and reconciles it physically.
- **Cross-brand work:** If managing both Per4m and PB Wholesale operations, uses the System Switch button to move between the two, relying on the shared Manage Users list to avoid re-creating the same staff accounts twice.

## 7. Data Model

All data lives in the browser's `localStorage`, as JSON, under prefixed keys (`per4m_*` on the main instance, `pb_*` on PB Wholesale — see §13). There is no server, no database, and no network call involved in storing or retrieving any of it (`js/store.js`). Each record type below is explained in plain English, with its exact fields.

### 7.1 Products (`per4m_products` / `pb_products`)
What's tracked about each catalogue product:
- **Internal ID** (system-generated, never shown to a user)
- **Name** (e.g. "Whey Protein - Chocolate Brownie Batter")
- **SKU** (the business's own stock code — optional, may be blank)
- **EAN** (the 13-digit registered barcode number — optional, may be blank; validated by checksum where present)
- **Created by** (a free-text field, currently never actually populated by any screen — see §14)
- **Date added** (today's date, captured automatically when created)

Products are never physically deleted while any stock entry still references them (§3.8, F32); deletion is otherwise a hard removal, not a soft/archived one.

### 7.2 Locations and Picking Bays (`per4m_locations` / `per4m_picking_bays`, and PB equivalents)
Two separate flat lists of location **codes only** — there is no record *about* a location beyond its code existing; everything else (what's in it, whether it's occupied) is computed live from Stock Entries, never stored against the location itself.
- **Racking locations:** `A01c`, `A01d`, `A02c`, `A02d` … `A10c`, `A10d` — 10 aisles × 2 levels (`c`/`d`) = 20 codes, generated by a fixed pattern (`generateLocationCodes` in `js/data.js`), not read from any external layout file.
- **Picking bays:** the same aisle numbering but levels `a`/`b` instead — `A01a`, `A01b` … `A10a`, `A10b` — another 20 codes (`generatePickingBayCodes`), representing ground-level picking as a separate system from racking.

### 7.3 Stock Entries (`per4m_stockEntries` / `pb_stockEntries`)
The single most important record type — every individual "batch of stock sitting somewhere" fact:
- **Internal ID**
- **Product ID** (reference into Products)
- **Batch code** (free text, optional)
- **Best Before** (as a `MM/YY` string, optional)
- **Quantity** (a number)
- **Location code** (reference into either Locations or Picking Bays — the same field serves both, since a stock entry doesn't otherwise know which kind of location it's in)
- **Logged by** (a name string, from the Staff list — not linked to a User account, see §5.3)
- **Status** — one of `In Stock`, `Partially Removed`, or `Removed`
- **Logged at** (an exact timestamp, captured automatically)

Entries are **never deleted**, even when fully removed — a `Removed` entry stays in storage forever, just excluded from every "active" view. There is currently no screen that lets anyone browse removed entries again (§3.4, F17; a genuine audit-trail gap flagged in §14/§15).

### 7.4 Deliveries (`per4m_deliveries` / `pb_deliveries`)
A permanent record of every confirmed delivery import:
- **Internal ID**
- **Original filename** (if a file was uploaded — always blank today, since F1/F2 never actually reads the file; the filename itself is still captured)
- **Display name** (editable; defaults to the filename, or a date-based fallback like "Delivery – 12 Aug 2026")
- **Imported at** (timestamp — doubles as "date processed" everywhere it's shown)
- **Items** — the confirmed line items (each with product reference, batch code, best before, quantity)

### 7.5 Pending Delivery Items (`per4m_pending_delivery_items` / `pb_pending_delivery_items`)
A working list of "arrived but not yet racked" items, separate from the permanent Deliveries record above:
- **Internal ID**
- **Product ID**
- **Batch code**
- **Best Before**
- **Quantity**

An item is removed from this list the moment a matching Put-Away save actually completes (F6/F7) — not when it's merely "scanned." This is the data behind the Dashboard's "Awaiting Put-Away" stat tile (F27).

### 7.6 Pallet Limits (`per4m_pallet_limits` / `pb_pallet_limits`)
Not a list of records but a single flat lookup table: **size name → maximum units per pallet**, e.g. `{"450g": 480, "1.2kg": 288}`. Ten sizes are pre-seeded; any new size is added either proactively (Size Limits tab, F26) or reactively (the Missing Size prompt, F23) — and, per the business rule baked into the code, **never auto-filled or guessed.**

### 7.7 Pallet Label Batches (`per4m_pallet_label_batches` / `pb_pallet_label_batches`)
Permanent history of every generated pallet-label run:
- **Internal ID**
- **Original filename** (if a PDF was used)
- **Display name** (editable)
- **Source file as a data URL** (the actual original PDF content, base64-encoded — only kept if ≤4MB; `null` otherwise)
- **Pallets** — the full list of individual pallet labels in this batch, each with product text, stripped display name, size key, flavour, quantity, best before, and batch code(s)
- **Grand total** (the validated total this batch was generated against)
- **Generated at** (timestamp)

### 7.8 Barcode Label Batches (`per4m_barcode_label_batches` / `pb_barcode_label_batches`)
Permanent history of every generated barcode label:
- **Internal ID**, EAN, SKU, Description, Variant, Output type (`single`/`sheet`), Generated-at timestamp.

### 7.9 Staff (`per4m_staff` / `pb_staff`) — names only
A flat array of strings used solely for the "Logged By" field. See §5.3 for why this is deliberately **not** the same thing as a User account.

### 7.10 Users / Accounts (`per4m_users` and `pb_users` — shared, see F35)
Real account records:
- **Internal ID**
- **Name**
- **Email** (the de-duplication key — case-insensitive, unique across both brand instances combined)
- **Role** (`employee` or `manager`)
- **Password** (a generated 10-character string, **stored and displayed in plain text** — a deliberate, explicitly-documented prototype shortcut, not a production-safe pattern; see §11 and §14)
- **Created at** (timestamp)

### 7.11 Portal Session (`per4m_portal` / `pb_portal` — separate module, `js/portal.js`)
A single string, `'employee'` or `'manager'`, with no expiry, no token, and no link whatsoever to the Users table above (§5.1, §5.3).

### 7.12 The "seeded" flag (`per4m_seeded_v5` / `pb_seeded_v5`)
A single marker value that, once present, stops the one-time demo-data seeding routine from running again. Bumping the version suffix (`_v4` → `_v5` happened once already, during development) is the mechanism used to force a fresh reseed onto an updated baked-in product catalogue, since the routine only ever runs when this exact key is absent.

### 7.13 What is *not* tracked (relevant gaps for §14)
- No supplier/customer records at all.
- No purchase orders or sales orders — only packing slips as free-floating documents.
- No "despatched" state — stock only ever goes from `In Stock` to `Partially Removed`/`Removed`; there's no concept of an order it left against.
- No audit log of *who* performed a Swap/Remove/Delete action, or *when*, beyond the single `logged by` name captured at creation — e.g. removing a stock entry doesn't record who removed it or when, only that it happened.
- No change history on Products (editing a product's name/SKU/EAN overwrites in place with no prior-version record).
- No stock valuation/costing data of any kind (no unit cost, no currency).

---

## 8. Labels, Printing and Scanning

### 8.1 Label formats

| Label | Screen | Physical size | Contents | Barcode/QR type |
|---|---|---|---|---|
| Put-Away QR label | Delivery Import | On-screen grid, prints at default page size per selection | Quantity × product name; batch + best-before line | QR code encoding `name\|SKU\|batchCode\|bestBefore` |
| Product barcode label — single | Barcode Labels | 6×4 in | Barcode + EAN/SKU/Description/Variant text, centred | Code 128 barcode of the EAN |
| Product barcode label — sheet | Barcode Labels | A4, 10 copies (2 cols × 5 rows) | Same as above, smaller | Code 128 barcode of the EAN |
| Pallet label | Pallet Labels | 6×4 in, one page per pallet | Product name + flavour (dynamically font-sized to fit); divider; QTY / BBE / BATCH lines; QR code | QR code encoding `name - flavour \| QTY n \| BBE mm/yy \| BATCH codes` |
| Stock Take sheet | Stock Take | Standard print page (browser default) | Full stock table: Product, SKU, Batch, Best Before, Qty, Location | None (not a label — a report) |

### 8.2 Barcode/QR generation — technical detail

- **QR codes** are generated entirely client-side using a vendored copy of Kazuhiko Arase's MIT-licensed `qrcode.js` library (`js/vendor/qrcode.js`), rendered as inline SVG (`qr.createSvgTag(4)`). No external API call, no network dependency, no internet connection required to generate or print a single label.
- **Code 128 barcodes** are generated via a vendored copy of `JsBarcode` v3.12.3 (MIT licence, `js/vendor/jsbarcode.js`), also rendered as SVG, also fully offline.
- **PDF reading** (for the Pallet Labels packing-slip import) uses a vendored copy of Mozilla's `pdf.js` (Apache 2.0 licence, `js/vendor/pdfjs.js` + `pdf.worker.min.js`), running its parsing in a Web Worker for performance. All PDF parsing happens **in the browser** — no file is ever uploaded to a server, because there is no server.

### 8.3 A deliberate QR encoding quirk worth knowing

Pallet label QR payloads replace hyphens in batch codes with periods (e.g. `300926-11` → `300926.11`) **inside the QR code's encoded data only** — the printed text on the label itself still shows the real hyphenated batch code. This is a direct fix for a real-world problem: several phone camera QR readers interpret a hyphenated numeric string as a phone number and offer to dial it instead of displaying the scanned text (`buildPalletQrPayload` in `js/screens/palletLabels.js`).

### 8.4 Printer and paper support

There is no printer-driver integration of any kind — "printing" means invoking the browser's own native print dialog (`window.print()`) against specially-styled HTML, exactly as printing any web page would work. This means:

- **Any printer the browser itself can print to works** (any printer installed on the device, via the OS print dialog) — there is no proprietary label-printer protocol support (e.g. no native Zebra/Dymo ZPL support).
- **Page size is forced per label type** via a dynamically injected CSS `@page` rule immediately before printing (`setPrintPageSize` in `js/ui.js`) — 6×4 inch for pallet/single-barcode labels, A4 for barcode sheets, and the browser/printer default for the Stock Take report. This means a 6×4" thermal/label printer can be targeted directly if the OS print dialog is pointed at it, but the system has no way to detect or confirm that a printer of the right physical size is actually selected — it just asks for that page size and trusts the printer/driver to honour it.
- **A4 sheet labels are explicitly captioned "Print at 100% / Actual size, not Fit to page"** in the UI — a manual step the user must get right in their own print dialog; the system cannot enforce it.
- Dedicated print stylesheets (`@media print` in `css/styles.css`) hide all chrome (sidebar, top bar, buttons, banners, toasts) so only the label/report content itself prints, and force each pallet label onto its own page (`break-after: page`).

### 8.5 Scanner support

**There is no real scanner support at all today.** "Scanning" is entirely simulated:
- Put-Away's "Scan QR Label" button (F7) does not access a camera, does not decode an image, and does not read any real QR code — it randomly selects from the pending-delivery-items list (or fabricates a random fill if none exist).
- The permanent on-screen banner states this outright: *"Prototype — scanning is simulated for this demo. The final build will use live camera barcode scanning."*
- There is no integration with dedicated handheld barcode-scanner hardware (USB/Bluetooth scanners that emulate keyboard input would, in principle, "just work" against any plain text field like Batch Code or the search boxes, since those are ordinary HTML text inputs — but this has not been built, tested, or documented as a supported path).

### 8.6 What a real build would need for labels/printing/scanning (forward-looking, see §15)
- Real device-camera QR/barcode scanning (e.g. via the browser's `BarcodeDetector` API or a JS scanning library) to replace F7's simulation.
- Either confirmed compatibility with, or direct protocol support for, common thermal label printers (e.g. Zebra ZPL, Dymo) if customers expect dedicated label-printer hardware rather than a general-purpose printer.
- Formal testing of the forced print page sizes across more browsers/OS combinations than this prototype has been verified against (see §11 for what has been tested).

## 9. Reporting and Exports

### 9.1 Reports that exist

| Report | Screen | Format | Filters | Data included |
|---|---|---|---|---|
| Dashboard summary | Dashboard | On-screen only | None | Locations tracked, items in stock, awaiting put-away, (manager) products catalogued, deliveries logged, last 6 activity entries, last shipment, last 3 deliveries |
| Stock Take | Stock Take | On-screen + print | None | Every active stock entry, all fields, sorted by location |
| Search results | Search | On-screen only | Free-text query + 6 sort orders | Matching active stock entries |
| Bay Search results | Bay Search | On-screen only | Free-text bay-code query | Matching active entries in picking bays |
| Manage Products list | Manage Products | On-screen only | Free-text + 5-option filter + 4-option sort | Products + their active-entry counts |
| All Locations overview | All Locations | On-screen only | None | Every racking location + occupancy + contents |
| Past Deliveries | Delivery Import | On-screen only | None (flat chronological list) | Every delivery record |
| Past Pallet Labels | Pallet Labels | On-screen only | None (flat chronological list) | Every pallet-label batch |
| Past Barcode Labels | Barcode Labels | On-screen only | None (flat chronological list) | Every barcode-label batch |

### 9.2 What counts as "export" today

There is **no data export feature anywhere in the system** — no CSV, no Excel, no PDF export of a report, no API endpoint to pull data out programmatically. The only two things that leave the browser in any form are:

1. **Printing** (§8.4) — which produces a physical page or a browser "Save as PDF" via the OS print dialog, not a structured export.
2. **Downloading a previously-uploaded packing-slip PDF back out** (F25) — this returns the exact original file a manager uploaded; it is not a generated export of the system's own data.

Every other report in §9.1 exists only as rendered HTML in the browser, re-computed fresh every time the screen is opened, with no "export this view" button anywhere.

### 9.3 What counts as "import" today

- **Delivery note upload** (F1) — accepted but, as documented in §3.2/F2, never actually parsed; the resulting line items are simulated, not extracted from the file.
- **Packing-slip PDF upload** (F20) — genuinely parsed (regex-based text-line reconstruction against one specific document layout), the only real file-import/extraction feature in the system.

There is no bulk product import (e.g. a CSV of SKUs/EANs), no bulk stock import, and no supplier/customer data import of any kind.

### 9.4 Dashboards and metrics, in detail

The Dashboard (F27) is the system's only metrics surface. All figures are computed live, on every page load, directly from the current `localStorage` state — there is no caching, no historical trend data, and no comparison against a previous period (e.g. no "vs last week" change indicator anywhere). "Recent Activity" and "Recent Deliveries" are the closest things to a time-series view, and both are simple most-recent-N lists, not charts.

### 9.5 What a real build would need (forward-looking, see §15)
- At minimum, CSV export of the Stock Take and Search results, since these are the two reports a business is most likely to need outside the browser (for sharing, archiving, or feeding into accounting/ERP software).
- A structured, documented API (even a simple one) if any other software is ever expected to read Pallet Pal's data.
- Genuine historical/trend reporting (stock levels over time, delivery volume over time) — currently impossible since removed stock entries, while preserved in storage, have no screen that re-surfaces them for analysis.

---

## 10. Integrations and Automations

### 10.1 External services and APIs

**There are none.** This is a fully offline-capable, client-only static web application. A full review of every script confirms there is no `fetch()`, `XMLHttpRequest`, WebSocket, or any other network call to any external service anywhere in the application code (`js/*.js`, `js/screens/*.js`). The only network activity possible at all is the browser loading the app's own static files (HTML/CSS/JS) and — if ever deployed as such — the vendored libraries, all of which are bundled locally, not loaded from a CDN.

Specifically **not integrated**, despite being referenced in code comments as the "real" version of something the prototype simulates:
- No connection to per4mbetter.com (or any e-commerce platform) for live product-catalogue sync — F30's "Refresh Products" explicitly only re-syncs against a hardcoded snapshot baked into the build, and the code comments state plainly that a static browser page has no cross-origin way to call an external site's API at all.
- No document-processing/AI backend for delivery-note extraction (F2) — entirely simulated.
- No camera/scanning API integration (F7) — entirely simulated.
- No email service — Manage Users (F33) displays the generated password on screen specifically because there is no way to send it.
- No accounting/ERP integration of any kind.
- No carrier/freight/shipping API integration.

### 10.2 File import/export

Covered fully in §9.3. In summary: delivery-note upload (unparsed/simulated) and packing-slip PDF upload (genuinely parsed) are the only inbound file integrations; a single stored-file re-download (F25) is the only outbound one.

### 10.3 Scheduled jobs / background processes

**None.** There is no cron-style scheduler, no background sync, no periodic cleanup job, and no server at all to run one on. The one "timer" in the entire codebase is a client-side `setInterval` that refreshes the on-screen clock in the top bar every 30 seconds (`js/app.js`, `updateClock`) — purely cosmetic, not a data process.

### 10.4 Automatic processes that do exist (client-side only)

These aren't "integrations" in the usual sense, but they are automatic behaviours worth documenting precisely since the brief asks for every automation:

- **One-time demo data seeding** on first load, if no seeded-data flag is present yet (`seedIfNeeded` in `js/store.js`) — generates the staff list, product catalogue, pallet limits, locations, and a batch of random starter stock entries.
- **Self-healing user-account sync** between the Per4m and PB Wholesale instances, running every single time `getUsers()` is called anywhere in either instance (F35) — this re-merges and re-saves both instances' account lists on every read, not just on write.
- **Automatic removal of a pending delivery item** the moment a matching Put-Away save completes (§7.5).
- **Automatic status transition** on a stock entry from `In Stock`/`Partially Removed` to `Removed` the instant its quantity reaches zero via a partial removal (F16) — the user doesn't have to separately mark it removed.
- **Automatic dynamic font-sizing** of the pallet label's product-name block to fit the label (F24).
- **Automatic forced print page size** immediately before any print action, then reset immediately afterward via the screen-navigation router (`AppRouter.showScreen` calls `setPrintPageSize(null)` on every screen change) so a forced size from one label type never leaks into a different screen's print job.

### 10.5 What a real build would need (forward-looking, see §15)
- A real product-feed integration (Shopify/ERP export, or a proper API) to replace the hardcoded catalogue snapshot behind F30.
- A real document-extraction service (commercial OCR/AI document API) behind Delivery Import.
- A real email/SMS service behind Manage Users' account creation.
- If multi-device/multi-terminal use is required (see §11), some form of server-side sync — `localStorage` cannot, by definition, synchronise between two different devices or browsers.

## 11. Technical Overview

### 11.1 For the non-technical buyer

Pallet Pal, as it exists today, is a **single web page** (plus its two or three supporting files) that runs entirely inside a web browser — there is no separate "server" to install, no database to administer, and no IT setup beyond putting the files somewhere a browser can open them. Think of it like a very sophisticated calculator built into a webpage: everything it knows is stored on the one device/browser that's using it.

That simplicity is also its current biggest limitation as a multi-user business tool, explained plainly:

- **One device's data does not appear on another device.** Because everything is stored in that specific browser's local storage, a stock entry logged on the warehouse floor tablet will **not** be visible on the office manager's laptop unless they are, impossibly, sharing the exact same browser profile. This is the single most important technical fact for a buyer to understand before being shown a live demo — see §14.
- **It works perfectly well with no internet connection at all**, once the page itself has loaded, because nothing it does requires a network call (§10.1).
- **It is fast** — because there's no server round-trip for any action, every click, search, or save is instant.
- **Printing just uses the browser's own print dialog**, so it works with whatever printer is already set up on the device.

### 11.2 Where it's hosted

As delivered for evaluation in this project, the application has been run two ways:
1. **As a static file tree**, served by any ordinary static file server (the project's own `README.md` suggests `npx serve .` or `python3 -m http.server`) — this is how a real deployment would most likely work, e.g. uploaded to any standard web host, CDN, or internal file server.
2. **As a single bundled HTML file**, published to a sharable link via the development tooling used to build this project (not part of the application itself) — useful for quick demos but not how a production deployment would be structured.

There is no requirement for any specific hosting provider, server language, or infrastructure — any location capable of serving static files (HTML/CSS/JS) over HTTP will run it.

### 11.3 Devices and browsers supported

- **Built entirely in modern, standard web technology** — plain HTML5, CSS3 (including CSS custom properties/variables, flexbox, CSS grid, and the `:has()` selector used in the print stylesheet), and vanilla JavaScript (ES6+: arrow functions, template literals, `const`/`let`, destructuring, `Map`/`Set`). No framework (React/Vue/Angular) and no build step are used at all — every file runs as-authored.
- **No explicit minimum-browser statement exists in the code**, but the features used (CSS `:has()`, the Clipboard API, `BarcodeDetector`-adjacent patterns are *not* used, template literals, arrow functions) are all broadly supported in current versions of Chrome, Edge, Firefox, and Safari — this has not been formally cross-browser tested as part of this audit beyond the automated testing described below (which ran on Chromium).
- **No app-store app, no installable desktop/mobile app** — it is a website, opened in a browser.

### 11.4 Mobile and tablet use

- The layout is **responsive**: below a 900px viewport width, the sidebar becomes a slide-in drawer opened by a hamburger button rather than a permanently-docked panel (F42, `css/styles.css`), and several components have their own narrower breakpoints (e.g. the system-switch button hides its text label below 680px, keeping just its icon).
- **This has not been tested on a real phone or tablet device** as part of this audit — the responsive behaviour is implemented in CSS media queries and has been verified only by resizing a desktop browser window, not on physical touch hardware. A real pilot on a warehouse-floor tablet is strongly recommended before relying on this for daily staff use (see §12, §14).
- There is **no camera-based scanning** to test on a mobile device anyway, since that feature doesn't exist yet (§8.5) — a mobile/tablet deployment today would use the same manual-entry and simulated-scan workflow as a desktop.

### 11.5 Offline capability

Functionally, the app **works fully offline once loaded**, because every piece of its logic and data is local to the browser and nothing calls out to the network (§10.1). However, there is **no explicit offline support engineered in** either — no service worker, no "add to home screen"/PWA manifest, no cache-first loading strategy. In practice this means: if the page is already open and loaded, losing the internet connection changes nothing; but there is nothing that proactively caches the app for opening fresh without a connection, and no offline-first design beyond the accidental consequence of not needing a network at all.

### 11.6 Speed

With no network round-trip for any user action and a product/location dataset in the tens-to-low-hundreds of records, every interaction in this prototype is effectively instantaneous — limited only by `localStorage` read/write speed and in-browser JavaScript execution, both of which are very fast at this data scale.

### 11.7 Scalability — how many pallets, locations, and users it can handle

This is the area where "it's a prototype" matters most, in very concrete terms:

- **`localStorage` has a hard, small capacity ceiling** — typically around 5–10MB per origin, enforced by the browser itself, not by this application. The code is explicitly aware of this: the Pallet Label batch history deliberately stops storing a copy of the original packing-slip PDF once it's over 4MB (`MAX_STORED_SOURCE_FILE_BYTES` in `js/screens/palletLabels.js`) specifically because "localStorage has a small, fixed quota shared by the whole app, and every past batch's copy sits in it."
- **Locations are fixed at 20 racking + 20 picking bays**, generated by a hardcoded pattern (`generateLocationCodes`/`generatePickingBayCodes` in `js/data.js`) covering 10 aisles. A warehouse with a different number of aisles, levels, or any non-grid layout would need this code changed by a developer — there is no UI to add, rename, or restructure locations at all (see §13/§14).
- **Products**: the seed catalogue has a little over 300 entries; nothing in the code imposes a hard limit, but every catalogue-wide operation (search, filter, refresh) is a simple client-side array scan with no indexing, so very large catalogues (many thousands+) would eventually become noticeably slower in the browser, long before `localStorage`'s own size ceiling became the binding constraint.
- **Stock entries**: same consideration — simple array operations, no pagination anywhere, so every screen that lists stock (Search, Stock Take, All Locations) renders its *entire* result set into the DOM at once. A stock take of many thousands of active entries would be the first place this becomes a real, user-visible slowdown.
- **Users**: trivial at any realistic small-business headcount; the merge/self-heal logic in F35 does a full array scan on every read, which is irrelevant at tens of accounts but would not be the right approach at a large scale.

**Bottom line for a buyer:** this prototype, as built, comfortably suits a single warehouse, single-digit-to-dozens of staff, a few hundred to low thousands of products, and a moderate volume of stock movement. It is **not** built, as-is, for multi-site operation, large enterprise product catalogues, or high-volume 24/7 multi-terminal use — all of that would require the backend/database rebuild discussed throughout §14 and §15.

### 11.8 Backups

**There are none.** Since all data lives in one browser's `localStorage` on one device, there is no automatic backup of any kind. Clearing that browser's site data, uninstalling the browser, or the device failing destroys the data permanently and irrecoverably, with no undo. The only "backup" mechanism accidentally available today is downloading a previously-uploaded packing-slip PDF back out (F25) — which is not a data backup, only a file re-download.

### 11.9 Security

To be direct and complete, because this is the area a buyer most needs straight answers on:

- **Authentication does not exist.** The Portal Gate's email/password fields are read by nothing (F36). Anyone who opens the page and clicks a portal card is "logged in" as that role.
- **Authorization is UI-only**, not enforced (§5.2) — there is no concept of a request being checked against a permission before it's allowed, because there is no server to check it.
- **Passwords are generated and stored in plain text** in `localStorage` (§7.10) — explicitly flagged in the code's own comments as a demo-only shortcut, never acceptable in a real system.
- **There is no transport security consideration** at all, because there is no network transmission of any sensitive data — everything stays on the one device. (This cuts both ways: nothing can be intercepted in transit, but nothing is protected from anyone with access to that device/browser either.)
- **No CSRF/XSS-specific hardening is needed in the traditional sense** (no server endpoints to attack), though the app does take care to escape user-entered text before inserting it into the page (`escapeHtml` in `js/ui.js`, used consistently throughout every screen) — this is good practice and does reduce the risk of a stored-XSS-style issue if this were ever connected to a shared backend later.
- **Vendored third-party libraries** (`qrcode.js`, `jsbarcode.js`, `pdfjs.js`) are used as-is, with no dependency-scanning or update process in place — a real deployment should track their upstream versions for security patches, specifically Mozilla's `pdf.js`, which parses untrusted, user-supplied PDF files.

### 11.10 Data protection / GDPR considerations

Directly relevant personal data stored by the system: staff names (`Staff`), and — more sensitively — full name, email address, and a plain-text password per account (`Users`, §7.10). Because this all lives in `localStorage`:

- There is no central place to action a GDPR data-subject access or deletion request across "the business's data" — it's scattered across whichever individual devices/browsers have ever been used, with no way to enumerate them.
- There is no data-retention policy or automatic expiry of any kind.
- A real production version intended for commercial sale would need, at minimum: hashed (never plain-text) password storage, a real authentication/authorization backend, a documented data-retention and deletion policy, and (if operating in the UK/EU) a basic GDPR compliance review before any real customer personal data is entered into it. **None of this exists today**, and this document recommends treating that as a hard blocker before any paying customer puts real staff personal data into the current build (see §14).

---

## 12. Setup and Onboarding

### 12.1 What a new business would need, concretely

Because there is no backend and no account-provisioning system, "setting up" Pallet Pal today means **editing the code directly** and placing the files on a server — there is no in-app setup wizard, business-registration flow, or configuration screen for any of the following:

1. **Product catalogue** — the full product list currently lives as a hardcoded array in `js/data.js` (`PRODUCT_SEED`). A new business's product list would need to be transcribed into this same format (name, SKU, EAN, a demo quantity range) before first load, or the business would need to add every product by hand through the in-app "+ Create new product" flow (F8) after the fact (slower, but requires no code change).
2. **Racking/bay layout** — the location-code generator (`generateLocationCodes`/`generatePickingBayCodes` in `js/data.js`) is a fixed pattern (10 aisles × 2 racking levels + 2 picking-bay levels). A business with a different number of aisles, a different naming convention, or a non-grid layout needs this logic edited directly — there is no UI for it at all (a significant onboarding gap — see §14).
3. **Pallet size limits** — ten common sizes are pre-seeded (`PALLET_LIMITS_SEED` in `js/data.js`), but this table is fully editable in-app (F26) with no code change needed, and the system will also prompt for any missing size the first time it's needed (F23) rather than requiring it all to be set up up-front.
4. **Staff names** — pre-seeded with 4 placeholder names; trivially added to or replaced in-app (F10) with no code change.
5. **User/login accounts** — created entirely in-app (F33), no setup step required beyond a manager doing it once per person.
6. **Branding** — the brand name, logo text, and colour palette are currently hardcoded per instance (see §13) and would need a developer to adjust for a genuinely new brand, though the mechanism for doing so (CSS custom properties + a handful of text strings) is simple and fast to repeat (§13).

### 12.2 Configuration needed before go-live

- Decide and hardcode (or, more sustainably, build a settings screen for — see §15) the real racking/bay layout.
- Transcribe the real product catalogue, including real SKUs and EANs (never guessed — a rule the system itself enforces for pallet limits and recommends for barcodes).
- Decide real pallet-size limits for every product size the business ships, or rely on the system's own "ask on first use" prompt (F23) to build this table organically during the first few real pallet-label runs.
- Create real staff names and real manager/employee accounts.
- Choose where the files will be hosted (any static web host) and who has access to that hosting.

### 12.3 Training needed

Given the system's design goal of minimal friction (§1, §2.8), training needs are genuinely light:

- **Employees:** a single walkthrough of Put-Away, Search, Bay Search, and All Locations — all four are simple enough that most staff could self-serve from the Dashboard's own "Quick Actions" descriptions. Fifteen to thirty minutes is a realistic estimate for a new starter to be productive.
- **Managers:** the above, plus Delivery Import, Pallet Labels (including understanding the exact-total validation rule and the missing-size prompt), Barcode Labels, Manage Products, Manage Users, and Stock Take. An hour-long walkthrough covering each screen once, plus the first couple of real Delivery Import / Pallet Label runs done alongside someone experienced, is a realistic estimate.
- No specialist IT training is needed to *use* the system day-to-day; meaningful IT/developer involvement is only needed for the one-off setup items in §12.1 above (catalogue, layout, branding).

### 12.4 Estimated time to go live

Given the above, and assuming the business accepts the current prototype's limitations (§14) rather than waiting for the real-backend rebuild:

- **Fastest path (accept all defaults, add real data only in-app):** a working day — host the files, do the manager walkthrough, start logging real stock, let the pallet-limits table build itself organically via the missing-size prompts.
- **Realistic path (real product catalogue + real racking layout transcribed in advance):** a few days to a week, almost entirely spent on getting an accurate product list and location layout into the right hardcoded format, which currently requires a developer's involvement (§14) rather than being something the business can self-serve.
- **Not realistic without further development:** any timeline that assumes multi-device staff access working correctly out of the box, since that requires the backend/database work described in §14/§15, not configuration.

## 13. Customisation

### 13.1 What can be configured per business without any code change (fully in-app)

- **Pallet size limits** — add/edit/delete freely (F26); the system also asks rather than guesses when it hits an unknown one (F23).
- **Product catalogue** — add, edit, delete products one at a time (F8, F31, F32); "Refresh Products" (F30) is the one catalogue action that *does* depend on a code-level snapshot (see 13.3).
- **Staff names** — add freely (F10).
- **User/login accounts** — create and delete freely, with role choice (F33, F34).
- **Pallet label history, barcode label history, delivery history** — all fully self-maintaining through normal use; nothing here needs developer setup.

### 13.2 What can be configured by editing a small number of clearly-marked constants (light developer touch, no architectural change)

- **Branding per instance** — proven out already by the Per4m/PB Wholesale duplication (§1, F41). The exact mechanism: a brand's logo text is a plain string in `index.html` (`<span class="brand-mark">…</span>`), and its single accent colour is one CSS custom property (`--color-orange` in `css/styles.css`, despite the variable keeping that name even in the blue PB Wholesale copy — only its *value* changes) plus a handful of literal `rgba(...)` colour values sprinkled through the stylesheet that reference the same hex by value rather than by variable and so needed finding and swapping by hand during the PB duplication. Repeating this for a third brand is a known, bounded, mechanical task — not a redesign.
- **Pallet-size default seed list** (`PALLET_LIMITS_SEED` in `js/data.js`) — a plain object literal; editing it just changes what's pre-loaded for a brand-new, never-before-seeded install. Does nothing for an install that's already been seeded once (see 13.4).
- **Staff name seed list** (`STAFF_SEED` in `js/data.js`) — same mechanism, same caveat.

### 13.3 What needs real development work (architectural, not configuration)

- **Racking/bay layout** — fixed at 10 aisles × (2 racking + 2 bay levels) by a hardcoded generator function (`generateLocationCodes`/`generatePickingBayCodes`, `js/data.js`). A different-shaped warehouse needs this function rewritten, or — better — replaced entirely with an in-app "Manage Locations" screen that doesn't exist today. This is the single highest-priority piece of real development work standing between this prototype and genuine multi-customer resale, because **every single customer's warehouse has a different physical layout**, and today that means a bespoke code change per customer rather than a configuration step (see §14, §15).
- **Product catalogue "Refresh" snapshot** (F30) — re-syncing against a live product feed (rather than the hardcoded `PRODUCT_SEED` snapshot) needs a real integration built, not a config change.
- **Real authentication** — turning the Portal Gate (F36) and Manage Users (F33) into an actually-enforced login system is a genuine backend build, not a setting.
- **Multi-device data sync** — moving off `localStorage` onto a real shared backend/database is the largest single piece of architectural work implied by everything in §11.7/§11.8, and is a prerequisite for this to be sellable as more than a single-terminal tool.
- **Document extraction** (Delivery Import's simulated parsing, F2) and **camera scanning** (F7) both need real third-party services/APIs integrated, not configuration.

### 13.4 An important nuance: the seeding mechanism only ever fires once

Every "seed list" constant in `js/data.js` (`PRODUCT_SEED`, `STAFF_SEED`, `PALLET_LIMITS_SEED`, the location generators) is only ever consulted the very first time an installation has no `per4m_seeded_v5`/`pb_seeded_v5` flag set yet (`seedIfNeeded` in `js/store.js`). Editing these constants to onboard a new customer therefore only matters **before that customer's first page load ever happens** — a useful shortcut for fast initial setup, but not a mechanism anyone could use to push updated defaults to an already-running installation. (The one deliberate exception is "Refresh Products," F30, which was specifically built to re-sync new catalogue entries into an already-seeded install — but only additively, and only against the same hardcoded snapshot, not a live source.)

---

## 14. Limitations, Gaps and Risks

This section is written to be read before any sales conversation, not after. Every item below is real, verified against the code, and presented without softening — per the brief's explicit instruction to be completely honest.

### 14.1 Hardcoded, single-customer specifics that must be generalised before resale

- **The PB Wholesale instance ships with Per4m's actual product catalogue, staff names, and brand-specific SKUs.** `pb/js/data.js` is byte-for-byte identical to `js/data.js` — confirmed directly (`diff js/data.js pb/js/data.js` produces zero differences). This means the "second company" proof-of-concept is, today, literally the first company's data under a blue coat of paint: Per4m's ~300-item protein-supplement catalogue, the staff names Ricky/Nick/Leighton/Tom, and two items with real Per4m-branded SKUs/EANs (`PFJUG003`, `PFFLAVCR5RANDOM`) all appear under the PB Wholesale brand too. **This must be replaced with that customer's own catalogue before PB Wholesale is shown to, or used by, anyone outside this development process as if it were a real second business.**
- **The racking/bay layout (10 aisles, A01–A10, levels a/b/c/d) is a generic grid, not drawn from any specific customer's real warehouse** — but it is still a single fixed layout baked into code (`js/data.js`) rather than configurable, so it is implicitly "hardcoded to whichever warehouse shape happened to be assumed," and every new customer with a different shape needs a code change (§13.3).
- **The pallet-label text-stripping rules are company-specific**: `stripProteinWord()` (`js/screens/palletLabels.js`) specifically strips the words "Per4m" and "Protein" from printed pallet labels — a rule that makes sense for Per4m's own product names but would need to be generalised (or made configurable) for a different customer's product naming conventions.
- **The packing-slip PDF parser is tied to one exact document layout** (fixed regular expressions matching a specific column arrangement — product/flavour, batch-dash-lot, lot, MM/YYYY, quantity — see F20). A different supplier's or customer's packing-slip format will not be understood at all; it will either extract nothing or extract it incorrectly, with no fallback.
- **The Barcode/Pallet label physical formats** (6×4", the specific text layout, the specific QR payload shape) were built to match one specific business's existing label stock and conventions, referenced directly in code comments (e.g. `barcodeLabels.js`: *"matching the ones already used in the warehouse"*). A new customer may use entirely different label sizes or printers.

### 14.2 Simulated or non-functional features that must not be presented as real

- **Barcode/QR scanning is entirely simulated** (§8.5, F7) — no camera, no real decode, ever. The system's own permanent on-screen banner says this. Never demo this as "scan a real label" without clarifying it is a one-click simulation that may not even pick the item you expect.
- **Delivery note extraction is entirely simulated** (F2) — the uploaded file's content is never read; the review table is populated with randomly-chosen existing products and random quantities/batches/dates. The filename is the only genuinely real thing retained. **This is the single most important feature to clarify before any live demo**, since visually it looks exactly like real document AI extraction.
- **Authentication does not exist** (F36, §11.9) — any email and any password (including blank) logs in as whichever portal card is clicked. User accounts created in Manage Users are never checked.
- **"Refresh Products" (F30) is not a live catalogue sync** — it only re-adds items from a snapshot frozen at build time.

### 14.3 Partial/incomplete features

- **Removed stock entries have no browsing screen.** They're preserved in storage (§7.3) but permanently invisible to every user once removed — there is no "view removed stock" or history screen anywhere, so the data exists but is currently inaccessible through the UI.
- **Scan QR Label picks a random pending item, not the next one in sequence** (F7) — makes "working through a list of pending items by repeated scanning" unreliable in a multi-item delivery.
- **No duplicate-product-name check** exists anywhere (F8) — two identically-named products can coexist, which would be confusing in Search/Put-Away.
- **Pallet size-key normalisation is fragile** — "1kg", "1 kg", and "1KG" would not all resolve to the same stored key unless entered with exactly matching casing/spacing after normalisation (F26) — a real risk of accidentally creating duplicate, inconsistent pallet-limit entries for what a human would consider the same size.
- **Deleting a delivery record can orphan its still-pending (not-yet-put-away) items**, leaving them in the "awaiting put-away" count with no way to trace which delivery they came from (F5).
- **No change history on products** — editing a product's name/SKU/EAN simply overwrites in place (§7.13); there's no way to see what it used to be.
- **`createdBy` on products is a defined field that is never actually populated by any code path** (`js/store.js`, `addProduct`) — always saved as an empty string regardless of who adds a product.

### 14.4 Architectural gaps a buyer would reasonably expect from "a warehouse system"

- **No multi-device/multi-terminal data sharing** (§11.1, §11.7) — this is the single biggest gap between "a convincing working prototype" and "a system a real multi-person warehouse team could actually run on." Every device is its own silent, disconnected island of data.
- **No backups, no disaster recovery** (§11.8) — total, permanent, unrecoverable data loss is one "clear browsing data" click away.
- **No real security** (§11.9, §11.10) — plain-text passwords, no enforced permissions, no audit log of who did what beyond a single optional name field at creation time.
- **No picking or despatch workflow** (§3.6) — no pick lists, no order records, no "this shipped" state.
- **No supplier/customer records, no purchase/sales orders** (§7.13).
- **No data export** of any kind (§9.2) — everything that isn't printed stays trapped in the browser.
- **No automated test suite exists inside this repository.** Every automated check referenced in this project's development history (Playwright regression tests covering tab lists, search, label generation, print pagination, cross-instance user sync, etc.) was written and run from a separate, ephemeral scratch workspace outside this codebase — **none of it is committed to this repository**, and there is no `package.json`, test runner config, or CI pipeline of any kind in the project itself (confirmed: no `*test*` files, no `package.json`, no CI config anywhere in the repo). A buyer inheriting this codebase inherits **zero automated regression protection** against a future change silently breaking an existing feature.
- **No README reflects the current feature set.** The repository's own `README.md` still describes the very earliest version of the project ("A clickable demo prototype… Screens: Put-Away, Search, All Locations") — it predates every feature documented in this entire audit (Manage Products, Manage Users, Delivery Import, Stock Take, Barcode Labels, Pallet Labels, the entire PB Wholesale/Pallet Pal rebrand, dashboards, and more). This should be rewritten before this codebase is handed to any new developer or customer, since it is actively misleading about what the system does today.

### 14.5 Data-integrity risks worth naming explicitly

- Two browser tabs on the same instance, open at once, can both write to `localStorage` independently with no locking or conflict detection — the second write silently wins, with no merge and no warning.
- There is no schema versioning/migration system beyond the one-off seeded-flag version bump (§7.12, §13.4) — if a future field were added to an existing record type, there's no established pattern yet for migrating already-stored records that lack it; every `load(key, fallback)` call in `js/store.js` would silently return objects missing the new field.
- `localStorage`'s quota being hit (large pallet-batch history with many stored source PDFs, for example) would cause writes to start failing; the code has no `try/catch` around any `localStorage.setItem` call, so a quota-exceeded error would surface as an unhandled JavaScript exception rather than a graceful warning to the user.

### 14.6 Minor confirmed defects (found during this audit's final verification pass)

- **Missing favicon.** Neither `index.html` nor `pb/index.html` declares a `<link rel="icon">`, and no favicon file exists anywhere in the repository. Every browser automatically requests `/favicon.ico` on page load regardless; with nothing there to serve, this produces a harmless but real 404 console error on every single page load of either instance — confirmed directly during this project's own testing, where it appeared consistently in browser console logs across dozens of automated test runs. Trivial to fix (add any small icon file and a `<link>` tag) but worth fixing before any client-facing demo, since an open browser console showing a 404 on a polished product is an easy, needless thing for a technical evaluator to notice.
- **A small naming leftover in the code, not a functional bug:** `Store.getGateStats()` (`js/store.js`) is named after its original purpose — feeding a "live stats" widget that used to sit on the Portal Gate (login screen) showing total locations and items in stock. That widget was deliberately removed from the login screen during development (at the business's request, to keep the login page clean), but the underlying function was simply repurposed to feed two of the Dashboard's stat tiles (F27) instead of being renamed or duplicated. It works correctly either way; the name is just a harmless trace of the feature's history for anyone reading the code cold.

### 14.7 Summary judgement

Everything documented in §2–§10 of this audit is real, working, and verifiable in the code — this is not a mockup or a slide deck, it is a genuinely functional application that correctly models a real warehouse workflow end-to-end for a single-device, single-company-at-a-time use case. The gaps above are not about whether the *idea* works; they are specifically and only about the distance between "a convincing, fully-clickable prototype built around one real business's data" and "a production multi-tenant SaaS product ready to sell to and be relied upon by other businesses." That distance is real, it is the entire subject of §15, and it should never be minimised in a sales conversation — see §16 for how to talk about it honestly and still make the sale.

## 15. Roadmap Suggestions

Ranked by a combined read of impact (how much it moves the product toward being sellable/usable by other businesses) and effort (rough relative engineering size). This is a product/engineering judgement call, not a line-item quote.

### Tier 1 — Highest impact, needed before any real multi-user customer deployment

1. **Real backend + database, replacing `localStorage`.** *Impact: transformative. Effort: large.* This single change unlocks multi-device access, backups, real security, and is a prerequisite for almost everything else on this list. Without it, Pallet Pal can only ever be a single-terminal tool.
2. **Real authentication, tied to the existing Manage Users accounts.** *Impact: very high. Effort: medium*, once a backend exists (item 1) — the UI and account-management workflow (F33–F35) are already built and just need to be wired to something that actually checks the password.
3. **A "Manage Locations" screen** to replace the hardcoded aisle/level generator. *Impact: very high* — this is what turns "needs a developer per customer" into "any customer can self-serve their own warehouse layout." *Effort: medium.*
4. **Generalise the PB Wholesale seed data** away from a direct copy of Per4m's catalogue, so the two-brand demo genuinely represents two different businesses rather than one business twice. *Impact: high for credibility in a sales demo specifically. Effort: small* (it's a data-entry task, not an engineering one).

### Tier 2 — High impact, meaningfully extends real-world usefulness

5. **Real camera-based barcode/QR scanning**, replacing the simulated "Scan QR Label" button. *Impact: high — this is the single feature most likely to visibly disappoint a buyer once they realise it's simulated. Effort: medium* (browser `BarcodeDetector` API or a JS scanning library, plus camera-permission UX).
6. **Real document extraction for Delivery Import**, replacing the random mock extraction. *Impact: high for the same reason as #5. Effort: medium-to-large*, depending on whether a commercial document-AI API is integrated or a bespoke parser (like the Pallet Labels PDF importer already proves is possible) is built per common delivery-note format.
7. **CSV/Excel export** of Stock Take and Search results, at minimum. *Impact: high — the most commonly requested "basic" feature a real warehouse team will ask for on day one. Effort: small.*
8. **A removed-stock / audit-trail history screen**, surfacing the `Removed` entries that already exist in storage but are currently invisible. *Impact: medium-high (compliance/traceability value). Effort: small* — the data already exists; this is a new read-only screen, not a data-model change.
9. **A real picking/despatch workflow** (pick lists, order references, a "despatched" state). *Impact: high for operations that need outbound order tracking, not just inbound/location tracking. Effort: large* — this is a genuinely new feature area, not an extension of an existing one.

### Tier 3 — Valuable polish and hardening

10. **Hashed password storage** (even ahead of full real authentication) — a quick, important security improvement. *Impact: medium (risk reduction). Effort: small.*
11. **A live/real product-catalogue sync** (Shopify/ERP export or API), replacing the hardcoded "Refresh Products" snapshot. *Impact: medium — valuable for any customer whose product range changes often. Effort: medium*, dependent on what system(s) a given customer actually uses.
12. **An automated test suite committed to this repository**, covering at minimum the core Put-Away → Search → Remove workflow, Pallet Label generation's total-matching logic, and the user-account sync. *Impact: medium (protects against regressions as the product grows). Effort: medium* — this project's own development process has already proven these tests are straightforward to write (they were written and run repeatedly throughout development, just never committed — see §14.4); committing an equivalent suite is mostly a matter of relocating and formalising that existing practice.
13. **A rewritten `README.md`** reflecting the system as it exists today. *Impact: small-but-easy win for onboarding a new developer. Effort: trivial.*
14. **Dedicated thermal label-printer protocol support** (e.g. Zebra ZPL) if customer feedback shows a strong preference for dedicated label hardware over "print to any printer." *Impact: depends entirely on target customer base. Effort: medium.*
15. **Schema versioning/migration handling** for `localStorage` records, and defensive error handling around storage-quota failures. *Impact: low-probability but high-severity if hit. Effort: small-medium.*

### Tier 4 — Nice-to-have, lower urgency

16. Historical/trend reporting (stock levels over time, delivery volume trends) — needs the audit-trail work (#8) as a foundation first.
17. A formal mobile/tablet usability pass with real device testing, beyond the current untested-but-implemented responsive CSS (§11.4).
18. Multi-warehouse/multi-site support (today's data model assumes one set of locations per brand instance, not per physical site).
19. Linking the "Logged By" staff list to actual User accounts (§5.3), so attribution and login identity are the same concept rather than two parallel, unconnected lists.

---

## 16. Sales Positioning

### 16.1 Ideal customer profile

- A warehouse or 3PL operation currently running on spreadsheets, paper pick sheets, or a mix of both, with **noticeable pain specifically around "where is it" and "did we print the right labels."**
- Small-to-mid headcount (a handful to a few dozen staff) operating from **a single physical site** — the current single-device-at-a-time data model (§11.1, §14.4) makes this, honestly, the only size of customer this specific build is ready for today without the Tier 1 roadmap work.
- A business that generates its own pallet/product labels in-house and currently does so by hand or in a general-purpose document editor (Word/Excel) — this is the single sharpest, most immediately demonstrable value proposition in the whole product (§2.4, §2.5, F22).
- A business open to being an early/design partner, since realistically every new customer today needs some bespoke setup (their own location layout, their own catalogue, their own packing-slip format if PDF import is wanted) rather than true self-service onboarding (§12, §14.1).
- **Not yet** a good fit: any business requiring multiple simultaneous terminals/devices sharing live data, any business with compliance requirements around audit trails or data retention, or any business expecting enterprise WMS features (EDI, carrier integration, multi-warehouse).

### 16.2 Key selling points

1. **It already works, end-to-end, today** — this is not a pitch deck or a set of wireframes; every workflow in §6 can be clicked through live, right now, by a prospective customer.
2. **The one feature that will sell itself in a demo:** the Pallet Label Generator's exact-total validation (F22) — show a real packing slip being turned into correctly-split, correctly-counted pallet labels in under a minute, with the system physically refusing to print anything until the numbers are provably right. This is the single most concrete "we will stop you shipping a miscounted pallet" proof point available.
3. **Zero infrastructure cost to pilot.** No server to provision, no database to administer, no per-seat software to install — a pilot can start on literally any device with a browser.
4. **Proven brand-flexibility.** The Per4m/PB Wholesale duplication (§1, F41) is a live, clickable demonstration that the same product can be re-skinned and run as two (or more) independently-branded instances — a direct answer to "could you white-label this for us" or "we run two divisions."
5. **Built-in honesty as a trust signal.** The permanent on-screen "Prototype" banner and this document's own candour about what's simulated (§14) can be reframed, correctly, as a sign of a vendor who won't oversell — useful specifically against competitors who oversell AI/automation capabilities they don't really have.

### 16.3 Likely objections and how to answer them

| Objection | Honest answer |
|---|---|
| "Does this work across multiple computers/warehouse tablets at once?" | Not yet — today, each device holds its own separate copy of the data. This is the #1 item on the roadmap (§15, Tier 1) and the right question to ask before committing budget; a paid pilot/build phase would prioritise this first. |
| "Is the barcode scanning real?" | Not yet — it's currently simulated to prove out the workflow; real camera-based scanning is a well-understood, medium-effort addition (§15, #5), not a research problem. |
| "Does it read our actual delivery notes automatically?" | The pallet-label side genuinely parses real PDF packing slips today (F20) — that's real, working document parsing, not a simulation. The *delivery-import* side (inbound goods) is currently a simulated demo of the same idea and would need the same kind of real parsing work built for your specific document format (§15, #6). |
| "What happens if the browser data gets cleared / the laptop breaks?" | Today, that data is gone — there is no backup. This is exactly why the backend/database rebuild (§15, #1) is the right next investment before this is relied on for anything business-critical. |
| "Is our data secure?" | Not yet to a standard appropriate for real passwords or sensitive data — passwords are currently stored in plain text and there's no real login enforcement. This is deliberately one of the fastest, cheapest items to fix (§15, #10) and should be treated as a non-negotiable pre-launch item, not a "someday." |
| "Can it handle our warehouse layout?" | Today's layout (10 aisles × 2 racking + 2 bay levels) is a placeholder grid, not yours specifically. A Manage Locations screen (§15, #3) is the fix, and until it exists, your real layout would need to be hand-coded in for you as part of onboarding. |
| "How is this different from [competitor WMS]?" | See §16.4 below — lead with cost, speed-to-pilot, and the purpose-built label workflow; be upfront that this doesn't yet match an established WMS on breadth of features, multi-site support, or integrations. |

### 16.4 Comparison to competitor WMS products (qualitative, no specific product names claimed from the codebase — this is market positioning, not a feature audit of any named competitor)

- **Established commercial WMS platforms** typically offer: multi-site support, EDI/carrier integrations, barcode-scanner hardware support, enforced role-based permissions, audit trails, and vendor-managed hosting/backups/security — at a correspondingly higher price point, implementation timeline (often months), and ongoing per-seat/per-site licensing cost.
- **Pallet Pal's honest current position** is closer to **"a very good internal tool that outgrew spreadsheets"** than a WMS competitor — its strength is depth in a few specific workflows (pallet labelling with validated totals, barcode generation, location search) done well and fast, not breadth across every warehouse function.
- **The right framing in a sales conversation** is not "this replaces [Competitor]" but **"this replaces your spreadsheet today, cheaply and immediately, and can grow into a [Competitor]-equivalent system as the roadmap in §15 is funded and built"** — selling the trajectory honestly, not pretending the destination has already been reached.

### 16.5 Suggested pricing models

Offered as standard SaaS/software pricing patterns a business in this position typically considers — not a specific recommended price point, which would need real market research and cost data this audit has no access to:

- **Per-site licence** — fits the current single-device-data-model reality well today (§11.7): price per physical warehouse/site, since that's realistically the natural unit of deployment while the system remains single-tenant per instance.
- **Per-user/per-seat** — becomes the more natural model once the Tier 1 roadmap (real backend, multi-device sync, real authentication) is delivered, since "seats" only means something once accounts are actually enforced logins rather than decorative records.
- **One-off licence + optional support/maintenance retainer** — a reasonable model for the current prototype stage specifically, sold honestly as "a working foundation you own outright, built further to your specification" — since every real customer today needs some bespoke onboarding work anyway (§14.1), framing that work as a one-off customisation/implementation fee on top of a licence is more honest than pretending it's a self-service SaaS signup today.
- **Tiered by feature depth** — e.g. a base tier covering Put-Away/Search/Locations/Barcode Labels, with Pallet Label Generation, Delivery Import, and multi-brand support (the more operationally complex, higher-value features) as a higher tier — reflecting that these aren't equally expensive to build or equally universal in need.

Whichever model is chosen, this document's recommendation is to **price the current build as what it is (a strong single-site prototype) and price the Tier 1 roadmap work separately and explicitly** as the cost of making it a genuine multi-tenant product — bundling the two risks either underpricing the real engineering work still needed, or overpricing what exists today.

---

## 17. Glossary

Terms used throughout the app and this document, in plain English.

- **Active entry** — a stock entry whose status is not `Removed`; i.e. stock that's still considered present somewhere in the warehouse (§7.3).
- **Backend** — the server/database side of a software system; Pallet Pal currently has none (§11.1).
- **Barcode (Code 128)** — the specific 1D (linear) barcode format Pallet Pal's Barcode Label Generator produces, encoding a product's EAN (§8.2).
- **Batch code** — a supplier- or business-assigned code identifying a specific production batch of a product, used for traceability.
- **Best Before (BBD/BBE)** — the expiry/best-before date of a batch, stored and displayed as `MM/YY`.
- **Bundled Artifact** — a special single-HTML-file packaged version of the app used for quick demo sharing during this project's development; not the normal deployment shape (§11.2, F41).
- **Despatch** — the outbound shipping stage of warehouse operations; not currently a tracked workflow in Pallet Pal (§3.6).
- **EAN (European Article Number)** — the internationally registered 13-digit barcode number for a product; validated by a checksum ("check digit") the system can verify (§2.6, §8.2).
- **Employee Portal** — one of the two login roles; the more restricted tab set (§5.1).
- **Grand Total** — the total unit quantity stated on a packing slip, which every pallet label batch's individual pallet quantities must sum to exactly before anything can be generated (F22).
- **GS1** — the organisation that issues/standardises EAN barcode numbers; referenced in the UI as the source of a "13-digit GS1 number."
- **localStorage** — a built-in browser feature that lets a website store small amounts of data on the visitor's own device, persisting between visits; this is Pallet Pal's entire data storage mechanism today (§7, §11.1).
- **Manager Portal** — the fuller-access login role (§5.1).
- **Packing slip** — the document (usually a PDF) listing what's in a delivery or shipment — product lines, batch codes, quantities, and a grand total; the input to the Pallet Label Generator (F20) and (conceptually) Delivery Import (F1).
- **Pallet limit / pallet size limit** — the maximum number of units of a given product size that may go on one physical pallet; used to split a large quantity into the correct number of pallets (F22, F26).
- **Per4m** — the primary branded instance of this application, modelled on a real nutrition-supplement warehouse business (§1).
- **PB Wholesale** — the second, blue-themed branded instance of the same application, proving the product can be duplicated/resold under a different brand (§1, §13.2).
- **Picking bay** — a ground-level floor location (as opposed to a racking/shelving location) used for active picking stock, tracked as its own separate set of location codes (§7.2).
- **Portal** — this document's/app's term for a login role (Employee or Manager), not a physical doorway.
- **Put-away** — the act (and the screen) of physically placing received stock into a location and recording that in the system (F6).
- **QR code** — the square, 2D barcode format used on Pallet Pal's put-away and pallet labels, capable of encoding more data than a 1D barcode (§8.2, §8.3).
- **Racking** — shelved storage locations (as opposed to ground-level picking bays), tracked as their own separate set of location codes (§7.2).
- **SKU (Stock Keeping Unit)** — a business's own internal product code, distinct from the externally-registered EAN.
- **Stock entry** — one record of a specific batch/quantity of a product sitting at a specific location; the core data record of the whole system (§7.3).
- **Stock take** — a full physical/manual count and reconciliation of all current stock; also the name of the screen that prints a snapshot to support doing one (F28).
- **Variant** — an optional extra descriptor on a barcode label (e.g. a colour or pack configuration) beyond the core product description.

---

*End of audit. This document was produced by reading every file in the project's source tree (`index.html`, `pb/index.html`, every file under `js/` and `pb/js/`, `css/styles.css` and `pb/css/styles.css`, `README.md`, `.gitignore`) and cross-checking every feature claim directly against that code, including a full diff between the Per4m and PB Wholesale trees to verify exactly which parts are shared logic versus brand-specific differences. No feature described here was inferred, assumed, or invented without a corresponding file-and-function reference.*

