-- Pallet Labels V2 — Phase 1 foundation schema.
--
-- Scope, per the approved architecture (see PALLET_LABELS_V2_DECISION_RECORD.md
-- and PALLET_LABELS_V2_C2_REVISED.md in the repo root): ONLY pallet allocation
-- rules and pallet label batch history move to Supabase. Products, Staff,
-- Stock Entries, Locations, Deliveries, Manage Users, and Barcode Label
-- history are explicitly NOT touched by this migration and remain exactly
-- where they are today (localStorage) until a separate, later decision.
--
-- Multi-tenancy: one row in `businesses` per onboarded business (e.g. Per4m,
-- PB Wholesale), each mapped to exactly one shared Supabase Auth login that
-- every employee at that business signs in with. Every other table carries
-- a `business_id` from day one so isolation never has to be retrofitted.
--
-- Run this against a fresh Supabase project's SQL editor, or via
-- `supabase db push` if using the Supabase CLI locally.

-- ============================================================================
-- 1. businesses
-- ============================================================================
-- One row per tenant. Rows here are created ONLY by the platform operator,
-- using the Supabase service-role key (e.g. via the dashboard's SQL editor,
-- or a small trusted admin script that never ships to any browser) — never
-- through the public client. There is deliberately no INSERT/UPDATE/DELETE
-- policy below for the `authenticated` role: an ordinary business's own
-- login can read its own row and nothing more, and cannot create another
-- business, rename its own business, or repoint its own auth_user_id to a
-- different login. This is intentional, not an oversight.

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

comment on table businesses is
  'One row per onboarded business/tenant. Created only via the service-role key by the platform operator — no public write path exists.';

alter table businesses enable row level security;

-- Explicit, defence-in-depth: the anon (unauthenticated) role gets no grants
-- and no policies at all on this table, so it has zero access by default.
-- This line is not strictly required (RLS already defaults to deny with no
-- matching policy), but it removes any ambiguity about intent.
revoke all on businesses from anon;

create policy "businesses: an authenticated business can read only its own row"
  on businesses
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- No insert/update/delete policy for `authenticated` on this table at all —
-- see the comment above. Writes happen only via the service-role key, which
-- bypasses RLS by design and is never embedded in any client-side code.

-- ============================================================================
-- 2. pallet_limits — max units per pallet, per product size, per business
-- ============================================================================

create table if not exists pallet_limits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  size_key text not null,
  max_qty_per_pallet integer not null check (max_qty_per_pallet > 0),
  updated_at timestamptz not null default now(),
  unique (business_id, size_key)
);

comment on table pallet_limits is
  'Max units per pallet for a given product size, scoped per business. Mirrors Store.getPalletLimits()/setPalletLimit()/deletePalletLimit() 1:1 in shape.';

alter table pallet_limits enable row level security;
revoke all on pallet_limits from anon;

-- A small helper expression repeated across every policy below: "the set of
-- business ids the currently-authenticated login is allowed to act as." With
-- exactly one shared login per business today, this is always zero or one
-- row — written as a subquery (not a stored function) so it's visible in
-- plain SQL exactly where it's used, and so Phase 6 (profiles-based
-- individual accounts) can change this subquery alone without touching any
-- other line in this file.

create policy "pallet_limits: read own business only"
  on pallet_limits
  for select
  to authenticated
  using (business_id in (select id from businesses where auth_user_id = auth.uid()));

create policy "pallet_limits: insert into own business only"
  on pallet_limits
  for insert
  to authenticated
  with check (business_id in (select id from businesses where auth_user_id = auth.uid()));

