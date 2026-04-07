/**
 * Local testing script for Zoom CSV import (CAMS-596 Slice 3).
 *
 * Invokes the importZoomCsv use case directly using backend/.env configuration.
 * Reads zoom-info.tsv from Azure Blob Storage and writes zoom-import-report.tsv
 * to the same container.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     test/migration/trustee/scripts/run-zoom-csv-import.ts \
 *     [command]
 *
 * Commands:
 *   run      Execute the importZoomCsv use case
 *   report   Show the latest zoom-import-report.tsv from Azure Blob Storage
 *   diagnose Show per-row DB match counts without writing anything
 *   help     Show this message
 *
 * Prerequisites:
 *   backend/.env must contain:
 *     AzureWebJobsStorage=<azure-storage-connection-string>
 *     CAMS_OBJECT_CONTAINER=migration-files
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { importZoomCsv, diagnoseZoomCsvImport } from '../../../../backend/lib/use-cases/dataflows/import-zoom-csv';
import factory from '../../../../backend/lib/factory';

dotenv.config({ path: 'backend/.env' });

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning importZoomCsv use case...');
  console.log(`  container : ${process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files'}`);
  console.log('  blob      : zoom-info.tsv');

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const result = await importZoomCsv(context);

  console.log('\nImport result:');
  console.log(`  total     : ${result.total}`);
  console.log(`  matched   : ${result.matched}`);
  console.log(`  unmatched : ${result.unmatched}`);
  console.log(`  ambiguous : ${result.ambiguous}`);
  console.log(`  errors    : ${result.errors}`);
  console.log(`\nReport saved to ${process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files'}/zoom-import-report.tsv. Run "report" to view it.`);
}

async function diagnose() {
  console.log('\nDiagnosing Zoom CSV import...');
  console.log(`  container : ${process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files'}`);
  console.log('  blob      : zoom-info.tsv');

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const diagnoses = await diagnoseZoomCsvImport(context);

  if (diagnoses.length === 0) {
    console.log('\n  No zoom-info.tsv found in object storage or file is empty.');
    return;
  }

  console.log(`\n  Parsed ${diagnoses.length} row(s) from TSV:\n`);

  for (const d of diagnoses) {
    console.log(`  [${d.outcome}] "${d.fullName}"`);
    console.log(`    normalized : "${d.normalizedName}"`);
    console.log(`    db matches : ${d.matchCount}`);
    for (const id of d.matchedTrusteeIds) {
      console.log(`      trusteeId : ${id}`);
    }
    console.log();
  }
}

async function report() {
  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const objectStorage = factory.getObjectStorageGateway(context);
  const content = await objectStorage.readObject(containerName, 'zoom-import-report.tsv');

  if (!content) {
    console.log('\nNo zoom-import-report.tsv found. Run "run" first.');
    return;
  }

  console.log(`\nZoom CSV Import Report (${containerName}/zoom-import-report.tsv):\n`);
  const lines = content.split('\n');
  for (const line of lines) {
    console.log('  ' + line);
  }
}

function clean() {
  console.log(
    '\nThe zoom-import-report.tsv is stored in Azure Blob Storage and is overwritten on each "run". No cleanup needed.',
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] || 'help';

  console.log('='.repeat(60));
  console.log('CAMS Zoom CSV Import - Local Test Tool');
  console.log('='.repeat(60));

  switch (command) {
    case 'run':
      await run();
      break;

    case 'diagnose':
      await diagnose();
      break;

    case 'report':
      await report();
      break;

    case 'clean':
      clean();
      break;

    case 'help':
    default:
      console.log(`
Usage: npx tsx --tsconfig backend/tsconfig.json \\
  test/migration/trustee/scripts/run-zoom-csv-import.ts \\
  [command]

Prerequisites (backend/.env):
  AzureWebJobsStorage=<azure-storage-connection-string>
  CAMS_OBJECT_CONTAINER=migration-files

Commands:
  run      Execute the importZoomCsv use case directly.
           Reads zoom-info.tsv from Azure Blob Storage, matches trustees in MongoDB,
           and writes zoom-import-report.tsv to the same container.

  diagnose Read zoom-info.tsv from Azure Blob Storage and show, for each row, exactly
           how many trustees matched by name in MongoDB — without writing anything.
           Useful for diagnosing unmatched/ambiguous discrepancies.

  report   Show the latest zoom-import-report.tsv from Azure Blob Storage.

  help     Show this message

Examples:
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts run
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts report
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts diagnose
`);
      break;
  }

  console.log('='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
