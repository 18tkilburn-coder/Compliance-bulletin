// Local test of the Stage 1 multi-tenant foundation on real PostgreSQL
// (PGlite, PostgreSQL compiled to WebAssembly). Nothing here touches the
// live Supabase project.
//
// It recreates the Supabase objects the migrations rely on (the anon /
// authenticated / service_role roles and their default privileges,
// auth.users, auth.uid(), auth.jwt() including the MFA "aal" claim, and the
// storage schema), applies the Phase 1 migration and then the Stage 1
// migration exactly as files, and checks every rule from the point of view
// of each kind of person.
//
// Run from supabase/tests/local:
//   npm install
//   node tenancy_foundation.local.test.mjs
// Optional: pass a different repository root as the first argument (used
// to run the suite against deliberately broken copies of the migration).

import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] || path.resolve(here, '..', '..', '..');
const db = new PGlite();

let pass = 0;
let fail = 0;
let section = '';
function check(name, ok, detail) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' — ' + detail}`);
}
function heading(text) {
  section = text;
  console.log(`\n--- ${section} ---`);
}

// ---------------------------------------------------------------------------
// Supabase stand-ins
// ---------------------------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  ${process.env.NO_DEFAULT_TABLE_GRANTS ? '' : 'alter default privileges in schema public grant all on tables to anon, authenticated, service_role;'}
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email varchar(255), email_confirmed_at timestamptz);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant all on storage.objects to anon, authenticated, service_role;
`);

