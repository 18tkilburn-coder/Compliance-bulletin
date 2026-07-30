# per4m Warehouse Location Tracker (Prototype)

A clickable demo prototype for tracking stock by warehouse location. Built as
a static single-page app with no backend — data is stored in the browser's
`localStorage` and pre-seeded with sample products and stock on first load.

Barcode scanning is simulated (see the in-app banner and the code comments
in `js/screens/putaway.js`) — a real build would use the device camera.

## Running it

Any static file server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local URL in a browser. You can also open
`index.html` directly by double-clicking it in most browsers.

## Screens

- **Put-Away** — log a batch of stock onto a location.
- **Search** — look up stock by product name, SKU, or batch code.
- **All Locations** — flat overview of all 20 racking locations.

To reset the demo data, clear the site's local storage (e.g. via browser
dev tools) and reload the page.
