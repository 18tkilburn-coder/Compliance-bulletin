-- Pallet Pal — Stage 1: multi-tenant foundation.
--
-- Four levels:
--   Platform      the Platform Owner (platform_staff). Separate from every
--                 customer role. No standing access to customer data: only
--                 read-only, time-limited, audited support sessions.
--   Organisation  one customer company (organisations). THE isolation
--                 boundary: no member of one organisation can read or write
--                 another organisation's data.
--   Workspace     a business environment inside an organisation (the
--                 existing `businesses` table; renamed `workspaces` in
--                 Stage 4). Members see all their organisation's workspaces
--                 by default, or only selected ones.
--   Person        one Supabase Auth identity (profiles). Can belong to
--                 several organisations, with a role in each
--                 (organisation_members).
--
-- Roles are per organisation: employee < manager < admin (enum order is
-- used for comparisons). Org Admin and Platform Owner powers additionally
-- require the session to have passed MFA (aal2).
--
-- WHAT THIS DOES TO EXISTING OBJECTS (Phase 1 migration 20261120000000):
--   - businesses.auth_user_id: NOT NULL is dropped, so new workspaces can be
--     created without a shared business login. Existing rows are untouched
--     (all keep their login), and every existing policy compares
--     auth_user_id = auth.uid(), which a NULL never satisfies — so no
--     existing access changes.
--   - businesses gains nullable organisation_id and slug columns, two
--     unique constraints, and one ADDITIONAL select policy for members.
--     Existing rows keep organisation_id NULL and stay invisible to
--     members; the Phase 1 test businesses are not modified.
--   - Nothing else from Phase 1 is altered: pallet_limits,
--     pallet_label_batches, the pallet-label-sources bucket and all their
--     policies are unchanged until the explicit Stage 4 migration.
--
-- No signed-in user (not even an Org Admin or the Platform Owner) can
-- write any table here directly. Every change goes through a SECURITY
-- DEFINER function below that checks the caller's role, MFA level and
-- organisation in the database, and writes the audit trail in the same
-- transaction.

-- ============================================================================
-- 0. Private schema and types
-- ============================================================================

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

create type public.org_role as enum ('employee', 'manager', 'admin');
create type public.membership_status as enum ('invited', 'active', 'deactivated');
create type public.org_status as enum ('active', 'suspended');

-- ============================================================================
-- 1. Organisations (tenants)
-- ============================================================================

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  status public.org_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

comment on table public.organisations is
  'One customer company. The tenant isolation boundary. Created only by the Platform Owner (create_organisation()).';

-- ============================================================================
-- 2. Workspaces: the existing businesses table, linked to an organisation
-- ============================================================================

alter table public.businesses alter column auth_user_id drop not null;
alter table public.businesses add column organisation_id uuid references public.organisations (id) on delete restrict;
alter table public.businesses add column slug text
  check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60));
alter table public.businesses add constraint businesses_org_slug_unique unique (organisation_id, slug);
-- Target for composite foreign keys, so a row can never pair organisation A
-- with a workspace of organisation B.
alter table public.businesses add constraint businesses_org_id_unique unique (organisation_id, id);
alter table public.businesses add constraint businesses_tenant_workspace_has_slug
  check (organisation_id is null or slug is not null);

create index businesses_organisation_idx on public.businesses (organisation_id);

-- ============================================================================
-- 3. People
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Personal details only. No role or status: those are per organisation (organisation_members). Never deleted, so history keeps its author.';

-- ============================================================================
-- 4. Memberships: a person's role and status inside one organisation
-- ============================================================================

create table public.organisation_members (
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.org_role not null default 'employee',
  status public.membership_status not null default 'invited',
  workspace_scope text not null default 'all' check (workspace_scope in ('all', 'selected')),
  invited_by uuid references public.profiles (id),
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id),
  primary key (organisation_id, user_id),
  constraint organisation_members_active_has_activation check (status <> 'active' or activated_at is not null),
  constraint organisation_members_deactivation_consistent check ((status = 'deactivated') = (deactivated_at is not null))
);

create index organisation_members_user_idx on public.organisation_members (user_id);

-- Only used when a membership's workspace_scope = 'selected'. Both foreign
-- keys carry the organisation, so a person can't be given a workspace of
-- an organisation they don't belong to.
create table public.member_workspaces (
  organisation_id uuid not null,
  user_id uuid not null,
  workspace_id uuid not null,
  primary key (organisation_id, user_id, workspace_id),
  foreign key (organisation_id, user_id) references public.organisation_members (organisation_id, user_id) on delete restrict,
  foreign key (organisation_id, workspace_id) references public.businesses (organisation_id, id) on delete cascade
);

-- ============================================================================
-- 5. Platform level
-- ============================================================================

create table public.platform_staff (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  platform_role text not null check (platform_role in ('owner')),
  granted_at timestamptz not null default now(),
  granted_reason text
);

