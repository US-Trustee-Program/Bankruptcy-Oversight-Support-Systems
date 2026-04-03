#!/usr/bin/env tsx

/**
 * MongoDB Harvest Script (ONE-TIME USE)
 *
 * Runs the full seedCosmosE2eDatabase() logic (requires live DXTR SQL credentials),
 * then reads all seeded collections back out of MongoDB, strips PII from case
 * documents, and writes a fixture file to fixtures/mongo-fixture.json.
 *
 * The harvest file (mongo-harvested.json) is a temporary intermediate file consumed
 * by synthesize-fixtures.ts to produce the committed mongo-fixture.json.
 * PII is replaced with Faker data at seed time — nothing sensitive is stored in the fixture.
 *
 * Usage:
 *   MSSQL_HOST=<host> \
 *   COSMOS_CONNECTION_STRING=<conn> \
 *   COSMOS_DATABASE_NAME=cams-e2e \
 *   tsx ./scripts/harvest-mongo.ts
 *
 * Or set the vars in .env before running.
 */

import { config } from 'dotenv';

config({ path: '.env', quiet: true });

import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../../backend/function-apps/azure/application-context-creator';
import { clearAllCollections } from '../../../backend/function-apps/dataflows/e2e/db-utils';
import DataGenerationUtils from '../../../backend/function-apps/dataflows/e2e/data-generation-utils';
import { MongoClient } from 'mongodb';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const MODULE_NAME = 'HARVEST-MONGO';

// Collections written by seedCosmosE2eDatabase
const COLLECTIONS = ['assignments', 'cases', 'consolidations', 'orders', 'trustees', 'user-groups'];

// PII fields to null out on CaseSummary / case documents
const CASE_PII_FIELDS = [
  'debtor.ssn',
  'debtor.taxId',
  'debtor.address1',
  'debtor.address2',
  'debtor.address3',
  'debtor.cityStateZipCountry',
  'debtor.additionalIdentifiers',
  'jointDebtor.ssn',
  'jointDebtor.taxId',
  'jointDebtor.address1',
  'jointDebtor.address2',
  'jointDebtor.address3',
  'jointDebtor.cityStateZipCountry',
  'jointDebtor.additionalIdentifiers',
  'debtorAttorney.phone',
  'debtorAttorney.email',
];

function setNestedNull(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  if (cur != null && typeof cur === 'object') {
    (cur as Record<string, unknown>)[parts[parts.length - 1]] = null;
  }
}

function stripCasePii(doc: Record<string, unknown>): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  for (const path of CASE_PII_FIELDS) {
    setNestedNull(clean, path);
  }
  return clean;
}

// Strip PII from embedded CaseSummary objects inside consolidations/orders
function stripEmbeddedCasePii(doc: Record<string, unknown>): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  // Consolidations embed CaseSummary on child cases
  if (Array.isArray(clean.childCases)) {
    clean.childCases = (clean.childCases as Record<string, unknown>[]).map((c) => {
      for (const path of CASE_PII_FIELDS) setNestedNull(c, path);
      return c;
    });
  }
  if (clean.leadCase && typeof clean.leadCase === 'object') {
    for (const path of CASE_PII_FIELDS)
      setNestedNull(clean.leadCase as Record<string, unknown>, path);
  }

  // Transfer orders embed newCase CaseSummary
  if (clean.newCase && typeof clean.newCase === 'object') {
    for (const path of CASE_PII_FIELDS)
      setNestedNull(clean.newCase as Record<string, unknown>, path);
  }

  // Top-level CaseSummary fields on orders/consolidations
  for (const path of CASE_PII_FIELDS) setNestedNull(clean, path);

  return clean;
}

type MongoDocument = Record<string, unknown>;

interface MongoFixture {
  harvestedAt: string;
  collections: Record<string, MongoDocument[]>;
}

async function dumpCollections(
  connectionString: string,
  dbName: string,
): Promise<Record<string, MongoDocument[]>> {
  const client = await MongoClient.connect(connectionString);
  const db = client.db(dbName);
  const result: Record<string, MongoDocument[]> = {};

  for (const collName of COLLECTIONS) {
    const docs = (await db.collection(collName).find({}).toArray()) as MongoDocument[];
    result[collName] = docs;
    console.log(`[${MODULE_NAME}]   ${collName}: ${docs.length} documents`);
  }

  await client.close();
  return result;
}

