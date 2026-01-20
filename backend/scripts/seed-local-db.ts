/**
 * Seed Local MongoDB Database
 *
 * This script populates the local MongoDB database with test data
 * by reusing the existing E2E data loading infrastructure.
 *
 * Usage: npm run seed:local
 *
 * Prerequisites:
 * - MongoDB running on localhost:27017 (use `npm run docker:up`)
 * - .env file with MONGO_CONNECTION_STRING pointing to localhost
 * - DXTR database connection configured in .env (for syncing cases)
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ContextCreator from '../function-apps/azure/application-context-creator';
import DataGenerationUtils from '../function-apps/dataflows/e2e/data-generation-utils';
import { clearAllCollections } from '../function-apps/dataflows/e2e/db-utils';

// Load environment variables
dotenv.config();

async function seedDatabase() {
  console.log('=====================================');
  console.log('CAMS Local Database Seeding Script');
  console.log('=====================================\n');

  // Check MongoDB connection string
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;

  if (!connectionString) {
    console.error('❌ MONGO_CONNECTION_STRING not found in environment variables');
    console.error('   Please ensure backend/.env is configured');
    process.exit(1);
  }

  if (!databaseName) {
    console.error('❌ COSMOS_DATABASE_NAME not found in environment variables');
    process.exit(1);
  }

  // Verify this is a local database
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  if (!isLocal) {
    console.error('❌ This script can only be run against a local MongoDB database');
    console.error(`   Current connection: ${connectionString.substring(0, 30)}...`);
    console.error('   Please update MONGO_CONNECTION_STRING in backend/.env to point to localhost');
    process.exit(1);
  }

  console.log('✓ MongoDB Connection: localhost');
  console.log(`✓ Database: ${databaseName}\n`);

  try {
    // Create application context
    console.log('Creating application context...');
    const invocationContext = new InvocationContext();
    const context = await ContextCreator.getApplicationContext({ invocationContext });
    console.log('✓ Application context created\n');

    // Clear existing data
    console.log('Clearing existing data...');
    await clearAllCollections(context);
    console.log('✓ All collections cleared\n');

    // Load seed data
    console.log('Loading seed data...');
    console.log('(This may take a few minutes as it syncs data from DXTR)\n');
    await DataGenerationUtils.seedCosmosE2eDatabase(context);
    console.log('\n✓ Seed data loaded successfully\n');

    console.log('=====================================');
    console.log('✓ Database seeding completed!');
    console.log('=====================================\n');
    console.log('You can now start the backend with: npm run start:backend\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database seeding failed:');
    console.error(error);
    console.error('\nCommon issues:');
    console.error('- MongoDB not running (run: npm run docker:up)');
    console.error('- DXTR database connection not configured in .env');
    console.error('- Invalid connection string format');
    process.exit(1);
  }
}

// Run the seed script
seedDatabase();
