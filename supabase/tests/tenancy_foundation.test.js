// Stage 1 live security acceptance tests for the multi-tenant foundation
// (20261121000000_tenancy_foundation.sql), run through the normal Supabase
// API exactly as the app will reach it.
//
// Covers, against the live project:
//   - tenant isolation between two test organisations (reads, writes,
//     forged workspace ids, cross-organisation admin actions);
//   - privilege escalation attempts by employees, managers, Admins without
//     MFA, and multi-organisation members;
//   - Org Admin powers with a real MFA session (TOTP), the last-Admin rule,
//     and appointing / standing down a second Admin;
//   - platform-only functions refused to everyone in the test (there is no
//     Platform Owner here; Platform Owner and support-session behaviour is
//     covered by the local suite in supabase/tests/local);
//   - deactivated, invited and profile-less logins, and the anon key;
//   - the Phase 1 pallet tables still closed to the new identities.
//
// Uses only the publishable (anon) key and the Stage 1 test logins. No
// service-role key is read. Every check is free (no AI calls).
//
// Prerequisites: the Stage 1 migration is applied, TOTP MFA is enabled in
// the project (Authentication > Multi-Factor, on by default), and
// seed_test_tenancy.js has just been run (it prints the variables).
//
// Re-seed before each run: this test accepts the invited membership and
// enrols MFA factors on the test Admin logins.

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const PEOPLE = ['A_ADMIN', 'A_MGR', 'A_EMP', 'A_SEL', 'A_DEACT', 'A_INVITED', 'B_ADMIN', 'B_EMP', 'MULTI', 'OUTSIDER'];
const required = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'STAGE1_ORG_A', 'STAGE1_ORG_B', 'STAGE1_WS_A1', 'STAGE1_WS_A2', 'STAGE1_WS_B1',
  ...PEOPLE.flatMap((k) => [`STAGE1_${k}_EMAIL`, `STAGE1_${k}_PASSWORD`]),
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('Run seed_test_tenancy.js first and set the values it prints.');
  process.exit(1);
}
const env = process.env;
const ORG_A = env.STAGE1_ORG_A;
const ORG_B = env.STAGE1_ORG_B;
const WS = { A1: env.STAGE1_WS_A1, A2: env.STAGE1_WS_A2, B1: env.STAGE1_WS_B1 };

let passCount = 0;
let failCount = 0;

