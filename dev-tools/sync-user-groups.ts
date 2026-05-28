#!/usr/bin/env tsx
/**
 * Sync user-groups from cosmos-mongo-ustp-cams (main) to cosmos-mongo-ustp-cams-dev
 *
 * This script:
 * 1. Reads user-groups from production (main)
 * 2. Removes all user-groups from dev
 * 3. Copies production user-groups to dev
 *
 * WHEN TO USE:
 * - Before seeding oversight-assignments scenario (requires real Okta user-groups)
 * - After production user-groups change (to update dev with latest users)
 * - When resetting dev database to match production user-groups
 *
 * USAGE:
 *   npx tsx sync-user-groups.ts
 *
 * REQUIRES:
 * - .env-dev-main (production connection string)
 * - .env-dev-local (dev connection string)
 * - Your IP must be whitelisted in Azure Cosmos firewall
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env-dev-main for production connection
config({ path: resolve(__dirname, '.env-dev-main') });
const PROD_URI = process.env.MONGO_CONNECTION_STRING;

// Load .env-dev-local for dev connection
config({ path: resolve(__dirname, '.env-dev-local'), override: true });
const DEV_URI = process.env.MONGO_CONNECTION_STRING;

if (!PROD_URI) {
  console.error('❌ MONGO_CONNECTION_STRING not found in .env-dev-main');
  process.exit(1);
}

if (!DEV_URI) {
  console.error('❌ MONGO_CONNECTION_STRING not found in .env-dev-local');
  process.exit(1);
}

async function syncUserGroups() {
  console.log('🔄 Syncing user-groups from production to dev...\n');

  const prodClient = new MongoClient(PROD_URI as string);
  const devClient = new MongoClient(DEV_URI as string);

  try {
    await prodClient.connect();
    await devClient.connect();
    console.log('✅ Connected to both databases\n');

    const prodDb = prodClient.db('cams');
    const devDb = devClient.db('cams');

    // Step 1: Read production user-groups
    console.log('📖 Reading production user-groups...');
    const prodGroups = await prodDb.collection('user-groups').find({}).toArray();
    console.log(`   Found ${prodGroups.length} user-groups in production:`);
    prodGroups.forEach((g) => {
      console.log(`   - ${g.id}: ${g.groupName} (${g.users?.length || 0} members)`);
    });
    console.log();

    // Step 2: Show what's currently in dev
    console.log('📖 Current dev user-groups...');
    const devGroups = await devDb.collection('user-groups').find({}).toArray();
    console.log(`   Found ${devGroups.length} user-groups in dev:`);
    devGroups.forEach((g) => {
      console.log(`   - ${g.id}: ${g.groupName} (${g.users?.length || 0} members)`);
    });
    console.log();

    // Step 3: Safety checks before destructive delete
    const devDbName = devDb.databaseName;
    if (!/dev/i.test(devDbName)) {
      console.error(
        `❌ Refusing to delete: database "${devDbName}" does not look like a dev database.`,
      );
      process.exit(1);
    }

    // Step 4: Remove all from dev
    console.log('🗑️  Removing all user-groups from dev...');
    const deleteResult = await devDb.collection('user-groups').deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} documents\n`);

    // Step 5: Copy production to dev
    if (prodGroups.length > 0) {
      console.log('📝 Copying production user-groups to dev...');
      const insertResult = await devDb.collection('user-groups').insertMany(prodGroups);
      console.log(`   Inserted ${insertResult.insertedCount} documents\n`);
    }

    // Step 6: Verify
    console.log('✅ Verification...');
    const newDevGroups = await devDb.collection('user-groups').find({}).toArray();
    console.log(`   Dev now has ${newDevGroups.length} user-groups:`);
    newDevGroups.forEach((g) => {
      console.log(`   - ${g.id}: ${g.groupName} (${g.users?.length || 0} members)`);
    });

    console.log('\n✅ Sync complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prodClient.close();
    await devClient.close();
  }
}

syncUserGroups().catch(console.error);