function sanitizeCollections(
  collections: Record<string, MongoDocument[]>,
): Record<string, MongoDocument[]> {
  const sanitized: Record<string, MongoDocument[]> = {};

  for (const [collName, docs] of Object.entries(collections)) {
    if (collName === 'cases') {
      sanitized[collName] = docs.map(stripCasePii);
    } else if (collName === 'consolidations' || collName === 'orders') {
      sanitized[collName] = docs.map(stripEmbeddedCasePii);
    } else {
      // trustees and user-groups are MockData — no PII
      sanitized[collName] = docs;
    }
  }

  return sanitized;
}

async function main() {
  // --dump-only: skip re-seeding, just dump whatever is already in the target MongoDB.
  // Useful when you have valid data already loaded and just need the fixture.
  // --dump-only: skip re-seeding, just dump whatever is already in the target MongoDB.
  // --source-db=<name>: read from a different database than the target (e.g. 'cams' when cams-e2e is empty).
  const dumpOnly = process.argv.includes('--dump-only');
  const sourceDbArg = process.argv.find((a) => a.startsWith('--source-db='));
  const sourceDbName = sourceDbArg ? sourceDbArg.split('=')[1] : null;

  console.log(
    `[${MODULE_NAME}] Starting one-time MongoDB harvest${dumpOnly ? ' (dump-only)' : ''}...`,
  );

  const invocationContext = {
    invocationId: 'harvest-mongo',
    log: console.log,
    error: console.error,
    warn: console.warn,
    trace: console.trace,
    debug: console.debug,
  } as unknown as InvocationContext;

  const context = await ContextCreator.getApplicationContext({ invocationContext });

  const dbName = context.config.documentDbConfig?.databaseName;
  if (!dbName?.toLowerCase().includes('e2e')) {
    throw new Error(
      `Safety check failed: This script must target an e2e database. Current database: ${dbName}`,
    );
  }

  const connectionString = context.config.documentDbConfig?.connectionString;
  console.log(`[${MODULE_NAME}] Target MongoDB database: ${dbName}`);

  if (!dumpOnly) {
    // Step 1: Clear and reseed MongoDB from DXTR
    console.log(`[${MODULE_NAME}] Clearing existing data...`);
    await clearAllCollections(context);

    console.log(`[${MODULE_NAME}] Seeding from DXTR SQL...`);
    await DataGenerationUtils.seedCosmosE2eDatabase(context);
    console.log(`[${MODULE_NAME}] ✓ MongoDB seeded`);
  } else {
    console.log(`[${MODULE_NAME}] Skipping re-seed — dumping existing data`);
  }

  // Step 2: Dump all collections (optionally from a different source database)
  const readDb = sourceDbName ?? dbName;
  if (sourceDbName) {
    console.log(`[${MODULE_NAME}] Reading from source database: ${sourceDbName}`);
  }
  console.log(`[${MODULE_NAME}] Reading collections...`);
  const collections = await dumpCollections(connectionString, readDb);

  // Step 3: Strip PII
  console.log(`[${MODULE_NAME}] Stripping PII from case documents...`);
  const sanitized = sanitizeCollections(collections);

  // Step 4: Write fixture
  const fixtureDir = resolve(__dirname, '../fixtures');
  mkdirSync(fixtureDir, { recursive: true });
  const fixturePath = resolve(fixtureDir, 'mongo-harvested.json');

  const fixture: MongoFixture = {
    harvestedAt: new Date().toISOString(),
    collections: sanitized,
  };

  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));

  const totalDocs = Object.values(sanitized).reduce((sum, docs) => sum + docs.length, 0);
  console.log(`\n[${MODULE_NAME}] ✓ Harvest written to fixtures/mongo-harvested.json`);
  console.log(`[${MODULE_NAME}]   Total documents: ${totalDocs}`);
  console.log(`[${MODULE_NAME}]   Collections: ${Object.keys(sanitized).join(', ')}`);

  process.exit(0);
}

main().catch((err: Error) => {
  console.error(`[${MODULE_NAME}] ERROR:`, err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