heading('Applying migrations');
for (const file of ['20261120000000_pallet_labels_v2_foundation.sql', '20261121000000_tenancy_foundation.sql']) {
  try {
    await db.exec(fs.readFileSync(path.join(repo, 'supabase', 'migrations', file), 'utf8'));
    check(`applies cleanly: ${file}`, true);
  } catch (e) {
    check(`applies cleanly: ${file}`, false, e.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
async function setSession(role, claims) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims || {})]);
  if (role) await db.exec(`set role ${role}`);
}
// Run one statement as somebody. who: 'owner' (database owner, like the SQL
// Editor), 'service' (service_role key), 'anon', or { id, aal } for a
// signed-in person ('aal2' = passed MFA).
async function run(who, sql, params) {
  if (who === 'owner') await setSession(null, {});
  else if (who === 'service') await setSession('service_role', { role: 'service_role' });
  else if (who === 'anon') await setSession('anon', { role: 'anon' });
  else await setSession('authenticated', { sub: who.id, role: 'authenticated', aal: who.aal || 'aal1' });
  try {
    if (params) {
      const r = await db.query(sql, params);
      return { rows: r.rows, affected: r.affectedRows, error: null };
    }
    const results = await db.exec(sql);
    const last = results[results.length - 1] || { rows: [] };
    return { rows: last.rows, affected: last.affectedRows, error: null };
  } catch (e) {
    return { rows: null, affected: 0, error: e };
  } finally {
    await db.exec('reset role');
  }
}
const refused = (r) => !!r.error && r.error.code === '42501';
const rowsOf = (r) => (r.rows || []).length;
const errText = (r) => (r.error ? `${r.error.code} ${r.error.message}` : `ok, ${rowsOf(r)} rows`);
async function scalar(who, sql, params) {
  const r = await run(who, sql, params);
  if (r.error) throw new Error(`${sql}: ${r.error.message}`);
  return r.rows[0] ? Object.values(r.rows[0])[0] : null;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const U = {};
const names = [
  'sharedA', 'sharedB', 'owner', 'newOwner', 'alice', 'adam', 'emma', 'mike', 'dan', 'ivy', 'una', 'sel',
  'bob', 'bea', 'multi', 'ghost', 'outsider', 'carol',
];
names.forEach((n, i) => {
  U[n] = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
});
const person = (n, aal = 'aal1') => ({ id: U[n], aal });
const mfa = (n) => person(n, 'aal2');

await run('owner', `insert into auth.users (id, email, email_confirmed_at) values ${names
  .map((n) => `('${U[n]}', '${n.toLowerCase()}@example.test', ${n === 'una' ? 'null' : 'now()'})`)
  .join(', ')}`);

// Phase 1 baseline: two shared business logins with pallet data.
await run('owner', `
  insert into public.businesses (auth_user_id, name) values ('${U.sharedA}', 'Test Business A'), ('${U.sharedB}', 'Test Business B');
  insert into public.pallet_limits (business_id, size_key, max_qty_per_pallet) select id, 'test-size', 100 from public.businesses;
  insert into public.pallet_label_batches (business_id, name, pallets, grand_total) select id, 'Test batch', '[]', 10 from public.businesses;
`);
const phase1Before = JSON.stringify((await run('owner', 'select id, auth_user_id, name from public.businesses order by name')).rows);

// Platform Owner, organisations, workspaces.
await run('owner', `insert into public.profiles (id, full_name) values ${names
  .filter((n) => !['sharedA', 'sharedB', 'outsider'].includes(n))
  .map((n) => `('${U[n]}', '${n[0].toUpperCase()}${n.slice(1)} Test')`)
  .join(', ')}`);
await run('owner', `select app.bootstrap_platform_owner('${U.owner}', 'Owner Test')`);
const orgA = await scalar(mfa('owner'), `select public.create_organisation('Org A', 'test-org-a', '${U.alice}')`);
const orgB = await scalar(mfa('owner'), `select public.create_organisation('Org B', 'test-org-b', '${U.bob}')`);
const wsA1 = await scalar(mfa('owner'), `select public.create_workspace('${orgA}', 'A One', 'a-one')`);
const wsA2 = await scalar(mfa('owner'), `select public.create_workspace('${orgA}', 'A Two', 'a-two')`);
const wsB1 = await scalar(mfa('owner'), `select public.create_workspace('${orgB}', 'B One', 'b-one')`);
await scalar(person('alice'), `select public.activate_my_membership('${orgA}')`);
await scalar(person('bob'), `select public.activate_my_membership('${orgB}')`);

// Other members, added the way the Stage 2 Edge Function will (service role).
await run('service', `
  insert into public.organisation_members (organisation_id, user_id, role, status, activated_at) values
    ('${orgA}', '${U.emma}', 'employee', 'active', now()),
    ('${orgA}', '${U.mike}', 'manager', 'active', now()),
    ('${orgA}', '${U.dan}', 'employee', 'active', now()),
    ('${orgA}', '${U.sel}', 'employee', 'active', now()),
    ('${orgA}', '${U.multi}', 'employee', 'active', now()),
    ('${orgB}', '${U.bea}', 'employee', 'active', now()),
    ('${orgB}', '${U.multi}', 'manager', 'active', now());
  insert into public.organisation_members (organisation_id, user_id, role) values
    ('${orgA}', '${U.ivy}', 'employee'), ('${orgA}', '${U.una}', 'employee');
`);

// Activity by several people in several workspaces.
async function activity(n, ws, summary) {
  await setSession(null, { sub: U[n], role: 'authenticated', aal: 'aal1' });
  await db.query(`select app.record_activity($1, 'test.seeded', 'test', null, $2)`, [ws, summary]);
  await db.exec('reset role');
}
await activity('emma', wsA1, 'Emma in A1');
await activity('mike', wsA2, 'Mike in A2');
await activity('dan', wsA1, 'Dan in A1 before deactivation');
await activity('bea', wsB1, 'Bea in B1');
await scalar(mfa('alice'), `select public.deactivate_member('${orgA}', '${U.dan}')`).then(() => null);
await scalar(mfa('alice'), `select public.set_member_workspaces('${orgA}', '${U.sel}', 'selected', array['${wsA2}']::uuid[])`).then(() => null);

// ---------------------------------------------------------------------------
heading('Phase 1 baseline is unchanged');
// ---------------------------------------------------------------------------
check('Phase 1 business rows unchanged (still no organisation, same logins)',
  JSON.stringify((await run('owner', 'select id, auth_user_id, name from public.businesses where organisation_id is null order by name')).rows) === phase1Before);
let r = await run(person('sharedA'), 'select name from public.businesses');
check('shared login A still reads only its own business', !r.error && rowsOf(r) === 1 && r.rows[0].name === 'Test Business A', errText(r));
r = await run(person('sharedA'), 'select business_id from public.pallet_limits');
check('shared login A still reads only its own pallet limits', !r.error && rowsOf(r) === 1, errText(r));
r = await run(person('sharedA'), `insert into public.pallet_limits (business_id, size_key, max_qty_per_pallet) select id, 'x', 1 from public.businesses where name = 'Test Business B'`);
check('shared login A still cannot write Test Business B (42501)', refused(r) || (!r.error && r.affected === 0), errText(r));
r = await run(person('sharedA'), 'select id from public.organisations');
check('shared login reads no organisations', !r.error && rowsOf(r) === 0, errText(r));
for (const n of ['emma', 'alice']) {
  r = await run(n === 'alice' ? mfa(n) : person(n), 'select id from public.pallet_limits union all select id from public.pallet_label_batches');
  check(`new member ${n} reads no Phase 1 pallet data (moves in Stage 4)`, !r.error && rowsOf(r) === 0, errText(r));
}

// ---------------------------------------------------------------------------
heading('Tenant isolation: members see only their own organisation');
// ---------------------------------------------------------------------------
r = await run(person('emma'), 'select slug from public.organisations');
check('A employee reads only organisation A', !r.error && rowsOf(r) === 1 && r.rows[0].slug === 'test-org-a', errText(r));
r = await run(person('emma'), 'select slug from public.businesses order by slug');
check('A employee reads both A workspaces and no others', !r.error && r.rows.map((x) => x.slug).join() === 'a-one,a-two', errText(r));
r = await run(person('emma'), 'select summary from public.activity_events order by id');
check('A employee reads A activity across both workspaces, including other people\'s',
  !r.error && rowsOf(r) === 3 && r.rows.some((x) => x.summary === 'Mike in A2'), errText(r));
check('A employee does not see organisation B activity', !(r.rows || []).some((x) => x.summary.includes('Bea')));
r = await run(person('emma'), `select * from public.activity_events where workspace_id = '${wsB1}'`);
check('A employee asking for a B workspace by id gets nothing', !r.error && rowsOf(r) === 0, errText(r));
r = await run(person('bea'), 'select summary from public.activity_events');
check('B employee reads only B activity', !r.error && rowsOf(r) === 1 && r.rows[0].summary === 'Bea in B1', errText(r));
r = await run(person('bea'), 'select slug from public.businesses');
check('B employee reads only the B workspace', !r.error && rowsOf(r) === 1 && r.rows[0].slug === 'b-one', errText(r));
r = await run(mfa('alice'), `select user_id from public.organisation_members where organisation_id = '${orgB}'`);
check('A Admin (MFA) reads no B memberships', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('alice'), `select id from public.profiles where id = '${U.bea}'`);
check('A Admin (MFA) cannot read a B member\'s profile', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('alice'), `select id from public.organisation_audit_log where organisation_id = '${orgB}'`);
check('A Admin (MFA) cannot read B\'s audit log', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('alice'), `select * from public.list_org_members('${orgB}')`);
check('A Admin (MFA) cannot list B\'s members (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select public.set_member_role('${orgB}', '${U.bea}', 'admin')`);
check('A Admin (MFA) cannot change a B member\'s role (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select public.deactivate_member('${orgB}', '${U.bob}')`);
check('A Admin (MFA) cannot deactivate B\'s Admin (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select public.set_member_workspaces('${orgA}', '${U.sel}', 'selected', array['${wsB1}']::uuid[])`);
check('A Admin cannot give an A member a B workspace (foreign key)', !!r.error && /foreign key/i.test(r.error.message), errText(r));
r = await run(person('emma'), `insert into public.activity_events (organisation_id, workspace_id, actor_id, actor_name, action, entity_type, summary) values ('${orgA}', '${wsB1}', '${U.emma}', 'x', 'forged.event', 'x', 'forged')`);
check('A employee cannot write activity into a B workspace (42501)', refused(r), errText(r));
r = await run('owner', `insert into public.activity_events (organisation_id, workspace_id, actor_id, actor_name, action, entity_type, summary) values ('${orgA}', '${wsB1}', '${U.emma}', 'x', 'forged.event', 'x', 'forged')`);
check('even the owner cannot pair organisation A with a B workspace (composite foreign key)', !!r.error && /foreign key/i.test(r.error.message), errText(r));
r = await run(person('emma'), `select public.activate_my_membership('${orgB}') as s`);
check('activating a membership you do not have does nothing', !r.error && r.rows[0].s === null, errText(r));

// Selected workspace scope.
r = await run(person('sel'), 'select slug from public.businesses');
check('member limited to selected workspaces sees only those', !r.error && rowsOf(r) === 1 && r.rows[0].slug === 'a-two', errText(r));
r = await run(person('sel'), 'select summary from public.activity_events');
check('…and only their activity', !r.error && rowsOf(r) === 1 && r.rows[0].summary === 'Mike in A2', errText(r));

// Multi-organisation member: independent roles.
r = await run(person('multi'), 'select slug from public.organisations order by slug');
check('a member of A and B sees both organisations', !r.error && r.rows.map((x) => x.slug).join() === 'test-org-a,test-org-b', errText(r));
r = await run(person('multi'), 'select public.my_memberships()');
check('my_memberships lists both, with each role', !r.error && rowsOf(r) === 2, errText(r));
r = await run(mfa('multi'), `select public.set_member_role('${orgB}', '${U.bea}', 'manager')`);
check('manager in B (with MFA) still cannot administer B (42501)', refused(r), errText(r));
r = await run(mfa('multi'), `select public.set_member_role('${orgA}', '${U.emma}', 'manager')`);
check('employee in A (with MFA) cannot administer A (42501)', refused(r), errText(r));

// ---------------------------------------------------------------------------
heading('New organisations never grant access to existing people');
// ---------------------------------------------------------------------------
const orgC = await scalar(mfa('owner'), `select public.create_organisation('Org C', 'test-org-c', '${U.carol}')`);
const wsC1 = await scalar(mfa('owner'), `select public.create_workspace('${orgC}', 'C One', 'c-one')`);
check('organisation C starts with exactly one membership: its named first Admin, invited',
  (await scalar('owner', `select count(*)::int from public.organisation_members where organisation_id = '${orgC}'`)) === 1 &&
  (await scalar('owner', `select status::text from public.organisation_members where organisation_id = '${orgC}'`)) === 'invited');
for (const n of ['alice', 'emma', 'multi', 'bob']) {
  r = await run(mfa(n), `select id from public.businesses where organisation_id = '${orgC}' union all select id from public.organisations where id = '${orgC}'`);
  check(`existing person ${n} gets nothing in the new organisation`, !r.error && rowsOf(r) === 0, errText(r));
}
r = await run(person('carol'), `select id from public.businesses where id = '${wsC1}'`);
check('C\'s first Admin sees nothing until they accept the invitation', !r.error && rowsOf(r) === 0, errText(r));
await scalar(person('carol'), `select public.activate_my_membership('${orgC}')`);
r = await run(person('carol'), `select id from public.businesses where id = '${wsC1}'`);
check('…and sees C\'s workspace after accepting', !r.error && rowsOf(r) === 1, errText(r));

// ---------------------------------------------------------------------------
heading('Privilege escalation attempts');
// ---------------------------------------------------------------------------
r = await run(person('emma'), `update public.organisation_members set role = 'admin' where user_id = '${U.emma}'`);
check('employee cannot edit their own membership directly (42501)', refused(r), errText(r));
r = await run(mfa('emma'), `select public.set_member_role('${orgA}', '${U.emma}', 'admin')`);
check('employee (even with MFA) cannot promote themselves (42501)', refused(r), errText(r));
r = await run(mfa('mike'), `select public.set_member_role('${orgA}', '${U.emma}', 'manager')`);
check('manager (with MFA) cannot change roles (42501)', refused(r), errText(r));
r = await run(mfa('mike'), `select public.deactivate_member('${orgA}', '${U.emma}')`);
check('manager (with MFA) cannot deactivate anyone (42501)', refused(r), errText(r));
r = await run(person('alice'), `select public.set_member_role('${orgA}', '${U.emma}', 'manager')`);
check('Org Admin WITHOUT MFA cannot change roles (42501)', refused(r), errText(r));
r = await run(person('alice'), `select * from public.list_org_members('${orgA}')`);
check('Org Admin WITHOUT MFA cannot list members (42501)', refused(r), errText(r));
r = await run(person('alice'), `select id from public.organisation_audit_log`);
check('Org Admin WITHOUT MFA reads no audit log', !r.error && rowsOf(r) === 0, errText(r));
r = await run(person('emma'), `insert into public.organisation_members (organisation_id, user_id, role, status, activated_at) values ('${orgB}', '${U.emma}', 'admin', 'active', now())`);
check('employee cannot add themselves to another organisation (42501)', refused(r), errText(r));
r = await run(person('ghost'), `insert into public.profiles (id, full_name) values ('${U.outsider}', 'x')`);
check('nobody can create profiles directly (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select public.create_organisation('Mine', 'test-org-mine', '${U.alice}')`);
check('Org Admin cannot create organisations (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select public.create_workspace('${orgA}', 'Extra', 'extra')`);
check('Org Admin cannot create workspaces (Platform Owner only, initially) (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select public.start_support_session('${orgB}', 'Trying to look at org B')`);
check('Org Admin cannot start a support session (42501)', refused(r), errText(r));
r = await run(person('emma'), `select app.record_activity('${wsA1}', 'forged.event', 'x', null, 'forged')`);
check('nobody can call the activity writer directly (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select app.bootstrap_platform_owner('${U.alice}', 'Alice')`);
check('Org Admin cannot call bootstrap_platform_owner (42501)', refused(r), errText(r));
r = await run(mfa('alice'), `select app.transfer_platform_owner('${U.alice}', 'Alice', 'taking over the platform')`);
check('Org Admin cannot call transfer_platform_owner (42501)', refused(r), errText(r));
r = await run(person('emma'), 'select public.purge_stage1_security_test_data()');
check('signed-in users cannot call the test clean-up (42501)', refused(r), errText(r));
r = await run(person('emma'), `select public.security_test_create_organisation('x', 'security-test-x')`);
check('signed-in users cannot call the test organisation helper (42501)', refused(r), errText(r));
r = await run('service', `insert into public.platform_staff (user_id, platform_role) values ('${U.alice}', 'owner')`);
check('the service role cannot grant platform roles (42501)', refused(r), errText(r));
r = await run('service', `insert into public.organisations (name, slug) values ('Sneaky', 'sneaky')`);
check('the service role cannot create organisations directly (42501)', refused(r), errText(r));
r = await run('service', `select public.security_test_create_organisation('Real', 'real-company')`);
check('the test organisation helper refuses non-test slugs (42501)', refused(r), errText(r));

// ---------------------------------------------------------------------------
heading('Org Admin powers (MFA), last-Admin rule, immediate effect');
// ---------------------------------------------------------------------------
r = await run(mfa('alice'), `select * from public.list_org_members('${orgA}')`);
check('Org Admin (MFA) lists own members with emails', !r.error && rowsOf(r) === 8 && r.rows.every((x) => x.email), errText(r));
r = await run(mfa('alice'), `select public.set_member_role('${orgA}', '${U.emma}', 'manager')`);
check('Org Admin (MFA) promotes an employee to manager', !r.error, errText(r));
check('…which takes effect on the next request', (await scalar(person('emma'), `select app.has_org_role('${orgA}', 'manager')`)) === true);
await run(mfa('alice'), `select public.set_member_role('${orgA}', '${U.emma}', 'employee')`);
check('…and so does the demotion', (await scalar(person('emma'), `select app.has_org_role('${orgA}', 'manager')`)) === false);
r = await run(mfa('alice'), `select public.set_member_role('${orgA}', '${U.alice}', 'manager')`);
check('the only active Admin cannot demote themselves (last-Admin rule)', refused(r) && /at least one active Admin/.test(r.error.message), errText(r));
r = await run(mfa('alice'), `select public.deactivate_member('${orgA}', '${U.alice}')`);
check('the only active Admin cannot deactivate themselves', refused(r), errText(r));
r = await run(mfa('alice'), `select public.set_member_role('${orgA}', '${U.mike}', 'admin')`);
check('Org Admin appoints a second Org Admin', !r.error, errText(r));
r = await run(mfa('alice'), `select public.set_member_role('${orgA}', '${U.alice}', 'manager')`);
check('with another Admin, an Admin may step down', !r.error, errText(r));
r = await run(mfa('mike'), `select public.set_member_role('${orgA}', '${U.mike}', 'employee')`);
check('…but the remaining Admin cannot', refused(r), errText(r));
await run(mfa('mike'), `select public.set_member_role('${orgA}', '${U.alice}', 'admin')`);
await run(mfa('alice'), `select public.set_member_role('${orgA}', '${U.mike}', 'manager')`);
r = await run('service', `update public.organisation_members set status = 'deactivated', deactivated_at = now() where organisation_id = '${orgA}' and user_id = '${U.alice}'`);
check('even the service role cannot remove the last active Admin (the last-Admin rule, not a permission error)',
  refused(r) && /at least one active Admin/.test(r.error.message), errText(r));
// The Stage 2 account function (service role) must be able to make
// legitimate changes, including demoting an Admin when another remains.
r = await run('service', `update public.organisation_members set role = 'admin' where organisation_id = '${orgA}' and user_id = '${U.mike}'`);
check('the service role can appoint an Admin (Stage 2 path)', !r.error && r.affected === 1, errText(r));
r = await run('service', `update public.organisation_members set role = 'manager' where organisation_id = '${orgA}' and user_id = '${U.mike}'`);
check('the service role can demote an Admin while another remains (Stage 2 path)', !r.error && r.affected === 1, errText(r));
r = await run(mfa('alice'), `select action from public.organisation_audit_log where organisation_id = '${orgA}'`);
check('role changes are in A\'s audit log', !r.error && r.rows.filter((x) => x.action === 'role_changed').length >= 5, errText(r));
r = await run(person('emma'), `select id from public.organisation_audit_log`);
check('employees cannot read the audit log', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('mike'), `select id from public.organisation_audit_log`);
check('managers cannot read the audit log', !r.error && rowsOf(r) === 0, errText(r));

// ---------------------------------------------------------------------------
heading('Deactivated, invited, profile-less and anonymous access');
// ---------------------------------------------------------------------------
for (const [label, who] of [['deactivated member', person('dan')], ['invited member', person('una')], ['profile with no membership', person('ghost')], ['login with no profile', person('outsider')]]) {
  r = await run(who, 'select id from public.activity_events union all select id::text::bigint from (select 1 as id) x where false');
  const act = await run(who, 'select id from public.activity_events');
  const ws = await run(who, 'select id from public.businesses');
  const orgs = await run(who, 'select id from public.organisations');
  check(`${label} reads no activity, workspaces or organisations`, !act.error && !ws.error && !orgs.error && rowsOf(act) + rowsOf(ws) + rowsOf(orgs) === 0,
    `${errText(act)} / ${errText(ws)} / ${errText(orgs)}`);
}
check('history is kept after deactivation (Dan\'s activity still visible to A)',
  (await run(person('emma'), `select 1 from public.activity_events where actor_id = '${U.dan}'`)).rows.length === 1);
r = await run(person('dan'), `select public.activate_my_membership('${orgA}') as s`);
check('a deactivated member cannot reactivate themselves', !r.error && r.rows[0].s === 'deactivated', errText(r));
r = await run(person('una'), `select public.activate_my_membership('${orgA}') as s`);
check('an invitation with an unconfirmed email cannot be accepted', !r.error && r.rows[0].s === 'invited', errText(r));
r = await run(person('ivy'), `select public.activate_my_membership('${orgA}') as s`);
check('an invitation with a confirmed email is accepted', !r.error && r.rows[0].s === 'active', errText(r));
r = await run(mfa('alice'), `select public.reactivate_member('${orgA}', '${U.dan}')`);
check('Org Admin (MFA) can reactivate a deactivated member', !r.error, errText(r));
await run(mfa('alice'), `select public.deactivate_member('${orgA}', '${U.dan}')`);
for (const table of ['organisations', 'profiles', 'organisation_members', 'member_workspaces', 'platform_staff', 'support_sessions', 'activity_events', 'organisation_audit_log', 'platform_audit_log']) {
  r = await run('anon', `select * from public.${table}`);
  check(`anon cannot read ${table} (42501)`, refused(r), errText(r));
}
r = await run('anon', 'select public.my_memberships()');
check('anon cannot call account functions (42501)', refused(r), errText(r));

// ---------------------------------------------------------------------------
heading('Platform Owner: MFA, no standing access to tenant data');
// ---------------------------------------------------------------------------
r = await run(person('owner'), `select public.create_organisation('No MFA', 'test-org-nomfa', '${U.ghost}')`);
check('Platform Owner WITHOUT MFA cannot create organisations (42501)', refused(r), errText(r));
r = await run(person('owner'), 'select id from public.platform_audit_log');
check('Platform Owner WITHOUT MFA reads no platform audit log', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), 'select action from public.platform_audit_log');
check('Platform Owner (MFA) reads the platform audit log', !r.error && rowsOf(r) >= 6, errText(r));
r = await run(mfa('alice'), 'select id from public.platform_audit_log');
check('Org Admins cannot read the platform audit log', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), 'select id, name, slug, status, created_at from public.organisations order by slug');
check('Platform Owner (MFA) sees the organisation directory (name, slug, status, created)', !r.error && rowsOf(r) === 3, errText(r));
r = await run(person('owner'), 'select id from public.organisations');
check('…but not without MFA', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), 'select id from public.businesses where organisation_id is not null');
check('Platform Owner (MFA) reads NO customer workspace records without a support session', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), `select id from public.businesses where id in ('${wsA1}', '${wsA2}', '${wsB1}')`);
check('…not even by asking for specific workspace ids', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), 'select workspace_id from public.member_workspaces');
check('…and no workspace assignments', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), 'select id from public.activity_events');
check('…but no tenant activity without a support session', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), `select id from public.profiles where id <> '${U.owner}'`);
check('…and no customer profiles without a support session', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), `select * from public.list_org_members('${orgA}')`);
check('…and cannot list members without a support session (42501)', refused(r), errText(r));
r = await run(person('emma'), 'select user_id from public.platform_staff');
check('staff cannot see who holds platform roles', !r.error && rowsOf(r) === 0, errText(r));
r = await run(person('owner'), 'select platform_role from public.platform_staff');
check('the Platform Owner can see their own grant', !r.error && rowsOf(r) === 1, errText(r));

