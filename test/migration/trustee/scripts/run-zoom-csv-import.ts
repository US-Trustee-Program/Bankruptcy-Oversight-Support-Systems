/**
 * Local testing script for Zoom CSV import (CAMS-596 Slice 3).
 *
 * Invokes the importZoomCsv use case directly using backend/.env configuration.
 * Reads zoom-info.tsv from Azure Blob Storage and saves a ZOOM_CSV_IMPORT_STATE
 * report to MongoDB.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     test/migration/trustee/scripts/run-zoom-csv-import.ts \
 *     [command]
 *
 * Commands:
 *   run      Execute the importZoomCsv use case
 *   report   Show the latest ZOOM_CSV_IMPORT_STATE document from MongoDB
 *   clean    Delete the ZOOM_CSV_IMPORT_STATE document from MongoDB
 *   help     Show this message
 *
 * Prerequisites:
 *   backend/.env must contain:
 *     AzureWebJobsStorage=<azure-storage-connection-string>
 *     CAMS_OBJECT_CONTAINER=migration-files
 *     MONGO_CONNECTION_STRING=<mongo-uri>
 *     COSMOS_DATABASE_NAME=<db-name>
 */

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { importZoomCsv } from '../../../../backend/lib/use-cases/dataflows/import-zoom-csv';

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
  console.log('\nReport saved to runtime-state collection. Run "report" to view failed rows.');
}

async function report() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !dbName) {
    console.error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set in backend/.env');
    return;
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(dbName);
    const doc = await db
      .collection('runtime-state')
      .findOne({ documentType: 'ZOOM_CSV_IMPORT_STATE' });

    if (!doc) {
      console.log('\nNo ZOOM_CSV_IMPORT_STATE document found. Run "run" first.');
      return;
    }

    console.log('\nZoom CSV Import Report:');
    console.log(`  importedAt : ${doc.importedAt}`);
    console.log(`  total      : ${doc.total}`);
    console.log(`  matched    : ${doc.matched}`);
    console.log(`  unmatched  : ${doc.unmatched}`);
    console.log(`  ambiguous  : ${doc.ambiguous}`);
    console.log(`  errors     : ${doc.errors}`);

    const failed = doc.failedRows ?? [];
    if (failed.length === 0) {
      console.log('\n  failedRows : (none)');
    } else {
      console.log(`\n  failedRows (${failed.length}):`);
      for (const row of failed) {
        console.log(`    [${row.reason}] ${row.fullName}`);
        if (row.accountEmail) console.log(`      accountEmail : ${row.accountEmail}`);
        console.log(`      meetingId    : ${row.meetingId}`);
      }
    }
  } finally {
    await client.close();
  }
}

async function clean() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !dbName) {
    console.error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set in backend/.env');
    return;
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(dbName);
    const result = await db
      .collection('runtime-state')
      .deleteOne({ documentType: 'ZOOM_CSV_IMPORT_STATE' });
    console.log(`\nDeleted ${result.deletedCount} ZOOM_CSV_IMPORT_STATE document(s).`);
  } finally {
    await client.close();
  }
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

    case 'report':
      await report();
      break;

    case 'clean':
      await clean();
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
  MONGO_CONNECTION_STRING=<mongo-uri>
  COSMOS_DATABASE_NAME=<db-name>

Commands:
  run      Execute the importZoomCsv use case directly.
           Reads zoom-info.tsv from Azure Blob Storage, matches trustees in MongoDB,
           and saves a ZOOM_CSV_IMPORT_STATE report to the runtime-state collection.

  report   Show the latest ZOOM_CSV_IMPORT_STATE document from MongoDB,
           including counts and any failed rows (unmatched, ambiguous, errors).

  clean    Delete the ZOOM_CSV_IMPORT_STATE document from MongoDB.

  help     Show this message

Examples:
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts run
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts report
  npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts clean
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
