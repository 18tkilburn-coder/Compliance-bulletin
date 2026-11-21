// Stage 1 (multi-tenant foundation) live test fixtures, for
// tenancy_foundation.test.js. Uses the SERVICE ROLE key, like
// seed_test_businesses.js — run it locally only, never in a browser.
//
// SAFETY
//   1. Project check: SUPABASE_URL must be a standard
//      https://<project-ref>.supabase.co address, and you must also set
//      STAGE1_SEED_PROJECT_REF to that same project ref. The seed refuses to
//      run if they differ, so a key or URL left over from another project
//      can't be used by accident.
//   2. Explicit opt-in before deleting anything: if earlier Stage 1 test
//      data exists, the seed stops and deletes nothing unless
//      STAGE1_SEED_ALLOW_RESET is set to exactly
//      'delete-previous-stage1-test-data'.
//   3. Narrow deletion: it deletes only what the Stage 1 fixture registry
//      (public.security_test_fixtures) lists as created by this suite —
//      via public.purge_stage1_security_test_data() — and only Auth users
//      whose id that function returns AND whose email is on the reserved
//      sub-domain @stage1.pallet-pal-security-test.invalid. Each is
//      re-checked before deletion.
//   4. It never touches real data, never creates a Platform Owner, and never
//      touches the Phase 1 test businesses or their logins
//      (test-business-a/b@pallet-pal-security-test.invalid), which can't be
//      registered for clean-up.
//
// What it creates (all registered as Stage 1 fixtures):
//   - two test organisations (security-test-org-a / -b) with three test
//     workspaces (two in A, one in B);
//   - ten test logins on the reserved sub-domain, with memberships covering
//     every role and state, one person in both organisations, and one login
//     with no profile;
//   - a few test activity events.
//
// Re-seed before each test run (the test accepts the "invited" membership
// and enrols MFA factors on the test Admin logins).
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGE1_SEED_PROJECT_REF
//   STAGE1_SEED_ALLOW_RESET='delete-previous-stage1-test-data'  (only to replace earlier Stage 1 test data)

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const TEST_SUBDOMAIN = 'stage1.pallet-pal-security-test.invalid';
const RESET_PHRASE = 'delete-previous-stage1-test-data';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAGE1_SEED_PROJECT_REF, STAGE1_SEED_ALLOW_RESET } = process.env;

