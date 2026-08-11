// Seed data for the per4m warehouse prototype.
// Everything here is placeholder/demo data used to pre-populate the local store.

const STAFF_SEED = ['Ricky', 'Nick', 'Leighton', 'Tom'];

// Quantity range is varied a bit per product "type" so the seeded data looks
// realistic (boxes come in bigger counts than powder tubs, for example).
const PRODUCT_SEED = [
  { name: 'Banana Whey 2kg', sku: 'PWD-BW-2KG', qtyRange: [10, 40] },
  { name: 'Chocolate Chip Pancakes 1.2kg', sku: 'FOOD-CCP-1.2KG', qtyRange: [10, 35] },
  { name: 'Creatine Unflavoured 400g', sku: 'PWD-CRT-400G', qtyRange: [15, 50] },
  { name: 'Hydrate Raspberry Cherry 210g', sku: 'PWD-HYD-210G', qtyRange: [15, 50] },
  { name: 'Isolate White Chocolate Hazelnut 900g', sku: 'PWD-ISO-900G', qtyRange: [10, 35] },
  { name: 'Black Lid Per4m Shakers', sku: '', qtyRange: [20, 60] },
  { name: 'Pre Watermelon Lemonade 5 Serve', sku: 'PWD-PRE-5SRV', qtyRange: [20, 60] },
  { name: 'Glycersize Powder', sku: 'PWD-GLY-BULK', qtyRange: [10, 30] },
  { name: 'MRP Cookies and Cream 1.8kg', sku: 'PWD-MRP-1.8KG', qtyRange: [10, 30] },
  { name: 'COR Sticky Toffee 450g', sku: 'PWD-COR-450G', qtyRange: [15, 45] },
  { name: 'Eco Boxes', sku: '', qtyRange: [30, 100] },
  { name: 'Skinny Boxes', sku: '', qtyRange: [30, 100] },
];

// Racking locations follow the pattern A0<aisle><level>, aisles 01-10, levels c/d only.
function generateLocationCodes() {
  const codes = [];
  for (let aisle = 1; aisle <= 10; aisle++) {
    const aisleNum = String(aisle).padStart(2, '0');
    codes.push(`A${aisleNum}c`);
    codes.push(`A${aisleNum}d`);
  }
  return codes;
}

// Floor/picking bays use the same A0<aisle><level> pattern as racking, but
// levels a/b (ground-level picking) instead of c/d. Separate from the racking
// system — looked up via the Bay Search screen rather than All Locations.
function generatePickingBayCodes() {
  const codes = [];
  for (let aisle = 1; aisle <= 10; aisle++) {
    const aisleNum = String(aisle).padStart(2, '0');
    codes.push(`A${aisleNum}a`);
    codes.push(`A${aisleNum}b`);
  }
  return codes;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomBatchCode() {
  return String(randomInt(10000, 99999));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Best-before month/year options for the Put-Away dropdowns: numeric months
// 01-12, and years as the current year through +6 years (last 2 digits).
function bestBeforeMonthOptions() {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(String(m).padStart(2, '0'));
  }
  return months;
}

function bestBeforeYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= 6; i++) {
    years.push(String(currentYear + i).slice(-2));
  }
  return years;
}

function formatBestBefore(month, year) {
  return `${month}/${year}`;
}

// Random best-before 3-36 months out, as { month, year } (year = last 2 digits).
function randomBestBefore() {
  const offsetMonths = randomInt(3, 36);
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return {
    month: String(d.getMonth() + 1).padStart(2, '0'),
    year: String(d.getFullYear()).slice(-2),
  };
}

// Returns an epoch-ms timestamp 0-60 days in the past, so seeded entries have
// a spread of realistic "date logged" values for the Search screen's sort.
function randomLoggedAt() {
  return Date.now() - randomInt(0, 60) * 86400000;
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
