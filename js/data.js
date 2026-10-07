// Seed data for the per4m warehouse prototype.
// Everything here is placeholder/demo data used to pre-populate the local store.

const STAFF_SEED = ['Ricky', 'Nick', 'Leighton', 'Tom'];

// Full PER4M product catalogue, transcribed from the PER4M Master Product
// Catalogue reference doc (7 Oct 2026) the user supplied, covering every
// product family and flavour/variant it lists, plus standalone items
// (accessories, capsules, bundles). That doc is a public-catalogue master,
// not a Shopify/ERP export, so `sku`/`ean` are intentionally left blank
// here — never guessed — except the two Per4m-branded items at the end,
// which carry real EAN/SKU pairs taken from the Barcode/Pallet Label
// Generator spec docs. `qtyRange` is a reasonable per-category guess for
// seeding demo stock, not sourced data. The next real step for warehouse
// use is importing the Shopify/ERP variant export so each flavour/size has
// an exact SKU, EAN, and barcode.
const PRODUCT_SEED = [
  { name: 'Advanced Protein Blend - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Sticky Toffee Pudding', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - White Chocolate Hazelnut', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Chocolate Brownie Batter', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Cinnamon Donut', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Carrot Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Cookie Dough', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Cookies & Cream', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Strawberry Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Cherry Cola Float (Limited Edition)', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend - Vanilla Cola Float (Limited Edition)', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Apple Strudel', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Baklava', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Banana Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Birthday Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Blueberry Muffin', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Carrot Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Cereal Milk', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Cherry Bakewell', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate & Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate Brownie Batter', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate Caramel', sku: '', qtyRange: [10, 40] },
  { name: "Whey Protein - Chocolate Egg'splosion", sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate Mochaccino', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate Orange', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate Peanut Butter', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocolate Pistachio', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Chocotella / Choconut', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Cinnamon Donut', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Coconut Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Cookie Dough', sku: '', qtyRange: [10, 40] },
  { name: "Whey Protein - Cookies 'N Creme", sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Curry (Limited Edition)', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Double Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Dubai Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Fluffy Marshmallow', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - French Toast Maple Swirl', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Jammy Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Key Lime Pie', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Lemon Cheesecake', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Minty Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Neapolitan Ice Cream', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Peachy Cream', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Peanut Butter & Jelly', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Raspberry White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Red Velvet Cake', sku: '', qtyRange: [10, 40] },
  { name: "Whey Protein - S'Mores", sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Sticky Toffee Pudding', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Strawberry Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Sweet Salty Popcorn', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Unflavoured', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Whey Protein - White Chocolate Hazelnut', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Sticky Toffee Pudding', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Banana Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Cookie Dough', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Chocolate Brownie Batter', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Chocolate Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Cereal Milk', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - White Chocolate Hazelnut', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Carrot Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Strawberry Creme', sku: '', qtyRange: [10, 40] },
  { name: "Isolate Zero - Chocolate Egg'splosion", sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Red Velvet Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Chocolate Peanut Butter', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Cinnamon Donut', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Dubai Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Tiramisu', sku: '', qtyRange: [10, 40] },
  { name: 'Isolate Zero - Baklava', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Blueberry Peach', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Mango Coconut', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Orange & Pineapple', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Passion Fruit Martini', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Raspberry Peach', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Strawberry Lime Daquiri', sku: '', qtyRange: [10, 40] },
  { name: 'Clear Whey Hydrate - Strawberry Watermelon', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Double Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Chocotella', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Raspberry White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Chocolate Orange', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Strawberry Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Minty Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Plant Protein - Sticky Toffee Pudding', sku: '', qtyRange: [10, 40] },
  { name: 'Egg White Protein - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: "Egg White Protein - Cookies 'N Creme", sku: '', qtyRange: [10, 40] },
  { name: 'Egg White Protein - Double Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Egg White Protein - Strawberry Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Egg White Protein - White Chocolate Hazelnut', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Carrot Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Chocolate Banana', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Chocolate Brownie Batter', sku: '', qtyRange: [10, 40] },
  { name: "Meal Replacement - Cookies 'N Creme", sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Double Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Red Velvet Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Strawberry Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Meal Replacement - White Chocolate Hazelnut', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Apple Strudel', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Banana Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Blueberry Muffin', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Carrot Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Cherry Bakewell', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Chocolate Brownie Batter', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Chocolate Orange', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Chocolate Peanut Butter', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Cinnamon Donut', sku: '', qtyRange: [10, 40] },
  { name: "Cream Of Rice - Cookies 'N Creme", sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Jammy Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Red Velvet Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Sticky Toffee Pudding', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Cream Of Rice - White Chocolate Hazelnut', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Citrus Burst', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Coconut', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Coconut Watermelon', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Cola Bottle', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Gummy Worms', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Lemon Sherbet Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Passion Fruit', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Peach Sweets', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Pineapple Rings', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Pink Lemonade', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Rainbow Candy', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Raspberry Cherry', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Strawberry Blackcurrant', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Electrolyte Mix - Strawberry Lime', sku: '', qtyRange: [10, 40] },
  { name: 'Hydrate Shots - Pink Lemonade', sku: '', qtyRange: [20, 60] },
  { name: 'Hydrate Shots - Strawberry Blackcurrant', sku: '', qtyRange: [20, 60] },
  { name: 'Hydrate Shots - Raspberry Cherry', sku: '', qtyRange: [20, 60] },
  { name: 'Pre-Workout Stim - Berry Blast', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Cola Bottle', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Passion Fruit', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Watermelon Lemonade', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Gummy Worms', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Lemon Sherbet Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Pink Lemonade', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Orange Mango', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Strawberry Lime', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Rainbow Candy', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Cola Bottle', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Passion Fruit', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Rainbow Candy', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Strawberry Lime', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Watermelon Lemonade', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Pink Lemonade', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout - Orange Mango', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout Shots - Cherry Fizz', sku: '', qtyRange: [20, 60] },
  { name: 'Energy Pre-Workout Shots - Rainbow Candy', sku: '', qtyRange: [20, 60] },
  { name: 'Energy Pre-Workout Shots - Cola Bottle', sku: '', qtyRange: [20, 60] },
  { name: 'Energy Pre-Workout Shots - Passion Fruit', sku: '', qtyRange: [20, 60] },
  { name: 'Pump Stim Free Pre Workout with Glycersize - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'Pump Stim Free Pre Workout with Glycersize - Strawberry Blackcurrant', sku: '', qtyRange: [10, 40] },
  { name: 'Pump Stim Free Pre Workout with Glycersize - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Pump Stim Free Pre Workout with Glycersize - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Pump Stim Free Pre Workout with Glycersize - Peach Sweets', sku: '', qtyRange: [10, 40] },
  { name: 'Pump Stim Free Pre Workout with Glycersize - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Rainbow Candy', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Passion Fruit', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Orange Burst', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Peach Iced Tea', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Lemon Lime Splash', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Mango Margarita', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Tropical Pineapple', sku: '', qtyRange: [10, 40] },
  { name: 'EAA Xtra - Strawberry Lime Twist', sku: '', qtyRange: [10, 40] },
  { name: 'Amino Burn - Lemon Lime', sku: '', qtyRange: [10, 40] },
  { name: 'Amino Burn - Mango Orange', sku: '', qtyRange: [10, 40] },
  { name: 'Amino Burn - Strawberry Lime Twist', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Peach Sweets', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Strawberry Lime', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Berry Blast', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Passion Fruit', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'Micronised Creatine - Unflavoured', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Rainbow Candy', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Peach Sweets', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Blue Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Strawberry Lime', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Berry Blast', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Passion Fruit', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine - Blackberry', sku: '', qtyRange: [10, 40] },
  { name: 'Creatine Sherbet - Original Sherbet', sku: '', qtyRange: [10, 40] },
  { name: 'Creatine Sherbet - Cherry Fizz', sku: '', qtyRange: [10, 40] },
  { name: 'Creatine Sherbet - Fizzy Bubblegum Bottles', sku: '', qtyRange: [10, 40] },
  { name: 'Creatine Sherbet - Rainbow Candy', sku: '', qtyRange: [10, 40] },
  { name: 'Creatine Sherbet - Peach Sweets', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Cookie Dough', sku: '', qtyRange: [10, 40] },
  { name: "Protein Bars - Cookies 'N Creme", sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Chocolate Brownie', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Chocotella', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Chocolate Peanut Butter', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Sticky Toffee Pudding', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Dubai Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - White Chocolate Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Chocolate & Raspberry', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Birthday Cake', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Bars - Raspberry White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Pancakes - Chocolate Chip', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Pancakes - Blueberry Muffin', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Pancakes - Caramel Biscuit', sku: '', qtyRange: [10, 40] },
  { name: "Protein Pancakes - Cookies 'N Creme", sku: '', qtyRange: [10, 40] },
  { name: 'Flavour Powder - Cinnamon Donut', sku: '', qtyRange: [10, 40] },
  { name: 'Flavour Powder - Cookies & Cream', sku: '', qtyRange: [10, 40] },
  { name: 'Flavour Powder - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Flavour Powder - Chocolate Brownie Batter', sku: '', qtyRange: [10, 40] },
  { name: 'Flavour Powder - Raspberry White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Flavour Powder - Vanilla Creme', sku: '', qtyRange: [10, 40] },
  { name: 'Zero Sugar Syrups - Chocotella / Choconut', sku: '', qtyRange: [10, 40] },
  { name: 'Zero Sugar Syrups - Double Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Zero Sugar Syrups - Honey', sku: '', qtyRange: [10, 40] },
  { name: 'Zero Sugar Syrups - Maple Syrup', sku: '', qtyRange: [10, 40] },
  { name: 'Zero Sugar Syrups - Salted Caramel', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Rice Cakes - Dark Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Protein Rice Cakes - White Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Multi-Blend Collagen - Raspberry Cherry', sku: '', qtyRange: [10, 40] },
  { name: 'Multi-Blend Collagen - Unflavoured', sku: '', qtyRange: [10, 40] },
  { name: 'Multi-Blend Collagen - Apple Mango', sku: '', qtyRange: [10, 40] },
  { name: 'Multi-Blend Collagen - Strawberry Blackcurrant', sku: '', qtyRange: [10, 40] },
  { name: 'Greens - Raspberry Cherry', sku: '', qtyRange: [10, 40] },
  { name: 'Greens - Apple Mango', sku: '', qtyRange: [10, 40] },
  { name: 'Greens - Strawberry Blackcurrant', sku: '', qtyRange: [10, 40] },
  { name: 'Greens - Unflavoured', sku: '', qtyRange: [10, 40] },
  { name: 'Advanced Protein Blend Sample Sachets', sku: '', qtyRange: [20, 60] },
  { name: 'Whey Protein Sample Sachets', sku: '', qtyRange: [20, 60] },
  { name: 'Clear Whey Hydrate Sample Sachets', sku: '', qtyRange: [20, 60] },
  { name: 'The Best Sellers Samples Bundle', sku: '', qtyRange: [20, 60] },
  { name: 'The Cake Samples Bundle', sku: '', qtyRange: [20, 60] },
  { name: 'The Chocolate Samples Bundle', sku: '', qtyRange: [20, 60] },
  { name: 'The Fruit Favourites Bundle', sku: '', qtyRange: [20, 60] },
  { name: "The 'Which Whey Wins' New Flavour Bundle (Limited Edition)", sku: '', qtyRange: [20, 60] },
  { name: 'Protein Crunchies', sku: '', qtyRange: [10, 40] },
  { name: 'Relax Hot Chocolate', sku: '', qtyRange: [10, 40] },
  { name: 'Glutamine', sku: '', qtyRange: [10, 40] },
  { name: 'Kyowa Quality Glutamine', sku: '', qtyRange: [10, 40] },
  { name: 'Creatine Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Creatine Gummies', sku: '', qtyRange: [20, 60] },
  { name: 'Vitamin C Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Vitamin D3 Plus K2 Tablets', sku: '', qtyRange: [20, 60] },
  { name: 'Advanced Omega-3 Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Multi Vita+min Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'KSM-66 Ashwagandha Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Zinc & Magnesium Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Advanced Magnesium Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Sleep Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Joint Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Advanced Curcumin Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Gut Health Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'NMN Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Liver Support Capsules', sku: '', qtyRange: [20, 60] },
  { name: 'Multifunction Shaker', sku: '', qtyRange: [15, 40] },
  { name: 'Bottle Jug with Straw', sku: '', qtyRange: [15, 40] },
  { name: 'Liquid Chalk', sku: '', qtyRange: [15, 40] },
  { name: 'Lifting Straps', sku: '', qtyRange: [15, 40] },
  { name: 'Weightlifting Belt', sku: '', qtyRange: [15, 40] },
  { name: 'Wrist Wraps', sku: '', qtyRange: [15, 40] },
  { name: 'Basic Tee', sku: '', qtyRange: [15, 40] },
  { name: 'Basic Hoodie', sku: '', qtyRange: [15, 40] },
  { name: 'Per4m e-Gift Card', sku: '', qtyRange: [15, 40] },
  { name: 'Creatine Sherbet MINI', sku: '', qtyRange: [10, 40] },
  { name: 'Flavoured Creatine MINI', sku: '', qtyRange: [10, 40] },
  { name: 'Energy Pre-Workout MINI', sku: '', qtyRange: [10, 40] },
  { name: 'Pre-Workout Stim MINI', sku: '', qtyRange: [10, 40] },
  { name: 'Multi-Blend Collagen MINI', sku: '', qtyRange: [10, 40] },
  {
    name: 'Per4m Jug 1500ml',
    sku: 'PFJUG003',
    ean: '5061097266873',
    qtyRange: [15, 40],
  },
  {
    name: 'Per4m Creatine 75g MINI (RANDOM)',
    sku: 'PFFLAVCR5RANDOM',
    ean: '5061097265609',
    qtyRange: [20, 60],
  },
];

// Max quantity per pallet by product size, used by the Pallet Label
// Generator to split a packing-slip line into pallets. A size with no entry
// here must never be guessed — the Pallet Labels screen stops and asks for
// a limit, then saves it here for next time.
const PALLET_LIMITS_SEED = {
  '30g': 10800,
  '33g': 10800,
  '450g': 480,
  '800g': 288,
  '810g': 288,
  '900g': 288,
  '1.2kg': 288,
  '1.8kg': 168,
  '2kg': 168,
};

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

// EAN-13 check digit: weight the first 12 digits 1,3,1,3... from the left,
// sum them, then (10 - sum mod 10) mod 10. Used by the Barcode Label
// Generator to catch a mistyped EAN before printing.
function eanCheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

function isValidEan13(ean) {
  if (!/^\d{13}$/.test(ean)) return false;
  return eanCheckDigit(ean.slice(0, 12)) === Number(ean[12]);
}