// ---------------------------------------------------------------------------
heading('Support sessions: read-only, reason, 4-hour limit, visible to the customer');
// ---------------------------------------------------------------------------
r = await run(person('owner'), `select public.start_support_session('${orgA}', 'Customer asked for help')`);
check('support session requires MFA (42501)', refused(r), errText(r));
r = await run(mfa('owner'), `select public.start_support_session('${orgA}', 'short')`);
check('support session requires a written reason of 10+ characters', !!r.error && /reason/.test(r.error.message), errText(r));
r = await run(mfa('owner'), `select public.start_support_session('${orgA}', 'Customer asked for help', 241)`);
check('support session cannot exceed 4 hours (240 minutes)', !!r.error && /240/.test(r.error.message), errText(r));
r = await run('owner', `insert into public.support_sessions (platform_user_id, organisation_id, reason, started_at, expires_at) values ('${U.owner}', '${orgA}', 'Direct insert attempt', now(), now() + interval '5 hours')`);
check('the 4-hour limit holds even for direct inserts (check constraint)', !!r.error && /check constraint/.test(r.error.message), errText(r));
const sessionA = await scalar(mfa('owner'), `select public.start_support_session('${orgA}', 'Customer reported missing pallet labels', 60)`);
check('Platform Owner (MFA) starts a 60-minute support session on A', !!sessionA);
r = await run(mfa('owner'), 'select summary from public.activity_events');
check('support session reads A activity', !r.error && rowsOf(r) === 3, errText(r));
check('…but not B activity', !(r.rows || []).some((x) => x.summary.includes('Bea')));
r = await run(mfa('owner'), 'select id from public.businesses where organisation_id is not null order by slug');
check('support session on A reads A\'s two workspaces and no others',
  !r.error && rowsOf(r) === 2 && r.rows.every((x) => [wsA1, wsA2].includes(x.id)), errText(r));
