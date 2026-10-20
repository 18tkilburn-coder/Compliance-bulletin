// Portal.js — a simple role selector used in place of real authentication.
// This is NOT security: it only controls which tabs/UI are shown. A real
// build must replace this with actual staff login and server-side checks
// before employee/manager access can be trusted.

const Portal = (() => {
  // Shared (not per4m_/pb_ prefixed) deliberately: Per4m and PB Wholesale run
  // on the same origin, so using one key here means your Employee/Manager
  // role carries across the System Switch button instead of each instance
  // keeping its own independent, potentially stale session — the same
  // same-origin trick Store.js uses to share user accounts between the two.
  const KEY = 'pallet_pal_portal';

  function get() {
    return localStorage.getItem(KEY);
  }

  function set(portal) {
    localStorage.setItem(KEY, portal);
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isManager() {
    return get() === 'manager';
  }

  return { get, set, clear, isManager };
})();