comment on table public.platform_staff is
  'Platform-level grants, separate from all customer roles. Written only by app.bootstrap_platform_owner() / app.transfer_platform_owner(), which are callable only from the SQL Editor.';

create unique index platform_staff_single_owner on public.platform_staff ((true)) where platform_role = 'owner';

create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  -- References the person (not platform_staff), so the record survives an
  -- owner transfer; the policies check platform_staff at use time.
  platform_user_id uuid not null references public.profiles (id) on delete restrict,
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 10 and 500),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  constraint support_sessions_max_four_hours check (expires_at > started_at and expires_at <= started_at + interval '4 hours'),
  constraint support_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index support_sessions_lookup_idx on public.support_sessions (platform_user_id, organisation_id, expires_at);

-- ============================================================================
-- 6. Activity and audit trails (append-only)
-- ============================================================================

create table public.activity_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  organisation_id uuid not null,
  workspace_id uuid not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  actor_name text not null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null check (entity_type ~ '^[a-z_]+$'),
  entity_id text,
  summary text not null check (length(summary) between 1 and 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  foreign key (organisation_id, workspace_id) references public.businesses (organisation_id, id) on delete restrict
);

create index activity_events_org_time_idx on public.activity_events (organisation_id, occurred_at desc);
create index activity_events_workspace_time_idx on public.activity_events (workspace_id, occurred_at desc);

