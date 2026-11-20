# Pallet Labels V2 — Phase 1 Supabase backend

This directory holds everything needed to stand up the Phase 1 backend. It is
entirely separate from the main application's build-step-free structure —
nothing here is loaded by the browser; it exists to configure and test a
Supabase project.

**Scope reminder:** this migrates *only* pallet allocation rules and pallet
label batch history. Products, Staff, Stock Entries, Locations, Deliveries,
Manage Users, and Barcode Label history are untouched and remain exactly
where they are today (`localStorage`).

## What's here

- `migrations/20261120000000_pallet_labels_v2_foundation.sql` — the complete
  schema: `businesses`, `pallet_limits`, `pallet_label_batches`, every Row
  Level Security policy, and the private Storage bucket + its policies. Fully
  commented inline; read it alongside
  `PALLET_LABELS_V2_C2_REVISED.md` in the repo root for the reasoning behind
  each policy.
- `tests/seed_test_businesses.js` — creates two throwaway test businesses
  ("Test Business A" / "Test Business B") with real Supabase Auth logins and
  one sample row each, using the service-role key. Needed before the
  acceptance tests below can run against something real.
- `tests/cross_tenant_isolation.test.js` — the Phase 1 security acceptance
  tests: Business A's authenticated session attempting to read, insert,
  update, and delete Business B's rows (and vice versa isn't separately
  needed — the policies are symmetric), plus the same attempts from a
  completely unauthenticated client, plus Storage-level isolation checks.
  Tests direct Supabase queries, not the app's UI, as required.

## One-time setup (needs a real Supabase project — this is the one step I can't do for you)

1. Create a Supabase project (free tier is almost certainly sufficient to
   start — see the cost discussion in `PALLET_LABELS_V2_TECHNICAL_AUDIT.md`).
2. In the SQL editor, run `migrations/20261120000000_pallet_labels_v2_foundation.sql`
   once.
3. From *Project Settings → API*, note down:
   - the Project URL
   - the `anon` `public` key (safe to embed in frontend code — this is
     Supabase's intended, documented use of this specific key)
   - the `service_role` `secret` key (never goes in any frontend file — only
     used locally, by you, for the two admin scripts below)
4. Onboard the two real businesses (Per4m and PB Wholesale) the same way
   `seed_test_businesses.js` onboards its test ones: one `auth.admin.createUser`
   call plus one `businesses` row insert per business, done once via the
   service-role key. (A small `onboard_business.js` script following the
   same pattern as the seed script is a natural next addition once you
   confirm you want to proceed — not included yet since it writes real,
   permanent business accounts rather than throwaway test ones.)

## Running the security acceptance tests

```bash
cd supabase/tests
npm install
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='...'   # from Project Settings > API — keep this out of shell history/CI logs
node seed_test_businesses.js
# copy the `export ...` lines it prints, then:
export SUPABASE_ANON_KEY='...'           # the anon/public key, also from Project Settings > API
node cross_tenant_isolation.test.js
```

Expect every line to print `PASS`. Any `FAIL` means a Row Level Security
policy isn't behaving as designed and must be fixed before Phase 1 is
considered done — per the approved acceptance criteria, this test suite
passing in full is a precondition for signing off Phase 1, not an optional
extra.

## What this does *not* yet cover

The future AI Edge Function (Phase 4) needs its own, separate equivalent
test once it exists, because it will hold service-role-level database
access to write extraction results — Row Level Security does not apply to
that key at all, so isolation there depends entirely on the function's own
code correctly deriving the caller's business from their verified Auth
token and never trusting a client-supplied value. This is noted as a
tracked requirement for Phase 4, not something this Phase 1 test suite can
verify, since that function doesn't exist yet.
