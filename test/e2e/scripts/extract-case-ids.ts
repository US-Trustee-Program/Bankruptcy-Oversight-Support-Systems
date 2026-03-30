#!/usr/bin/env tsx

/**
 * Extract Case IDs from MongoDB E2E Database
 *
 * This script connects to the MongoDB E2E database and extracts all case IDs
 * that are currently seeded. These IDs will be used to harvest the corresponding
 * records from the Azure SQL dev database.
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env', quiet: true });

import { MongoClient } from 'mongodb';

const MODULE_NAME = 'EXTRACT-CASE-IDS';

async function main() {
  console.log(`[${MODULE_NAME}] Extracting case IDs from MongoDB...`);

  const connectionString =
    process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/cams-e2e?retrywrites=false';
  const dbName = process.env.COSMOS_DATABASE_NAME || 'cams-e2e';

  try {
    const client = await MongoClient.connect(connectionString);
    console.log(`[${MODULE_NAME}] Connected to MongoDB: ${dbName}`);

    const db = client.db(dbName);
    const casesCollection = db.collection('cases');

    // Get all unique case IDs
    const cases = await casesCollection.find({}, { projection: { caseId: 1, _id: 0 } }).toArray();
    const caseIds = cases.map((c) => c.caseId).sort();

    console.log(`[${MODULE_NAME}] Found ${caseIds.length} case IDs:`);
    console.log('');
    console.log('Case IDs (sorted):');
    console.log('==================');
    caseIds.forEach((id) => console.log(id));
    console.log('');

    // Also get the known good transfer case IDs from data-generation-utils
    console.log('Known Good Transfer Cases:');
    console.log('==================');
    console.log('KNOWN_GOOD_TRANSFER_FROM_CASE_ID: 081-65-67641');
    console.log('KNOWN_GOOD_TRANSFER_TO_CASE_ID: 091-69-12345');
    console.log('');

    // Output in formats useful for SQL queries
    console.log('SQL WHERE clause format:');
    console.log('==================');
    console.log(`caseId IN (${caseIds.map((id) => `'${id}'`).join(', ')})`);
    console.log('');

    // Parse case IDs into division, year, number for SQL table structure
    console.log('For ACMS table queries (DIV-YEAR-NUMBER):');
    console.log('==================');
    const parsedCases = caseIds.map((id) => {
      const [div, year, num] = id.split('-');
      return { caseId: id, div: parseInt(div), year: parseInt(year), num: parseInt(num) };
    });
    console.log(JSON.stringify(parsedCases, null, 2));

    await client.close();
    console.log(`[${MODULE_NAME}] Done!`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${MODULE_NAME}] ERROR:`, err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
