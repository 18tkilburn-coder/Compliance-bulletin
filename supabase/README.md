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

## Stage 1: multi-tenant foundation (organisations, workspaces, people)

`migrations/20261121000000_tenancy_foundation.sql` adds the structure for a
commercial multi-tenant SaaS, in four levels:

| Level | Table(s) | Notes |
|---|---|---|
| Platform | `platform_staff`, `support_sessions`, `platform_audit_log` | The Platform Owner. Separate from every customer role. Needs MFA. No standing access to customer data. |
| Organisation (tenant) | `organisations`, `organisation_members`, `organisation_audit_log` | One per customer company. **The isolation boundary.** Roles (`employee` < `manager` < `admin`) are per organisation. Org Admin powers need MFA. |
| Workspace | `businesses` (renamed `workspaces` in Stage 4), `member_workspaces` | Business environments inside an organisation (e.g. Per4m, PB Wholesale). Members see all their organisation's workspaces, or only selected ones. |
| Person | `profiles` | One Supabase Auth identity. Can belong to several organisations. |

Plus `activity_events`: operational activity, append-only, readable by
active members for the workspaces they can use (and by an active support
session on that organisation).

### How permissions are enforced (server-side only)

- No signed-in user can write any of these tables directly. Every change
  goes through a database function that checks, on the server, the
  caller's role **in that organisation**, their MFA level and the
  organisation's status, and writes the audit trail in the same
  transaction:
  - Platform Owner + MFA: `create_organisation`, `create_workspace`,
    `start_support_session`, `end_support_session`.
  - Org Admin + MFA, own organisation only: `set_member_role`,
    `deactivate_member`, `reactivate_member`, `set_member_workspaces`,
    `list_org_members`.
  - Yourself: `my_memberships`, `activate_my_membership`.
- Hiding a button in the app is never the control: the same checks apply to
  any request, however it's made.
- A new organisation starts with exactly one membership, its named first
  Admin (invited). Nobody else, including existing users and the Platform
  Owner, gains any access to it.
- An organisation always keeps at least one active Admin (enforced by a
  trigger, also against the service role). Org Admins can appoint other
  Org Admins.
- Memberships, profiles and organisations are never deleted (deactivate
  instead), and activity and audit logs are append-only, so history keeps
  its author.
- The Platform Owner (with MFA) can read the **organisation directory**:
  each organisation's name, slug, status and creation details. Every other
  customer record, workspace records included, needs a support session on
  that organisation.

### Support access (Platform Owner)

- Started only by the Platform Owner, with MFA, a written reason (10+
  characters) and a duration of 1–240 minutes. The 4-hour cap is also a
  database constraint.
- Read-only: support access appears only in read policies, and every write
  function requires real membership, so a support session can't change
  anything (activity, memberships or pallet data).
- One organisation per session; it gives nothing in any other organisation.
- Recorded in the platform audit log **and** in that organisation's own
  audit log, with the reason, so the customer's Admins can see it.
- Ends at expiry, when ended manually, or on a Platform Owner transfer.

### What this changes in the existing (Phase 1) schema

- `businesses.auth_user_id` is no longer required, so new workspaces don't
  need a shared business login. Existing rows keep their login, and every
  existing policy compares `auth_user_id = auth.uid()`, which an empty value
  never matches, so no existing access changes.
- `businesses` gains `organisation_id` and `slug`, two unique constraints
  and one **additional** read policy for organisation members. Existing rows
  (including the Phase 1 test businesses) are not modified.