r = await run(mfa('owner'), `select * from public.list_org_members('${orgA}')`);
check('support session lists A members', !r.error && rowsOf(r) === 8, errText(r));
r = await run(mfa('owner'), `select * from public.list_org_members('${orgB}')`);
check('support session on A gives nothing in B (42501)', refused(r), errText(r));
r = await run(person('owner'), 'select id from public.activity_events');
check('support access also requires MFA at use time', !r.error && rowsOf(r) === 0, errText(r));
// Write attempts during support.
r = await run(mfa('owner'), `select public.set_member_role('${orgA}', '${U.emma}', 'admin')`);
check('support session cannot change roles (42501)', refused(r), errText(r));
r = await run(mfa('owner'), `select public.deactivate_member('${orgA}', '${U.emma}')`);
check('support session cannot deactivate (42501)', refused(r), errText(r));
r = await run(mfa('owner'), `select public.set_member_workspaces('${orgA}', '${U.emma}', 'all', null)`);
check('support session cannot change workspace access (42501)', refused(r), errText(r));
r = await run(mfa('owner'), `insert into public.activity_events (organisation_id, workspace_id, actor_id, actor_name, action, entity_type, summary) values ('${orgA}', '${wsA1}', '${U.owner}', 'x', 'forged.event', 'x', 'forged')`);
check('support session cannot write activity (42501)', refused(r), errText(r));
await setSession(null, { sub: U.owner, role: 'authenticated', aal: 'aal2' });
r = await (async () => {
  try {
    await db.query(`select app.record_activity($1, 'support.write', 'x', null, 'attempt')`, [wsA1]);
    return { error: null };
  } catch (e) {
    return { error: e };
  }
})();
await db.exec('reset role');
check('support session fails the activity writer\'s workspace check (42501)', refused(r), errText(r));
r = await run(mfa('owner'), `update public.organisation_members set role = 'employee' where organisation_id = '${orgA}'`);
check('support session cannot update memberships directly (42501)', refused(r), errText(r));
r = await run(mfa('owner'), `insert into public.pallet_limits (business_id, size_key, max_qty_per_pallet) values ('${wsA1}', 'x', 1)`);
check('support session cannot write Phase 1 pallet data', refused(r), errText(r));
r = await run(mfa('owner'), `update public.support_sessions set expires_at = expires_at + interval '1 hour'`);
check('support session cannot be extended (42501)', refused(r), errText(r));
r = await run('service', `update public.support_sessions set expires_at = expires_at + interval '1 hour'`);
check('…not even by the service role', refused(r), errText(r));
r = await run(mfa('alice'), `select action, details->>'reason' as reason from public.organisation_audit_log where action = 'support_session_started'`);
check('the support session and its reason appear in A\'s own audit log', !r.error && rowsOf(r) === 1 && r.rows[0].reason.includes('missing pallet labels'), errText(r));
r = await run(mfa('bob'), `select id from public.organisation_audit_log where action = 'support_session_started'`);
check('…and not in B\'s', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), `select public.end_support_session('${sessionA}')`);
check('Platform Owner ends the session', !r.error, errText(r));
r = await run(mfa('owner'), 'select id from public.activity_events');
check('ended session gives no further access', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), 'select id from public.businesses where organisation_id is not null');
check('…including to A\'s workspace records', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('owner'), `select public.end_support_session('${sessionA}')`);
check('an ended session cannot be ended or reopened again', !!r.error, errText(r));
await run('owner', `insert into public.support_sessions (platform_user_id, organisation_id, reason, started_at, expires_at) values ('${U.owner}', '${orgA}', 'Session that has already expired', now() - interval '3 hours', now() - interval '1 hour')`);
r = await run(mfa('owner'), 'select id from public.activity_events');
check('an expired session gives no access', !r.error && rowsOf(r) === 0, errText(r));

