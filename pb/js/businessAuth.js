// Pallet Labels V2 — business-level sign-in (one shared login per business,
// not per employee — see PALLET_LABELS_V2_C2_REVISED.md for the full
// reasoning). This is a SEPARATE, new concept from the existing Portal
// Gate's Employee/Manager choice (js/portal.js, js/app.js): that decides
// which tabs an already-identified business's employees can see; this
// decides WHICH BUSINESS's data they're allowed to touch at all. One sits
// in front of the other.
//
// Entirely inert when window.SUPABASE_CONFIG isn't filled in (see
// js/supabaseConfig.js) — isRequired() returns false, and nothing else in
// this file is ever called, so an unconfigured deployment behaves exactly
// as it did before this file existed.

const BusinessAuth = (() => {
  let lastKnownSession = null;

  function configured() {
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  }

  function client() {
    return SupabaseClient.get();
  }

  // True only when a real Supabase project is configured — i.e. whether
  // the business sign-in gate should exist at all for this deployment.
  function isRequired() {
    return configured();
  }

  async function restoreSession() {
    if (!configured()) return null;
    const {
      data: { session },
    } = await client().auth.getSession();
    lastKnownSession = session || null;
    return lastKnownSession;
  }

  async function isSignedIn() {
    if (!configured()) return true; // nothing to sign into — treat as satisfied
    const session = await restoreSession();
    return !!session;
  }

  async function signIn(email, password) {
    if (!configured()) return { error: 'Not configured' };
    const { data, error } = await client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: error.message };
    lastKnownSession = data.session;
    return { session: data.session };
  }

  async function signOut() {
    if (!configured()) return;
    await client().auth.signOut();
    lastKnownSession = null;
  }

  // A best-effort, honest label for "who did this" on records created
  // under the shared business login — the signed-in email, since there is
  // no individual employee identity yet (Phase 6 adds that). Synchronous,
  // reading only what's already been established by restoreSession()/
  // signIn() so callers (e.g. PalletLabelsBackend) don't need to await it.
  function currentDisplayName() {
    return (lastKnownSession && lastKnownSession.user && lastKnownSession.user.email) || null;
  }

  return { isRequired, isSignedIn, signIn, signOut, currentDisplayName, restoreSession };
})();
