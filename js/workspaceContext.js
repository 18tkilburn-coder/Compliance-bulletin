// WorkspaceContext — which workspace (business environment) the single
// application shell is showing, and its branding.
//
// One shell serves every workspace. Today (before real authentication)
// the available workspaces are Per4m and PB Wholesale, both inside the
// same organisation. Selecting one:
//   - points Store at that workspace's data (its storage prefix — the same
//     'per4m_' / 'pb_' prefixes the two former copies of the app used, so
//     existing data on a device is read in place);
//   - applies its branding (colours, wordmark, page title) at runtime;
//   - remembers it as this browser's last-used workspace (a convenience
//     preference only — never a permission);
//   - tells the app shell, which re-renders the current screen.
//
// IMPORTANT for the authentication stage: available() is the ONLY place
// that decides which workspaces can be offered. Here it returns the local
// list; with real authentication it will return only the workspaces the
// database's row-level security returns for the signed-in person, and every
// data request will carry the workspace id for the database to check. The
// switcher, the URL parameter and the remembered preference can only ever
// choose from available(); none of them grants access.

const WorkspaceContext = (() => {
  // Branding and storage for each workspace. Colours are the exact values
  // the two former copies of the app used.
  const WORKSPACES = [
    {
      slug: 'per4m',
      name: 'Per4m',
      storePrefix: 'per4m_',
      wordmark: { main: 'PER4M', accent: 'WAREHOUSE' },
      theme: { brand: '#f57a1f', light: '#fdeadb', text: '#7a3c0a', rgb: '245 122 31' },
    },
    {
      slug: 'pb-wholesale',
      name: 'PB Wholesale',
      storePrefix: 'pb_',
      wordmark: { main: 'PB', accent: 'WHOLESALE' },
      theme: { brand: '#3b82f6', light: '#dbe9fe', text: '#1e3a6a', rgb: '59 130 246' },
    },
  ];

  const LAST_USED_KEY = 'pallet_pal_last_workspace';
  const THEME_PROPS = { brand: '--brand', light: '--brand-light', text: '--brand-text', rgb: '--brand-rgb' };

  let current = null;
  const listeners = [];

  function copy(ws) {
    return ws ? JSON.parse(JSON.stringify(ws)) : null;
  }

  // The workspaces this person may switch between. See the note at the top.
  function available() {
    return WORKSPACES.map(copy);
  }

  function find(slug) {
    return WORKSPACES.find((w) => w.slug === slug) || null;
  }

  function readLastUsed() {
    try {
      return localStorage.getItem(LAST_USED_KEY);
    } catch (_) {
      return null;
    }
  }

  function writeLastUsed(slug) {
    try {
      localStorage.setItem(LAST_USED_KEY, slug);
    } catch (_) {
      // Storage unavailable (e.g. private mode): the choice just isn't remembered.
    }
  }

  // ?workspace=<slug> (used by the old pb/index.html address), then the
  // remembered workspace, then the first available one. Anything not in
  // available() is ignored.
  function initialSlug() {
    const allowed = available().map((w) => w.slug);
    let fromUrl = null;
    try {
      fromUrl = new URLSearchParams(window.location.search).get('workspace');
    } catch (_) {
      fromUrl = null;
    }
    if (fromUrl && allowed.includes(fromUrl)) return { slug: fromUrl };
    const remembered = readLastUsed();
    if (remembered && allowed.includes(remembered)) return { slug: remembered };
    return { slug: allowed[0] };
  }

  // Selects a workspace. Throws if it isn't available, so a caller can't
  // reach a workspace by naming it.
  function select(slug, { notify = true } = {}) {
    if (!available().some((w) => w.slug === slug)) {
      throw new Error(`Workspace "${slug}" is not available`);
    }
    const ws = find(slug);
    const changed = !current || current.slug !== ws.slug;
    current = ws;
    Store.useWorkspace(ws.storePrefix);
    writeLastUsed(ws.slug);
    if (document.documentElement.dataset.workspace) applyTheme();
    if (changed && notify) listeners.slice().forEach((fn) => fn(copy(ws)));
    return copy(ws);
  }

  function getCurrent() {
    return copy(current);
  }

  // Branding inside the signed-in shell. The login page never calls this,
  // so it always shows the default Pallet Pal orange from styles.css.
  function applyTheme() {
    if (!current) return;
    const root = document.documentElement;
    Object.keys(THEME_PROPS).forEach((k) => root.style.setProperty(THEME_PROPS[k], current.theme[k]));
    root.dataset.workspace = current.slug;
    const main = document.getElementById('brand-mark-main');
    const accent = document.getElementById('brand-mark-accent');
    if (main) main.textContent = current.wordmark.main;
    if (accent) accent.textContent = current.wordmark.accent;
    document.title = `Pallet Pal · ${current.name}`;
  }

  // Back to the universal Pallet Pal look (orange), e.g. on sign-out.
  function clearTheme() {
    const root = document.documentElement;
    Object.values(THEME_PROPS).forEach((p) => root.style.removeProperty(p));
    delete root.dataset.workspace;
    document.title = 'Pallet Pal';
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // Runs as soon as this script loads (straight after store.js and before
  // any screen), so Store always points at a real workspace.
  function init() {
    const { slug } = initialSlug();
    select(slug, { notify: false });
    // Tidy the address bar whether or not the ?workspace= value was usable:
    // a valid choice is now remembered instead, and an invalid one was ignored.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('workspace')) {
        url.searchParams.delete('workspace');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch (_) {
      // Ignore: purely cosmetic.
    }
  }

  init();

  return { available, select, getCurrent, applyTheme, clearTheme, onChange };
})();
