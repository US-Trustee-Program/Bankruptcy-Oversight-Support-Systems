/**
 * Phonetic Search Test Data Management Script
 *
 * This script:
 * 1. Connects to MongoDB using real connection strings from backend/.env
 * 2. Seeds 190 phonetic test cases with MOCK- prefix
 * 3. Verifies test data
 * 4. Provides cleanup functionality
 *
 * Test cases include:
 * - Jon/John phonetic matches
 * - Mike/Michael nickname matches
 * - Gail/Gayle phonetic variations (previously lost with Soundex)
 * - International names (Spanish, Eastern European, East Asian, Arabic)
 * - Edge cases (short names, stop words, numbers, etc.)
 *
 * Usage:
 *   # Seed test cases
 *   npx tsx backend/lib/testing/phonetic-search-data-management.ts seed
 *
 *   # Verify test cases
 *   npx tsx backend/lib/testing/phonetic-search-data-management.ts verify
 *
 *   # Cleanup test cases
 *   npx tsx backend/lib/testing/phonetic-search-data-management.ts cleanup
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { phoneticSearchTestCases } from '../../../test/bdd/fixtures/phonetic-search-cases';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Seed test cases into database
async function seedTestData(): Promise<void> {
  const mongoUrl = process.env.MONGO_CONNECTION_STRING!;
  const dbName = process.env.COSMOS_DATABASE_NAME || 'cams';

  console.log('========================================');
  console.log('SEEDING PHONETIC TEST DATA');
  console.log('========================================');
  console.log(`Database: ${dbName}`);
  console.log(`Total cases: ${phoneticSearchTestCases.length}`);
  console.log('');

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(dbName);
    const collection = db.collection('cases');

    // Check for existing test cases (caseNumber starts with "00-")
    const existingCount = await collection.countDocuments({
      caseNumber: { $regex: /^00-/ },
    });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing test cases (caseNumber starts with "00-")`);
      console.log(
        '   Run cleanup first: npx tsx backend/lib/testing/phonetic-search-data-management.ts cleanup\n',
      );
      process.exit(1);
    }

    // Insert test cases
    console.log(`📥 Inserting ${phoneticSearchTestCases.length} test cases...`);
    await collection.insertMany(phoneticSearchTestCases);

    console.log(`\n✅ Successfully seeded ${phoneticSearchTestCases.length} cases!`);
    console.log('\n📋 Test case categories:');
    console.log('   - Jon/John phonetic matches');
    console.log('   - Mike/Michael nickname matches');
    console.log('   - Gail/Gayle, Cathy/Kathy phonetic variations');
    console.log('   - Spanish/Latino names (José, María, García)');
    console.log('   - Eastern European names (Kowalski, Ivanova)');
    console.log('   - East Asian names (Li Wei, Kim Min-jun)');
    console.log('   - Arabic names (Mohammed, Hassan)');
    console.log('   - Edge cases (short names, stop words, numbers)');
    console.log('\n🧪 Test through your UI now!');
    console.log(
      '🧹 Cleanup: npx tsx backend/lib/testing/phonetic-search-data-management.ts cleanup\n',
    );
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Verify test data exists and has correct structure
async function verifyTestData(): Promise<boolean> {
  const mongoUrl = process.env.MONGO_CONNECTION_STRING!;
  const dbName = process.env.COSMOS_DATABASE_NAME || 'cams';

  console.log('========================================');
  console.log('VERIFYING PHONETIC TEST DATA');
  console.log('========================================');

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('cases');

    // Count test cases (caseNumber starts with "00-")
    const count = await collection.countDocuments({ caseNumber: { $regex: /^00-/ } });
    console.log(`Found ${count} test cases (caseNumber starts with "00-")`);

    if (count === 0) {
      console.log('⚠️  No test cases found. Run seed command first.\n');
      return false;
    }

    // Get a sample case to inspect
    const sample = await collection.findOne({ caseNumber: { $regex: /^00-/ } });

    if (!sample) {
      console.log('❌ No sample case found\n');
      return false;
    }

    console.log('\n📋 Sample case structure:');
    console.log(`   caseId: ${sample.caseId}`);
    console.log(`   caseNumber: ${sample.caseNumber}`);
    console.log(`   debtorName: ${sample.debtor?.name}`);
    console.log(`   documentType: ${sample.documentType}`);
    console.log(
      `   phoneticTokens: ${JSON.stringify(sample.debtor?.phoneticTokens?.slice(0, 5))}...`,
    );
    console.log(`   chapter: ${sample.chapter}`);
    console.log(`   updatedBy: ${sample.updatedBy?.name}`);

    // Verify required fields
    const hasRequiredFields =
      sample.caseNumber &&
      sample.debtor?.name &&
      sample.debtor?.phoneticTokens &&
      sample.documentType === 'SYNCED_CASE' &&
      sample.updatedBy;

    if (!hasRequiredFields) {
      console.log('\n❌ Sample case is missing required fields\n');
      return false;
    }

    // Check phonetic tokens format
    const hasPhonetics = sample.debtor.phoneticTokens.some((t: string) => /^[A-Z0-9]+$/.test(t));
    const hasBigrams = sample.debtor.phoneticTokens.some((t: string) => /^[a-z]{2}$/.test(t));

    console.log(`\n✓ Has phonetic codes (Soundex/Metaphone): ${hasPhonetics}`);
    console.log(`✓ Has bigrams: ${hasBigrams}`);

    if (!hasPhonetics || !hasBigrams) {
      console.log('\n❌ phoneticTokens missing bigrams or phonetic codes\n');
      return false;
    }

    console.log(`\n✅ All ${count} test cases verified successfully!\n`);
    return true;
  } catch (error) {
    console.error('❌ Error verifying test data:', error);
    return false;
  } finally {
    await client.close();
  }
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  const mongoUrl = process.env.MONGO_CONNECTION_STRING!;
  const dbName = process.env.COSMOS_DATABASE_NAME || 'cams';

  console.log('========================================');
  console.log('CLEANING UP PHONETIC TEST DATA');
  console.log('========================================');

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('cases');

    // Count test cases (caseNumber starts with "00-")
    const count = await collection.countDocuments({ caseNumber: { $regex: /^00-/ } });

    if (count === 0) {
      console.log('✨ No test cases found (caseNumber starts with "00-"). Nothing to clean up!\n');
      process.exit(0);
    }

    // Show sample of what will be deleted
    const samples = await collection
      .find({ caseNumber: { $regex: /^00-/ } })
      .limit(5)
      .toArray();

    console.log(`⚠️  Found ${count} test cases to delete (caseNumber starts with "00-")\n`);
    console.log('📋 Sample cases:');
    samples.forEach((c) => {
      console.log(`   - ${c.caseId}: ${c.debtor?.name || c.caseTitle}`);
    });
    if (count > 5) {
      console.log(`   ... and ${count - 5} more`);
    }

    console.log('\n🗑️  Deleting...');

    // Delete all test cases (caseNumber starts with "00-")
    const result = await collection.deleteMany({ caseNumber: { $regex: /^00-/ } });

    console.log(`\n✅ Deleted ${result.deletedCount} test cases`);
    console.log('✨ Database is clean!\n');
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Main entry point
async function main() {
  const command = process.argv[2];

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Phonetic Search Test Data Management                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (command === 'seed') {
    await seedTestData();
  } else if (command === 'verify') {
    const success = await verifyTestData();
    process.exit(success ? 0 : 1);
  } else if (command === 'cleanup') {
    await cleanupTestData();
  } else {
    console.log('Usage:');
    console.log('  npx tsx backend/lib/testing/phonetic-search-data-management.ts <command>');
    console.log('');
    console.log('Commands:');
    console.log('  seed    - Insert phonetic test cases into database');
    console.log('  verify  - Verify test cases exist and have correct structure');
    console.log('  cleanup - Remove all MOCK- test cases from database');
    console.log('');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