function stop(message) {
  console.error(`\nSeed stopped — nothing was deleted. ${message}`);
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STAGE1_SEED_PROJECT_REF) {
  stop('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and STAGE1_SEED_PROJECT_REF (the project ref you intend to seed).');
}
const urlMatch = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(SUPABASE_URL.trim());
if (!urlMatch) {
  stop(`SUPABASE_URL must look like https://<20-character project ref>.supabase.co (got "${SUPABASE_URL}").`);
}
const PROJECT_REF = urlMatch[1];
if (STAGE1_SEED_PROJECT_REF.trim() !== PROJECT_REF) {
  stop(`STAGE1_SEED_PROJECT_REF ("${STAGE1_SEED_PROJECT_REF}") does not match the project in SUPABASE_URL ("${PROJECT_REF}").`);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// key: env-var prefix; memberships: [org, role, status, scope]
const PEOPLE = [
  { key: 'A_ADMIN', name: 'Stage1 A Admin', memberships: [['A', 'admin', 'active']] },
  { key: 'A_MGR', name: 'Stage1 A Manager', memberships: [['A', 'manager', 'active']] },
  { key: 'A_EMP', name: 'Stage1 A Employee', memberships: [['A', 'employee', 'active']] },
  { key: 'A_SEL', name: 'Stage1 A Selected', memberships: [['A', 'employee', 'active', 'selected']] },
  { key: 'A_DEACT', name: 'Stage1 A Deactivated', memberships: [['A', 'employee', 'deactivated']] },
  { key: 'A_INVITED', name: 'Stage1 A Invited', memberships: [['A', 'employee', 'invited']] },
  { key: 'B_ADMIN', name: 'Stage1 B Admin', memberships: [['B', 'admin', 'active']] },
  { key: 'B_EMP', name: 'Stage1 B Employee', memberships: [['B', 'employee', 'active']] },
  { key: 'MULTI', name: 'Stage1 Multi', memberships: [['A', 'employee', 'active'], ['B', 'manager', 'active']] },
  { key: 'OUTSIDER', name: null, memberships: [] },
];

function rpcOrThrow(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function isStage1TestEmail(email) {
  const e = (email || '').toLowerCase();
  return e.endsWith(`@${TEST_SUBDOMAIN}`) && !e.startsWith('test-business-');
}

// Removes earlier Stage 1 fixtures, but only with the explicit opt-in.
async function removePreviousStage1TestData() {
  const { data: fixtures, error } = await admin.from('security_test_fixtures').select('kind, id');
  if (error) throw new Error(`Reading the Stage 1 fixture registry failed (is the Stage 1 migration applied?): ${error.message}`);
  if (!fixtures.length) {
    console.log('No earlier Stage 1 test data found; nothing to remove.');
    return;
  }
  const orgs = fixtures.filter((f) => f.kind === 'organisation').length;
  const users = fixtures.filter((f) => f.kind === 'user').length;
  if (STAGE1_SEED_ALLOW_RESET !== RESET_PHRASE) {
    stop(
      `Earlier Stage 1 test data exists in project ${PROJECT_REF} (${orgs} test organisations, ${users} test logins). ` +
        `To delete it and re-seed, set $env:STAGE1_SEED_ALLOW_RESET='${RESET_PHRASE}' and run again.`
    );
  }

  const purged = rpcOrThrow('purge_stage1_security_test_data', await admin.rpc('purge_stage1_security_test_data'));
  let removed = 0;
  for (const id of purged.user_ids || []) {
    const { data: found, error: getError } = await admin.auth.admin.getUserById(id);
    if (getError || !found || !found.user) {
      console.log(`  (login ${id} no longer exists in Auth; skipped)`);
      continue;
    }
    if (!isStage1TestEmail(found.user.email)) {
      throw new Error(`Refusing to delete ${id}: its email (${found.user.email}) is not on the Stage 1 test sub-domain.`);
    }
    const { error: delError } = await admin.auth.admin.deleteUser(id);
    if (delError) throw new Error(`Deleting test login ${found.user.email} failed: ${delError.message}`);
    removed += 1;
  }
  console.log(`Removed earlier Stage 1 test data: ${purged.organisations} organisations, ${purged.users} registered logins (${removed} deleted from Auth).`);
}

async function main() {
  console.log(`\nTarget project: ${PROJECT_REF} (confirmed by STAGE1_SEED_PROJECT_REF)\n`);
  await removePreviousStage1TestData();

  const orgs = {
    A: rpcOrThrow('create org A', await admin.rpc('security_test_create_organisation', { p_name: 'Security Test Org A', p_slug: 'security-test-org-a' })),
    B: rpcOrThrow('create org B', await admin.rpc('security_test_create_organisation', { p_name: 'Security Test Org B', p_slug: 'security-test-org-b' })),
  };
  const ws = {
    A1: rpcOrThrow('workspace A1', await admin.rpc('security_test_create_workspace', { p_org: orgs.A, p_name: 'Test Workspace A1', p_slug: 'a-one' })),
    A2: rpcOrThrow('workspace A2', await admin.rpc('security_test_create_workspace', { p_org: orgs.A, p_name: 'Test Workspace A2', p_slug: 'a-two' })),
    B1: rpcOrThrow('workspace B1', await admin.rpc('security_test_create_workspace', { p_org: orgs.B, p_name: 'Test Workspace B1', p_slug: 'b-one' })),
  };

  const created = {};
  for (const p of PEOPLE) {
    const email = `${p.key.toLowerCase().replace('_', '-')}@${TEST_SUBDOMAIN}`;
    const password = `Test-${crypto.randomBytes(12).toString('base64url')}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`Creating ${email} failed: ${error.message}`);
    // Register immediately, so the clean-up can find it later. If that
    // fails, remove the login we just made rather than leave it untracked.
    const reg = await admin.rpc('security_test_register_user', { p_user: data.user.id });
    if (reg.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new Error(`Registering ${email} as a Stage 1 fixture failed (login removed again): ${reg.error.message}`);
    }
    created[p.key] = { email, password, id: data.user.id };
    if (!p.name) continue;

    const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, full_name: p.name });
    if (profileError) throw new Error(`Profile for ${email} failed: ${profileError.message}`);
    for (const [orgKey, role, status, scope] of p.memberships) {
      const row = {
        organisation_id: orgs[orgKey],
        user_id: data.user.id,
        role,
        status: status === 'deactivated' ? 'active' : status,
        activated_at: status === 'invited' ? null : new Date().toISOString(),
        workspace_scope: scope || 'all',
      };
      const { error: memberError } = await admin.from('organisation_members').insert(row);
      if (memberError) throw new Error(`Membership for ${email} failed: ${memberError.message}`);
    }
  }

  // The "selected" member may only use workspace A2.
  {
    const { error } = await admin.from('member_workspaces').insert({ organisation_id: orgs.A, user_id: created.A_SEL.id, workspace_id: ws.A2 });
    if (error) throw new Error(`Selected workspace failed: ${error.message}`);
  }

  // Activity by several people (before the deactivation, so it's history).
  for (const [key, wsKey, text] of [
    ['A_EMP', 'A1', 'A employee in A1'],
    ['A_MGR', 'A2', 'A manager in A2'],
    ['A_DEACT', 'A1', 'A deactivated member, before deactivation'],
    ['B_EMP', 'B1', 'B employee in B1'],
  ]) {
    rpcOrThrow('test activity', await admin.rpc('security_test_record_activity', { p_workspace: ws[wsKey], p_actor: created[key].id, p_summary: text }));
  }

  {
    const { error } = await admin
      .from('organisation_members')
      .update({ status: 'deactivated', deactivated_at: new Date().toISOString() })
      .eq('organisation_id', orgs.A)
      .eq('user_id', created.A_DEACT.id);
    if (error) throw new Error(`Deactivating the test member failed: ${error.message}`);
  }

  console.log('\nCreated Stage 1 test organisations, workspaces and logins (registered as Stage 1 fixtures).\n');
  console.log('Set these in the same PowerShell window, then run tenancy_foundation.test.js:\n');
  console.log(`$env:STAGE1_ORG_A='${orgs.A}'`);
  console.log(`$env:STAGE1_ORG_B='${orgs.B}'`);
  console.log(`$env:STAGE1_WS_A1='${ws.A1}'`);
  console.log(`$env:STAGE1_WS_A2='${ws.A2}'`);
  console.log(`$env:STAGE1_WS_B1='${ws.B1}'`);
  for (const p of PEOPLE) {
    console.log(`$env:STAGE1_${p.key}_EMAIL='${created[p.key].email}'`);
    console.log(`$env:STAGE1_${p.key}_PASSWORD='${created[p.key].password}'`);
  }
}

main().catch((err) => {
  console.error('\nSeeding failed:', err.message);
  process.exit(1);
});
