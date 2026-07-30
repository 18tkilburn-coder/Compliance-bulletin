// Seed data for the per4m warehouse prototype.
// Everything here is placeholder/demo data used to pre-populate the local store.

const STAFF_NAMES = ['Alex', 'Sam', 'Jordan', 'Chris', 'Taylor'];

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
// "a" and "b" levels are ground-level picking locations and are intentionally excluded.
function generateLocationCodes() {
  const codes = [];
  for (let aisle = 1; aisle <= 10; aisle++) {
    const aisleNum = String(aisle).padStart(2, '0');
    codes.push(`A${aisleNum}c`);
    codes.push(`A${aisleNum}d`);
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

// Random date within roughly -30 to +14 days of today, formatted as YYYY-MM-DD.
function randomRecentDate() {
  const offsetDays = randomInt(-30, 14);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
