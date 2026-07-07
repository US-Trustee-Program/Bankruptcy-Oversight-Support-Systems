// verify-dedup-cosmos.mjs
// =============================================================================
// READ-ONLY Cosmos DB (Mongo API) verification for the trustee-migration
// duplicate-trustee fixes, run AFTER the real MIGRATE-TRUSTEES dataflow has been
// executed twice against the shared environment (see DEDUP_MIGRATION_RUNBOOK.md).
// =============================================================================
//
// WHAT IT VERIFIES
// ----------------
// The dedup fixtures seeded by seed/02-seed-dedup-trustees.sql use ATS TRU_IDs
// 1004-1008. After two dataflow runs, this script asserts that the fixes held:
//
//   HARD PASS/FAIL (the real dedup test):
//     - Exactly ONE `trustees` doc exists per fixture person. The migration must
//       NOT create a second doc on run 2. Grouped by {name, public.address.state}
//       over docs whose legacy.truIds intersect {1004..1008}; expect 5 groups,
//       each with count === 1, and each of the 5 truIds present on exactly one doc.
//     - M2 (1006 Merrill Cohen): public.address.state === 'DE' (transformed public
//       state from STATE_A2), internal.address.state === 'MD' (raw STATE).
//     - fallback (1007 Test Fallback): public.address.state === 'MD' (backfilled
//       from the other address because STATE_A2 was blank), and the doc exists.
//
//   INFO ONLY (NOT hard failures — depend on ACMS CMMPR + ATS CHAPTER_DETAILS
//   seeding being present and correct in the shared environment):
//     - trustee-professional-ids: >= 1 doc per fixture trusteeId (camsTrusteeId).
//     - trustee-appointments:     >= 1 doc per fixture trusteeId.
//
// READ-ONLY
// ---------
// This script performs ONLY find/aggregate reads. It never inserts, updates, or
// deletes any document. Safe to run against any environment.
//
// HOW TO RUN
// ----------
// Point it at the SAME Cosmos environment the migration targeted.
//
//   export MONGO_CONNECTION_STRING='<cosmos mongo api connection string>'
//   export COSMOS_DATABASE_NAME='<db containing the trustees collection>'
//   node test/integration/migrate-trustees/scripts/verify-dedup-cosmos.mjs
//
// CLI overrides (take precedence over the env vars):
//   node verify-dedup-cosmos.mjs --uri '<connection-string>' --db '<database>'
//
// It resolves `mongodb` from the CAMS repo root node_modules (the v7.3.0 driver
// hoisted at /Users/jbrooks/Repos/cams/node_modules/mongodb). Node module
// resolution walks up from this script's directory, so the bare
// `import { MongoClient } from 'mongodb'` resolves when run anywhere under the repo.
//
// EXIT CODE
// ---------
// Non-zero if any HARD check fails (or on a connection/query error). INFO checks
// never affect the exit code.
// =============================================================================

import { MongoClient } from 'mongodb';

// ---------------------------------------------------------------------------
// Fixtures (must match seed/02-seed-dedup-trustees.sql).
// ---------------------------------------------------------------------------
const TRU_IDS = ['1004', '1005', '1006', '1007', '1008'];

const EXPECTED = {
  1004: { name: 'J. Ford Elsaesser', publicState: 'ID' },
  1005: { name: 'William A. Brandt, Jr.', publicState: 'AZ' },
  1006: { name: 'Merrill Cohen', publicState: 'DE', internalState: 'MD' },
  1007: { name: 'Test Fallback', publicState: 'MD' },
  1008: { name: 'Jane Control', publicState: 'CT' },
};

