// Proves the local suite can catch real mistakes. Each "mutant" is a copy
// of the Stage 1 migration with ONE realistic security bug introduced;
// the suite must report at least one FAIL for every mutant. A mutant that
// passes the suite means the tests have a blind spot.
//
// Run from supabase/tests/local:  node mutation_check.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const phase1 = '20261120000000_pallet_labels_v2_foundation.sql';
const stage1 = '20261121000000_tenancy_foundation.sql';
const original = fs.readFileSync(path.join(repo, 'supabase', 'migrations', stage1), 'utf8');

const mutants = [
  ['support session not tied to its organisation', 'and s.organisation_id = p_org', ''],
  ['Org Admin powers without MFA', "select app.has_org_role(p_org, 'admin') and app.has_mfa()", "select app.has_org_role(p_org, 'admin')"],
  ['Platform Owner without MFA',
    "select app.has_mfa() and exists (\n    select 1 from public.platform_staff s where s.user_id = auth.uid() and s.platform_role = 'owner'",
    "select exists (\n    select 1 from public.platform_staff s where s.user_id = auth.uid() and s.platform_role = 'owner'"],
  ['selected workspace scope ignored', "m.workspace_scope = 'all'\n        or exists", 'true\n        or exists'],
  ['suspended organisation: roles still work', "m.status = 'active' and o.status = 'active'\n$$;", "m.status = 'active'\n$$;"],
  ['suspended organisation: workspaces still open', "and m.status = 'active'\n      and o.status = 'active'\n      and (", "and m.status = 'active'\n      and ("],
  ['deactivated members keep access', "and m.status = 'active'\n      and o.status = 'active'", "and o.status = 'active'"],
  ['last-Admin rule missing', 'if v_other_admins = 0 then', 'if false then'],
  ['activity readable by everyone', 'using (app.has_workspace_access(workspace_id) or app.has_support_access(organisation_id));', 'using (true);'],
  ['audit log readable by any member', 'using (app.can_administer_org(organisation_id) or app.has_support_access(organisation_id));', "using (app.org_role(organisation_id) is not null);"],
  ['profiles readable by everyone', 'using (app.can_see_profile(id));', 'using (true);'],
  ['new organisation auto-grants existing users',
    "values (v_org, p_first_admin, 'admin', 'invited', auth.uid());",
    "values (v_org, p_first_admin, 'admin', 'invited', auth.uid());\n  insert into public.organisation_members (organisation_id, user_id, role, status, activated_at)\n  select v_org, p.id, 'employee', 'active', now() from public.profiles p where p.id <> p_first_admin on conflict do nothing;"],
  ['support session can write through record_activity',
    "  if not app.has_workspace_access(p_workspace) then\n    raise exception 'No access to this workspace'",
    "  if not (app.has_workspace_access(p_workspace) or app.has_support_access((select organisation_id from public.businesses where id = p_workspace))) then\n    raise exception 'No access to this workspace'"],
  ['Org Admin can act on another organisation', 'if not app.can_administer_org(p_org) then\n    raise exception \'Only an Admin of this organisation (with MFA) can change roles\'',
    'if not exists (select 1 from public.organisation_members where user_id = auth.uid() and role = \'admin\') then\n    raise exception \'Only an Admin of this organisation (with MFA) can change roles\''],
  ['signed-in users keep insert on memberships', 'revoke insert, update, delete, truncate, references, trigger on public.organisations, public.profiles,\n  public.organisation_members,',
    'revoke insert, update, delete, truncate, references, trigger on public.organisations, public.profiles,\n  public.member_workspaces,'],
  ['service role can grant platform roles', "    raise exception 'Platform roles can only be changed from the SQL Editor' using errcode = '42501';", '    null;'],
  ['support sessions can last longer than 4 hours', "expires_at <= started_at + interval '4 hours'", "expires_at <= started_at + interval '400 hours'"],
  ['activity editable', "  raise exception '% rows are append-only', tg_table_name using errcode = '42501';", '  return new;'],
  ['composite workspace key missing',
    "  foreign key (organisation_id, workspace_id) references public.businesses (organisation_id, id) on delete restrict\n);",
    "  foreign key (workspace_id) references public.businesses (id) on delete restrict\n);"],
  // Added after the independent review:
  ['test clean-up selects organisations by slug alone (ignores the fixture registry)',
    "  select coalesce(array_agg(o.id), '{}') into v_orgs\n  from public.security_test_fixtures f\n  join public.organisations o on o.id = f.id\n  where f.kind = 'organisation' and o.slug like 'security-test-%';",
    "  select coalesce(array_agg(o.id), '{}') into v_orgs\n  from public.organisations o\n  where o.slug like 'security-test-%';"],
  ['Platform Owner has standing access to workspace records',
    '    and (app.has_workspace_access(id) or app.has_support_access(organisation_id))',
    '    and (app.has_workspace_access(id) or app.has_support_access(organisation_id) or app.is_platform_owner())'],
];

let blindSpots = 0;
for (const [name, from, to] of mutants) {
  if (!original.includes(from)) {
    console.log(`SKIP  ${name} — mutation target not found (update this script)`);
    blindSpots += 1;
    continue;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pallet-pal-mutant-'));
  fs.mkdirSync(path.join(dir, 'supabase', 'migrations'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'supabase', 'migrations', phase1), path.join(dir, 'supabase', 'migrations', phase1));
  fs.writeFileSync(path.join(dir, 'supabase', 'migrations', stage1), original.replace(from, () => to));
  const res = spawnSync(process.execPath, [path.join(here, 'tenancy_foundation.local.test.mjs'), dir], { encoding: 'utf8' });
  const failures = (res.stdout.match(/^FAIL .*$/gm) || []).map((l) => l.replace(/ — .*$/, ''));
  const caught = failures.length > 0;
  if (!caught) blindSpots += 1;
  console.log(`${caught ? 'CAUGHT' : 'MISSED'}  ${name}${caught ? ` (${failures.length} failing: ${failures[0].replace('FAIL  ', '')}${failures.length > 1 ? ', …' : ''})` : ''}`);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${mutants.length - blindSpots} of ${mutants.length} deliberate bugs caught`);
process.exit(blindSpots ? 1 : 0);