- `grant select on businesses to authenticated, service_role` (already true
  in this project; stated so Stage 1 doesn't depend on it).
- Nothing else: `pallet_limits`, `pallet_label_batches`, the
  `pallet-label-sources` bucket and all their policies are unchanged until
  the explicit Stage 4 migration. The existing 36/36 Phase 1 test must still
  pass after applying this.

### Testing

1. **Locally, before applying (nothing touches Supabase).** From
   `supabase/tests/local`:

   ```powershell
   npm install
   node tenancy_foundation.local.test.mjs
   node mutation_check.mjs
   ```

   The first runs both migrations on a real PostgreSQL (PGlite) with
   stand-ins for Supabase's roles, auth (including the MFA level) and
   storage, and runs 172 checks. The second introduces 21 realistic
   security bugs, one at a time, and confirms the suite catches every one.

2. **Live, after applying.** From `supabase/tests`, in one PowerShell
   window. TOTP MFA must be enabled under Authentication > Multi-Factor (it
   is on by default).

   ```powershell
   $env:SUPABASE_URL = 'https://<project-ref>.supabase.co'; $env:SUPABASE_ANON_KEY = '<publishable key>'
   $env:STAGE1_SEED_PROJECT_REF = '<project-ref>'
   $env:SUPABASE_SERVICE_ROLE_KEY = Read-Host 'Paste your sb_secret key'
   node seed_test_tenancy.js
   ```

   Set the `$env:STAGE1_...` lines it prints, then:

   ```powershell
   Remove-Item env:SUPABASE_SERVICE_ROLE_KEY
   node tenancy_foundation.test.js
   node cross_tenant_isolation.test.js
   ```

   The seed creates two test organisations (`security-test-org-a/b`), three
   test workspaces and ten logins on the reserved sub-domain
   `stage1.pallet-pal-security-test.invalid`, and registers every one of
   them in `security_test_fixtures`. It never creates a Platform Owner and
   never touches real data, the Phase 1 test businesses or their logins.
   Platform Owner and support-session behaviour is tested locally only,
   because the live project must not get a test Platform Owner.

   **Seed safety.** The seed refuses to run unless `SUPABASE_URL` is a
   standard `https://<project-ref>.supabase.co` address and
   `STAGE1_SEED_PROJECT_REF` names the same project. If earlier Stage 1 test
   data exists, it stops and deletes nothing unless you also set:

   ```powershell
   $env:STAGE1_SEED_ALLOW_RESET = 'delete-previous-stage1-test-data'
   ```

   Even then it deletes only what the fixture registry lists as created by
   this suite, and re-checks each login's email is on the Stage 1 test
   sub-domain before deleting it. Re-seed (with that opt-in) before each
   test run, because the test accepts an invitation and enrols MFA on the
   test Admin logins.

### Creating the Platform Owner (later, when Stage 2 is ready)

1. In Authentication > Users, invite your own email; accept the invite and
   set a strong password.
2. In the SQL Editor, once:
   `select app.bootstrap_platform_owner('<your auth user id>', '<your name>');`
3. Sign in and enrol **two** authenticator factors (for example your phone
   and a password manager), so losing one device doesn't lock you out.

`bootstrap_platform_owner` refuses if an owner already exists. Nothing in
the app or the API can create, change or remove the Platform Owner.

### Platform Owner account recovery

There is deliberately exactly one Platform Owner, and no in-app way to
change it. Recovery always goes through **control of the Supabase project
itself**, which sits outside the app and is protected separately. That is
what stops the single-owner rule from becoming a permanent lock-out.

There are two separate accounts to keep recoverable:

1. **Your supabase.com account** (the dashboard login that owns the
   project). This is the root of trust: whoever can open the project's SQL
   Editor and use its secret key can recover the platform.
2. **Your Pallet Pal login** (a user of this project's Supabase Auth), which
   holds the Platform Owner grant.

**Root of trust: protecting the supabase.com account.** Per Supabase's
"Lost access to your MFA authenticator app or recovery codes" article
(supabase.com/kb/troubleshooting/lost-accessforgot-the-mfa-device-nAPT-7),
account MFA can be recovered with:

- **Recovery codes:** "A set has 10 recovery codes, and each code works one
  time." Save them somewhere secure and offline when you turn on MFA.
- **A second authenticator app:** add it alongside the first. Supabase
  warns: "Add the new app before you remove the lost one. If you remove
  your only authenticator app, MFA turns off and all your recovery codes
  are deleted."
- **Supabase support,** as a last resort (the article's "Email support to
  regain access" option). Never send recovery or authenticator codes to
  anyone; Supabase says it never asks for them.

Also consider a second, trusted person in the Supabase organisation (with
their own MFA) as a break-glass contact, and keep MFA on the email account
used for supabase.com.

**Pallet Pal login: forgotten password.** Use "Forgot password"; Supabase
emails a reset link. No database change is needed.

**Pallet Pal login: one authenticator lost.** Sign in with the second
enrolled factor, remove the lost one, and enrol a replacement.

**Pallet Pal login: all authenticators lost (email and password still
work).** Supabase Auth has no recovery codes for project users; recovery is
an administrator removing the lost factor with the secret key:

1. From a trusted computer, with the project's secret key (never in a
   browser), find the owner's factor id and remove it with Supabase's admin
   API, `supabase.auth.admin.mfa.deleteFactor({ id: '<factor id>', userId: '<owner auth user id>' })`.
   Supabase's reference for that method says it "will log the user out of
   all active sessions if the deleted factor was verified".
   - Finding the factor id: an admin "list factors" method is expected to
     exist, but its reference page was unavailable when this was written.
     Check the current Supabase JavaScript reference (Auth > Admin > MFA)
     before relying on it.
   - Do **not** delete rows from `auth.mfa_factors` with SQL: Supabase
     doesn't document that as a recovery method. Use the admin API.
2. Sign in with the password and immediately enrol two new factors.
3. Record what happened and why in your own incident notes.

**The owner's account itself is lost or compromised** (email lost, person
unavailable, or suspected takeover):
1. Sign in to supabase.com with the project owner's account (or the
   break-glass contact's).
2. In Authentication > Users, invite the new owner's email; they accept it
   and set a password.
3. In the SQL Editor:
   `select app.transfer_platform_owner('<new auth user id>', '<full name>', '<reason, at least 10 characters>');`
   This moves the grant, ends any open support sessions, and records the
   previous owner, the new owner and the reason in the platform audit log.
4. If the old account may be compromised, also stop it signing in by
   blocking the Auth user through the Auth admin API or the dashboard
   (check the current Supabase docs for the exact option). Deleting that
   Auth user is refused by design, because its profile keeps the history
   attributed to it.
5. The new owner signs in and enrols two authenticator factors.

None of this is reachable from the app: recovery needs the project's SQL
Editor, so an Org Admin or any other user can't use it.