// ---------------------------------------------------------------------------
heading('History and integrity (apply even to the owner / service role)');
// ---------------------------------------------------------------------------
r = await run('service', `delete from public.organisation_members where user_id = '${U.dan}'`);
check('memberships are never deleted', refused(r), errText(r));
r = await run('service', `delete from public.profiles where id = '${U.dan}'`);
check('profiles are never deleted', refused(r), errText(r));
r = await run('owner', `delete from auth.users where id = '${U.dan}'`);
check('the Auth user behind a profile cannot be deleted', !!r.error && /foreign key/i.test(r.error.message), errText(r));
r = await run('owner', `delete from public.organisations where id = '${orgB}'`);
check('organisations are never deleted', refused(r), errText(r));
r = await run('owner', `update public.activity_events set summary = 'edited'`);
check('activity is append-only', refused(r), errText(r));
r = await run('owner', `delete from public.organisation_audit_log`);
check('organisation audit log is append-only', refused(r), errText(r));
r = await run('owner', `update public.platform_audit_log set action = 'organisation_created'`);
check('platform audit log is append-only', refused(r), errText(r));
r = await run('owner', `update public.organisation_members set organisation_id = '${orgB}' where user_id = '${U.emma}' and organisation_id = '${orgA}'`);
check('a membership cannot be moved to another organisation', refused(r), errText(r));
r = await run('owner', `insert into public.platform_staff (user_id, platform_role) values ('${U.alice}', 'owner')`);
check('platform roles cannot be granted outside bootstrap/transfer', refused(r), errText(r));
r = await run('owner', `select set_config('app.allow_platform_change', 'on', false); insert into public.platform_staff (user_id, platform_role) values ('${U.alice}', 'owner')`);
await run('owner', `select set_config('app.allow_platform_change', 'off', false)`);
check('the unique index alone blocks a second Platform Owner', !!r.error && /platform_staff_single_owner|duplicate key/.test(r.error.message), errText(r));
r = await run('owner', `select app.bootstrap_platform_owner('${U.alice}', 'Alice')`);
check('bootstrap refuses once a Platform Owner exists', !!r.error && /already exists/.test(r.error.message), errText(r));
await run('owner', `update public.organisations set status = 'suspended' where id = '${orgB}'`);
r = await run(person('bea'), 'select id from public.activity_events');
check('members of a suspended organisation lose access to its activity', !r.error && rowsOf(r) === 0, errText(r));
r = await run(person('bea'), 'select id from public.businesses');
check('…and to its workspaces', !r.error && rowsOf(r) === 0, errText(r));
r = await run(person('bea'), 'select id from public.organisations');
check('…and to the organisation itself', !r.error && rowsOf(r) === 0, errText(r));
r = await run(mfa('bob'), `select * from public.list_org_members('${orgB}')`);
check('…and its Admin loses Admin powers (42501)', refused(r), errText(r));
await run('owner', `update public.organisations set status = 'active' where id = '${orgB}'`);

