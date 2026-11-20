// Single shared Supabase client instance. businessAuth.js and
// palletLabelsBackend.js both use this rather than each creating their own
// — two separate GoTrueClient instances against the same project both read/
// write the same localStorage session key, which works but triggers
// Supabase's own "Multiple GoTrueClient instances" warning and runs two
// redundant background token-refresh timers. One instance, shared.
const SupabaseClient = (() => {
  let instance = null;
  function get() {
    if (!instance) {
      if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
        throw new Error('Supabase is not configured (js/supabaseConfig.js)');
      }
      instance = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    }
    return instance;
  }
  return { get };
})();
