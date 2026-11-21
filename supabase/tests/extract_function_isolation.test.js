// Phase 4 security acceptance tests for the extract-packing-slip Edge
// Function — the "separate equivalent test" supabase/README.md requires
// before Phase 4 is signed off.
//
// What this proves: the function works out the caller's business from
// their own Auth token alone, so Business A cannot get Business B's
// uploaded packing slip read (and its contents returned) by naming B's
// Storage path, by path traversal, or without signing in at all.
//
// Every request here is rejected BEFORE the function calls Claude, so
// running this costs nothing on the Anthropic bill. (A successful
// extraction is checked by hand in the app instead; see supabase/README.md.)
//
// Prerequisites: the migration is applied, the function is deployed, and
// seed_test_businesses.js has been run. Uses the same environment variables
// as cross_tenant_isolation.test.js.

const { createClient } = require('@supabase/supabase-js');

const required = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'BIZ_A_EMAIL', 'BIZ_A_PASSWORD', 'BIZ_A_ID',
  'BIZ_B_EMAIL', 'BIZ_B_PASSWORD', 'BIZ_B_ID',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('Run seed_test_businesses.js first and export its printed values.');
  process.exit(1);
}

const {
  SUPABASE_URL, SUPABASE_ANON_KEY,
  BIZ_A_EMAIL, BIZ_A_PASSWORD, BIZ_A_ID,
  BIZ_B_EMAIL, BIZ_B_PASSWORD, BIZ_B_ID,
} = process.env;

const FUNCTION_NAME = 'extract-packing-slip';
const BUCKET = 'pallet-label-sources';

// A valid 1x1 PNG, so the file itself is never the reason for a refusal.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

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

async function signedInAs(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`);
  return client;
}

// Resolves to the HTTP status the function answered with (200 on success).
async function invokeStatus(client, body) {
  const { error } = await client.functions.invoke(FUNCTION_NAME, { body });
  if (!error) return 200;
  return error.context && typeof error.context.status === 'number' ? error.context.status : -1;
}

async function main() {
  console.log('\n=== extract-packing-slip isolation tests (Phase 4) ===\n');

  const asA = await signedInAs(BIZ_A_EMAIL, BIZ_A_PASSWORD);
  const asB = await signedInAs(BIZ_B_EMAIL, BIZ_B_PASSWORD);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Business B uploads a real file into its own folder.
  const runId = `isolation-test-${Date.now()}`;
  const bPath = `${BIZ_B_ID}/${runId}/slip.png`;
  {
    const { error } = await asB.storage.from(BUCKET).upload(bPath, TINY_PNG, { contentType: 'image/png' });
    if (error) throw new Error(`Setup failed: Business B could not upload its own file: ${error.message}`);
  }

  try {
    console.log('Business A trying to get Business B\'s file read:\n');

    {
      const status = await invokeStatus(asA, { path: bPath });
      report('A names B\'s exact path — refused with 403', status === 403, `got ${status}`);
    }

    {
      const status = await invokeStatus(asA, { path: `${BIZ_A_ID}/../${bPath}` });
      report('A uses path traversal from its own folder — refused with 400', status === 400, `got ${status}`);
    }

    {
      const status = await invokeStatus(asA, { path: bPath, business_id: BIZ_B_ID });
      report('A supplies B\'s business_id in the body — ignored, still 403', status === 403, `got ${status}`);
    }

    {
      const status = await invokeStatus(asA, { path: `${BIZ_A_ID}/${runId}/slip.png` });
      report('A asks for a same-named file in its own folder — 404, no B data', status === 404, `got ${status}`);
    }

    console.log('\nNo sign-in at all:\n');

    {
      const status = await invokeStatus(anon, { path: bPath });
      report('anon client names B\'s path — refused with 401', status === 401, `got ${status}`);
    }

    {
      // A forged token must not get past the function's own JWT check.
      const { error } = await anon.functions.invoke(FUNCTION_NAME, {
        body: { path: bPath },
        headers: { Authorization: 'Bearer not-a-real-token' },
      });
      const status = !error ? 200 : error.context && typeof error.context.status === 'number' ? error.context.status : -1;
      report('forged bearer token names B\'s path — refused with 401', status === 401, `got ${status}`);
    }
  } finally {
    await asB.storage.from(BUCKET).remove([bPath]);
  }

  console.log(`\n${passCount} passed, ${failCount} failed.\n`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
