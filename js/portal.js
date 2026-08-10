// Portal.js — a simple role selector used in place of real authentication.
// This is NOT security: it only controls which tabs/UI are shown. A real
// build must replace this with actual staff login and server-side checks
// before employee/manager access can be trusted.

const Portal = (() => {
  const KEY = 'per4m_portal';

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
