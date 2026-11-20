// Pallet Labels V2 — Supabase project configuration.
//
// The anon/public key is designed by Supabase to be embedded in frontend
// code — it is NOT a secret, as long as every table it can reach has Row
// Level Security correctly configured (see supabase/migrations/). Never
// put the service-role key here, or anywhere else that reaches the
// browser — see supabase/README.md for the full explanation.
//
// Left blank until a real Supabase project exists for this deployment.
// While url/anonKey are blank, PalletLabelsBackend and BusinessAuth both
// transparently fall back to today's existing behaviour (localStorage,
// no sign-in gate) — the app works exactly as it did before this file
// existed. Filling these in, after running the migration in
// supabase/migrations/, is what switches Pallet Labels over to the shared
// backend.
window.SUPABASE_CONFIG = {
  url: '', // e.g. 'https://xxxxxxxx.supabase.co'
  anonKey: '', // the anon/public key, from Project Settings > API
};
