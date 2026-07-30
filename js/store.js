// Local, in-browser data store for the prototype.
// Backed by localStorage so the demo data survives page reloads.
// A real build would replace this with an API-backed database.

const Store = (() => {
  const KEYS = {
    products: 'per4m_products',
    locations: 'per4m_locations',
    stockEntries: 'per4m_stockEntries',
    seeded: 'per4m_seeded_v1',
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

    const occupiedCount = randomInt(12, 15);
    const chosenLocations = shuffle(locationCodes).slice(0, occupiedCount);

    const stockEntries = chosenLocations.map((locationCode) => {
      const product = randomChoice(products);
      const [min, max] = product.qtyRange || [5, 60];
      return {
        id: uid('stock'),
        productId: product.id,
        batchCode: randomBatchCode(),
        dateLogged: randomRecentDate(),
        quantity: randomInt(min, max),
        locationCode,
        loggedBy: randomChoice(STAFF_NAMES),
        status: 'In Stock',
      };
    });
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

  function getLocations() {
    return load(KEYS.locations, []);
  }

  function findLocations(query) {
    const q = query.trim().toLowerCase();
    const locations = getLocations();
    if (!q) return locations;
    return locations.filter((code) => code.toLowerCase().includes(q));
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
      dateLogged: entry.dateLogged,
      quantity: Number(entry.quantity),
      locationCode: entry.locationCode,
      loggedBy: entry.loggedBy,
      status: 'In Stock',
    };
    entries.push(stockEntry);
    save(KEYS.stockEntries, entries);
    return stockEntry;
  }

  function getActiveEntries() {
    return getStockEntries().filter((e) => e.status !== 'Removed');
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

  seedIfNeeded();

  return {
    getProducts,
    addProduct,
    findProducts,
    getLocations,
    findLocations,
    getStockEntries,
    addStockEntry,
    getLocationOverview,
    searchStock,
  };
})();
