#!/usr/bin/env npx tsx
/**
 * CLI Script: Trigger Case Sync with Event Type
 *
 * This script sends case sync events to the dataflow API for testing
 * the trustee-case-sync feature (CAMS-588).
 *
 * Usage:
 *   npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts [options] <caseId...>
 *
 * Options:
 *   --type, -t        Event type: 'CASE_CHANGED' or 'TRUSTEE_APPOINTMENT' (default: CASE_CHANGED)
 *   --endpoint, -e    Dataflow API endpoint (or use DATAFLOW_IMPORT_URL env var)
 *   --key, -k         Admin API key (or use ADMIN_KEY env var)
 *   --dry-run, -d     Show payload without sending
 *   --verbose, -v     Show detailed output
 *   --help, -h        Show help
 *
 * Examples:
 *   # Sync a single case as CASE_CHANGED
 *   npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts 081-24-12345
 *
 *   # Trigger trustee appointment sync (will attempt trustee matching)
 *   npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts -t TRUSTEE_APPOINTMENT 081-24-12345
 *
 *   # Dry run to see the payload
 *   npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts --dry-run -t TRUSTEE_APPOINTMENT 081-24-12345
 *
 * Environment Variables:
 *   DATAFLOW_IMPORT_URL  - Base URL for dataflow API (e.g., http://localhost:7072)
 *   ADMIN_KEY            - API key for authorization
 */

import { parseArgs } from 'node:util';

// Event type for case sync
type CaseSyncEventType = 'CASE_CHANGED' | 'TRUSTEE_APPOINTMENT' | 'MIGRATION';

interface CaseSyncEvent {
  type: CaseSyncEventType;
  caseId: string;
}

// Parse command line arguments
const { values, positionals } = parseArgs({
  options: {
    type: {
      type: 'string',
      short: 't',
      default: 'CASE_CHANGED',
    },
    endpoint: {
      type: 'string',
      short: 'e',
    },
    key: {
      type: 'string',
      short: 'k',
    },
    'dry-run': {
      type: 'boolean',
      short: 'd',
      default: false,
    },
    verbose: {
      type: 'boolean',
      short: 'v',
      default: false,
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false,
    },
  },
  allowPositionals: true,
});

const eventType = values.type as CaseSyncEventType;
const endpoint = values.endpoint || process.env.DATAFLOW_IMPORT_URL;
const apiKey = values.key || process.env.ADMIN_KEY;
const dryRun = values['dry-run'];
const verbose = values.verbose;
const showHelp = values.help;
const caseIds = positionals;

// Show help
if (showHelp || caseIds.length === 0) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              CAMS Case Sync CLI - CAMS-588 Testing               ║
╚══════════════════════════════════════════════════════════════════╝

USAGE:
  npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts [options] <caseId...>

OPTIONS:
  -t, --type <type>      Event type (default: CASE_CHANGED)
                         Valid values: CASE_CHANGED, TRUSTEE_APPOINTMENT, MIGRATION

  -e, --endpoint <url>   Dataflow API base URL
                         Default: DATAFLOW_IMPORT_URL env var

  -k, --key <key>        Admin API key for authorization
                         Default: ADMIN_KEY env var

  -d, --dry-run          Show payload without sending request

  -v, --verbose          Show detailed output

  -h, --help             Show this help message

EXAMPLES:
  # Sync a single case (normal sync)
  npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts 081-24-12345

  # Trigger trustee appointment sync (will attempt trustee matching)
  npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts -t TRUSTEE_APPOINTMENT 081-24-12345

  # Sync multiple cases at once
  npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts 081-24-11111 081-24-22222

  # Dry run to preview the payload
  npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts --dry-run -t TRUSTEE_APPOINTMENT 081-24-12345

  # Specify endpoint and key directly
  npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts \\
    -e http://localhost:7072 \\
    -k your-api-key \\
    -t TRUSTEE_APPOINTMENT \\
    081-24-12345