// ---------------------------------------------------------------------------
heading('Platform Owner recovery (SQL Editor only)');
// ---------------------------------------------------------------------------
const recoverySession = await scalar(mfa('owner'), `select public.start_support_session('${orgB}', 'Open session before a recovery', 60)`);
r = await run('owner', `select app.transfer_platform_owner('${U.newOwner}', 'New Owner Test', 'short')`);
check('recovery requires a written reason', !!r.error && /reason/.test(r.error.message), errText(r));
r = await run('owner', `select app.transfer_platform_owner('${U.newOwner}', 'New Owner Test', 'Lost authenticator and email access, verified identity offline')`);
check('recovery moves the Platform Owner grant from the SQL Editor', !r.error, errText(r));
check('the previous owner loses platform powers', (await scalar(mfa('owner'), 'select app.is_platform_owner()')) === false);
check('the new owner has platform powers (with MFA)', (await scalar(mfa('newOwner'), 'select app.is_platform_owner()')) === true);
check('the previous owner\'s open support sessions were ended',
  (await scalar('owner', `select ended_at is not null from public.support_sessions where id = '${recoverySession}'`)) === true);
r = await run(mfa('newOwner'), `select action from public.platform_audit_log where action = 'platform_owner_transferred'`);
check('the transfer is in the platform audit log', !r.error && rowsOf(r) === 1, errText(r));

