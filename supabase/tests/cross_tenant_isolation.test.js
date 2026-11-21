// Phase 1 security acceptance tests — direct Supabase queries, not the
// application UI, exactly as required before Phase 1 is signed off.
//
// What this proves, concretely:
//   - Business A can read and write its OWN rows and Storage files (positive
//     controls), so the "denied" results below come from isolation, not from
//     a database that refuses everything.
//   - Business A cannot read, insert, update, or delete Business B's rows in
//     pallet_limits or pallet_label_batches, cannot read or write businesses
//     rows, and cannot move one of its own rows to Business B.
//   - Business A cannot list, download, overwrite, upload into, or delete
//     inside Business B's Storage folder, checked against a REAL file B owns.
//   - An unauthenticated (anon) client can do none of the above.
//   - After every attack, Business B re-reads its own data to confirm nothing
//     actually changed. Each check relies on that re-read, not only on the
//     response the attacker got back.
//
// Run `node seed_test_businesses.js` once first (see its own header
// comment), export the values it prints, then run this script. It can be
// re-run any number of times: everything it creates is removed at the end.
//
// Required environment variables:
//   SUPABASE_URL, SUPABASE_ANON_KEY
//   BIZ_A_EMAIL, BIZ_A_PASSWORD, BIZ_A_ID, BIZ_A_BATCH_ID
//   BIZ_B_EMAIL, BIZ_B_PASSWORD, BIZ_B_ID, BIZ_B_BATCH_ID
//
// Exit code is 0 only if every check passed — suitable as a CI gate.

const { createClient } = require('@supabase/supabase-js');

const required = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'BIZ_A_EMAIL', 'BIZ_A_PASSWORD', 'BIZ_A_ID', 'BIZ_A_BATCH_ID',
  'BIZ_B_EMAIL', 'BIZ_B_PASSWORD', 'BIZ_B_ID', 'BIZ_B_BATCH_ID',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('Run seed_test_businesses.js first and export its printed values.');
  process.exit(1);
}

const {
  SUPABASE_URL, SUPABASE_ANON_KEY,
  BIZ_A_EMAIL, BIZ_A_PASSWORD, BIZ_A_ID, BIZ_A_BATCH_ID,
  BIZ_B_EMAIL, BIZ_B_PASSWORD, BIZ_B_ID, BIZ_B_BATCH_ID,
} = process.env;

const BUCKET = 'pallet-label-sources';
const RUN_ID = `isolation-run-${Date.now()}`;

// Names used for anything this run creates, so cleanup can find it.
const A_OWN_SIZE_KEY = `own-write-test-${RUN_ID}`;
const ATTACK_SIZE_KEY = `attacker-inserted-${RUN_ID}`;
const ATTACK_BATCH_NAME = `attacker-inserted batch ${RUN_ID}`;
const B_FIXTURE_PATH = `${BIZ_B_ID}/${RUN_ID}/fixture.txt`;
const B_FIXTURE_CONTENT = `fixture owned by Business B, ${RUN_ID}`;
const A_PROBE_IN_B_PATH = `${BIZ_B_ID}/${RUN_ID}/attacker-probe.txt`;
const A_OWN_FILE_PATH = `${BIZ_A_ID}/${RUN_ID}/own-file.txt`;
const A_OWN_FILE_CONTENT = `own file of Business A, ${RUN_ID}`;

let passCount = 0;
let failCount = 0;