ENVIRONMENT VARIABLES:
  DATAFLOW_IMPORT_URL    Dataflow API base URL (e.g., http://localhost:7072)
  ADMIN_KEY              API key for authorization

LOCAL DEVELOPMENT:
  Start the dataflows locally first:
    cd backend/function-apps/dataflows && npm start

  Then run:
    DATAFLOW_IMPORT_URL=http://localhost:7072 ADMIN_KEY=dev-key \\
      npx tsx backend/function-apps/dataflows/e2e/cli-sync-case.ts 081-24-12345

TRUSTEE-CASE SYNC (CAMS-588):
  When using -t TRUSTEE_APPOINTMENT, the sync will:
  1. Fetch case details from DXTR
  2. Extract the trustee name from the case
  3. Search CAMS trustees for an exact name match
  4. If exactly one match: set trusteeId on the case
  5. If no match or multiple matches: error (case goes to DLQ)

OUTPUT FORMAT:
  The API returns an array of events with results:
  [
    {
      "type": "TRUSTEE_APPOINTMENT",
      "caseId": "081-24-12345",
      "trusteeId": "abc-123",       // Set if match found
      "error": null                 // Set if error occurred
    }
  ]
`);
  process.exit(showHelp ? 0 : 1);
}

// Validate event type
const validEventTypes = ['CASE_CHANGED', 'TRUSTEE_APPOINTMENT', 'MIGRATION'];
if (!validEventTypes.includes(eventType)) {
  console.error(`\n❌ Invalid event type: ${eventType}`);
  console.error(`   Valid types: ${validEventTypes.join(', ')}`);
  process.exit(1);
}

// Validate case IDs format (basic check)
const caseIdPattern = /^\d{3}-\d{2}-\d{5}$/;
const invalidCaseIds = caseIds.filter((id) => !caseIdPattern.test(id));
if (invalidCaseIds.length > 0) {
  console.warn(`\n⚠️  Warning: Some case IDs may be invalid format (expected: XXX-XX-XXXXX):`);
  invalidCaseIds.forEach((id) => console.warn(`   - ${id}`));
  console.warn('');
}

// Build events
const events: CaseSyncEvent[] = caseIds.map((caseId) => ({
  type: eventType,
  caseId,
}));

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    CAMS Case Sync CLI                            ║
╚══════════════════════════════════════════════════════════════════╝
`);

console.log(`📋 Configuration:`);
console.log(`   Event Type:  ${eventType}`);
console.log(`   Case Count:  ${caseIds.length}`);
console.log(`   Endpoint:    ${endpoint || '(not set)'}`);
console.log(`   API Key:     ${apiKey ? '***' + apiKey.slice(-4) : '(not set)'}`);
console.log(`   Dry Run:     ${dryRun ? 'Yes' : 'No'}`);
console.log('');

console.log(`📦 Events to send:`);
events.forEach((event, index) => {
  console.log(`   ${index + 1}. [${event.type}] ${event.caseId}`);
});
console.log('');

if (verbose || dryRun) {
  console.log(`📝 Request payload:`);
  console.log(JSON.stringify(events, null, 2));
  console.log('');
}

if (dryRun) {
  console.log(`🔍 DRY RUN - No request will be sent.`);
  console.log('');

  // Show curl command equivalent
  console.log(`📋 Equivalent curl command:`);
  console.log(`   curl -X POST '${endpoint || '<ENDPOINT>'}/import/sync-cases' \\`);
  console.log(`     -H 'Content-Type: application/json' \\`);
  console.log(`     -H 'Authorization: ApiKey ${apiKey || '<API_KEY>'}' \\`);
  console.log(`     -d '${JSON.stringify(events)}'`);
  console.log('');

  process.exit(0);
}

// Validate endpoint and key
if (!endpoint) {
  console.error(`
❌ Missing endpoint URL.

Provide via:
  --endpoint <url>
  or
  export DATAFLOW_IMPORT_URL=http://localhost:7072
`);
  process.exit(1);
}

if (!apiKey) {
  console.error(`
❌ Missing API key.

Provide via:
  --key <key>
  or
  export ADMIN_KEY=your-key
`);
  process.exit(1);
}

// Execute the sync via HTTP
async function main(): Promise<void> {
  const syncUrl = `${endpoint}/import/sync-cases`;

  console.log(`🚀 Sending request to: ${syncUrl}`);
  console.log('');

  try {
    const startTime = Date.now();
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify(events),
    });

    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ Request failed: ${response.status} ${response.statusText}`);
      if (verbose) {
        console.error(`   Response: ${errorText}`);
      }
      process.exit(1);
    }

    const results = (await response.json()) as CaseSyncEvent[];

    console.log(`✅ Sync completed in ${elapsed}ms`);
    console.log('');
    console.log(`📊 Results:`);

    let successCount = 0;
    let errorCount = 0;

    results.forEach((result) => {
      const hasError = 'error' in result && result.error;
      if (hasError) {
        errorCount++;
        console.log(`   ❌ ${result.caseId}: ERROR`);
        console.log(`      ${JSON.stringify((result as { error: unknown }).error)}`);
      } else {
        successCount++;
        console.log(`   ✅ ${result.caseId}: SUCCESS`);
        if ('trusteeId' in result && result.trusteeId) {
          console.log(`      Matched trusteeId: ${result.trusteeId}`);
        }
      }
    });

    console.log('');
    console.log(`📈 Summary:`);
    console.log(`   Processed: ${results.length}`);
    console.log(`   Success:   ${successCount}`);
    console.log(`   Errors:    ${errorCount}`);

    if (verbose) {
      console.log('');
      console.log(`📝 Full response:`);
      console.log(JSON.stringify(results, null, 2));
    }

    if (errorCount > 0) {
      console.log('');
      console.log(
        `⚠️  ${errorCount} case(s) failed. These would go to the Dead Letter Queue (DLQ).`,
      );
      console.log(`   For TRUSTEE_APPOINTMENT events, common errors:`);
      console.log(`   - No CAMS trustee found matching the DXTR trustee name`);
      console.log(`   - Multiple CAMS trustees found with the same name`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Request failed:`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
