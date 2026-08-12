// Local, in-browser data store for the prototype.
// Backed by localStorage so the demo data survives page reloads.
// A real build would replace this with an API-backed database.

const Store = (() => {
  const KEYS = {
    products: 'per4m_products',
    locations: 'per4m_locations',
    pickingBays: 'per4m_picking_bays',
    stockEntries: 'per4m_stockEntries',
    staff: 'per4m_staff',
    pendingDeliveryItems: 'per4m_pending_delivery_items',
    deliveries: 'per4m_deliveries',
    // Bumped to v2 to force a reseed that includes picking bays, product
    // minimum stock levels, and stock entry "logged at" timestamps.
    seeded: 'per4m_seeded_v2',
  };

  function load(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function seedIfNeeded() {
    if (localStorage.getItem(KEYS.seeded)) return;

    const staff = STAFF_SEED.slice();
    save(KEYS.staff, staff);

    const products = PRODUCT_SEED.map((p) => ({
      id: uid('prod'),
      name: p.name,
      sku: p.sku || '',
      createdBy: '',
      dateAdded: todayISO(),
      qtyRange: p.qtyRange,
    }));
    save(KEYS.products, products);

    const locationCodes = generateLocationCodes();
    save(KEYS.locations, locationCodes);

    const pickingBayCodes = generatePickingBayCodes();
    save(KEYS.pickingBays, pickingBayCodes);

    function makeEntry(locationCode) {
      const product = randomChoice(products);
      const [min, max] = product.qtyRange || [5, 60];
      const { month, year } = randomBestBefore();
      return {
        id: uid('stock'),
        productId: product.id,
        batchCode: randomBatchCode(),
        bestBefore: formatBestBefore(month, year),
        quantity: randomInt(min, max),
        locationCode,
        loggedBy: randomChoice(staff),
        status: 'In Stock',
        loggedAt: randomLoggedAt(),
      };
    }

    const occupiedCount = randomInt(12, 15);
    const chosenLocations = shuffle(locationCodes).slice(0, occupiedCount);

    const pickingBayOccupiedCount = randomInt(3, 5);
    const chosenPickingBays = shuffle(pickingBayCodes).slice(0, pickingBayOccupiedCount);

    const stockEntries = [...chosenLocations.map(makeEntry), ...chosenPickingBays.map(makeEntry)];
    save(KEYS.stockEntries, stockEntries);

    localStorage.setItem(KEYS.seeded, 'true');
  }

  function getProducts() {
    return load(KEYS.products, []);
  }

  function addProduct({ name, sku, createdBy }) {
    const products = getProducts();
    const product = {
      id: uid('prod'),
      name: name.trim(),
      sku: (sku || '').trim(),
      createdBy: (createdBy || '').trim(),
      dateAdded: todayISO(),
    };
    products.push(product);
    save(KEYS.products, products);
    return product;
  }

  function findProducts(query) {
    const q = query.trim().toLowerCase();
    const products = getProducts();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }

  // Updates a product's name/SKU in place. Stock entries only ever store a
  // productId, so anywhere that joins against the catalogue picks up the
  // change immediately — no need to touch existing stock entries.
  function updateProduct(id, { name, sku }) {
    const products = getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return null;
    products[index] = {
      ...products[index],
      name: name.trim(),
      sku: (sku || '').trim(),
    };
    save(KEYS.products, products);
    return products[index];
  }

  // Number of non-removed stock entries currently referencing this product —
  // i.e. how many bays it's actually sitting in right now.
  function getActiveEntryCountForProduct(id) {
    return getActiveEntries().filter((e) => e.productId === id).length;
  }

  // Deletes a product only if no active stock entries reference it. Returns
  // { deleted: true } on success, or { deleted: false, activeCount } if the
  // product is still in use somewhere.
  function deleteProduct(id) {
    const activeCount = getActiveEntryCountForProduct(id);
    if (activeCount > 0) {
      return { deleted: false, activeCount };
    }
    const products = getProducts().filter((p) => p.id !== id);
    save(KEYS.products, products);
    return { deleted: true };
  }

  function getStaff() {
    return load(KEYS.staff, STAFF_SEED.slice());
  }

  // Adds a new staff name (deduped case-insensitively) and persists it for
  // the rest of the session. Returns the canonical name to select.
  function addStaffMember(name) {
    const trimmed = name.trim();
    const staff = getStaff();
    const existing = staff.find((n) => n.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    staff.push(trimmed);
    save(KEYS.staff, staff);
    return trimmed;
  }

  function getLocations() {
    return load(KEYS.locations, []);
  }

  function getPickingBays() {
    return load(KEYS.pickingBays, []);
  }

  // Racking + picking bays combined — used by any location picker (Put-Away,
  // swap location) since picking bays are just another set of locations
  // staff can log stock into. All Locations stays racking-only via
  // getLocations()/getLocationOverview(); Bay Search stays picking-bay-only
  // via getPickingBays()/searchPickingBayStock().
  function getAllLocationCodes() {
    return [...getLocations(), ...getPickingBays()];
  }

  function findLocations(query) {
    const q = query.trim().toLowerCase();
    const codes = getAllLocationCodes();
    if (!q) return codes;
    return codes.filter((code) => code.toLowerCase().includes(q));
  }

  // Set of every location code (racking or picking bay) with at least one
  // active stock entry — used to show Occupied/Empty in location pickers.
  function getOccupiedLocationCodes() {
    return new Set(getActiveEntries().map((e) => e.locationCode));
  }

  function getStockEntries() {
    return load(KEYS.stockEntries, []);
  }

  function addStockEntry(entry) {
    const entries = getStockEntries();
    const stockEntry = {
      id: uid('stock'),
      productId: entry.productId,
      batchCode: entry.batchCode.trim(),
      bestBefore: entry.bestBefore,
      quantity: Number(entry.quantity),
      locationCode: entry.locationCode,
      loggedBy: entry.loggedBy,
      status: 'In Stock',
      loggedAt: Date.now(),
    };
    entries.push(stockEntry);
    save(KEYS.stockEntries, entries);
    return stockEntry;
  }

  function getActiveEntries() {
    return getStockEntries().filter((e) => e.status !== 'Removed');
  }

  function getStockEntryById(id) {
    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));
    const entry = getStockEntries().find((e) => e.id === id);
    if (!entry) return null;
    return { ...entry, product: productById.get(entry.productId) || null };
  }

  function updateStockEntry(id, changes) {
    const entries = getStockEntries();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return null;
    entries[index] = { ...entries[index], ...changes };
    save(KEYS.stockEntries, entries);
    return entries[index];
  }

  function swapEntryLocation(id, newLocationCode) {
    return updateStockEntry(id, { locationCode: newLocationCode });
  }

  // Subtracts `amount` from the entry's quantity. Reaching zero is treated
  // as a full removal (status 'Removed'); otherwise the entry stays in place
  // with status 'Partially Removed'.
  function reduceEntryQuantity(id, amount) {
    const entry = getStockEntries().find((e) => e.id === id);
    if (!entry) return null;
    const remaining = entry.quantity - amount;
    if (remaining <= 0) {
      return updateStockEntry(id, { quantity: 0, status: 'Removed' });
    }
    return updateStockEntry(id, { quantity: remaining, status: 'Partially Removed' });
  }

  function removeEntryCompletely(id) {
    return updateStockEntry(id, { status: 'Removed' });
  }

  // Returns location rows enriched with occupancy status + a summary of contents.
  function getLocationOverview() {
    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));
    const entries = getActiveEntries();

    return getLocations().map((code) => {
      const entriesHere = entries.filter((e) => e.locationCode === code);
      return {
        code,
        status: entriesHere.length > 0 ? 'Occupied' : 'Empty',
        entries: entriesHere.map((e) => ({
          ...e,
          product: productById.get(e.productId) || null,
        })),
      };
    });
  }

  // Product / batch code / SKU search across all active stock entries.
  function searchStock(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));

    return getStockEntries()
      .map((e) => ({ ...e, product: productById.get(e.productId) || null }))
      .filter((e) => {
        if (!e.product) return false;
        return (
          e.product.name.toLowerCase().includes(q) ||
          e.product.sku.toLowerCase().includes(q) ||
          e.batchCode.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
  }

  // Active stock entries sitting in picking bays whose bay code matches the
  // query — "what should currently be in this picking bay".
  function searchPickingBayStock(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const pickingBaySet = new Set(getPickingBays());
    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));

    return getActiveEntries()
      .filter((e) => pickingBaySet.has(e.locationCode) && e.locationCode.toLowerCase().includes(q))
      .map((e) => ({ ...e, product: productById.get(e.productId) || null }))
      .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
  }

  // Full snapshot of current stock (racking + picking bays) for the Manager
  // portal's Stock Take list.
  function getStockTakeRows() {
    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));

    return getActiveEntries()
      .map((e) => ({ ...e, product: productById.get(e.productId) || null }))
      .sort((a, b) => a.locationCode.localeCompare(b.locationCode));
  }

  // Stock that has arrived (confirmed from a Delivery Import) but hasn't
  // been racked yet. Items are removed once a matching Put-Away QR scan is
  // actually saved — not just scanned — so an abandoned form doesn't lose
  // the item.
  function getPendingDeliveryItems() {
    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));
    return load(KEYS.pendingDeliveryItems, []).map((item) => ({
      ...item,
      product: productById.get(item.productId) || null,
    }));
  }

  function addPendingDeliveryItems(items) {
    const existing = load(KEYS.pendingDeliveryItems, []);
    const newItems = items.map((item) => ({
      id: uid('delivery'),
      productId: item.productId,
      batchCode: item.batchCode.trim(),
      bestBefore: item.bestBefore,
      quantity: Number(item.quantity),
    }));
    save(KEYS.pendingDeliveryItems, [...existing, ...newItems]);
    return newItems;
  }

  function removePendingDeliveryItem(id) {
    const existing = load(KEYS.pendingDeliveryItems, []);
    save(KEYS.pendingDeliveryItems, existing.filter((item) => item.id !== id));
  }

  // Used by the Put-Away "Scan QR Label" simulation to pick which pending
  // delivery item the scan "finds".
  function getRandomPendingDeliveryItem() {
    const items = getPendingDeliveryItems();
    if (!items.length) return null;
    return randomChoice(items);
  }

  // Default name for a newly-confirmed delivery: the uploaded filename if
  // one exists, otherwise a date-based fallback ("Delivery – 12 Aug 2026").
  function defaultDeliveryName(filename) {
    if (filename) return filename;
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `Delivery – ${day} ${month} ${year}`;
  }

  // Permanent history of confirmed deliveries, independent of
  // pendingDeliveryItems — a delivery's record (and its labels) stays
  // browsable even after every item in it has been put away and removed
  // from the pending list. `importedAt` doubles as the "date processed"
  // timestamp shown in the UI, since that's exactly when confirming
  // generates the labels.
  function addDeliveryRecord({ filename, items }) {
    const deliveries = load(KEYS.deliveries, []);
    const record = {
      id: uid('deliveryrec'),
      filename: filename || '',
      name: defaultDeliveryName(filename),
      importedAt: Date.now(),
      items,
    };
    deliveries.push(record);
    save(KEYS.deliveries, deliveries);
    return record;
  }

  function getDeliveryRecords() {
    const products = getProducts();
    const productById = new Map(products.map((p) => [p.id, p]));
    return load(KEYS.deliveries, [])
      .map((d) => ({
        ...d,
        items: d.items.map((item) => ({ ...item, product: productById.get(item.productId) || null })),
      }))
      .sort((a, b) => b.importedAt - a.importedAt);
  }

  function getDeliveryRecordById(id) {
    return getDeliveryRecords().find((d) => d.id === id) || null;
  }

  function renameDeliveryRecord(id, name) {
    const deliveries = load(KEYS.deliveries, []);
    const index = deliveries.findIndex((d) => d.id === id);
    if (index === -1) return null;
    const trimmed = name.trim();
    deliveries[index] = { ...deliveries[index], name: trimmed || deliveries[index].name };
    save(KEYS.deliveries, deliveries);
    return deliveries[index];
  }

  // Removes only the historical delivery record itself. Stock already put
  // away via labels from this delivery is a separate Stock Entry and is
  // untouched; any not-yet-scanned pending delivery items are left alone
  // too, since they represent physical stock that has actually arrived.
  function deleteDeliveryRecord(id) {
    const deliveries = load(KEYS.deliveries, []).filter((d) => d.id !== id);
    save(KEYS.deliveries, deliveries);
  }

  // Small live snapshot shown on the portal gate so it feels connected to
  // real data rather than a static splash screen.
  function getGateStats() {
    return {
      totalLocations: getAllLocationCodes().length,
      itemsInStock: getActiveEntries().reduce((sum, e) => sum + e.quantity, 0),
    };
  }

  seedIfNeeded();

  return {
    getProducts,
    addProduct,
    findProducts,
    updateProduct,
    getActiveEntryCountForProduct,
    deleteProduct,
    getStaff,
    addStaffMember,
    getLocations,
    getPickingBays,
    findLocations,
    getOccupiedLocationCodes,
    getStockEntries,
    addStockEntry,
    getStockEntryById,
    swapEntryLocation,
    reduceEntryQuantity,
    removeEntryCompletely,
    getLocationOverview,
    searchStock,
    searchPickingBayStock,
    getStockTakeRows,
    getGateStats,
    getPendingDeliveryItems,
    addPendingDeliveryItems,
    removePendingDeliveryItem,
    getRandomPendingDeliveryItem,
    addDeliveryRecord,
    getDeliveryRecords,
    getDeliveryRecordById,
    renameDeliveryRecord,
    deleteDeliveryRecord,
  };
})();