function report(name, passed, detail) {
  if (passed) {
    passCount += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failCount += 1;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// Describes what Supabase actually answered, printed under every check so
// a PASS or FAIL can be traced to its cause. Never affects pass/fail.
function outcome(error, data) {
  let rows;
  if (Array.isArray(data)) rows = String(data.length);
  else if (data === null || data === undefined) rows = 'none (null)';
  else rows = '1 object';
  const err = error
    ? [error.code, error.statusCode, error.status, error.message].filter((v) => v !== undefined && v !== null && v !== '').join(' | ')
    : 'none';
  return `error: ${err}; rows returned: ${rows}`;
}

function diag(error, data) {
  console.log(`          -> ${outcome(error, data)}`);
}

function note(text) {
  console.log(`          -> ${text}`);
}

// Postgres refuses an RLS-blocked write, and anything a role has no table
// privilege for, with SQLSTATE 42501. Any other error (bad column, network,
// constraint) is NOT proof of isolation and must not count as a pass.
function isRlsRefusal(error) {
  return !!error && error.code === '42501';
}

// Storage reports an RLS-blocked write as a 403, or with the Postgres RLS
// message, depending on the endpoint and client version.
function isStorageRefusal(error) {
  if (!error) return false;
  return (
    String(error.statusCode) === '403' ||
    error.status === 403 ||
    /row-level security|unauthorized|access denied/i.test(error.message || '')
  );
}

// For a cross-tenant SELECT: zero rows and no error. An error would hide
// whether RLS filtered the rows or the query simply failed.
function emptyWithoutError(error, data) {
  return !error && Array.isArray(data) && data.length === 0;
}

// For anon reads: anon has no table privileges at all (the migration
// revokes them), so either a 42501 refusal or zero rows is secure. Any
// other error is inconclusive and fails.
function anonEmptyOrRefused(error, data) {
  if (error) return isRlsRefusal(error);
  return Array.isArray(data) && data.length === 0;
}

async function signedInAs(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`);
  return client;
}

// Business B's own view of its rows, used as the before/after comparison.
async function snapshotB(asB) {
  const limits = await asB
    .from('pallet_limits')
    .select('id, business_id, size_key, max_qty_per_pallet')
    .eq('business_id', BIZ_B_ID)
    .order('id');
  const batches = await asB
    .from('pallet_label_batches')
    .select('id, business_id, name, grand_total, pallets')
    .eq('business_id', BIZ_B_ID)
    .order('id');
  if (limits.error) throw new Error(`Snapshot of B's pallet_limits failed: ${limits.error.message}`);
  if (batches.error) throw new Error(`Snapshot of B's pallet_label_batches failed: ${batches.error.message}`);
  return { limits: limits.data, batches: batches.data };
}

async function readFileAs(client, path) {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data) return { content: null, error };
  return { content: await data.text(), error: null };
}

async function main() {
  console.log('\n=== Cross-tenant isolation acceptance tests (Phase 1) ===');
  console.log(`    run id: ${RUN_ID}\n`);

  const asA = await signedInAs(BIZ_A_EMAIL, BIZ_A_PASSWORD);
  const asB = await signedInAs(BIZ_B_EMAIL, BIZ_B_PASSWORD);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // never signed in

  const {
    data: { user: userA },
  } = await asA.auth.getUser();
  if (!userA) throw new Error('Could not read Business A\'s own Auth user.');

  // ---- Setup: a real file in Business B's Storage folder ----
  {
    const { error } = await asB.storage
      .from(BUCKET)
      .upload(B_FIXTURE_PATH, Buffer.from(B_FIXTURE_CONTENT), { contentType: 'text/plain' });
    if (error) throw new Error(`Setup failed: Business B could not upload its own fixture file: ${error.message}`);
  }

  try {
    const bBefore = await snapshotB(asB);
    if (!bBefore.limits.length || !bBefore.batches.length) {
      throw new Error('Setup failed: Business B has no seeded rows to protect. Run seed_test_businesses.js first.');
    }

    // ======================================================================
    console.log('Positive controls: Business A using its OWN data:\n');
    // ======================================================================

    {
      const { data, error } = await asA.from('businesses').select('id').eq('id', BIZ_A_ID);
      report('SELECT own businesses row — 1 row', !error && (data || []).length === 1, outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.from('pallet_limits').select('id').eq('business_id', BIZ_A_ID);
      report('SELECT own pallet_limits — at least 1 row', !error && (data || []).length >= 1, outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.from('pallet_label_batches').select('id').eq('business_id', BIZ_A_ID);
      report('SELECT own pallet_label_batches — at least 1 row', !error && (data || []).length >= 1, outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA
        .from('pallet_limits')
        .insert({ business_id: BIZ_A_ID, size_key: A_OWN_SIZE_KEY, max_qty_per_pallet: 10 })
        .select();
      report('INSERT own pallet_limits row — succeeds', !error && (data || []).length === 1, outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA
        .from('pallet_limits')
        .update({ max_qty_per_pallet: 20 })
        .eq('business_id', BIZ_A_ID)
        .eq('size_key', A_OWN_SIZE_KEY)
        .select();
      const ok = !error && (data || []).length === 1 && data[0].max_qty_per_pallet === 20;
      report('UPDATE own pallet_limits row — succeeds', ok, outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA
        .from('pallet_limits')
        .delete()
        .eq('business_id', BIZ_A_ID)
        .eq('size_key', A_OWN_SIZE_KEY)
        .select();
      report('DELETE own pallet_limits row — succeeds', !error && (data || []).length === 1, outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.storage
        .from(BUCKET)
        .upload(A_OWN_FILE_PATH, Buffer.from(A_OWN_FILE_CONTENT), { contentType: 'text/plain' });
      report('Storage: upload into own folder — succeeds', !error, outcome(error, data));
      diag(error, data);
    }
    {
      const { content, error } = await readFileAs(asA, A_OWN_FILE_PATH);
      report('Storage: download own file — content matches', content === A_OWN_FILE_CONTENT, outcome(error, content));
      diag(error, content);
    }
    {
      const { data, error } = await asA.storage.from(BUCKET).remove([A_OWN_FILE_PATH]);
      // The folder listing reads Storage's own records, so it shows the
      // delete at once. A download can be served from Supabase's CDN cache,
      // which Supabase says can take up to about a minute to clear after a
      // delete, so the download is retried for up to 60 seconds before the
      // check gives up.
      const listing = await asA.storage.from(BUCKET).list(`${BIZ_A_ID}/${RUN_ID}`);
      const listedGone = !listing.error && !(listing.data || []).some((o) => o.name === 'own-file.txt');
      let downloadGone = false;
      let waitedSeconds = 0;
      for (;;) {
        if ((await readFileAs(asA, A_OWN_FILE_PATH)).content === null) {
          downloadGone = true;
          break;
        }
        if (waitedSeconds >= 60) break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        waitedSeconds += 5;
      }
      const ok = !error && (data || []).length === 1 && listedGone && downloadGone;
      const after = `gone from listing: ${listedGone}; download refused: ${downloadGone} (after ${waitedSeconds}s)`;
      report('Storage: delete own file — succeeds and file is gone', ok, `${outcome(error, data)}; ${after}`);
      diag(error, data);
      note(after);
    }

    // ======================================================================
    console.log('\nBusiness A attempting to reach Business B\'s rows:\n');
    // ======================================================================

    {
      const { data, error } = await asA.from('pallet_limits').select('*').eq('business_id', BIZ_B_ID);
      report('SELECT pallet_limits WHERE business_id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA
        .from('pallet_limits')
        .insert({ business_id: BIZ_B_ID, size_key: ATTACK_SIZE_KEY, max_qty_per_pallet: 1 });
      report('INSERT pallet_limits with business_id = B — refused with 42501', isRlsRefusal(error), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA
        .from('pallet_limits')
        .update({ max_qty_per_pallet: 999 })
        .eq('business_id', BIZ_B_ID)
        .select();
      report('UPDATE pallet_limits WHERE business_id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.from('pallet_limits').delete().eq('business_id', BIZ_B_ID).select();
      report('DELETE pallet_limits WHERE business_id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.from('pallet_label_batches').select('*').eq('business_id', BIZ_B_ID);
      report('SELECT pallet_label_batches WHERE business_id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.from('pallet_label_batches').insert({
        business_id: BIZ_B_ID,
        name: ATTACK_BATCH_NAME,
        pallets: [],
        grand_total: 0,
      });
      report('INSERT pallet_label_batches with business_id = B — refused with 42501', isRlsRefusal(error), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA
        .from('pallet_label_batches')
        .update({ name: 'renamed by attacker' })
        .eq('business_id', BIZ_B_ID)
        .select();
      report('UPDATE pallet_label_batches WHERE business_id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await asA.from('pallet_label_batches').delete().eq('business_id', BIZ_B_ID).select();
      report('DELETE pallet_label_batches WHERE business_id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      // Targeting B's batch by its exact id, not only by business_id.
      const { data, error } = await asA
        .from('pallet_label_batches')
        .update({ name: 'renamed by attacker (by id)' })
        .eq('id', BIZ_B_BATCH_ID)
        .select();
      report('UPDATE B\'s batch by its exact id — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }

    // Reassigning A's own batch to B: WITH CHECK must refuse the new row.
    {
      const { data, error } = await asA
        .from('pallet_label_batches')
        .update({ business_id: BIZ_B_ID })
        .eq('id', BIZ_A_BATCH_ID)
        .select();
      const after = await asA.from('pallet_label_batches').select('business_id').eq('id', BIZ_A_BATCH_ID);
      const stillA = !after.error && (after.data || []).length === 1 && after.data[0].business_id === BIZ_A_ID;
      const refused = isRlsRefusal(error) || (!error && (data || []).length === 0);
      report(
        'UPDATE own batch SET business_id = B — refused, and the batch still belongs to A',
        refused && stillA,
        `${outcome(error, data)}; still owned by A: ${stillA}`
      );
      diag(error, data);
      note(`re-read as A: still owned by A = ${stillA}`);
    }

    // ---- Post-attack verification, from Business B's own point of view ----
    {
      const bAfter = await snapshotB(asB);
      const limitsSame = JSON.stringify(bAfter.limits) === JSON.stringify(bBefore.limits);
      const batchesSame = JSON.stringify(bAfter.batches) === JSON.stringify(bBefore.batches);
      report('Re-read as B: B\'s pallet_limits are exactly as before', limitsSame, `before ${bBefore.limits.length} rows, after ${bAfter.limits.length}`);
      note(`before: ${bBefore.limits.length} rows, after: ${bAfter.limits.length} rows`);
      report('Re-read as B: B\'s pallet_label_batches are exactly as before', batchesSame, `before ${bBefore.batches.length} rows, after ${bAfter.batches.length}`);
      note(`before: ${bBefore.batches.length} rows, after: ${bAfter.batches.length} rows`);
    }

    // ---- businesses table ----
    {
      const { data, error } = await asA.from('businesses').select('*').eq('id', BIZ_B_ID);
      report('SELECT businesses WHERE id = B — zero rows, no error', emptyWithoutError(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      // Uses A's REAL Auth user id, so the only thing that can stop this
      // insert is the missing INSERT policy (42501), not a foreign-key error.
      const { data, error } = await asA.from('businesses').insert({ auth_user_id: userA.id, name: `Rogue business ${RUN_ID}` });
      report('INSERT into businesses with A\'s own Auth user id — refused with 42501', isRlsRefusal(error), outcome(error, data));
      diag(error, data);
    }
    {
      const before = await asA.from('businesses').select('name').eq('id', BIZ_A_ID);
      const { data, error } = await asA.from('businesses').update({ name: 'Renamed by self' }).eq('id', BIZ_A_ID).select();
      const after = await asA.from('businesses').select('name').eq('id', BIZ_A_ID);
      const unchanged =
        !before.error && !after.error && (after.data || []).length === 1 && after.data[0].name === before.data[0].name;
      const refused = isRlsRefusal(error) || (!error && (data || []).length === 0);
      report('UPDATE own businesses row (self-rename) — refused, and the name is unchanged', refused && unchanged, `${outcome(error, data)}; unchanged: ${unchanged}`);
      diag(error, data);
      note(`re-read as A: name unchanged = ${unchanged}`);
    }

    // ======================================================================
    console.log('\nBusiness A attempting to reach Business B\'s Storage folder (a real file exists there):\n');
    // ======================================================================

    {
      const { data, error } = await asA.storage.from(BUCKET).list(`${BIZ_B_ID}/${RUN_ID}`);
      const sawFixture = (data || []).some((o) => o.name === 'fixture.txt');
      report('Storage: list B\'s folder — B\'s file is not visible', !sawFixture, outcome(error, data));
      diag(error, data);
    }
    {
      const { content, error } = await readFileAs(asA, B_FIXTURE_PATH);
      report('Storage: download B\'s file by exact path — refused, no content', content === null && !!error, outcome(error, content));
      diag(error, content);
    }
    {
      const { data, error } = await asA.storage
        .from(BUCKET)
        .upload(A_PROBE_IN_B_PATH, Buffer.from('attacker probe'), { contentType: 'text/plain' });
      report('Storage: upload into B\'s folder — refused by RLS', isStorageRefusal(error), outcome(error, data));
      diag(error, data);
    }
    {
      // Overwrite attempt on B's real file. There is no UPDATE policy on
      // storage.objects, so this must be refused.
      const { data, error } = await asA.storage
        .from(BUCKET)
        .upload(B_FIXTURE_PATH, Buffer.from('overwritten by attacker'), { contentType: 'text/plain', upsert: true });
      report('Storage: overwrite B\'s file (upsert) — refused', !!error, outcome(error, data));
      diag(error, data);
    }
    {
      // Storage does not report an error when RLS hides the object; the
      // delete simply matches nothing. So the real check is whether the file
      // still exists afterwards, read back by its owner.
      const { data, error } = await asA.storage.from(BUCKET).remove([B_FIXTURE_PATH]);
      diag(error, data);
      const after = await readFileAs(asB, B_FIXTURE_PATH);
      report(
        'Storage: delete B\'s file — B can still download it, unchanged',
        after.content === B_FIXTURE_CONTENT,
        `B's re-read: ${after.content === null ? 'file missing' : after.content === B_FIXTURE_CONTENT ? 'intact' : 'content changed'}`
      );
      note(`re-read as B: ${after.content === null ? 'file missing' : after.content === B_FIXTURE_CONTENT ? 'intact' : 'content changed'}`);
    }
    {
      const { data, error } = await asB.storage.from(BUCKET).list(`${BIZ_B_ID}/${RUN_ID}`);
      const names = (data || []).map((o) => o.name).sort();
      const onlyFixture = !error && names.length === 1 && names[0] === 'fixture.txt';
      report('Re-read as B: B\'s folder holds only B\'s own file (no attacker file)', onlyFixture, `B sees: ${names.join(', ') || '(nothing)'}`);
      note(`B sees: ${names.join(', ') || '(nothing)'}`);
    }

    // ======================================================================
    console.log('\nUnauthenticated (anon) client attempting the same, directly:\n');
    // ======================================================================

    {
      const { data, error } = await anon.from('pallet_limits').select('*');
      report('anon SELECT pallet_limits — zero rows or refused with 42501', anonEmptyOrRefused(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await anon.from('pallet_label_batches').select('*');
      report('anon SELECT pallet_label_batches — zero rows or refused with 42501', anonEmptyOrRefused(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await anon.from('businesses').select('*');
      report('anon SELECT businesses — zero rows or refused with 42501', anonEmptyOrRefused(error, data), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await anon
        .from('pallet_limits')
        .insert({ business_id: BIZ_A_ID, size_key: `anon-insert-${RUN_ID}`, max_qty_per_pallet: 1 });
      report('anon INSERT pallet_limits — refused with 42501', isRlsRefusal(error), outcome(error, data));
      diag(error, data);
    }
    {
      const { data, error } = await anon.storage.from(BUCKET).list(`${BIZ_B_ID}/${RUN_ID}`);
      const sawFixture = (data || []).some((o) => o.name === 'fixture.txt');
      report('anon Storage: list B\'s folder — B\'s file is not visible', !sawFixture, outcome(error, data));
      diag(error, data);
    }
    {
      const { content, error } = await readFileAs(anon, B_FIXTURE_PATH);
      report('anon Storage: download B\'s file — refused, no content', content === null && !!error, outcome(error, content));
      diag(error, content);
    }
  } finally {
    await cleanUp(asA, asB);
  }

  console.log(`\n=== Result: ${passCount} passed, ${failCount} failed ===\n`);

  if (failCount > 0) {
    console.log('A FAIL above means the database or Storage did not behave as the Phase 1');
    console.log('security design requires. Do not use this project with real business data');
    console.log('until every check passes.');
  }
  console.log('Phase 4 note: the extract-packing-slip Edge Function holds no service-role');
  console.log('key. It runs as the caller under these same RLS policies, so this suite also');
  console.log('covers the data it can reach. Its own request-level isolation (path and');
  console.log('business checks) is tested separately by extract_function_isolation.test.js.\n');

  process.exit(failCount > 0 ? 1 : 0);
}

// Removes everything this run created, as the owner of each item, and
// anything an attack managed to create (so a breach doesn't leave debris).
async function cleanUp(asA, asB) {
  const problems = [];
  const steps = [
    ['A\'s own test limit', () => asA.from('pallet_limits').delete().eq('business_id', BIZ_A_ID).eq('size_key', A_OWN_SIZE_KEY)],
    ['A\'s own test file', () => asA.storage.from(BUCKET).remove([A_OWN_FILE_PATH])],
    ['B\'s fixture and any attacker file', () => asB.storage.from(BUCKET).remove([B_FIXTURE_PATH, A_PROBE_IN_B_PATH])],
    ['any attacker limit in B', () => asB.from('pallet_limits').delete().eq('business_id', BIZ_B_ID).eq('size_key', ATTACK_SIZE_KEY)],
    ['any attacker batch in B', () => asB.from('pallet_label_batches').delete().eq('business_id', BIZ_B_ID).eq('name', ATTACK_BATCH_NAME)],
  ];
  for (const [label, run] of steps) {
    try {
      const { error } = await run();
      if (error) problems.push(`${label}: ${error.message}`);
    } catch (err) {
      problems.push(`${label}: ${err.message}`);
    }
  }
  if (problems.length) {
    console.log('\nCleanup could not remove everything:');
    problems.forEach((p) => console.log(`  - ${p}`));
    console.log(`Look for items containing "${RUN_ID}" and remove them by hand.`);
  }
}

main().catch((err) => {
  console.error('\nTest run crashed:', err.message);
  process.exit(1);
});