-- Account management inside one organisation, plus every support session
-- opened on it (so the customer's Admins can see platform access).
create table public.organisation_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete restrict,
  target_user_id uuid references public.profiles (id) on delete restrict,
  action text not null check (action in (
    'organisation_created', 'member_added', 'member_activated', 'role_changed', 'member_deactivated',
    'member_reactivated', 'workspace_scope_changed', 'workspace_created', 'support_session_started',
    'support_session_ended'
  )),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index organisation_audit_log_org_time_idx on public.organisation_audit_log (organisation_id, occurred_at desc);

create table public.platform_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete restrict,
  organisation_id uuid references public.organisations (id) on delete restrict,
  action text not null check (action in (
    'platform_owner_bootstrapped', 'platform_owner_transferred', 'organisation_created', 'workspace_created',
    'support_session_started', 'support_session_ended'
  )),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index platform_audit_log_time_idx on public.platform_audit_log (occurred_at desc);

-- Registry of the records created by the Stage 1 live security-test suite
-- (supabase/tests/seed_test_tenancy.js). The test clean-up deletes ONLY
-- organisations and logins listed here, so an unrelated organisation or
-- login can never be removed just because its slug or email looks like
-- test data. Rows are written only by the security_test_* functions below.
create table public.security_test_fixtures (
  kind text not null check (kind in ('organisation', 'user')),
  id uuid not null,
  suite text not null default 'stage1-tenancy' check (suite = 'stage1-tenancy'),
  registered_at timestamptz not null default now(),
  primary key (kind, id)
);

comment on table public.security_test_fixtures is
  'Records created by the Stage 1 security-test seed. The only thing purge_stage1_security_test_data() will delete. Not readable or writable by signed-in users.';

-- ============================================================================
-- 7. Permission helpers (used by every policy and function)
-- ============================================================================
-- SECURITY DEFINER (owned by the migration's role, which owns these tables
-- and so is not subject to their row-level security), STABLE, with an
-- empty search_path. They re-read memberships on every call, so a role
-- change, a deactivation or an organisation suspension applies to the next
-- request, not when the person's session expires.

-- True when this session passed MFA (Supabase sets "aal": "aal2" in the JWT).
create function app.has_mfa()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

-- The caller's role in an ACTIVE membership of an ACTIVE organisation, else null.
create function app.org_role(p_org uuid)
returns public.org_role language sql stable security definer set search_path = ''
as $$
  select m.role
  from public.organisation_members m
  join public.organisations o on o.id = m.organisation_id
  where m.organisation_id = p_org and m.user_id = auth.uid() and m.status = 'active' and o.status = 'active'
$$;

create function app.has_org_role(p_org uuid, p_min public.org_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(app.org_role(p_org) >= p_min, false) $$;

-- Org Admin powers: admin role AND an MFA session.
create function app.can_administer_org(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.has_org_role(p_org, 'admin') and app.has_mfa() $$;

create function app.has_workspace_access(p_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses w
    join public.organisation_members m on m.organisation_id = w.organisation_id
    join public.organisations o on o.id = w.organisation_id
    where w.id = p_workspace
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
      and (
        m.workspace_scope = 'all'
        or exists (
          select 1 from public.member_workspaces mw
          where mw.organisation_id = m.organisation_id and mw.user_id = m.user_id and mw.workspace_id = w.id
        )
      )
  )
$$;

-- Platform Owner: a platform_staff 'owner' row AND an MFA session.
create function app.is_platform_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.has_mfa() and exists (
    select 1 from public.platform_staff s where s.user_id = auth.uid() and s.platform_role = 'owner'
  )
$$;

-- Read-only support access to ONE organisation: Platform Owner with MFA
-- and an unexpired, un-ended session for exactly that organisation.
-- Used ONLY in SELECT policies and read functions, never for writes.
create function app.has_support_access(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.is_platform_owner() and exists (
    select 1 from public.support_sessions s
    where s.platform_user_id = auth.uid()
      and s.organisation_id = p_org
      and s.ended_at is null
      and now() < s.expires_at
  )
$$;

-- Profile visibility: yourself; Org Admins (MFA) for people in orgs they
-- administer; support sessions for people in that org.
create function app.can_see_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_user = auth.uid() or exists (
    select 1 from public.organisation_members m
    where m.user_id = p_user
      and (app.can_administer_org(m.organisation_id) or app.has_support_access(m.organisation_id))
  )
$$;

-- ============================================================================
-- 8. Integrity triggers (apply to everyone, including the service role)
-- ============================================================================

-- Transaction-local switches, set only inside the functions below.
create function app.setting_on(p_name text)
returns boolean language sql stable set search_path = ''
as $$ select coalesce(current_setting(p_name, true), '') = 'on' $$;

-- SECURITY DEFINER so its own lookups (and the organisation row lock) run
-- as the table owner whoever made the change; the service role, for
-- example, has no UPDATE on organisations, which FOR UPDATE would need.
create function app.guard_membership_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_other_admins integer;
begin
  if tg_op = 'DELETE' then
    if not app.setting_on('app.allow_test_purge') then
      raise exception 'Memberships are never deleted; deactivate instead' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.organisation_id <> old.organisation_id or new.user_id <> old.user_id then
    raise exception 'A membership cannot move to another organisation or person' using errcode = '42501';
  end if;

  -- An organisation must always keep at least one active Admin. The
  -- organisation row is locked first so two Admins demoting each other at
  -- the same moment can't both succeed.
  if old.role = 'admin' and old.status = 'active' and not (new.role = 'admin' and new.status = 'active') then
    perform 1 from public.organisations where id = old.organisation_id for update;
    select count(*) into v_other_admins
    from public.organisation_members
    where organisation_id = old.organisation_id and role = 'admin' and status = 'active' and user_id <> old.user_id;
    if v_other_admins = 0 then
      raise exception 'An organisation must keep at least one active Admin' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger organisation_members_guard
  before update or delete on public.organisation_members
  for each row execute function app.guard_membership_changes();

create function app.guard_never_delete()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not app.setting_on('app.allow_test_purge') then
    raise exception '% rows are never deleted', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger profiles_never_delete before delete on public.profiles
  for each row execute function app.guard_never_delete();
create trigger organisations_never_delete before delete on public.organisations
  for each row execute function app.guard_never_delete();

create function app.guard_append_only()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and app.setting_on('app.allow_test_purge') then
    return old;
  end if;
  raise exception '% rows are append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger activity_events_append_only before update or delete on public.activity_events
  for each row execute function app.guard_append_only();
create trigger organisation_audit_log_append_only before update or delete on public.organisation_audit_log
  for each row execute function app.guard_append_only();
create trigger platform_audit_log_append_only before update or delete on public.platform_audit_log
  for each row execute function app.guard_append_only();

-- platform_staff changes only inside bootstrap / transfer (SQL Editor only).
create function app.guard_platform_staff()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not app.setting_on('app.allow_platform_change') then
    raise exception 'Platform roles can only be changed from the SQL Editor' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger platform_staff_guard before insert or update or delete on public.platform_staff
  for each row execute function app.guard_platform_staff();

-- Support sessions: only the end time may ever be set, once.
create function app.guard_support_sessions()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if app.setting_on('app.allow_test_purge') then
      return old;
    end if;
    raise exception 'Support sessions are never deleted' using errcode = '42501';
  end if;
  if new.id <> old.id or new.platform_user_id <> old.platform_user_id or new.organisation_id <> old.organisation_id
     or new.reason <> old.reason or new.started_at <> old.started_at or new.expires_at <> old.expires_at
     or old.ended_at is not null then
    raise exception 'A support session can only be ended, once' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger support_sessions_guard before update or delete on public.support_sessions
  for each row execute function app.guard_support_sessions();

-- ============================================================================
-- 9. Functions
-- ============================================================================
-- Errors use SQLSTATE 42501 (insufficient privilege) for every refusal.

-- ---- SQL Editor only (no grants): Platform Owner bootstrap and recovery ----

-- Run once: select app.bootstrap_platform_owner('<auth user id>', '<full name>');
create function app.bootstrap_platform_owner(p_user uuid, p_full_name text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.platform_staff where platform_role = 'owner') then
    raise exception 'A Platform Owner already exists; use app.transfer_platform_owner() for recovery';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null) then
    raise exception 'No confirmed Auth user with that id';
  end if;
  insert into public.profiles (id, full_name) values (p_user, btrim(p_full_name))
  on conflict (id) do nothing;
  perform set_config('app.allow_platform_change', 'on', true);
  insert into public.platform_staff (user_id, platform_role, granted_reason) values (p_user, 'owner', 'bootstrap');
  perform set_config('app.allow_platform_change', 'off', true);
  insert into public.platform_audit_log (actor_id, action, details) values (p_user, 'platform_owner_bootstrapped', '{}');
end;
$$;

-- Recovery (see supabase/README.md): moves the Platform Owner grant to
-- another confirmed Auth user. Callable only from the SQL Editor, i.e. by
-- someone who controls the Supabase project itself.
create function app.transfer_platform_owner(p_new_user uuid, p_full_name text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_old uuid;
begin
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'A written reason (at least 10 characters) is required';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_new_user and u.email_confirmed_at is not null) then
    raise exception 'No confirmed Auth user with that id';
  end if;
  select user_id into v_old from public.platform_staff where platform_role = 'owner';
  insert into public.profiles (id, full_name) values (p_new_user, btrim(p_full_name))
  on conflict (id) do nothing;
  perform set_config('app.allow_platform_change', 'on', true);
  delete from public.platform_staff where platform_role = 'owner';
  insert into public.platform_staff (user_id, platform_role, granted_reason) values (p_new_user, 'owner', btrim(p_reason));
  perform set_config('app.allow_platform_change', 'off', true);
  -- End any support sessions the previous owner still had open.
  update public.support_sessions set ended_at = now() where ended_at is null and now() < expires_at;
  insert into public.platform_audit_log (actor_id, action, details)
  values (p_new_user, 'platform_owner_transferred', jsonb_build_object('previous_owner', v_old, 'reason', btrim(p_reason)));
end;
$$;

-- ---- Platform Owner (MFA) ----

create function public.create_organisation(p_name text, p_slug text, p_first_admin uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if not app.is_platform_owner() then
    raise exception 'Only the Platform Owner (with MFA) can create organisations' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_first_admin) then
    raise exception 'The first Admin must already have a profile' using errcode = '22023';
  end if;
  insert into public.organisations (name, slug, created_by) values (btrim(p_name), p_slug, auth.uid())
  returning id into v_org;
  -- The only membership a new organisation ever starts with is the named
  -- first Admin, as an invitation. Nobody else gains access.
  insert into public.organisation_members (organisation_id, user_id, role, status, invited_by)
  values (v_org, p_first_admin, 'admin', 'invited', auth.uid());
  insert into public.platform_audit_log (actor_id, organisation_id, action, details)
  values (auth.uid(), v_org, 'organisation_created', jsonb_build_object('first_admin', p_first_admin));
  insert into public.organisation_audit_log (organisation_id, actor_id, target_user_id, action)
  values (v_org, auth.uid(), p_first_admin, 'organisation_created');
  return v_org;
end;
$$;

create function public.create_workspace(p_org uuid, p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_ws uuid;
begin
  if not app.is_platform_owner() then
    raise exception 'Only the Platform Owner (with MFA) can create workspaces' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organisations where id = p_org) then
    raise exception 'No such organisation' using errcode = '22023';
  end if;
  insert into public.businesses (name, organisation_id, slug) values (btrim(p_name), p_org, p_slug)
  returning id into v_ws;
  insert into public.platform_audit_log (actor_id, organisation_id, action, details)
  values (auth.uid(), p_org, 'workspace_created', jsonb_build_object('workspace_id', v_ws, 'slug', p_slug));
  insert into public.organisation_audit_log (organisation_id, actor_id, action, details)
  values (p_org, auth.uid(), 'workspace_created', jsonb_build_object('workspace_id', v_ws, 'slug', p_slug));
  return v_ws;
end;
$$;

-- Read-only support access to one organisation for up to 4 hours.
create function public.start_support_session(p_org uuid, p_reason text, p_minutes integer default 60)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app.is_platform_owner() then
    raise exception 'Only the Platform Owner (with MFA) can start a support session' using errcode = '42501';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 240 then
    raise exception 'A support session lasts between 1 and 240 minutes' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'A written reason (at least 10 characters) is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organisations where id = p_org) then
    raise exception 'No such organisation' using errcode = '22023';
  end if;
  insert into public.support_sessions (platform_user_id, organisation_id, reason, expires_at)
  values (auth.uid(), p_org, btrim(p_reason), now() + make_interval(mins => p_minutes))
  returning id into v_id;
  insert into public.platform_audit_log (actor_id, organisation_id, action, details)
  values (auth.uid(), p_org, 'support_session_started', jsonb_build_object('session_id', v_id, 'minutes', p_minutes, 'reason', btrim(p_reason)));
  -- Visible to the customer's own Admins.
  insert into public.organisation_audit_log (organisation_id, actor_id, action, details)
  values (p_org, auth.uid(), 'support_session_started', jsonb_build_object('session_id', v_id, 'minutes', p_minutes, 'reason', btrim(p_reason)));
  return v_id;
end;
$$;

create function public.end_support_session(p_session uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if not app.is_platform_owner() then
    raise exception 'Only the Platform Owner (with MFA) can end a support session' using errcode = '42501';
  end if;
  update public.support_sessions set ended_at = now()
  where id = p_session and platform_user_id = auth.uid() and ended_at is null
  returning organisation_id into v_org;
  if v_org is null then
    raise exception 'No open support session with that id' using errcode = '22023';
  end if;
  insert into public.platform_audit_log (actor_id, organisation_id, action, details)
  values (auth.uid(), v_org, 'support_session_ended', jsonb_build_object('session_id', p_session));
  insert into public.organisation_audit_log (organisation_id, actor_id, action, details)
  values (v_org, auth.uid(), 'support_session_ended', jsonb_build_object('session_id', p_session));
end;
$$;

-- ---- Org Admin (MFA), own organisation only ----

create function public.set_member_role(p_org uuid, p_user uuid, p_role public.org_role)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.org_role;
begin
  if not app.can_administer_org(p_org) then
    raise exception 'Only an Admin of this organisation (with MFA) can change roles' using errcode = '42501';
  end if;
  select role into v_old from public.organisation_members where organisation_id = p_org and user_id = p_user for update;
  if v_old is null then
    raise exception 'That person is not a member of this organisation' using errcode = '22023';
  end if;
  update public.organisation_members set role = p_role where organisation_id = p_org and user_id = p_user;
  insert into public.organisation_audit_log (organisation_id, actor_id, target_user_id, action, details)
  values (p_org, auth.uid(), p_user, 'role_changed', jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

create function public.deactivate_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.can_administer_org(p_org) then
    raise exception 'Only an Admin of this organisation (with MFA) can deactivate members' using errcode = '42501';
  end if;
  update public.organisation_members
  set status = 'deactivated', deactivated_at = now(), deactivated_by = auth.uid()
  where organisation_id = p_org and user_id = p_user and status <> 'deactivated';
  if not found then
    raise exception 'No member of this organisation to deactivate' using errcode = '22023';
  end if;
  insert into public.organisation_audit_log (organisation_id, actor_id, target_user_id, action)
  values (p_org, auth.uid(), p_user, 'member_deactivated');
end;
$$;

create function public.reactivate_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.can_administer_org(p_org) then
    raise exception 'Only an Admin of this organisation (with MFA) can reactivate members' using errcode = '42501';
  end if;
  update public.organisation_members
  set status = 'active', activated_at = coalesce(activated_at, now()), deactivated_at = null, deactivated_by = null
  where organisation_id = p_org and user_id = p_user and status = 'deactivated';
  if not found then
    raise exception 'No deactivated member of this organisation with that id' using errcode = '22023';
  end if;
  insert into public.organisation_audit_log (organisation_id, actor_id, target_user_id, action)
  values (p_org, auth.uid(), p_user, 'member_reactivated');
end;
$$;

create function public.set_member_workspaces(p_org uuid, p_user uuid, p_scope text, p_workspaces uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.can_administer_org(p_org) then
    raise exception 'Only an Admin of this organisation (with MFA) can change workspace access' using errcode = '42501';
  end if;
  if p_scope not in ('all', 'selected') then
    raise exception 'Scope must be all or selected' using errcode = '22023';
  end if;
  update public.organisation_members set workspace_scope = p_scope where organisation_id = p_org and user_id = p_user;
  if not found then
    raise exception 'That person is not a member of this organisation' using errcode = '22023';
  end if;
  delete from public.member_workspaces where organisation_id = p_org and user_id = p_user;
  if p_scope = 'selected' then
    -- The composite foreign key rejects any workspace of another organisation.
    insert into public.member_workspaces (organisation_id, user_id, workspace_id)
    select p_org, p_user, unnest(coalesce(p_workspaces, '{}'));
  end if;
  insert into public.organisation_audit_log (organisation_id, actor_id, target_user_id, action, details)
  values (p_org, auth.uid(), p_user, 'workspace_scope_changed', jsonb_build_object('scope', p_scope, 'workspaces', coalesce(p_workspaces, '{}')));
end;
$$;

-- Members and their emails for an organisation's Manage Users screen. Org
-- Admins (MFA) of that organisation, or a support session on it (read-only).
create function public.list_org_members(p_org uuid)
returns table (
  user_id uuid, full_name text, email text, role public.org_role, status public.membership_status,
  workspace_scope text, invited_at timestamptz, activated_at timestamptz, deactivated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (app.can_administer_org(p_org) or app.has_support_access(p_org)) then
    raise exception 'Only an Admin of this organisation (with MFA) can list its members' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.full_name, u.email::text, m.role, m.status, m.workspace_scope, m.invited_at, m.activated_at, m.deactivated_at
    from public.organisation_members m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    where m.organisation_id = p_org
    order by p.full_name;
end;
$$;

-- ---- Any signed-in person, about themselves only ----

-- The caller's own memberships (for the organisation picker).
create function public.my_memberships()
returns table (organisation_id uuid, organisation_name text, organisation_slug text, organisation_status public.org_status,
  role public.org_role, status public.membership_status)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.name, o.slug, o.status, m.role, m.status
  from public.organisation_members m
  join public.organisations o on o.id = m.organisation_id
  where m.user_id = auth.uid()
  order by o.name
$$;

-- Accept an invitation: only the caller's own membership, only from
-- 'invited', only once Supabase has confirmed their email.
create function public.activate_my_membership(p_org uuid)
returns public.membership_status language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.membership_status;
begin
  update public.organisation_members m
  set status = 'active', activated_at = now()
  where m.organisation_id = p_org
    and m.user_id = auth.uid()
    and m.status = 'invited'
    and exists (select 1 from auth.users u where u.id = m.user_id and u.email_confirmed_at is not null);
  if found then
    insert into public.organisation_audit_log (organisation_id, actor_id, target_user_id, action)
    values (p_org, auth.uid(), auth.uid(), 'member_activated');
  end if;
  select m.status into v_status from public.organisation_members m where m.organisation_id = p_org and m.user_id = auth.uid();
  return v_status;
end;
$$;

-- ---- Server-side activity writer (used by Stage 4 triggers; no grants) ----
-- Requires real workspace access, so a support session can never write.
create function app.record_activity(
  p_workspace uuid, p_action text, p_entity_type text, p_entity_id text, p_summary text, p_details jsonb default '{}'::jsonb
)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_name text;
  v_id bigint;
begin
  if not app.has_workspace_access(p_workspace) then
    raise exception 'No access to this workspace' using errcode = '42501';
  end if;
  select organisation_id into v_org from public.businesses where id = p_workspace;
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.activity_events (organisation_id, workspace_id, actor_id, actor_name, action, entity_type, entity_id, summary, details)
  values (v_org, p_workspace, auth.uid(), v_name, p_action, p_entity_type, p_entity_id, p_summary, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---- Security-test support (service role only; test data only) ----

-- Create organisations and workspaces for the live security tests, which
-- must not need a Platform Owner. Only slugs starting 'security-test-', and
-- every organisation created here is registered in security_test_fixtures.
create function public.security_test_create_organisation(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  if p_slug not like 'security-test-%' then
    raise exception 'Only security-test organisations can be created this way' using errcode = '42501';
  end if;
  insert into public.organisations (name, slug) values (btrim(p_name), p_slug) returning id into v_org;
  insert into public.security_test_fixtures (kind, id) values ('organisation', v_org);
  return v_org;
end;
$$;

-- True only for organisations created by security_test_create_organisation().
create function app.is_registered_test_organisation(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.security_test_fixtures f
    join public.organisations o on o.id = f.id
    where f.kind = 'organisation' and f.id = p_org and o.slug like 'security-test-%'
  )
$$;

create function public.security_test_create_workspace(p_org uuid, p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_ws uuid;
begin
  if not app.is_registered_test_organisation(p_org) then
    raise exception 'Only registered security-test organisations can receive test workspaces' using errcode = '42501';
  end if;
  insert into public.businesses (name, organisation_id, slug) values (btrim(p_name), p_org, p_slug) returning id into v_ws;
  return v_ws;
end;
$$;

-- Registers a test login so the clean-up may later remove it. Only Auth
-- users on the Stage 1 test sub-domain can be registered.
create function public.security_test_register_user(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.users u where u.id = p_user and lower(u.email) like '%@stage1.pallet-pal-security-test.invalid'
  ) then
    raise exception 'Only Auth users on the Stage 1 test sub-domain can be registered' using errcode = '42501';
  end if;
  insert into public.security_test_fixtures (kind, id) values ('user', p_user) on conflict do nothing;
end;
$$;

-- Writes a test activity event for the live security tests. Refuses any
-- organisation that wasn't created by security_test_create_organisation().
create function public.security_test_record_activity(p_workspace uuid, p_actor uuid, p_summary text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_name text;
  v_id bigint;
begin
  select w.organisation_id into v_org from public.businesses w where w.id = p_workspace;
  if v_org is null or not app.is_registered_test_organisation(v_org) then
    raise exception 'Only registered security-test organisations can receive test activity' using errcode = '42501';
  end if;
  select full_name into v_name from public.profiles where id = p_actor;
  insert into public.activity_events (organisation_id, workspace_id, actor_id, actor_name, action, entity_type, summary)
  values (v_org, p_workspace, p_actor, v_name, 'test.seeded', 'security_test', p_summary)
  returning id into v_id;
  return v_id;
end;
$$;

-- Removes what the Stage 1 security-test seed created, and nothing else.
-- A record is removed only if BOTH hold:
--   - it is registered in security_test_fixtures (created by this suite), and
--   - it still looks like test data: organisation slug 'security-test-…',
--     or Auth email on '@stage1.pallet-pal-security-test.invalid'.
-- An unrelated organisation or login that merely looks like test data is
-- never touched, and nor are the Phase 1 test businesses or their logins.
-- Returns the removed login ids so the seed can delete those Auth users
-- (and only those) through the Auth admin API.
create function public.purge_stage1_security_test_data()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_orgs uuid[];
  v_users uuid[];
begin
  select coalesce(array_agg(o.id), '{}') into v_orgs
  from public.security_test_fixtures f
  join public.organisations o on o.id = f.id
  where f.kind = 'organisation' and o.slug like 'security-test-%';

  select coalesce(array_agg(u.id), '{}') into v_users
  from public.security_test_fixtures f
  join auth.users u on u.id = f.id
  where f.kind = 'user'
    and lower(u.email) like '%@stage1.pallet-pal-security-test.invalid'
    and not exists (select 1 from public.platform_staff s where s.user_id = u.id);

  perform set_config('app.allow_test_purge', 'on', true);
  delete from public.activity_events where organisation_id = any (v_orgs) or actor_id = any (v_users);
  delete from public.organisation_audit_log where organisation_id = any (v_orgs);
  delete from public.platform_audit_log where organisation_id = any (v_orgs);
  delete from public.support_sessions where organisation_id = any (v_orgs);
  delete from public.member_workspaces where organisation_id = any (v_orgs);
  delete from public.organisation_members where organisation_id = any (v_orgs) or user_id = any (v_users);
  delete from public.businesses where organisation_id = any (v_orgs);
  delete from public.organisations where id = any (v_orgs);
  delete from public.profiles where id = any (v_users);
  delete from public.security_test_fixtures where (kind = 'organisation' and id = any (v_orgs)) or (kind = 'user' and id = any (v_users));
  perform set_config('app.allow_test_purge', 'off', true);
  return jsonb_build_object(
    'organisations', coalesce(array_length(v_orgs, 1), 0),
    'users', coalesce(array_length(v_users, 1), 0),
    'user_ids', to_jsonb(v_users)
  );
end;
$$;

-- ============================================================================
-- 10. Function permissions
-- ============================================================================
-- New functions are executable by PUBLIC by default in PostgreSQL. Remove
-- that everywhere, then grant exactly what each caller needs.

revoke execute on all functions in schema app from public;
-- app.is_registered_test_organisation: no grants (used inside the test functions only).
grant execute on function
  app.has_mfa(), app.org_role(uuid), app.has_org_role(uuid, public.org_role), app.can_administer_org(uuid),
  app.has_workspace_access(uuid), app.is_platform_owner(), app.has_support_access(uuid), app.can_see_profile(uuid),
  app.setting_on(text)
to authenticated, service_role;
-- app.bootstrap_platform_owner, app.transfer_platform_owner, app.record_activity
-- and the trigger functions: no grants (SQL Editor / table owner only).

revoke execute on function
  public.create_organisation(text, text, uuid), public.create_workspace(uuid, text, text),
  public.start_support_session(uuid, text, integer), public.end_support_session(uuid),
  public.set_member_role(uuid, uuid, public.org_role), public.deactivate_member(uuid, uuid),
  public.reactivate_member(uuid, uuid), public.set_member_workspaces(uuid, uuid, text, uuid[]),
  public.list_org_members(uuid), public.my_memberships(), public.activate_my_membership(uuid),
  public.security_test_create_organisation(text, text), public.security_test_create_workspace(uuid, text, text), public.security_test_register_user(uuid), public.security_test_record_activity(uuid, uuid, text), public.purge_stage1_security_test_data()
from public, anon;

grant execute on function
  public.create_organisation(text, text, uuid), public.create_workspace(uuid, text, text),
  public.start_support_session(uuid, text, integer), public.end_support_session(uuid),
  public.set_member_role(uuid, uuid, public.org_role), public.deactivate_member(uuid, uuid),
  public.reactivate_member(uuid, uuid), public.set_member_workspaces(uuid, uuid, text, uuid[]),
  public.list_org_members(uuid), public.my_memberships(), public.activate_my_membership(uuid)
to authenticated;

revoke execute on function public.security_test_create_organisation(text, text), public.security_test_create_workspace(uuid, text, text), public.security_test_register_user(uuid), public.security_test_record_activity(uuid, uuid, text), public.purge_stage1_security_test_data()
from authenticated;
grant execute on function public.security_test_create_organisation(text, text), public.security_test_create_workspace(uuid, text, text), public.security_test_register_user(uuid), public.security_test_record_activity(uuid, uuid, text), public.purge_stage1_security_test_data()
to service_role;

-- ============================================================================
-- 11. Table permissions
-- ============================================================================
-- Supabase grants anon, authenticated and service_role full privileges on
-- new public tables by default. Signed-in users only ever READ these
-- tables (the functions above do all writing). The service role keeps
-- write access to the tenant tables the Stage 2 account-management Edge
-- Function needs (profiles, memberships), still subject to the triggers;
-- it loses write access to the platform, support and audit tables, which
-- only the functions above may write.

revoke all on public.organisations, public.profiles, public.organisation_members, public.member_workspaces,
  public.platform_staff, public.support_sessions, public.activity_events, public.organisation_audit_log,
  public.platform_audit_log from anon;

-- The test fixture registry: nobody but the service role may read it, and
-- only the security_test_* functions may write it.
revoke all on public.security_test_fixtures from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.security_test_fixtures from service_role;
grant select on public.security_test_fixtures to service_role;

revoke insert, update, delete, truncate, references, trigger on public.organisations, public.profiles,
  public.organisation_members, public.member_workspaces, public.platform_staff, public.support_sessions,
  public.activity_events, public.organisation_audit_log, public.platform_audit_log from authenticated;

grant select on public.organisations, public.profiles, public.organisation_members, public.member_workspaces,
  public.platform_staff, public.support_sessions, public.activity_events, public.organisation_audit_log,
  public.platform_audit_log to authenticated;

revoke insert, update, delete, truncate, references, trigger on public.organisations, public.platform_staff,
  public.support_sessions, public.activity_events, public.organisation_audit_log, public.platform_audit_log from service_role;

-- Explicit grants for the service role, so this migration doesn't depend
-- on whether the project automatically exposes new tables to the API
-- roles (newer Supabase projects can be set not to).
grant select on public.organisations, public.profiles, public.organisation_members, public.member_workspaces,
  public.platform_staff, public.support_sessions, public.activity_events, public.organisation_audit_log,
  public.platform_audit_log to service_role;
grant insert, update on public.profiles, public.organisation_members to service_role;
grant insert, delete on public.member_workspaces to service_role;

-- The new workspace read policy on the existing businesses table needs
-- SELECT for signed-in users. Projects that expose public tables to the API
-- already have it (a no-op there); this keeps Stage 1 correct either way.
-- No other privilege on businesses is changed.
grant select on public.businesses to authenticated, service_role;

-- ============================================================================
-- 12. Row-level security
-- ============================================================================

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.organisation_members enable row level security;
alter table public.member_workspaces enable row level security;
alter table public.platform_staff enable row level security;
alter table public.support_sessions enable row level security;
alter table public.activity_events enable row level security;
alter table public.organisation_audit_log enable row level security;
alter table public.platform_audit_log enable row level security;
alter table public.security_test_fixtures enable row level security;
-- security_test_fixtures: no policies at all, so no signed-in user can read it.

-- Every policy below is SELECT-only. There are deliberately no INSERT,
-- UPDATE or DELETE policies for signed-in users anywhere in this file,
-- and support access appears only in SELECT policies.

-- The Platform Owner reads this table (name, slug, status, creation
-- details) as the platform directory. Workspaces, members, activity and
-- every other customer record need a support session.
create policy "organisations: members, support sessions and the Platform Owner read"
  on public.organisations for select to authenticated
  using (app.org_role(id) is not null or app.has_support_access(id) or app.is_platform_owner());

-- Additional to the Phase 1 "read only its own row" policy, which is unchanged.
-- No Platform Owner clause: workspace records are customer data, readable
-- only with a support session on that organisation.
create policy "businesses: members read their organisation's workspaces"
  on public.businesses for select to authenticated
  using (
    organisation_id is not null
    and (app.has_workspace_access(id) or app.has_support_access(organisation_id))
  );

create policy "profiles: self, own-org Admins (MFA) and support sessions read"
  on public.profiles for select to authenticated
  using (app.can_see_profile(id));

create policy "organisation_members: own rows, own-org Admins (MFA) and support sessions read"
  on public.organisation_members for select to authenticated
  using (user_id = auth.uid() or app.can_administer_org(organisation_id) or app.has_support_access(organisation_id));

create policy "member_workspaces: own rows, own-org Admins (MFA) and support sessions read"
  on public.member_workspaces for select to authenticated
  using (user_id = auth.uid() or app.can_administer_org(organisation_id) or app.has_support_access(organisation_id));

create policy "platform_staff: a person reads only their own platform grant"
  on public.platform_staff for select to authenticated
  using (user_id = auth.uid());

create policy "support_sessions: Platform Owner (MFA) reads"
  on public.support_sessions for select to authenticated
  using (app.is_platform_owner());

create policy "activity_events: workspace members and support sessions read"
  on public.activity_events for select to authenticated
  using (app.has_workspace_access(workspace_id) or app.has_support_access(organisation_id));

create policy "organisation_audit_log: own-org Admins (MFA) and support sessions read"
  on public.organisation_audit_log for select to authenticated
  using (app.can_administer_org(organisation_id) or app.has_support_access(organisation_id));

create policy "platform_audit_log: Platform Owner (MFA) reads"
  on public.platform_audit_log for select to authenticated
  using (app.is_platform_owner());

-- ============================================================================
-- End of Stage 1 multi-tenant foundation.
-- ============================================================================