// ---------------------------------------------------------------------------
heading('Security-test clean-up touches only test data');
// ---------------------------------------------------------------------------
// The suite's own fixtures: created through the security_test_* helpers,
// so they are registered in security_test_fixtures.
const T = {
  user: '00000000-0000-4000-8000-0000000000aa',
  outsiderUser: '00000000-0000-4000-8000-0000000000ab',
  lookalikeUser: '00000000-0000-4000-8000-0000000000ac',
  phase1Lookalike: '00000000-0000-4000-8000-0000000000ad',
  lookalikeAdmin: '00000000-0000-4000-8000-0000000000ae',
};
await run('owner', `insert into auth.users (id, email, email_confirmed_at) values
  ('${T.user}', 'emp@stage1.pallet-pal-security-test.invalid', now()),
  ('${T.outsiderUser}', 'outsider@stage1.pallet-pal-security-test.invalid', now()),
  ('${T.lookalikeUser}', 'not-registered@stage1.pallet-pal-security-test.invalid', now()),
  ('${T.phase1Lookalike}', 'test-business-c@pallet-pal-security-test.invalid', now()),
  ('${T.lookalikeAdmin}', 'lookalike-admin@example.test', now())`);
const tOrg = await scalar('service', `select public.security_test_create_organisation('Security Test Org', 'security-test-org-x')`);
const tWs = await scalar('service', `select public.security_test_create_workspace('${tOrg}', 'Test WS', 'test-ws')`);
await scalar('service', `select public.security_test_register_user('${T.user}')`);
await scalar('service', `select public.security_test_register_user('${T.outsiderUser}')`);
await run('service', `insert into public.profiles (id, full_name) values ('${T.user}', 'Test Emp');
  insert into public.organisation_members (organisation_id, user_id, role, status, activated_at) values ('${tOrg}', '${T.user}', 'admin', 'active', now())`);