create policy "pallet_limits: update rows in own business only, and forbid moving a row to another business"
  on pallet_limits
  for update
  to authenticated
  using (business_id in (select id from businesses where auth_user_id = auth.uid()))
  with check (business_id in (select id from businesses where auth_user_id = auth.uid()));
  -- USING picks which existing rows may be touched at all (only this
  -- business's own rows are even visible to the UPDATE). WITH CHECK is
  -- evaluated against the resulting row and requires its business_id to
  -- also be one of "my own" business ids — since a login maps to exactly
  -- one business, the only business_id that can ever pass WITH CHECK is
  -- the one it already has, so an attempt to set business_id to a
  -- different business is rejected by WITH CHECK, not merely hidden.

create policy "pallet_limits: delete rows in own business only"
  on pallet_limits
  for delete
  to authenticated
  using (business_id in (select id from businesses where auth_user_id = auth.uid()));

-- ============================================================================
-- 3. pallet_label_batches — permanent history of every generated batch
-- ============================================================================

create table if not exists pallet_label_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  filename text,
  source_file_path text,
  -- `pallets` keeps the exact same shape as the array
  -- Store.addPalletLabelBatch() already produces today (product text,
  -- stripped display name, size key, flavour, quantity, best-before,
  -- batch codes) — stored as JSONB rather than normalised, deliberately,
  -- since Phase 1's scope has no need for separate tables underneath it.
  pallets jsonb not null,
  grand_total integer not null check (grand_total >= 0),
  generated_by text,
  generated_at timestamptz not null default now()
);

comment on table pallet_label_batches is
  'Permanent history of every generated pallet-label batch, scoped per business. source_file_path points into the private Storage bucket (see the storage policies below), replacing the old 4MB-capped base64-data-URL-in-localStorage approach.';

create index if not exists pallet_label_batches_business_id_idx
  on pallet_label_batches (business_id, generated_at desc);

alter table pallet_label_batches enable row level security;
revoke all on pallet_label_batches from anon;

create policy "pallet_label_batches: read own business only"
  on pallet_label_batches
  for select
  to authenticated
  using (business_id in (select id from businesses where auth_user_id = auth.uid()));

create policy "pallet_label_batches: insert into own business only"
  on pallet_label_batches
  for insert
  to authenticated
  with check (business_id in (select id from businesses where auth_user_id = auth.uid()));

create policy "pallet_label_batches: update rows in own business only, and forbid moving a row to another business"
  on pallet_label_batches
  for update
  to authenticated
  using (business_id in (select id from businesses where auth_user_id = auth.uid()))
  with check (business_id in (select id from businesses where auth_user_id = auth.uid()));

create policy "pallet_label_batches: delete rows in own business only"
  on pallet_label_batches
  for delete
  to authenticated
  using (business_id in (select id from businesses where auth_user_id = auth.uid()));

-- ============================================================================
-- 4. Storage: a private bucket for uploaded source documents
-- ============================================================================
-- Path convention, enforced below, not just documented:
--   {business_id}/{batch_id}/{original_filename}
-- The business_id segment is exactly the uuid in businesses.id, which is
-- what lets the storage policies below check "does this object's first
-- path segment belong to the caller's own business" cheaply and directly.

insert into storage.buckets (id, name, public)
values ('pallet-label-sources', 'pallet-label-sources', false)
on conflict (id) do nothing;
-- public = false: this bucket is private. Nothing in it is reachable by a
-- plain unauthenticated URL — every access goes through the policies below.

create policy "pallet-label-sources: read only own business's folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pallet-label-sources'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where auth_user_id = auth.uid()
    )
  );

create policy "pallet-label-sources: upload only into own business's folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pallet-label-sources'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where auth_user_id = auth.uid()
    )
  );

create policy "pallet-label-sources: delete only within own business's folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pallet-label-sources'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where auth_user_id = auth.uid()
    )
  );

-- No update policy: a stored source document is write-once (upload) and
-- delete-only thereafter — there's no legitimate reason to modify an
-- uploaded file's bytes in place, so no policy is defined for it, which
-- means it's denied by default, same as every other unlisted operation.

-- ============================================================================
-- End of Phase 1 foundation migration.
-- ============================================================================
