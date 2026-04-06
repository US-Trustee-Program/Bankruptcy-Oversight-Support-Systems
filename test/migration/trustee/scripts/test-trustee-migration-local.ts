/**
 * Local testing script for trustee migration
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/test-trustee-migration-local.ts [command]
 *
 * This script allows you to test the trustee migration locally without
 * running the full Azure Functions runtime.
 */

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import * as MigrateTrusteesUseCase from '../../../../backend/lib/use-cases/dataflows/migrate-trustees';
import {
  getOrCreateMigrationState,
  updateMigrationState,
  completeMigration,
  TrusteeMigrationState,
} from '../../../../backend/lib/use-cases/dataflows/trustee-migration-state.service';
import { ApplicationConfiguration } from '../../../../backend/lib/configs/application-configuration';
import factory from '../../../../backend/lib/factory';

// Load environment variables
dotenv.config({ path: 'backend/.env' });

async function testConnection() {
  console.log('Testing ATS database connection...');

  const appConfig = new ApplicationConfiguration();
  const atsConfig = appConfig.atsDbConfig;

  if (!atsConfig) {
    console.error('❌ ATS database configuration not found. Check your .env file.');
    console.log('Required environment variables:');
    console.log('  - ATS_MSSQL_HOST');
    console.log('  - ATS_MSSQL_DATABASE');
    console.log('  - ATS_MSSQL_USER');
    console.log('  - ATS_MSSQL_PASS');
    return false;
  }

  console.log('ATS Connection Config:');
  console.log(`  Server: ${atsConfig.server}`);
  console.log(`  Database: ${atsConfig.database}`);
  console.log(`  User: ${atsConfig.user ? atsConfig.user : 'Using Azure AD auth'}`);

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  const gateway = factory.getAtsGateway(context);

  try {
    const isConnected = await gateway.testConnection(context);
    if (isConnected) {
      console.log('✅ Successfully connected to ATS database');

      // Get total count
      const count = await gateway.getTrusteeCount(context);
      console.log(`📊 Total trustees in ATS: ${count}`);

      return true;
    } else {
      console.error('❌ Failed to connect to ATS database');
      return false;
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return false;
  }
}

async function previewMigration(limit = 5) {
  console.log(`\n🔍 Previewing first ${limit} trustees...`);

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  const gateway = factory.getAtsGateway(context);

  try {
    // Get first page of trustees
    const trustees = await gateway.getTrusteesPage(context, null, limit);

    console.log(`\nFound ${trustees.length} trustees:`);
    for (const trustee of trustees) {
      console.log(`\n  Trustee ID: ${trustee.ID}`);
      console.log(`    Name: ${trustee.FIRST_NAME} ${trustee.LAST_NAME}`);
      console.log(`    Company: ${trustee.COMPANY || 'N/A'}`);
      console.log(`    Email: ${trustee.EMAIL_ADDRESS || 'N/A'}`);
      console.log(`    Phone: ${trustee.TELEPHONE || 'N/A'}`);
      console.log(
        `    Address: ${trustee.STREET || ''}, ${trustee.CITY || ''}, ${trustee.STATE || ''} ${trustee.ZIP || ''}`,
      );

      // Get appointments for this trustee
      const appointments = await gateway.getTrusteeAppointments(context, trustee.ID);
      console.log(`    Appointments: ${appointments.length}`);

      if (appointments.length > 0) {
        const firstAppt = appointments[0];
        console.log(
          `      First appointment: District ${firstAppt.DISTRICT}, Chapter ${firstAppt.CHAPTER}`,
        );
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Preview error:', error);
    return false;
  }
}

async function checkMigrationState() {
  console.log('\n📋 Checking migration state...');

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  const stateResult = await getOrCreateMigrationState(context);

  if (stateResult.error) {
    console.error('❌ Error getting migration state:', stateResult.error.message);
    return;
  }

  const state = stateResult.data;
  if (!state) {
    console.log('No migration state found. Migration has not been started.');
    return;
  }

  console.log('\nMigration State:');
  console.log(`  Status: ${state.status}`);
  console.log(`  Started: ${state.startedAt}`);
  console.log(`  Last Updated: ${state.lastUpdatedAt}`);
  console.log(`  Processed: ${state.processedCount} trustees`);
  console.log(`  Appointments: ${state.appointmentsProcessedCount}`);
  console.log(`  Errors: ${state.errors}`);
  if (state.lastTrusteeId) {
    console.log(`  Last Trustee ID: ${state.lastTrusteeId}`);
  }
}

async function runMigrationBatch(pageSize = 10) {
  console.log(`\n🚀 Running migration batch (size: ${pageSize})...`);

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  // Get or create state
  const stateResult = await getOrCreateMigrationState(context);
  if (stateResult.error) {
    console.error('❌ Error getting migration state:', stateResult.error.message);
    return;
  }

  const state = stateResult.data!;

  if (state.status === 'COMPLETED') {
    console.log('✅ Migration already completed!');
    return;
  }

  const lastTrusteeId = state.lastTrusteeId;
  console.log(`Starting from trustee ID: ${lastTrusteeId ?? 'beginning'}`);

  // Get next page
  const pageResult = await MigrateTrusteesUseCase.getPageOfTrustees(
    context,
    lastTrusteeId,
    pageSize,
  );

  if (pageResult.error) {
    console.error('❌ Error getting page:', pageResult.error.message);
    return;
  }

  const { trustees, hasMore } = pageResult.data!;

  if (trustees.length === 0) {
    console.log('No more trustees to migrate!');
    await completeMigration(context, state);
    return;
  }

  console.log(`Processing ${trustees.length} trustees...`);

  // Process the batch
  const processResult = await MigrateTrusteesUseCase.processPageOfTrustees(context, trustees);

  if (processResult.error) {
    console.error('❌ Error processing batch:', processResult.error.message);
    return;
  }

  const { processed, appointments, errors } = processResult.data!;

  console.log(`\n✅ Batch complete:`);
  console.log(`  Processed: ${processed} trustees`);
  console.log(`  Appointments: ${appointments}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Has more: ${hasMore ? 'Yes' : 'No'}`);

  // Update state
  const newState = {
    ...state,
    lastTrusteeId: trustees[trustees.length - 1].ID,
    processedCount: (state.processedCount ?? 0) + processed,
    appointmentsProcessedCount: (state.appointmentsProcessedCount ?? 0) + appointments,
    errors: (state.errors ?? 0) + errors,
    status: hasMore ? ('IN_PROGRESS' as const) : ('COMPLETED' as const),
  };

  await updateMigrationState(context, newState);

  if (!hasMore) {
    console.log('\n🎉 Migration complete!');
  } else {
    console.log('\n➡️  Run again to process next batch');
  }
}

async function resetMigration() {
  console.log('\n🔄 Resetting migration state...');

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  const repo = factory.getRuntimeStateRepository(context);

  // Reset the migration state by upserting a fresh state
  const freshState: TrusteeMigrationState = {
    documentType: 'TRUSTEE_MIGRATION_STATE',
    lastTrusteeId: null,
    processedCount: 0,
    appointmentsProcessedCount: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    divisionMappingVersion: '1.0',
  };

  await repo.upsert(freshState);

  console.log('✅ Migration state reset. Next run will start from beginning.');
}

async function cleanAppointments() {
  console.log('\n🧹 Cleaning migrated appointment data...');

  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !dbName) {
    console.error('❌ MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set in .env');
    return;
  }

  console.log(`  Database: ${dbName}`);

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(dbName);

    // Delete all trustee appointments
    const appointmentsResult = await db
      .collection('trustee-appointments')
      .deleteMany({});
    console.log(`  Deleted ${appointmentsResult.deletedCount} appointments`);

    // Reset migration state
    const invocationContext = new InvocationContext();
    const context = await ApplicationContextCreator.getApplicationContext({
      invocationContext,
      logger: ApplicationContextCreator.getLogger(invocationContext),
    });
    const repo = factory.getRuntimeStateRepository(context);

    const freshState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: null,
      processedCount: 0,
      appointmentsProcessedCount: 0,
      errors: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      divisionMappingVersion: '1.0',
    };

    await repo.upsert(freshState);

    console.log('  Migration state reset');
    console.log('✅ Clean complete. Run migration again to re-create appointments.');
  } finally {
    await client.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('='.repeat(60));
  console.log('🏛️  CAMS Trustee Migration Test Tool');
  console.log('='.repeat(60));

  switch (command) {
    case 'test':
      await testConnection();
      break;

    case 'preview':
      if (await testConnection()) {
        const limit = parseInt(args[1]) || 5;
        await previewMigration(limit);
      }
      break;

    case 'state':
      await checkMigrationState();
      break;

    case 'run': {
      const pageSize = parseInt(args[1]) || 10;
      await runMigrationBatch(pageSize);
      break;
    }

    case 'reset':
      await resetMigration();
      break;

    case 'clean':
      await cleanAppointments();
      break;

    case 'help':
    default:
      console.log('\nUsage: npx tsx scripts/test-trustee-migration-local.ts [command] [options]');
      console.log('\nCommands:');
      console.log('  test                Test ATS database connection');
      console.log('  preview [n]         Preview first n trustees (default: 5)');
      console.log('  state               Check migration state');
      console.log('  run [size]          Run migration batch (default size: 10)');
      console.log('  reset               Reset migration state only');
      console.log('  clean               Delete all appointments and reset state');
      console.log('  help                Show this help message');
      console.log('\nExamples:');
      console.log('  npx tsx scripts/test-trustee-migration-local.ts test');
      console.log('  npx tsx scripts/test-trustee-migration-local.ts preview 10');
      console.log('  npx tsx scripts/test-trustee-migration-local.ts run 50');
      console.log('  npx tsx scripts/test-trustee-migration-local.ts clean');
      break;
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