function outcome(error, data) {
  const res = Array.isArray(data) ? `${data.length} rows` : data === null || data === undefined ? 'none' : JSON.stringify(data);
  return `error: ${error ? [error.code, error.message].filter(Boolean).join(' | ') : 'none'}; result: ${res}`;
}
function report(name, passed, detail) {
  if (passed) passCount += 1;
  else failCount += 1;
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : ' — ' + detail}`);
}
const refused = (error) => !!error && error.code === '42501';
const empty = (error, data) => !error && Array.isArray(data) && data.length === 0;

// ---- TOTP (RFC 6238: SHA-1, 30-second steps, 6 digits) for MFA sessions ----
function base32Decode(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of text.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v < 0) throw new Error('Bad base32 secret');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

async function signIn(key) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: env[`STAGE1_${key}_EMAIL`], password: env[`STAGE1_${key}_PASSWORD`] });
  if (error) throw new Error(`Could not sign in as ${key}: ${error.message}`);
  return { client, id: data.user.id };
}

// Enrols a TOTP factor and completes a challenge, upgrading the session to aal2.
async function withMfa(key) {
  const who = await signIn(key);
  const enrol = await who.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `stage1-${key}-${Date.now()}` });
  if (enrol.error) throw new Error(`MFA enrolment for ${key} failed (is TOTP MFA enabled?): ${enrol.error.message}`);
  const factorId = enrol.data.id;
  const challenge = await who.client.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(`MFA challenge for ${key} failed: ${challenge.error.message}`);
  const verify = await who.client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: totp(enrol.data.totp.secret) });
  if (verify.error) throw new Error(`MFA verification for ${key} failed: ${verify.error.message}`);
  const aal = await who.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.data?.currentLevel !== 'aal2') throw new Error(`MFA session for ${key} is not aal2`);
  return who;
}

async function main() {
  console.log('\n=== Multi-tenant foundation acceptance tests (Stage 1) ===\n');

  const p = {};
  for (const key of PEOPLE) p[key] = await signIn(key);
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  let aAdminMfa;
  let bAdminMfa;
  try {
    aAdminMfa = await withMfa('A_ADMIN');
    bAdminMfa = await withMfa('B_ADMIN');
    report('test Admins obtained real MFA (aal2) sessions', true);
  } catch (e) {
    report('test Admins obtained real MFA (aal2) sessions', false, e.message);
  }

  // -------------------------------------------------------------------
  console.log('\nTenant isolation:\n');
  // -------------------------------------------------------------------
  {
    const { data, error } = await p.A_EMP.client.from('organisations').select('id');
    report('A employee reads only organisation A', !error && data.length === 1 && data[0].id === ORG_A, outcome(error, data));
  }
  {
    const { data, error } = await p.A_EMP.client.from('businesses').select('id').not('organisation_id', 'is', null);
    const ids = (data || []).map((r) => r.id).sort();
    report('A employee reads both A workspaces and no others', !error && JSON.stringify(ids) === JSON.stringify([WS.A1, WS.A2].sort()), outcome(error, data));
  }
  {
    const { data, error } = await p.A_EMP.client.from('activity_events').select('summary, workspace_id').eq('action', 'test.seeded');
    const ws = new Set((data || []).map((r) => r.workspace_id));
    report('A employee reads activity across both A workspaces, including other people\'s',
      !error && ws.has(WS.A1) && ws.has(WS.A2) && data.some((r) => r.summary === 'A manager in A2'), outcome(error, data));
    report('A employee sees no organisation B activity', !(data || []).some((r) => r.workspace_id === WS.B1));
  }
  {
    const { data, error } = await p.A_EMP.client.from('activity_events').select('id').eq('workspace_id', WS.B1);
    report('asking for a B workspace\'s activity by id returns nothing', empty(error, data), outcome(error, data));
  }
  {
    const { data, error } = await p.B_EMP.client.from('activity_events').select('workspace_id').eq('action', 'test.seeded');
    report('B employee reads only B activity', !error && data.length === 1 && data[0].workspace_id === WS.B1, outcome(error, data));
  }
  {
    const { data, error } = await p.A_SEL.client.from('businesses').select('id').not('organisation_id', 'is', null);
    report('member limited to selected workspaces sees only A2', !error && data.length === 1 && data[0].id === WS.A2, outcome(error, data));
  }
  {
    const { data, error } = await p.MULTI.client.rpc('my_memberships');
    report('a member of both organisations sees both memberships', !error && data.length === 2, outcome(error, data));
  }
  if (aAdminMfa) {
    let r = await aAdminMfa.client.rpc('list_org_members', { p_org: ORG_B });
    report('A Admin (MFA) cannot list B\'s members — 42501', refused(r.error), outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('set_member_role', { p_org: ORG_B, p_user: p.B_EMP.id, p_role: 'admin' });
    report('A Admin (MFA) cannot change a B member\'s role — 42501', refused(r.error), outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('deactivate_member', { p_org: ORG_B, p_user: p.B_ADMIN.id });
    report('A Admin (MFA) cannot deactivate B\'s Admin — 42501', refused(r.error), outcome(r.error, r.data));
    r = await aAdminMfa.client.from('organisation_audit_log').select('id').eq('organisation_id', ORG_B);
    report('A Admin (MFA) cannot read B\'s audit log', empty(r.error, r.data), outcome(r.error, r.data));
    r = await aAdminMfa.client.from('profiles').select('id').eq('id', p.B_EMP.id);
    report('A Admin (MFA) cannot read a B member\'s profile', empty(r.error, r.data), outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('set_member_workspaces', { p_org: ORG_A, p_user: p.A_SEL.id, p_scope: 'selected', p_workspaces: [WS.B1] });
    report('A Admin cannot give an A member a B workspace — rejected (foreign key 23503)', !!r.error && r.error.code === '23503', outcome(r.error, r.data));
  }
  {
    const { data, error } = await p.A_EMP.client.from('activity_events').insert({
      organisation_id: ORG_A, workspace_id: WS.B1, actor_id: p.B_EMP.id, actor_name: 'x', action: 'forged.event', entity_type: 'x', summary: 'forged',
    });
    report('A employee cannot forge activity into a B workspace — 42501', refused(error), outcome(error, data));
  }

  // -------------------------------------------------------------------
  console.log('\nPrivilege escalation:\n');
  // -------------------------------------------------------------------
  {
    let r = await p.A_EMP.client.from('organisation_members').update({ role: 'admin' }).eq('user_id', p.A_EMP.id).select();
    report('employee cannot edit their membership directly — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.A_EMP.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_EMP.id, p_role: 'admin' });
    report('employee cannot promote themselves — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.A_MGR.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_EMP.id, p_role: 'manager' });
    report('manager cannot change roles — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.A_ADMIN.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_EMP.id, p_role: 'manager' });
    report('Org Admin WITHOUT MFA cannot change roles — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.A_ADMIN.client.rpc('list_org_members', { p_org: ORG_A });
    report('Org Admin WITHOUT MFA cannot list members — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.MULTI.client.rpc('set_member_role', { p_org: ORG_B, p_user: p.B_EMP.id, p_role: 'manager' });
    report('a manager in B / employee in A cannot administer B — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.A_EMP.client.from('organisation_members').insert({ organisation_id: ORG_B, user_id: p.A_EMP.id, role: 'admin', status: 'active', activated_at: new Date().toISOString() });
    report('employee cannot add themselves to organisation B — 42501', refused(r.error), outcome(r.error, r.data));
    r = await p.OUTSIDER.client.from('profiles').insert({ id: p.OUTSIDER.id, full_name: 'Self-made' });
    report('a login with no profile cannot create one — 42501', refused(r.error), outcome(r.error, r.data));
  }
  for (const [label, who] of [['Org Admin (MFA)', aAdminMfa], ['employee', p.A_EMP]]) {
    if (!who) continue;
    let r = await who.client.rpc('create_organisation', { p_name: 'Not allowed', p_slug: 'security-test-not-allowed', p_first_admin: who.id });
    report(`${label} cannot create organisations (Platform Owner only) — 42501`, refused(r.error), outcome(r.error, r.data));
    r = await who.client.rpc('create_workspace', { p_org: ORG_A, p_name: 'Not allowed', p_slug: 'not-allowed' });
    report(`${label} cannot create workspaces — 42501`, refused(r.error), outcome(r.error, r.data));
    r = await who.client.rpc('start_support_session', { p_org: ORG_B, p_reason: 'Attempting to open a support session' });
    report(`${label} cannot start a support session — 42501`, refused(r.error), outcome(r.error, r.data));
  }
  for (const fn of ['purge_stage1_security_test_data', 'security_test_create_organisation']) {
    const r = await p.A_EMP.client.rpc(fn, fn === 'security_test_create_organisation' ? { p_name: 'x', p_slug: 'security-test-x' } : {});
    report(`signed-in users cannot call ${fn} — 42501`, refused(r.error), outcome(r.error, r.data));
  }
  {
    const { data, error } = await p.A_EMP.client.from('platform_staff').select('user_id');
    report('staff cannot see who holds platform roles', empty(error, data), outcome(error, data));
  }

  // -------------------------------------------------------------------
  console.log('\nOrg Admin powers with MFA, and the last-Admin rule:\n');
  // -------------------------------------------------------------------
  if (aAdminMfa) {
    let r = await aAdminMfa.client.rpc('list_org_members', { p_org: ORG_A });
    report('Org Admin (MFA) lists A members with emails', !r.error && r.data.length === 7 && r.data.every((m) => m.email), outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_ADMIN.id, p_role: 'manager' });
    report('the only active Admin cannot step down — 42501 (last-Admin rule)', refused(r.error) && /at least one active Admin/.test(r.error.message), outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_MGR.id, p_role: 'admin' });
    report('Org Admin (MFA) appoints a second Org Admin', !r.error, outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_MGR.id, p_role: 'manager' });
    report('…and can return them to manager while still an Admin', !r.error, outcome(r.error, r.data));
    r = await aAdminMfa.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_EMP.id, p_role: 'manager' });
    const promoted = await p.A_EMP.client.from('organisation_members').select('role').eq('organisation_id', ORG_A).eq('user_id', p.A_EMP.id);
    report('a role change applies to the person\'s very next request', !r.error && promoted.data?.[0]?.role === 'manager', outcome(promoted.error, promoted.data));
    await aAdminMfa.client.rpc('set_member_role', { p_org: ORG_A, p_user: p.A_EMP.id, p_role: 'employee' });
    r = await aAdminMfa.client.from('organisation_audit_log').select('action').eq('organisation_id', ORG_A).eq('action', 'role_changed');
    report('role changes are recorded in A\'s audit log', !r.error && r.data.length >= 4, outcome(r.error, r.data));
    r = await p.A_EMP.client.from('organisation_audit_log').select('id');
    report('employees cannot read the audit log', empty(r.error, r.data), outcome(r.error, r.data));
    r = await p.A_MGR.client.from('organisation_audit_log').select('id');
    report('managers cannot read the audit log', empty(r.error, r.data), outcome(r.error, r.data));
  }
  if (bAdminMfa) {
    const r = await bAdminMfa.client.from('organisation_audit_log').select('organisation_id');
    report('B Admin (MFA) sees only B\'s audit entries', !r.error && (r.data || []).every((x) => x.organisation_id === ORG_B), outcome(r.error, r.data));
  }

  // -------------------------------------------------------------------
  console.log('\nDeactivated, invited, profile-less and anonymous:\n');
  // -------------------------------------------------------------------
  for (const [label, who] of [['deactivated member', p.A_DEACT], ['invited member (not yet accepted)', p.A_INVITED], ['login with no profile', p.OUTSIDER]]) {
    const a = await who.client.from('activity_events').select('id');
    const w = await who.client.from('businesses').select('id').not('organisation_id', 'is', null);
    const o = await who.client.from('organisations').select('id');
    report(`${label} reads no activity, workspaces or organisations`,
      empty(a.error, a.data) && empty(w.error, w.data) && empty(o.error, o.data), `${outcome(a.error, a.data)} / ${outcome(w.error, w.data)} / ${outcome(o.error, o.data)}`);
  }
  {
    const { data, error } = await p.A_EMP.client.from('activity_events').select('id').eq('actor_id', p.A_DEACT.id);
    report('the deactivated member\'s past activity is kept and still visible', !error && data.length === 1, outcome(error, data));
  }
  {
    let r = await p.A_DEACT.client.rpc('activate_my_membership', { p_org: ORG_A });
    report('a deactivated member cannot reactivate themselves', !r.error && r.data === 'deactivated', outcome(r.error, r.data));
    r = await p.A_INVITED.client.rpc('activate_my_membership', { p_org: ORG_A });
    report('an invited member accepts their invitation', !r.error && r.data === 'active', outcome(r.error, r.data));
    r = await p.A_INVITED.client.from('activity_events').select('id').eq('action', 'test.seeded');
    report('…and can then read A activity', !r.error && r.data.length >= 3, outcome(r.error, r.data));
    r = await p.A_EMP.client.rpc('activate_my_membership', { p_org: ORG_B });
    report('activating a membership you do not have does nothing', !r.error && r.data === null, outcome(r.error, r.data));
  }
  for (const table of ['organisations', 'profiles', 'organisation_members', 'member_workspaces', 'platform_staff', 'support_sessions', 'activity_events', 'organisation_audit_log', 'platform_audit_log']) {
    const { data, error } = await anon.from(table).select('*').limit(5);
    report(`anon cannot read ${table}`, refused(error) || empty(error, data), outcome(error, data));
  }
  {
    const { data, error } = await anon.rpc('my_memberships');
    report('anon cannot call account functions', !!error, outcome(error, data));
  }

  // -------------------------------------------------------------------
  console.log('\nPhase 1 unchanged until Stage 4:\n');
  // -------------------------------------------------------------------
  for (const table of ['pallet_limits', 'pallet_label_batches']) {
    const { data, error } = await p.A_EMP.client.from(table).select('id').limit(5);
    report(`new members read no ${table} yet`, empty(error, data), outcome(error, data));
  }

  console.log(`\n=== Result: ${passCount} passed, ${failCount} failed ===\n`);
  console.log('Also re-run cross_tenant_isolation.test.js: the Phase 1 baseline must still be 36/36.\n');
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nTest run crashed:', err.message);
  process.exit(1);
});