// ---------------------------------------------------------------------------
// Config: env with CLI-arg overrides. Do NOT guess a db name.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--uri') {
      out.uri = argv[++i];
    } else if (argv[i] === '--db') {
      out.db = argv[++i];
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const uri = args.uri || process.env.MONGO_CONNECTION_STRING;
const dbName = args.db || process.env.COSMOS_DATABASE_NAME;

if (!uri) {
  console.error('');
  console.error('ERROR: No Cosmos connection string provided.');
  console.error("  export MONGO_CONNECTION_STRING='<cosmos mongo api connection string>'");
  console.error("  (or pass --uri '<connection-string>')");
  console.error('');
  process.exit(1);
}

if (!dbName) {
  console.error('');
  console.error('ERROR: No database name provided.');
  console.error("  export COSMOS_DATABASE_NAME='<db containing the trustees collection>'");
  console.error("  (or pass --db '<database>')");
  console.error('  This script will NOT guess a database name.');
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Result tracking.
// ---------------------------------------------------------------------------
let hardPassed = 0;
let hardFailed = 0;
const infoNotes = [];

function hardCheck(label, ok, detail) {
  if (ok) {
    hardPassed++;
    console.log('  PASS  ' + label + (detail ? '  — ' + detail : ''));
  } else {
    hardFailed++;
    console.log('  FAIL  ' + label + (detail ? '  — ' + detail : ''));
  }
}

function infoCheck(label, ok, detail) {
  const tag = ok ? 'INFO ok  ' : 'INFO warn';
  console.log('  ' + tag + ' ' + label + (detail ? '  — ' + detail : ''));
  if (!ok) infoNotes.push(label + (detail ? ' — ' + detail : ''));
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const trustees = db.collection('trustees');
  const professionalIds = db.collection('trustee-professional-ids');
  const appointments = db.collection('trustee-appointments');

  console.log('--- verify-dedup-cosmos.mjs (READ-ONLY) ---');
  console.log('Database: ' + dbName);
  console.log('Fixture TRU_IDs: ' + TRU_IDS.join(', '));
  console.log('');

  // -------------------------------------------------------------------------
  // Load all trustee docs touching the fixture legacy truIds.
  // -------------------------------------------------------------------------
  const fixtureDocs = await trustees
    .find({ documentType: 'TRUSTEE', 'legacy.truIds': { $in: TRU_IDS } })
    .toArray();

  console.log(
    '=== Loaded ' + fixtureDocs.length + ' TRUSTEE doc(s) referencing fixture truIds ===',
  );
  console.log('');

  // -------------------------------------------------------------------------
  // HARD CHECK 1: dedup — exactly one doc per fixture person.
  // Each of the 5 truIds must appear on exactly one doc, and grouping by
  // {name, public.address.state} must yield 5 groups each of count 1.
  // -------------------------------------------------------------------------
  console.log('=== HARD: dedup (one doc per person) ===');

  // 1a. Each truId on exactly one doc.
  for (const truId of TRU_IDS) {
    const docsForId = fixtureDocs.filter(
      (d) => Array.isArray(d.legacy?.truIds) && d.legacy.truIds.includes(truId),
    );
    hardCheck(
      'truId ' + truId + ' present on exactly one trustees doc',
      docsForId.length === 1,
      'found ' + docsForId.length + ' doc(s)' +
        (docsForId.length ? ' [' + docsForId.map((d) => d.trusteeId).join(', ') + ']' : ''),
    );
  }

  // 1b. Group by {name, public.address.state}: expect 5 groups, each count 1.
  const groups = new Map();
  for (const d of fixtureDocs) {
    const key = (d.name ?? '') + '|' + (d.public?.address?.state ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  hardCheck(
    'exactly 5 {name, public.state} groups',
    groups.size === 5,
    'found ' + groups.size + ' group(s): ' + [...groups.keys()].map((k) => '"' + k + '"').join(', '),
  );
  for (const [key, docs] of groups.entries()) {
    hardCheck(
      'group "' + key + '" has exactly one doc',
      docs.length === 1,
      'count ' + docs.length +
        (docs.length > 1 ? ' [' + docs.map((d) => d.trusteeId).join(', ') + ']' : ''),
    );
  }
  console.log('');

  // -------------------------------------------------------------------------
  // Helper: single doc for a given truId (null if not exactly one).
  // -------------------------------------------------------------------------
  const docForTruId = (truId) => {
    const matches = fixtureDocs.filter(
      (d) => Array.isArray(d.legacy?.truIds) && d.legacy.truIds.includes(truId),
    );
    return matches.length === 1 ? matches[0] : null;
  };

  // -------------------------------------------------------------------------
  // HARD CHECK 2: M2 (1006) public state DE, internal state MD.
  // -------------------------------------------------------------------------
  console.log('=== HARD: M2 (1006 Merrill Cohen) public=DE / internal=MD ===');
  const doc1006 = docForTruId('1006');
  if (!doc1006) {
    hardCheck('1006 resolves to a single doc', false, 'cannot evaluate M2 states');
  } else {
    hardCheck(
      '1006 public.address.state === DE',
      doc1006.public?.address?.state === 'DE',
      'actual=' + JSON.stringify(doc1006.public?.address?.state),
    );
    hardCheck(
      '1006 internal.address.state === MD',
      doc1006.internal?.address?.state === 'MD',
      'actual=' + JSON.stringify(doc1006.internal?.address?.state),
    );
  }
  console.log('');

  // -------------------------------------------------------------------------
  // HARD CHECK 3: fallback (1007) public state MD, doc exists.
  // -------------------------------------------------------------------------
  console.log('=== HARD: fallback (1007 Test Fallback) public=MD, exists ===');
  const doc1007 = docForTruId('1007');
  hardCheck('1007 doc exists (single)', doc1007 !== null, doc1007 ? doc1007.trusteeId : 'missing');
  if (doc1007) {
    hardCheck(
      '1007 public.address.state === MD (backfilled)',
      doc1007.public?.address?.state === 'MD',
      'actual=' + JSON.stringify(doc1007.public?.address?.state),
    );
  }
  console.log('');

  // -------------------------------------------------------------------------
  // INFO CHECK: professional-ids and appointments per fixture trusteeId.
  // These depend on ACMS CMMPR (03-seed) and ATS CHAPTER_DETAILS (02-seed).
  // -------------------------------------------------------------------------
  console.log('=== INFO: professional-ids (depends on ACMS CMMPR seeding) ===');
  for (const truId of TRU_IDS) {
    const doc = docForTruId(truId);
    if (!doc) {
      infoCheck('truId ' + truId + ' professional-ids', false, 'no single trustees doc to resolve trusteeId');
      continue;
    }
    const count = await professionalIds.countDocuments({
      documentType: 'TRUSTEE_PROFESSIONAL_ID',
      camsTrusteeId: doc.trusteeId,
    });
    infoCheck(
      'truId ' + truId + ' (' + (EXPECTED[truId]?.name ?? '') + ') professional-ids >= 1',
      count >= 1,
      'count ' + count + ' for trusteeId ' + doc.trusteeId,
    );
  }
  console.log('');

  console.log('=== INFO: appointments (depends on ATS CHAPTER_DETAILS seeding) ===');
  for (const truId of TRU_IDS) {
    const doc = docForTruId(truId);
    if (!doc) {
      infoCheck('truId ' + truId + ' appointments', false, 'no single trustees doc to resolve trusteeId');
      continue;
    }
    const count = await appointments.countDocuments({
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: doc.trusteeId,
    });
    infoCheck(
      'truId ' + truId + ' (' + (EXPECTED[truId]?.name ?? '') + ') appointments >= 1',
      count >= 1,
      'count ' + count + ' for trusteeId ' + doc.trusteeId,
    );
  }
  console.log('');
} finally {
  // ALWAYS close the client, even on connection/query errors.
  await client.close();
}

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------
console.log('==================== SUMMARY ====================');
console.log('HARD checks passed: ' + hardPassed);
console.log('HARD checks failed: ' + hardFailed);
if (infoNotes.length > 0) {
  console.log('');
  console.log('INFO warnings (' + infoNotes.length + ') — do NOT fail the run, but review:');
  for (const note of infoNotes) {
    console.log('  - ' + note);
  }
  console.log('  These depend on ACMS CMMPR (03-seed) / ATS CHAPTER_DETAILS (02-seed) being');
  console.log('  present. A zero count means the professional-id / appointment path was not');
  console.log('  exercised, NOT that the dedup fixes regressed.');
}
console.log('');
if (hardFailed === 0) {
  console.log('RESULT: PASS — all HARD dedup/state checks held after two migration runs.');
} else {
  console.log('RESULT: FAIL — ' + hardFailed + ' HARD check(s) failed. Duplicate/state regression.');
}
console.log('=================================================');

process.exit(hardFailed > 0 ? 1 : 0);
