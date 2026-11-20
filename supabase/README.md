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

## Phase 4: AI packing-slip extraction

`functions/extract-packing-slip/index.ts` is a Supabase Edge Function that
reads an uploaded packing slip (phone photo or scanned PDF) with Claude and
returns its rows to the Pallet Labels screen for review. It does what Claude
used to do by hand from photos (see the handover, section 1). Digital PDFs
are still parsed locally in the browser first, for free; only a photo, or a
PDF with no readable text, goes to the function.

**Isolation design.** The function never holds the service-role key. It
runs *as the caller*, with their own Auth token, so the same Row Level
Security policies that protect the browser also protect it: `businesses`
returns only the caller's own row, and Storage refuses another business's
path. It also rejects any path whose first segment isn't the caller's own
business id, and never reads a business id from the request body. It writes
nothing; saving the batch stays in the browser, under RLS, as before.

**What it costs.** Each read is one Claude Opus 5.5 request (`effort:
high`). A typical one-page sheet is a few thousand tokens in and out:
a few pence per sheet at current API prices.

### Setup (needs the Supabase CLI and an Anthropic API key)

1. Install the Supabase CLI and link this repo to your project:
   `supabase login`, then `supabase link --project-ref <your-project-ref>`.
2. Store the Anthropic key as a function secret. It never goes in any
   browser file:
   `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
3. Deploy: `supabase functions deploy extract-packing-slip`.
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to the function
   automatically.
4. Fill in `js/supabaseConfig.js` (and `pb/js/supabaseConfig.js`) if not
   already done. Once a business is signed in, the Pallet Labels upload box
   accepts photos as well as PDFs.

### Phase 4 acceptance test

`tests/extract_function_isolation.test.js` checks that Business A can't
get Business B's uploaded file read (exact path, path traversal, a forged
`business_id` in the body), and that an unsigned-in client is refused.
Every request in it is rejected before Claude is called, so it costs
nothing to run. Same environment variables as the Phase 1 test:

```bash
cd supabase/tests
node extract_function_isolation.test.js
```

Expect every line to print `PASS`. Then check a real extraction by hand:
upload `inputs/trailer10_sheet_photo_page2.jpg` from the handover package
and compare the review table against the photo.
