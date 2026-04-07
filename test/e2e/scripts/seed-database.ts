#!/usr/bin/env tsx

/**
 * MongoDB Seeding Script for E2E Tests
 *
 * Reads fixtures/mongo-fixture.json (synthesized from dev data, no PII),
 * generates Faker replacements for all nulled PII fields, connects directly
 * to MongoDB, clears all collections, and replays documents.
 *
 * Self-contained — requires no external database access after the fixture is created.
 *
 * Usage: tsx ./scripts/seed-database.ts
 */

import { config } from 'dotenv';

config({ path: '.env', quiet: true });

import { MongoClient, ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODULE_NAME = 'SEED-MONGO-E2E';

const CONNECTION_STRING =
  process.env.COSMOS_CONNECTION_STRING ||
  process.env.MONGO_CONNECTION_STRING ||
  'mongodb://localhost:27017/cams-e2e?retrywrites=false';

const DB_NAME = process.env.COSMOS_DATABASE_NAME || 'cams-e2e';

const COLLECTIONS = [
  'assignments',
  'cases',
  'consolidations',
  'orders',
  'trustee-match-verification',
  'trustees',
  'user-groups',
];

type MongoDocument = Record<string, unknown>;

interface MongoFixture {
  synthesizedAt?: string;
  harvestedAt?: string;
  collections: Record<string, MongoDocument[]>;
}

// ── Faker generators ──────────────────────────────────────────────────────────

function fakeSsn(): string {
  return `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`;
}

function fakeTaxId(): string {
  return `${faker.string.numeric(2)}-${faker.string.numeric(7)}`;
}

function fakeCityStateZip(): string {
  return `${faker.location.city()}, ${faker.location.state({ abbreviated: true })} ${faker.location.zipCode('#####')}`;
}

function fakeCaseTitle(): string {
  return `In re ${faker.company.name()}`;
}

function fakeDebtor(): Record<string, unknown> {
  return {
    name: faker.person.lastName(),
    address1: faker.location.streetAddress(),
    address2: faker.datatype.boolean() ? faker.location.secondaryAddress() : null,
    address3: null,
    cityStateZipCountry: fakeCityStateZip(),
    taxId: fakeTaxId(),
    ssn: fakeSsn(),
    additionalIdentifiers: null,
  };
}

function fakeAttorney(): Record<string, unknown> {
  return {
    name: faker.person.fullName(),
    address1: faker.location.streetAddress(),
    address2: faker.datatype.boolean() ? faker.location.secondaryAddress() : null,
    address3: null,
    cityStateZipCountry: fakeCityStateZip(),
    phone: faker.phone.number({ style: 'national' }),
    email: faker.internet.email(),
    office: faker.company.name(),
  };
}

// ── PII regeneration ──────────────────────────────────────────────────────────

function regenerateCasePii(doc: MongoDocument): MongoDocument {
  const out = { ...doc };
  if ('caseTitle' in out) out.caseTitle = fakeCaseTitle();
  if ('judgeName' in out) out.judgeName = faker.person.fullName();
  if (out.debtor !== undefined) out.debtor = fakeDebtor();
  if (out.jointDebtor !== undefined) out.jointDebtor = fakeDebtor();
  if ('debtorAttorney' in out)
    out.debtorAttorney = faker.datatype.boolean() ? fakeAttorney() : null;
  return out;
}

function regenerateOrderPii(doc: MongoDocument): MongoDocument {
  const out = { ...doc };
  if ('caseTitle' in out) out.caseTitle = fakeCaseTitle();
  if (out.debtor !== undefined) out.debtor = fakeDebtor();
  if (out.jointDebtor !== undefined) out.jointDebtor = fakeDebtor();
  if ('debtorAttorney' in out)
    out.debtorAttorney = faker.datatype.boolean() ? fakeAttorney() : null;
  if (out.newCase && typeof out.newCase === 'object') {
    const nc = { ...(out.newCase as MongoDocument) };
    if ('caseTitle' in nc) nc.caseTitle = fakeCaseTitle();
    if (nc.debtor !== undefined) nc.debtor = fakeDebtor();
    if (nc.jointDebtor !== undefined) nc.jointDebtor = fakeDebtor();
    if ('debtorAttorney' in nc)
      nc.debtorAttorney = faker.datatype.boolean() ? fakeAttorney() : null;
    out.newCase = nc;
  }
  return out;
}

function regenerateConsolidationPii(doc: MongoDocument): MongoDocument {
  const out = { ...doc };
  if ('caseTitle' in out) out.caseTitle = fakeCaseTitle();
  if (out.debtor !== undefined) out.debtor = fakeDebtor();
  if (out.leadCase && typeof out.leadCase === 'object') {
    const lc = { ...(out.leadCase as MongoDocument) };
    if ('caseTitle' in lc) lc.caseTitle = fakeCaseTitle();
    if (lc.debtor !== undefined) lc.debtor = fakeDebtor();
    if ('debtorAttorney' in lc)
      lc.debtorAttorney = faker.datatype.boolean() ? fakeAttorney() : null;
    out.leadCase = lc;
  }
  const memberCasesKey = Array.isArray(out.memberCases) ? 'memberCases' : 'childCases';
  if (Array.isArray(out[memberCasesKey])) {
    out[memberCasesKey] = (out[memberCasesKey] as MongoDocument[]).map((cc) => {
      const c = { ...cc };
      if ('caseTitle' in c) c.caseTitle = fakeCaseTitle();
      if (c.debtor !== undefined) c.debtor = fakeDebtor();
      if ('debtorAttorney' in c)
        c.debtorAttorney = faker.datatype.boolean() ? fakeAttorney() : null;
      return c;
    });
  }
  return out;
}

function regenerateTrusteePii(doc: MongoDocument): MongoDocument {
  const out = { ...doc };
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  out.name = `${lastName}, ${firstName}`;
  if (out.professional && typeof out.professional === 'object') {
    out.professional = {
      ...(out.professional as MongoDocument),
      firstName,
      lastName,
      office: faker.company.name(),
      phone: faker.phone.number({ style: 'national' }),
      email: faker.internet.email(),
    };
  }
  return out;
}

function applyFakerPii(collectionName: string, docs: MongoDocument[]): MongoDocument[] {
  switch (collectionName) {
    case 'cases':
      return docs.map(regenerateCasePii);
    case 'orders':
      return docs.map(regenerateOrderPii);
    case 'consolidations':
      return docs.map(regenerateConsolidationPii);
    case 'trustees':
      return docs.map(regenerateTrusteePii);
    default:
      return docs;
  }
}

// Restore MongoDB _id fields: fixture stores them as strings, MongoClient needs ObjectId
function restoreIds(docs: MongoDocument[]): MongoDocument[] {
  return docs.map((doc) => {
    const out = { ...doc };
    if (typeof out._id === 'string' && /^[0-9a-f]{24}$/.test(out._id)) {
      out._id = new ObjectId(out._id) as unknown as string;
    }
    return out;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const fixturePath = resolve(__dirname, '../fixtures/mongo-fixture.json');

  let fixture: MongoFixture;
  try {
    fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as MongoFixture;
  } catch {
    console.error(`[${MODULE_NAME}] ERROR: Cannot read fixture file at ${fixturePath}`);
    console.error(`[${MODULE_NAME}] Run synthesize-fixtures.ts first to generate the fixture.`);
    process.exit(1);
  }

  if (!DB_NAME.toLowerCase().includes('e2e')) {
    throw new Error(
      `Safety check failed: This script must target an e2e database. Current database: ${DB_NAME}`,
    );
  }

  const timestamp = fixture.synthesizedAt ?? fixture.harvestedAt ?? 'unknown';
  console.log(`[${MODULE_NAME}] Starting MongoDB seeding from fixture...`);
  console.log(`[${MODULE_NAME}] Fixture date: ${timestamp}`);
  console.log(`[${MODULE_NAME}] Target: ${DB_NAME}`);

  const client = await MongoClient.connect(CONNECTION_STRING);

  try {
    const db = client.db(DB_NAME);

    console.log(`[${MODULE_NAME}] Clearing collections...`);
    for (const collName of COLLECTIONS) {
      await db.collection(collName).deleteMany({});
    }
    console.log(`[${MODULE_NAME}] ✓ Collections cleared`);

    console.log(`[${MODULE_NAME}] Seeding collections...`);
    for (const collName of COLLECTIONS) {
      const rawDocs = fixture.collections[collName];
      if (!rawDocs || rawDocs.length === 0) {
        console.log(`  ${collName}... SKIP (not in fixture)`);
        continue;
      }

      process.stdout.write(`  ${collName}... `);
      const docsWithPii = applyFakerPii(collName, rawDocs);
      const docs = restoreIds(docsWithPii);
      await db.collection(collName).insertMany(docs);
      console.log(`${docs.length} documents`);
    }

    console.log(`\n[${MODULE_NAME}] ✓ MongoDB seeded successfully`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${MODULE_NAME}] ERROR:`, err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