await scalar('service', `select public.security_test_record_activity('${tWs}', '${T.user}', 'test activity')`);
check('the test helpers registered exactly the suite\'s organisation and two logins',
  (await scalar('owner', 'select count(*)::int from public.security_test_fixtures')) === 3);

// Look-alikes that must NEVER be removed: an organisation with a
// security-test- slug created normally (not by the test helpers), an
// unregistered login on the Stage 1 test sub-domain, and a Phase 1-style
// test login.
const lookalikeOrg = await scalar(mfa('newOwner'), `select public.create_organisation('Unrelated Look-alike', 'security-test-unrelated', '${U.carol}')`);
const lookalikeWs = await scalar(mfa('newOwner'), `select public.create_workspace('${lookalikeOrg}', 'Look-alike WS', 'lookalike-ws')`);
await run('owner', `insert into public.profiles (id, full_name) values ('${T.lookalikeUser}', 'Unregistered Look-alike')`);
await run('service', `insert into public.organisation_members (organisation_id, user_id, role, status, activated_at) values ('${lookalikeOrg}', '${T.lookalikeUser}', 'employee', 'active', now())`);
await activity('emma', wsA1, 'real activity that must survive the clean-up');

r = await run('service', `select public.security_test_create_workspace('${lookalikeOrg}', 'x', 'x')`);
check('test workspace helper refuses an unregistered security-test- organisation (42501)', refused(r), errText(r));
r = await run('service', `select public.security_test_record_activity('${lookalikeWs}', '${T.user}', 'x')`);
check('test activity helper refuses an unregistered security-test- organisation (42501)', refused(r), errText(r));
r = await run('service', `select public.security_test_record_activity('${wsA1}', '${U.emma}', 'into a real org')`);
check('test activity helper refuses real organisations (42501)', refused(r), errText(r));
r = await run('service', `select public.security_test_register_user('${T.phase1Lookalike}')`);
check('a Phase 1-style test login (parent domain) cannot be registered for clean-up (42501)', refused(r), errText(r));
r = await run('service', `select public.security_test_register_user('${U.emma}')`);
check('a real login cannot be registered for clean-up (42501)', refused(r), errText(r));
r = await run(person('emma'), 'select * from public.security_test_fixtures');
check('signed-in users cannot read the fixture registry (42501)', refused(r), errText(r));
r = await run('service', `insert into public.security_test_fixtures (kind, id) values ('organisation', '${lookalikeOrg}')`);
check('the service role cannot add rows to the registry directly (42501)', refused(r), errText(r));
r = await run(person('emma'), `select public.security_test_register_user('${T.lookalikeUser}')`);
check('signed-in users cannot register test logins (42501)', refused(r), errText(r));

const snapshot = async () => JSON.stringify((await run('owner', `select
  (select count(*) from public.organisations where id <> '${tOrg}') o,
  (select count(*) from public.businesses where organisation_id is null or organisation_id <> '${tOrg}') b,
  (select count(*) from public.profiles where id <> '${T.user}') p,
  (select count(*) from public.organisation_members where organisation_id <> '${tOrg}') m,
  (select count(*) from public.activity_events where organisation_id <> '${tOrg}') a,
  (select count(*) from public.organisation_audit_log where organisation_id <> '${tOrg}') oa,
  (select count(*) from public.platform_audit_log) pa,
  (select count(*) from public.pallet_limits) pl,
  (select count(*) from public.pallet_label_batches) pb`)).rows);
const before = await snapshot();
r = await run('service', 'select public.purge_stage1_security_test_data() as res');
const res = r.rows ? r.rows[0].res : null;
check('purge removes exactly the suite\'s organisation and its two registered logins',
  !r.error && res.organisations === 1 && res.users === 2 && [T.user, T.outsiderUser].every((id) => res.user_ids.includes(id)), errText(r));
check('purge returns only registered login ids (for the seed to delete from Auth)',
  !!res && res.user_ids.length === 2 && !res.user_ids.includes(T.lookalikeUser) && !res.user_ids.includes(T.phase1Lookalike));
check('the unrelated security-test- organisation is NOT deleted',
  (await scalar('owner', `select count(*)::int from public.organisations where id = '${lookalikeOrg}'`)) === 1);
check('…nor its workspace or members',
  (await scalar('owner', `select count(*)::int from public.businesses where id = '${lookalikeWs}'`)) === 1 &&
  (await scalar('owner', `select count(*)::int from public.organisation_members where organisation_id = '${lookalikeOrg}'`)) === 2);
check('the unregistered look-alike login\'s profile is NOT deleted',
  (await scalar('owner', `select count(*)::int from public.profiles where id = '${T.lookalikeUser}'`)) === 1);
check('everything outside the suite\'s own fixtures is untouched (orgs, workspaces, people, members, activity, audit, Phase 1)',
  (await snapshot()) === before, `${before} vs ${await snapshot()}`);
check('the suite\'s registry entries are removed with them',
  (await scalar('owner', 'select count(*)::int from public.security_test_fixtures')) === 0);
r = await run('service', 'select public.purge_stage1_security_test_data() as res');
check('a second purge finds nothing to remove', !r.error && r.rows[0].res.organisations === 0 && r.rows[0].res.users === 0, errText(r));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
