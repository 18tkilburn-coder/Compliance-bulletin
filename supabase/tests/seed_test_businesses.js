// Seeds two throwaway test businesses ("Test Business A" / "Test Business B")
// so cross_tenant_isolation.test.js has two real, separate tenants to try to
// breach. Uses the SERVICE ROLE key deliberately — this script is never run
// in a browser, never committed with real credentials filled in, and is the
// one place in this whole project a service-role key is allowed to appear,
// because creating `businesses` rows is explicitly service-role-only (see
// the migration SQL: there is no authenticated insert policy on that table).
//
// Required environment variables (set these in your shell, never hardcode
// them in this file):
//   SUPABASE_URL                  — your project's URL
//   SUPABASE_SERVICE_ROLE_KEY     — service role key, from Project Settings > API
//
// Run: node seed_test_businesses.js
// Prints the two test businesses' login emails/passwords and ids on success
// — cross_tenant_isolation.test.js reads those same env vars back, or you
// can paste the printed values into your shell before running it.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_BUSINESSES = [
  { label: 'A', email: 'test-business-a@pallet-pal-security-test.invalid', password: 'TestBizA-' + Math.random().toString(36).slice(2, 10) },
  { label: 'B', email: 'test-business-b@pallet-pal-security-test.invalid', password: 'TestBizB-' + Math.random().toString(36).slice(2, 10) },
];

async function main() {
  const results = [];

  for (const biz of TEST_BUSINESSES) {
    // 1. Create the shared Auth login for this test business.
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email: biz.email,
      password: biz.password,
      email_confirm: true,
    });
    if (userErr) throw new Error(`Creating auth user for ${biz.label}: ${userErr.message}`);

    // 2. Create the matching businesses row (service role bypasses RLS).
    const { data: bizRow, error: bizErr } = await admin
      .from('businesses')
      .insert({ auth_user_id: userData.user.id, name: `Test Business ${biz.label} (security test)` })
      .select()
      .single();
    if (bizErr) throw new Error(`Creating businesses row for ${biz.label}: ${bizErr.message}`);

    // 3. Seed one pallet_limits row and one pallet_label_batches row per
    //    business, so the tests have real rows to try to reach across into.
    const { error: limitErr } = await admin
      .from('pallet_limits')
      .insert({ business_id: bizRow.id, size_key: `test-size-${biz.label.toLowerCase()}`, max_qty_per_pallet: 100 });
    if (limitErr) throw new Error(`Seeding pallet_limits for ${biz.label}: ${limitErr.message}`);

    const { data: batchRow, error: batchErr } = await admin
      .from('pallet_label_batches')
      .insert({
        business_id: bizRow.id,
        name: `Test batch for Business ${biz.label}`,
        pallets: [{ name: 'Test Product', flavour: 'Test Flavour', quantity: 10, bbe: '01/27', batchCodes: ['12345'] }],
        grand_total: 10,
        generated_by: 'seed script',
      })
      .select()
      .single();
    if (batchErr) throw new Error(`Seeding pallet_label_batches for ${biz.label}: ${batchErr.message}`);

    results.push({ ...biz, businessId: bizRow.id, authUserId: userData.user.id, batchId: batchRow.id });
  }

  console.log('\nSeeded two test businesses:\n');
  results.forEach((r) => {
    console.log(`Business ${r.label}:`);
    console.log(`  email:       ${r.email}`);
    console.log(`  password:    ${r.password}`);
    console.log(`  business_id: ${r.businessId}`);
    console.log(`  batch_id:    ${r.batchId}`);
    console.log('');
  });
  console.log('Export these for cross_tenant_isolation.test.js, e.g.:\n');
  console.log(`export BIZ_A_EMAIL='${results[0].email}'`);
  console.log(`export BIZ_A_PASSWORD='${results[0].password}'`);
  console.log(`export BIZ_A_ID='${results[0].businessId}'`);
  console.log(`export BIZ_A_BATCH_ID='${results[0].batchId}'`);
  console.log(`export BIZ_B_EMAIL='${results[1].email}'`);
  console.log(`export BIZ_B_PASSWORD='${results[1].password}'`);
  console.log(`export BIZ_B_ID='${results[1].businessId}'`);
  console.log(`export BIZ_B_BATCH_ID='${results[1].batchId}'`);
}

main().catch((err) => {
  console.error('\nSeeding failed:', err.message);
  process.exit(1);
});
