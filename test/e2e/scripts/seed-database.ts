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
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import {
  TRUSTEE_MATCH_FINDINGS_SCENARIOS,
  TrusteeMatchScenarioKey,
} from '../../../common/src/cams/test-utilities/trustee-match-findings.scenarios';
import {
  buildVariant,
  computeFingerprint,
} from '../../../backend/lib/use-cases/dataflows/trustee-variant.helpers';
import { generateSearchTokens } from '../../../backend/lib/adapters/utils/phonetic-helper';

const MODULE_NAME = 'SEED-MONGO-E2E';

const CONNECTION_STRING =
  process.env.COSMOS_CONNECTION_STRING ||
  process.env.MONGO_CONNECTION_STRING ||
  'mongodb://localhost:27017/cams-e2e?retrywrites=false';

const DB_NAME = process.env.COSMOS_DATABASE_NAME || 'cams-e2e';

const COLLECTIONS = [
  'assignments',
  'case-trustee-appointments',
  'cases',
  'consolidations',
  'orders',
  'trustee-appointments',
  'trustee-case-appointments',
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

/**
 * Identity tasks name a trustee-match fixture scenario (findingsScenario) instead of carrying
 * findings: the scenario's generated findings are the real pipeline's output. Fills findings and
 * every field that must agree with them, as the DXTR sync writes them, and removes the key.
 * Returns the scenarios' CAMS trustees too, since the candidates must exist in CAMS.
 */
function resolveFindingsScenarios(tasks: MongoDocument[]): {
  tasks: MongoDocument[];
  trustees: MongoDocument[];
  surrogates: MongoDocument[];
} {
  const trustees = new Map<string, MongoDocument>();
  const surrogates: MongoDocument[] = [];
  const resolved = tasks.map(({ findingsScenario, ...task }) => {
    if (!findingsScenario) return task;
    const key = findingsScenario as TrusteeMatchScenarioKey;
    const findings = MockData.getTrusteeMatchScenarioFindings(key);
    const variant = buildVariant(findings.sourceRaw);
    for (const trustee of TRUSTEE_MATCH_FINDINGS_SCENARIOS[key].trustees) {
      trustees.set(trustee.trusteeId, {
        ...trustee,
        documentType: 'TRUSTEE',
        phoneticTokens: generateSearchTokens(trustee.name),
      });
    }
    const fingerprint = computeFingerprint(variant);
    // The sync writes one surrogate case appointment per affected case while a task is pending;
    // the list and detail views count affected cases only from live surrogates. An approved task
    // reads its affectedCaseIds snapshot instead, which approval records before the remap.
    const caseId = task.caseId as string | undefined;
    if (caseId && task.status === 'pending') {
      surrogates.push({
        id: `e2e-surrogate-${task.id}`,
        documentType: 'CASE_APPOINTMENT',
        caseId,
        trusteeId: fingerprint,
        assignedOn: '2018-01-01T00:00:00.000Z',
        appointedDate: '2018-01-01',
        isSurrogate: true,
        chapter: '11',
        courtDivisionCode: '081',
        createdOn: task.createdOn,
        createdBy: task.createdBy,
        updatedOn: task.updatedOn,
        updatedBy: task.updatedBy,
      });
    }
    return {
      ...task,
      ...(caseId && task.status === 'approved' ? { affectedCaseIds: [caseId] } : {}),
      dxtrTrustee: findings.sourceRaw,
      findings,
      mismatchReason: findings.candidates.length > 1 ? 'ambiguous' : 'no match',
      variant,
      fingerprint,
    };
  });
  return { tasks: resolved, trustees: [...trustees.values()], surrogates };
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

/**
 * Mirrors the Cosmos-only unique index from cosmos-collections.bicep
 * (trusteeMatchVerificationCollection) on this plain MongoDB fixture DB, so
 * upsertVerification's duplicate-key protection (trustee-match-verification.
 * mongo.repository.ts) is actually exercised in e2e, not silently absent
 * (CAMS-953 cams-c45pn.12). createIndex is idempotent against an existing
 * identical index.
 */
async function ensureTrusteeMatchVerificationIndex(db: ReturnType<MongoClient['db']>) {
  await db
    .collection('trustee-match-verification')
    .createIndex({ fingerprint: 1, variant: 1, documentType: 1 }, { unique: true });
}

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

    await ensureTrusteeMatchVerificationIndex(db);

    const scenarios = resolveFindingsScenarios(
      fixture.collections['trustee-match-verification'] ?? [],
    );
    // Scenario trustees are fictional fixture data, so they skip the PII regeneration.
    const seededDocs = (collName: string): MongoDocument[] => {
      if (collName === 'trustee-match-verification') return scenarios.tasks;
      const docs = applyFakerPii(collName, fixture.collections[collName] ?? []);
      if (collName === 'trustees') return [...docs, ...scenarios.trustees];
      if (collName === 'trustee-case-appointments') return [...docs, ...scenarios.surrogates];
      return docs;
    };

    console.log(`[${MODULE_NAME}] Seeding collections...`);
    for (const collName of COLLECTIONS) {
      const rawDocs = seededDocs(collName);
      if (!rawDocs || rawDocs.length === 0) {
        console.log(`  ${collName}... SKIP (not in fixture)`);
        continue;
      }

      process.stdout.write(`  ${collName}... `);
      const docs = restoreIds(rawDocs);
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
