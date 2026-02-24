#!/usr/bin/env npx tsx
/**
 * CLI Test Harness: SyncTrusteeAppointments Dataflow
 *
 * Tests the end-to-end trustee-case-sync flow (CAMS-588) against real databases:
 *   1. Queries DXTR for trustee appointment transactions (AO_TX + AO_PY)
 *   2. Checks for matching CAMS trustee documents in Cosmos DB
 *   3. Optionally seeds matching CAMS trustees for discovered DXTR names
 *   4. Runs processAppointments to match and link trusteeIds to SyncedCases
 *   5. Verifies results by reading back the updated SyncedCases
 *
 * Prerequisites:
 *   - backend/.env configured with real database connections (DATABASE_MOCK=false)
 *   - DXTR SQL Server accessible (AODATEX_SUB)
 *   - Cosmos DB accessible (cosmos-ustp-cams-dev)
 *
 * Usage (run from backend/ directory for @common path alias resolution):
 *   cd backend && npx tsx function-apps/dataflows/e2e/cli-sync-trustee-appointments.ts [options]
 *
 * Options:
 *   --since, -s      ISO date to search from (default: 30 days ago)
 *   --limit, -n      Max number of appointments to process (default: all)
 *   --seed-dxtr      Insert test trustee appointment data into DXTR (AO_TX + AO_PY)
 *   --discover, -d   Discovery mode: show DXTR appointments without processing
 *   --seed           Seed matching CAMS trustees for any unmatched DXTR names
 *   --process, -p    Process appointments (match + link trusteeId to cases)
 *   --verify         Verify results by reading SyncedCases from Cosmos
 *   --all, -a        Run full pipeline: seed-dxtr -> discover -> seed -> process -> verify
 *   --verbose, -v    Show detailed output
 *   --help, -h       Show help
 *
 * Examples:
 *   # Seed DXTR with a test appointment, then discover it
 *   cd backend && npx tsx function-apps/dataflows/e2e/cli-sync-trustee-appointments.ts --seed-dxtr --discover
 *
 *   # Full pipeline: seed DXTR, discover, seed Cosmos, process, verify
 *   cd backend && npx tsx function-apps/dataflows/e2e/cli-sync-trustee-appointments.ts --all -n 1
 *
 *   # Discover with a specific start date
 *   cd backend && npx tsx function-apps/dataflows/e2e/cli-sync-trustee-appointments.ts -d -s 2025-01-01
 *
 *   # Seed + process only (after reviewing discovery output)
 *   cd backend && npx tsx function-apps/dataflows/e2e/cli-sync-trustee-appointments.ts --seed --process --verify -n 3
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as mssql from 'mssql';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ApplicationConfiguration } from '../../../lib/configs/application-configuration';
import { getFeatureFlags } from '../../../lib/adapters/utils/feature-flag';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import { AppInsightsObservability } from '../../../lib/adapters/services/observability';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import factory from '../../../lib/factory';
import SyncTrusteeAppointments from '../../../lib/use-cases/dataflows/sync-trustee-appointments';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { CamsUserReference } from '@common/cams/users';
import { executeQuery } from '../../../lib/adapters/utils/database';

// Load environment from backend/.env (resolve relative to this script's location)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// --- CLI Arguments -----------------------------------------------------------

const { values } = parseArgs({
  options: {
    since: { type: 'string', short: 's' },
    limit: { type: 'string', short: 'n' },
    'seed-dxtr': { type: 'boolean', default: false },
    discover: { type: 'boolean', short: 'd', default: false },
    seed: { type: 'boolean', default: false },
    process: { type: 'boolean', short: 'p', default: false },
    verify: { type: 'boolean', default: false },
    all: { type: 'boolean', short: 'a', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  console.log(`
SyncTrusteeAppointments Test Harness - CAMS-588

USAGE:
  cd backend && npx tsx function-apps/dataflows/e2e/cli-sync-trustee-appointments.ts [options]

MODES:
  --seed-dxtr            Insert test trustee appointment data into DXTR
  -d, --discover         Query DXTR for trustee appointment transactions
  --seed                 Create CAMS trustee docs for unmatched DXTR names
  -p, --process          Run trustee matching and link trusteeIds to cases
  --verify               Read back SyncedCases to confirm trusteeIds were set
  -a, --all              Run all steps: seed-dxtr -> discover -> seed -> process -> verify

OPTIONS:
  -s, --since <date>     ISO date to search from (default: 30 days ago)
  -n, --limit <count>    Max number of appointments to process (default: all)
  -v, --verbose          Detailed output
  -h, --help             Show this help

STEPS:
  0. SEED-DXTR - Finds an existing case in DXTR and inserts a test trustee
                 appointment transaction (AO_TX TX_TYPE='A', TX_CODE='TR') and
                 a trustee party record (AO_PY PY_ROLE='tr'). This creates the
                 data the discovery step looks for.

  1. DISCOVER  - Queries DXTR AO_TX (TX_TYPE='A', TX_CODE='TR') joined with
                 AO_PY (PY_ROLE='tr') to find trustee appointments since the
                 given date. Shows case IDs, trustee names, and court IDs.

  2. SEED      - For each DXTR trustee name that does NOT already have a matching
                 CAMS trustee in Cosmos DB, creates a new CAMS trustee document
                 with zoomInfo so the full UI display can be verified.

  3. PROCESS   - Calls SyncTrusteeAppointments.processAppointments() which:
                 a) Matches each DXTR trustee name to a CAMS trustee
                 b) Reads the SyncedCase from Cosmos
                 c) Sets trusteeId on the SyncedCase and saves it

  4. VERIFY    - Reads each SyncedCase back from Cosmos and confirms the
                 trusteeId field was set correctly.

ENVIRONMENT:
  Reads from backend/.env. Required vars:
    DATABASE_MOCK=false
    MSSQL_HOST, MSSQL_DATABASE_DXTR (DXTR connection)
    MONGO_CONNECTION_STRING, COSMOS_DATABASE_NAME (Cosmos connection)
`);
  process.exit(0);
}

const runSeedDxtr = values.all || values['seed-dxtr'];
const runDiscover = values.all || values.discover;
const runSeed = values.all || values.seed;
const runProcess = values.all || values.process;
const runVerify = values.all || values.verify;
const limit = values.limit ? parseInt(values.limit, 10) : undefined;

if (!runSeedDxtr && !runDiscover && !runSeed && !runProcess && !runVerify) {
  console.error(
    '\nNo mode selected. Use --seed-dxtr, --discover, --seed, --process, --verify, or --all.\nUse --help for usage.\n',
  );
  process.exit(1);
}

if (limit !== undefined && (isNaN(limit) || limit < 1)) {
  console.error('\n--limit must be a positive integer.\n');
  process.exit(1);
}

const defaultSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const sinceDate = values.since ?? defaultSince;

// --- Application Context -----------------------------------------------------

async function createContext(): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();

  if (config.dbMock) {
    console.error('\n[ERROR] DATABASE_MOCK is true. Set DATABASE_MOCK=false in backend/.env.\n');
    process.exit(1);
  }

  const featureFlags = await getFeatureFlags(config);
  const logger = new LoggerImpl('cli-sync-trustee-appointments');
  const observability = new AppInsightsObservability();

  return {
    config,
    featureFlags,
    logger,
    observability,
    invocationId: randomUUID(),
    session: undefined,
    request: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined,
  };
}

// --- Step 0: Seed DXTR -------------------------------------------------------

async function seedDxtr(context: ApplicationContext): Promise<void> {
  console.log('\n=== STEP 0: SEED DXTR ===');

  const dxtrConfig = context.config.dxtrDbConfig;

  // 1. Find an existing CAMS trustee in Cosmos to use as the name source
  console.log('  Querying Cosmos for an existing CAMS trustee...');
  const trusteesRepo = factory.getTrusteesRepository(context);
  const allTrustees = await trusteesRepo.listTrustees();
  trusteesRepo.release();

  if (allTrustees.length === 0) {
    console.error('  [ERROR] No CAMS trustees found in Cosmos. Cannot seed DXTR.');
    console.error('  Seed a trustee in Cosmos first, then re-run with --seed-dxtr.');
    return;
  }

  const camsTrustee = allTrustees[0];
  console.log(`  Using CAMS trustee: "${camsTrustee.name}" (trusteeId: ${camsTrustee.trusteeId})`);

  // Parse the CAMS trustee name into parts for AO_PY columns.
  // DXTR stores: PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION
  // The fullName is reconstructed as: TRIM(CONCAT(first, ' ', middle, ' ', last, ' ', gen))
  const nameParts = camsTrustee.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

  console.log(`  Name parts: first="${firstName}" middle="${middleName}" last="${lastName}"`);
  console.log('');

  // 2. Find a case in DXTR, then verify it exists as a SyncedCase in Cosmos.
  console.log('  Querying DXTR for recent cases...');
  const findCasesQuery = `
    SELECT TOP 20
      C.CS_CASEID,
      C.CASE_ID,
      C.COURT_ID,
      CONCAT(CS_DIV.CS_DIV_ACMS, '-', C.CASE_ID) AS caseId
    FROM AO_CS C
    JOIN AO_CS_DIV AS CS_DIV ON C.CS_DIV = CS_DIV.CS_DIV
    ORDER BY C.CS_DATE_FILED DESC
  `;
  const casesResult = await executeQuery(context, dxtrConfig, findCasesQuery);
  const dxtrCases = casesResult.results?.['recordset'] ?? [];

  if (!dxtrCases.length) {
    console.error('  [ERROR] No cases found in DXTR.');
    return;
  }

  console.log(`  Found ${dxtrCases.length} DXTR case(s). Verifying against Cosmos...`);

  const casesRepo = factory.getCasesRepository(context);
  let csCaseId: string | undefined;
  let dxtrCaseId: string | undefined;
  let courtId: string | undefined;
  let caseId: string | undefined;

  for (const row of dxtrCases) {
    try {
      await casesRepo.getSyncedCase(row.caseId);
      csCaseId = row.CS_CASEID;
      dxtrCaseId = row.CASE_ID;
      courtId = row.COURT_ID;
      caseId = row.caseId;
      console.log(`  Matched: ${caseId} exists in both DXTR (CS_CASEID=${csCaseId}) and Cosmos`);
      break;
    } catch {
      // SyncedCase not found in Cosmos, try next
    }
  }
  casesRepo.release();

  if (!csCaseId || !dxtrCaseId || !courtId || !caseId) {
    console.error('  [ERROR] None of the recent DXTR cases exist as SyncedCases in Cosmos.');
    console.error('  Run sync-cases first to populate Cosmos, then re-run --seed-dxtr.');
    return;
  }

  const caseParams = [
    { name: 'csCaseId', type: mssql.VarChar, value: csCaseId },
    { name: 'dxtrCaseId', type: mssql.VarChar, value: dxtrCaseId },
    { name: 'courtId', type: mssql.VarChar, value: courtId },
  ];

  // 3. Replace any existing trustee parties to ensure 0..1 cardinality, then insert ours
  const deletePyQuery = `
    DELETE FROM AO_PY
    WHERE CS_CASEID = @csCaseId AND COURT_ID = @courtId AND PY_ROLE = 'tr'
  `;
  await executeQuery(context, dxtrConfig, deletePyQuery, caseParams);

  const insertPyQuery = `
    INSERT INTO AO_PY (
      CS_CASEID, COURT_ID, PY_ROLE,
      PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME
    ) VALUES (
      @csCaseId, @courtId, 'tr',
      @firstName, @middleName, @lastName
    )
  `;
  const insertParams = [
    ...caseParams,
    { name: 'firstName', type: mssql.VarChar, value: firstName },
    { name: 'middleName', type: mssql.VarChar, value: middleName },
    { name: 'lastName', type: mssql.VarChar, value: lastName },
  ];
  const pyResult = await executeQuery(context, dxtrConfig, insertPyQuery, insertParams);
  if (!pyResult.success) {
    console.error(`  [ERROR] Failed to insert AO_PY: ${pyResult.message}`);
    return;
  }
  console.log(`  [OK] Set trustee party for case: "${camsTrustee.name}"`);

  // 4. Insert the appointment transaction in AO_TX
  const checkTxQuery = `
    SELECT TX_ID FROM AO_TX
    WHERE CS_CASEID = @csCaseId AND COURT_ID = @courtId
      AND TX_TYPE = 'A' AND TX_CODE = 'TR'
      AND TX_DATE > DATEADD(day, -1, GETUTCDATE())
  `;
  const existingTx = await executeQuery(context, dxtrConfig, checkTxQuery, caseParams);

  if (existingTx.results?.['recordset']?.length > 0) {
    console.log('  [EXISTS] Recent appointment transaction already exists. Skipping AO_TX insert.');
  } else {
    const insertTxQuery = `
      INSERT INTO AO_TX (
        CS_CASEID, CASE_ID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, DE_SEQNO, JOB_ID, REC
      ) VALUES (
        @csCaseId, @dxtrCaseId, @courtId, 'A', 'TR', GETUTCDATE(), 0, 100, ''
      )
    `;
    const txResult = await executeQuery(context, dxtrConfig, insertTxQuery, caseParams);
    if (!txResult.success) {
      console.error(`  [ERROR] Failed to insert AO_TX: ${txResult.message}`);
      return;
    }
    console.log('  [OK] Inserted appointment transaction into AO_TX');
  }

  console.log('');
  console.log(`  Test case ready: ${caseId}`);
  console.log(`  CAMS trustee:    "${camsTrustee.name}" (${camsTrustee.trusteeId})`);
  console.log('  Run --discover to confirm the data is visible.');
}

// --- Step 1: Discover --------------------------------------------------------

async function discover(context: ApplicationContext): Promise<TrusteeAppointmentSyncEvent[]> {
  console.log('\n=== STEP 1: DISCOVER ===');
  console.log(`  Querying DXTR for trustee appointments since: ${sinceDate}`);
  console.log('');

  const { events, latestSyncDate } = await SyncTrusteeAppointments.getAppointmentEvents(
    context,
    sinceDate,
  );

  if (events.length === 0) {
    console.log('  No trustee appointment transactions found in DXTR.');
    console.log(`  Try an earlier --since date (current: ${sinceDate}).`);
    return [];
  }

  console.log(`  Found ${events.length} trustee appointment(s).`);
  console.log(`  Latest transaction date: ${latestSyncDate}`);

  if (limit && events.length > limit) {
    console.log(`  Limiting to first ${limit} (of ${events.length} total).`);
  }

  const selected = limit ? events.slice(0, limit) : events;

  console.log('');

  const nameWidth = 35;
  const caseWidth = 16;
  const courtWidth = 8;
  console.log(
    `  ${'TRUSTEE NAME'.padEnd(nameWidth)} ${'CASE ID'.padEnd(caseWidth)} ${'COURT'.padEnd(courtWidth)}`,
  );
  console.log(`  ${'─'.repeat(nameWidth)} ${'─'.repeat(caseWidth)} ${'─'.repeat(courtWidth)}`);

  for (const event of selected) {
    const name = event.dxtrTrustee.fullName.padEnd(nameWidth);
    const caseId = event.caseId.padEnd(caseWidth);
    const court = event.courtId.padEnd(courtWidth);
    console.log(`  ${name} ${caseId} ${court}`);
  }
  console.log('');

  return selected;
}

// --- Step 2: Seed ------------------------------------------------------------

async function seed(
  context: ApplicationContext,
  events: TrusteeAppointmentSyncEvent[],
): Promise<void> {
  console.log('\n=== STEP 2: SEED ===');
  console.log('  Checking Cosmos DB for matching CAMS trustees...');
  console.log('');

  const trusteesRepo = factory.getTrusteesRepository(context);
  const testUser: CamsUserReference = { id: 'cli-test-harness', name: 'CLI Test Harness' };

  // Deduplicate by trustee name
  const uniqueNames = new Map<string, TrusteeAppointmentSyncEvent>();
  for (const event of events) {
    const name = event.dxtrTrustee.fullName;
    if (!uniqueNames.has(name)) {
      uniqueNames.set(name, event);
    }
  }

  let seededCount = 0;
  let existingCount = 0;

  for (const [name, event] of uniqueNames) {
    const matches = await trusteesRepo.findTrusteesByName(name);

    if (matches.length > 0) {
      existingCount++;
      console.log(`  [EXISTS]  "${name}" -> trusteeId: ${matches[0].trusteeId}`);
      if (matches.length > 1) {
        console.log(`            WARNING: ${matches.length} matches found (ambiguous)`);
      }
    } else {
      const trusteeId = randomUUID();
      const trusteeData = {
        id: randomUUID(),
        trusteeId,
        name,
        public: {
          address: {
            address1: event.dxtrTrustee.legacy?.address1 || '123 Test St',
            city:
              event.dxtrTrustee.legacy?.cityStateZipCountry?.split(',')[0]?.trim() || 'Test City',
            state: 'NY',
            zipCode: '10001',
            countryCode: 'US' as const,
          },
          phone: event.dxtrTrustee.legacy?.phone
            ? { number: event.dxtrTrustee.legacy.phone }
            : undefined,
          email: event.dxtrTrustee.legacy?.email,
        },
        zoomInfo: {
          link: 'https://zoom.us/j/1234567890',
          phone: '+1-555-012-3456',
          meetingId: '123 456 7890',
          passcode: 'test1234',
        },
        updatedOn: new Date().toISOString(),
        updatedBy: testUser,
      };

      await trusteesRepo.createTrustee(trusteeData, testUser);
      seededCount++;
      console.log(`  [SEEDED]  "${name}" -> trusteeId: ${trusteeId}`);
    }
  }

  trusteesRepo.release();
  console.log('');
  console.log(`  Summary: ${existingCount} existing, ${seededCount} seeded`);
}

// --- Step 3: Process ---------------------------------------------------------

async function processAppointments(
  context: ApplicationContext,
  events: TrusteeAppointmentSyncEvent[],
): Promise<TrusteeAppointmentSyncEvent[]> {
  console.log('\n=== STEP 3: PROCESS ===');
  console.log(`  Processing ${events.length} appointment event(s)...`);
  console.log('');

  const results = await SyncTrusteeAppointments.processAppointments(context, events);

  let successCount = 0;
  let errorCount = 0;

  for (const event of results) {
    if (event.error) {
      errorCount++;
      const errMsg =
        typeof event.error === 'object' && 'message' in event.error
          ? (event.error as { message: string }).message
          : String(event.error);
      console.log(`  [FAIL]    ${event.caseId}: ${errMsg}`);
    } else {
      successCount++;
      console.log(`  [OK]      ${event.caseId}: matched "${event.dxtrTrustee.fullName}"`);
    }
  }

  console.log('');
  console.log(`  Summary: ${successCount} succeeded, ${errorCount} failed`);

  if (errorCount > 0) {
    console.log('');
    console.log('  Common failure reasons:');
    console.log('  - No CAMS trustee found matching the DXTR trustee name');
    console.log('  - Multiple CAMS trustees found with the same name');
    console.log('  - SyncedCase does not exist in Cosmos (case not yet synced)');
    console.log('');
    console.log('  Fix: Run --seed to create matching trustees, or sync cases first.');
  }

  return results;
}

// --- Step 4: Verify ----------------------------------------------------------

async function verify(
  context: ApplicationContext,
  events: TrusteeAppointmentSyncEvent[],
): Promise<void> {
  console.log('\n=== STEP 4: VERIFY ===');
  console.log('  Reading SyncedCases from Cosmos DB...');
  console.log('');

  const casesRepo = factory.getCasesRepository(context);
  let linkedCount = 0;
  let missingCount = 0;
  let noTrusteeIdCount = 0;

  for (const event of events) {
    try {
      const syncedCase = await casesRepo.getSyncedCase(event.caseId);
      if (syncedCase.trusteeId) {
        linkedCount++;
        console.log(`  [LINKED]  ${event.caseId} -> trusteeId: ${syncedCase.trusteeId}`);
      } else {
        noTrusteeIdCount++;
        console.log(`  [NO ID]   ${event.caseId}: SyncedCase exists but no trusteeId`);
      }
    } catch {
      missingCount++;
      console.log(`  [MISSING] ${event.caseId}: SyncedCase not found in Cosmos`);
    }
  }

  casesRepo.release();
  console.log('');
  console.log(
    `  Summary: ${linkedCount} linked, ${noTrusteeIdCount} without trusteeId, ${missingCount} missing`,
  );
}

// --- Main --------------------------------------------------------------------

async function main() {
  console.log('\nSyncTrusteeAppointments Test Harness - CAMS-588\n');
  console.log('  Configuration:');
  console.log(`    Since date:  ${sinceDate}`);
  console.log(`    Limit:       ${limit ?? 'all'}`);
  console.log(
    `    Steps:       ${[runSeedDxtr && 'seed-dxtr', runDiscover && 'discover', runSeed && 'seed', runProcess && 'process', runVerify && 'verify'].filter(Boolean).join(' -> ')}`,
  );
  console.log(`    DB Mock:     ${process.env.DATABASE_MOCK ?? '(not set)'}`);
  console.log(`    DXTR Host:   ${process.env.MSSQL_HOST ?? '(not set)'}`);
  console.log(`    Cosmos DB:   ${process.env.COSMOS_DATABASE_NAME ?? '(not set)'}`);

  const context = await createContext();
  let events: TrusteeAppointmentSyncEvent[] = [];

  try {
    // Step 0: Seed DXTR
    if (runSeedDxtr) {
      await seedDxtr(context);
    }

    // Step 1: Discover
    if (runDiscover || runSeed || runProcess) {
      events = await discover(context);
      if (events.length === 0 && (runSeed || runProcess)) {
        console.log('\n  No events to process. Exiting.');
        return;
      }
    }

    // Step 2: Seed
    if (runSeed && events.length > 0) {
      await seed(context, events);
    }

    // Step 3: Process
    if (runProcess && events.length > 0) {
      events = await processAppointments(context, events);
    }

    // Step 4: Verify
    if (runVerify && events.length > 0) {
      await verify(context, events);
    }

    console.log('\nDone.\n');
  } finally {
    for (const closable of context.closables) {
      await closable.close();
    }
    for (const releasable of context.releasables) {
      releasable.release();
    }
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
