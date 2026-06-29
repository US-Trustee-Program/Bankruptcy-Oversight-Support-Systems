/**
 * Integration test suite for the CAMS QueryBuilder library and MongoDB renderers.
 *
 * Proves that query constructs and renderers work correctly against a real
 * MongoDB instance — no mocks. Covers the full QueryBuilder API:
 *
 *   Conditions:  EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_THAN_OR_EQUAL,
 *                LESS_THAN, LESS_THAN_OR_EQUAL, CONTAINS, NOT_CONTAINS,
 *                EXISTS, REGEX
 *   Conjunctions: AND, OR, NOT (including nested)
 *   SortSpec:    orderBy — ASCENDING, DESCENDING, multi-field
 *   Limit:       bounded result sets
 *   Projection:  pick(), omit()
 *
 * Three collections with real CAMS domain-shaped fixtures:
 *   test-cases     — CaseBasics-shaped, exercises string/date/chapter conditions
 *   test-trustees  — Trustee-shaped, exercises name/status/optional-field conditions
 *   test-orders    — ConsolidationOrder-shaped, exercises numeric/enum conditions
 *
 * Usage (from test/integration/):
 *   npm run query-builder -- [command]
 *
 * Local workflow:
 *   1. cd query-builder/scripts && ./start-services.sh
 *   2. Copy .env.local.template to .env.local
 *   3. npm run query-builder -- seed
 *   4. npm run query-builder -- run
 *   5. npm run query-builder -- clean
 *   6. cd query-builder/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Insert fixture documents into MongoDB
 *   run     Run all query builder assertions
 *   clean   Remove all fixture documents
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Collection, MongoClient } from 'mongodb';
import QueryBuilder from '../../../../backend/lib/query/query-builder';
import {
  toMongoProjection,
  toMongoQuery,
  toMongoSort,
} from '../../../../backend/lib/adapters/gateways/mongo/utils/mongo-query-renderer';

const HARNESS_DIR = path.resolve(__dirname, '../');

const CASES_COLLECTION = 'test-cases';
const TRUSTEES_COLLECTION = 'test-trustees';
const ORDERS_COLLECTION = 'test-orders';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(`Missing ${localEnvPath} — copy .env.local.template to .env.local first`);
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

loadEnv();

// ---------------------------------------------------------------------------
// MongoDB helpers
// ---------------------------------------------------------------------------

async function getDb(): Promise<{ client: MongoClient; collections: Record<string, Collection> }> {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  return {
    client,
    collections: {
      cases: db.collection(CASES_COLLECTION),
      trustees: db.collection(TRUSTEES_COLLECTION),
      orders: db.collection(ORDERS_COLLECTION),
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture types — shaped after real CAMS domain models
// ---------------------------------------------------------------------------

type TestCase = {
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  courtName: string;
  courtDivisionCode: string;
  regionId: string;
  petitionCode?: string;
};

type TestTrustee = {
  trusteeId: string;
  name: string;
  firstName: string;
  lastName: string;
  status?: string;
  softwareId?: string;
  phoneticTokens?: string[];
};

type TestOrder = {
  consolidationId: string;
  taskType: 'consolidation';
  orderDate: string;
  status: 'pending' | 'approved' | 'rejected';
  courtName: string;
  courtDivisionCode: string;
  jobId: number;
  leadCaseIdHint?: string;
  reason?: string;
};

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const CASE_FIXTURES: TestCase[] = [
  {
    caseId: '091-24-10001',
    chapter: '7',
    caseTitle: 'Smith Industries LLC',
    dateFiled: '2024-01-15',
    courtName: 'Southern District of New York',
    courtDivisionCode: 'SDNY',
    regionId: '02',
    petitionCode: 'VL',
  },
  {
    caseId: '091-24-10002',
    chapter: '11',
    caseTitle: 'Pacific Rim Holdings Corp',
    dateFiled: '2024-03-20',
    courtName: 'Northern District of California',
    courtDivisionCode: 'NDCA',
    regionId: '09',
    petitionCode: 'VL',
  },
  {
    caseId: '091-24-10003',
    chapter: '13',
    caseTitle: 'Johnson Family Trust',
    dateFiled: '2024-06-01',
    courtName: 'Eastern District of Texas',
    courtDivisionCode: 'EDTX',
    regionId: '05',
    // petitionCode intentionally absent — used for EXISTS tests
  },
  {
    caseId: '091-24-10004',
    chapter: '7',
    caseTitle: 'Metro Transit Authority',
    dateFiled: '2024-09-10',
    courtName: 'District of New Jersey',
    courtDivisionCode: 'DNJ',
    regionId: '03',
    petitionCode: 'IN',
  },
  {
    caseId: '091-25-10005',
    chapter: '11',
    caseTitle: 'Western Energy Partners',
    dateFiled: '2025-02-28',
    courtName: 'Central District of California',
    courtDivisionCode: 'CDCA',
    regionId: '09',
    petitionCode: 'VL',
  },
];

const TRUSTEE_FIXTURES: TestTrustee[] = [
  {
    trusteeId: 'trustee-001',
    name: 'Adams, Alice',
    firstName: 'Alice',
    lastName: 'Adams',
    status: 'active',
    softwareId: 'SW-001',
    phoneticTokens: ['ALS', 'ATMS'],
  },
  {
    trusteeId: 'trustee-002',
    name: 'Barnes, Robert',
    firstName: 'Robert',
    lastName: 'Barnes',
    status: 'active',
    softwareId: 'SW-002',
  },
  {
    trusteeId: 'trustee-003',
    name: 'Chen, David',
    firstName: 'David',
    lastName: 'Chen',
    status: 'inactive',
    // softwareId intentionally absent — used for EXISTS tests
  },
  {
    trusteeId: 'trustee-004',
    name: 'Davis, Margaret',
    firstName: 'Margaret',
    lastName: 'Davis',
    status: 'active',
    softwareId: 'SW-004',
    phoneticTokens: ['MRKRT', 'TFS'],
  },
  {
    trusteeId: 'trustee-005',
    name: 'Evans, Patricia',
    firstName: 'Patricia',
    lastName: 'Evans',
    status: 'resigned',
    // softwareId absent
  },
];

const ORDER_FIXTURES: TestOrder[] = [
  {
    consolidationId: 'order-001',
    taskType: 'consolidation',
    orderDate: '2024-01-15',
    status: 'pending',
    courtName: 'Southern District of New York',
    courtDivisionCode: 'SDNY',
    jobId: 100,
    leadCaseIdHint: '091-24-10001',
  },
  {
    consolidationId: 'order-002',
    taskType: 'consolidation',
    orderDate: '2024-03-20',
    status: 'approved',
    courtName: 'Northern District of California',
    courtDivisionCode: 'NDCA',
    jobId: 200,
    leadCaseIdHint: '091-24-10002',
  },
  {
    consolidationId: 'order-003',
    taskType: 'consolidation',
    orderDate: '2024-06-01',
    status: 'approved',
    courtName: 'Eastern District of Texas',
    courtDivisionCode: 'EDTX',
    jobId: 300,
    // leadCaseIdHint intentionally absent — used for EXISTS tests
  },
  {
    consolidationId: 'order-004',
    taskType: 'consolidation',
    orderDate: '2024-09-10',
    status: 'rejected',
    courtName: 'District of New Jersey',
    courtDivisionCode: 'DNJ',
    jobId: 400,
    reason: 'Insufficient documentation',
  },
  {
    consolidationId: 'order-005',
    taskType: 'consolidation',
    orderDate: '2025-02-28',
    status: 'pending',
    courtName: 'Central District of California',
    courtDivisionCode: 'CDCA',
    jobId: 500,
    leadCaseIdHint: '091-25-10005',
  },
];

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
  passed++;
}

function fail(msg: string) {
  console.error(`  ✗ FAIL: ${msg}`);
  failed++;
  process.exitCode = 1;
}

function assertIds(
  label: string,
  actual: { [key: string]: unknown }[],
  idField: string,
  expectedIds: string[],
) {
  const actualIds = actual.map((d) => d[idField] as string).sort();
  const sortedExpected = [...expectedIds].sort();
  if (JSON.stringify(actualIds) === JSON.stringify(sortedExpected)) {
    pass(`${label} — ids: [${actualIds.join(', ')}]`);
  } else {
    fail(`${label} — expected [${sortedExpected.join(', ')}], got [${actualIds.join(', ')}]`);
  }
}

function assertOrder(
  label: string,
  actual: { [key: string]: unknown }[],
  idField: string,
  expectedIds: string[],
) {
  const actualIds = actual.map((d) => d[idField] as string);
  if (JSON.stringify(actualIds) === JSON.stringify(expectedIds)) {
    pass(`${label} — order: [${actualIds.join(', ')}]`);
  } else {
    fail(`${label} — expected order [${expectedIds.join(', ')}], got [${actualIds.join(', ')}]`);
  }
}

function assertCount(label: string, actual: number, expected: number) {
  if (actual === expected) {
    pass(`${label} — count: ${actual}`);
  } else {
    fail(`${label} — expected count ${expected}, got ${actual}`);
  }
}

function assertFieldPresent(label: string, doc: Record<string, unknown>, field: string) {
  if (field in doc) {
    pass(`${label} — "${field}" present`);
  } else {
    fail(`${label} — "${field}" missing`);
  }
}

function assertFieldAbsent(label: string, doc: Record<string, unknown>, field: string) {
  if (!(field in doc)) {
    pass(`${label} — "${field}" absent`);
  } else {
    fail(`${label} — "${field}" should be absent`);
  }
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding integration test fixtures...\n');
  const { client, collections } = await getDb();
  try {
    await collections.cases.deleteMany({});
    await collections.trustees.deleteMany({});
    await collections.orders.deleteMany({});

    await collections.cases.insertMany(CASE_FIXTURES as unknown as Record<string, unknown>[]);
    pass(`Inserted ${CASE_FIXTURES.length} cases into "${CASES_COLLECTION}"`);

    await collections.trustees.insertMany(TRUSTEE_FIXTURES as unknown as Record<string, unknown>[]);
    pass(`Inserted ${TRUSTEE_FIXTURES.length} trustees into "${TRUSTEES_COLLECTION}"`);

    await collections.orders.insertMany(ORDER_FIXTURES as unknown as Record<string, unknown>[]);
    pass(`Inserted ${ORDER_FIXTURES.length} orders into "${ORDERS_COLLECTION}"`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning query-builder integration tests...\n');
  const { client, collections } = await getDb();
  const { cases, trustees, orders } = collections;

  try {
    const cq = QueryBuilder.using<TestCase>();
    const tq = QueryBuilder.using<TestTrustee>();
    const oq = QueryBuilder.using<TestOrder>();
    const { and, or, not, orderBy, pick, omit } = QueryBuilder;

    // ────────────────────────────────────────────────────────────────────────
    // EQUALS
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- EQUALS ---');
    {
      const results = await cases.find(toMongoQuery(cq('chapter').equals('7'))).toArray();
      assertIds('EQUALS chapter=7', results, 'caseId', ['091-24-10001', '091-24-10004']);
    }
    {
      const results = await trustees.find(toMongoQuery(tq('status').equals('active'))).toArray();
      assertIds('EQUALS trustee status=active', results, 'trusteeId', [
        'trustee-001',
        'trustee-002',
        'trustee-004',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOT_EQUALS
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- NOT_EQUALS ---');
    {
      const results = await orders.find(toMongoQuery(oq('status').notEqual('approved'))).toArray();
      assertIds('NOT_EQUALS order status!=approved', results, 'consolidationId', [
        'order-001',
        'order-004',
        'order-005',
      ]);
    }
    {
      const results = await cases.find(toMongoQuery(cq('chapter').notEqual('11'))).toArray();
      assertIds('NOT_EQUALS case chapter!=11', results, 'caseId', [
        '091-24-10001',
        '091-24-10003',
        '091-24-10004',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // GREATER_THAN
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- GREATER_THAN ---');
    {
      const results = await orders.find(toMongoQuery(oq('jobId').greaterThan(300))).toArray();
      assertIds('GREATER_THAN jobId>300', results, 'consolidationId', ['order-004', 'order-005']);
    }
    {
      // dateFiled is ISO string — lexicographic comparison works for YYYY-MM-DD
      const results = await cases
        .find(toMongoQuery(cq('dateFiled').greaterThan('2024-06-01')))
        .toArray();
      assertIds('GREATER_THAN dateFiled>2024-06-01', results, 'caseId', [
        '091-24-10004',
        '091-25-10005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // GREATER_THAN_OR_EQUAL
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- GREATER_THAN_OR_EQUAL ---');
    {
      const results = await orders
        .find(toMongoQuery(oq('jobId').greaterThanOrEqual(300)))
        .toArray();
      assertIds('GTE jobId>=300', results, 'consolidationId', [
        'order-003',
        'order-004',
        'order-005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // LESS_THAN
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- LESS_THAN ---');
    {
      const results = await orders.find(toMongoQuery(oq('jobId').lessThan(200))).toArray();
      assertIds('LESS_THAN jobId<200', results, 'consolidationId', ['order-001']);
    }

    // ────────────────────────────────────────────────────────────────────────
    // LESS_THAN_OR_EQUAL
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- LESS_THAN_OR_EQUAL ---');
    {
      const results = await orders.find(toMongoQuery(oq('jobId').lessThanOrEqual(200))).toArray();
      assertIds('LTE jobId<=200', results, 'consolidationId', ['order-001', 'order-002']);
    }

    // ────────────────────────────────────────────────────────────────────────
    // CONTAINS (IN)
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- CONTAINS ---');
    {
      const results = await cases.find(toMongoQuery(cq('chapter').contains(['7', '13']))).toArray();
      assertIds('CONTAINS chapter IN [7,13]', results, 'caseId', [
        '091-24-10001',
        '091-24-10003',
        '091-24-10004',
      ]);
    }
    {
      const results = await trustees
        .find(toMongoQuery(tq('status').contains(['inactive', 'resigned'])))
        .toArray();
      assertIds('CONTAINS trustee status IN [inactive,resigned]', results, 'trusteeId', [
        'trustee-003',
        'trustee-005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOT_CONTAINS (NIN)
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- NOT_CONTAINS ---');
    {
      const results = await cases
        .find(toMongoQuery(cq('courtDivisionCode').notContains(['SDNY', 'NDCA'])))
        .toArray();
      assertIds('NOT_CONTAINS case code NIN [SDNY,NDCA]', results, 'caseId', [
        '091-24-10003',
        '091-24-10004',
        '091-25-10005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // EXISTS
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- EXISTS ---');
    {
      const results = await cases.find(toMongoQuery(cq('petitionCode').exists())).toArray();
      assertIds('EXISTS petitionCode', results, 'caseId', [
        '091-24-10001',
        '091-24-10002',
        '091-24-10004',
        '091-25-10005',
      ]);
    }
    {
      const results = await trustees.find(toMongoQuery(tq('softwareId').exists())).toArray();
      assertIds('EXISTS trustee softwareId', results, 'trusteeId', [
        'trustee-001',
        'trustee-002',
        'trustee-004',
      ]);
    }
    {
      const results = await orders.find(toMongoQuery(oq('leadCaseIdHint').exists())).toArray();
      assertIds('EXISTS order leadCaseIdHint', results, 'consolidationId', [
        'order-001',
        'order-002',
        'order-005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOT_EXISTS (notExists)
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- NOT_EXISTS ---');
    {
      const results = await cases.find(toMongoQuery(cq('petitionCode').notExists())).toArray();
      assertIds('NOT_EXISTS petitionCode', results, 'caseId', ['091-24-10003']);
    }
    {
      const results = await trustees.find(toMongoQuery(tq('softwareId').notExists())).toArray();
      assertIds('NOT_EXISTS trustee softwareId', results, 'trusteeId', [
        'trustee-003',
        'trustee-005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // REGEX
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- REGEX ---');
    {
      const results = await cases.find(toMongoQuery(cq('courtName').regex(/California/))).toArray();
      assertIds('REGEX case courtName ~/California/', results, 'caseId', [
        '091-24-10002',
        '091-25-10005',
      ]);
    }
    {
      const results = await trustees.find(toMongoQuery(tq('lastName').regex('^[AD]'))).toArray();
      assertIds('REGEX trustee lastName starts with A or D', results, 'trusteeId', [
        'trustee-001',
        'trustee-004',
      ]);
    }
    {
      const results = await cases.find(toMongoQuery(cq('caseId').regex('091-24-'))).toArray();
      assertIds('REGEX caseId string pattern 091-24-', results, 'caseId', [
        '091-24-10001',
        '091-24-10002',
        '091-24-10003',
        '091-24-10004',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // AND conjunction
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- AND ---');
    {
      const results = await orders
        .find(toMongoQuery(and(oq('status').equals('approved'), oq('jobId').greaterThan(200))))
        .toArray();
      assertIds('AND status=approved AND jobId>200', results, 'consolidationId', ['order-003']);
    }
    {
      const results = await cases
        .find(toMongoQuery(and(cq('chapter').equals('11'), cq('regionId').equals('09'))))
        .toArray();
      assertIds('AND chapter=11 AND regionId=09', results, 'caseId', [
        '091-24-10002',
        '091-25-10005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // OR conjunction
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- OR ---');
    {
      const results = await orders
        .find(toMongoQuery(or(oq('status').equals('rejected'), oq('jobId').lessThan(200))))
        .toArray();
      assertIds('OR status=rejected OR jobId<200', results, 'consolidationId', [
        'order-001',
        'order-004',
      ]);
    }
    {
      const results = await trustees
        .find(toMongoQuery(or(tq('status').equals('resigned'), tq('status').equals('inactive'))))
        .toArray();
      assertIds('OR trustee resigned OR inactive', results, 'trusteeId', [
        'trustee-003',
        'trustee-005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOT conjunction
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- NOT ---');
    {
      const results = await orders
        .find(toMongoQuery(not(oq('status').equals('approved'))))
        .toArray();
      assertIds('NOT status=approved', results, 'consolidationId', [
        'order-001',
        'order-004',
        'order-005',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Nested conjunctions
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- Nested AND/OR ---');
    {
      const results = await orders
        .find(
          toMongoQuery(
            or(
              and(oq('status').equals('pending'), oq('jobId').lessThan(200)),
              and(oq('status').equals('approved'), oq('jobId').greaterThan(250)),
            ),
          ),
        )
        .toArray();
      assertIds('Nested OR(AND pending+low, AND approved+high)', results, 'consolidationId', [
        'order-001',
        'order-003',
      ]);
    }
    {
      // Cases: (chapter=7 OR chapter=13) AND regionId!=09
      const results = await cases
        .find(
          toMongoQuery(
            and(
              or(cq('chapter').equals('7'), cq('chapter').equals('13')),
              cq('regionId').notEqual('09'),
            ),
          ),
        )
        .toArray();
      assertIds('Nested AND(OR chapters, NOT region)', results, 'caseId', [
        '091-24-10001',
        '091-24-10003',
        '091-24-10004',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SortSpec ASCENDING
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- SORT ASCENDING ---');
    {
      const filter = toMongoQuery(oq('status').equals('approved'));
      const sort = toMongoSort(orderBy<TestOrder>(['jobId', 'ASCENDING']));
      const results = await orders.find(filter).sort(sort).toArray();
      assertOrder('SORT orders jobId ASC', results, 'consolidationId', ['order-002', 'order-003']);
    }
    {
      const filter = toMongoQuery(tq('status').equals('active'));
      const sort = toMongoSort(orderBy<TestTrustee>(['lastName', 'ASCENDING']));
      const results = await trustees.find(filter).sort(sort).toArray();
      assertOrder('SORT trustees lastName ASC', results, 'trusteeId', [
        'trustee-001',
        'trustee-002',
        'trustee-004',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SortSpec DESCENDING
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- SORT DESCENDING ---');
    {
      const filter = toMongoQuery(oq('status').equals('approved'));
      const sort = toMongoSort(orderBy<TestOrder>(['jobId', 'DESCENDING']));
      const results = await orders.find(filter).sort(sort).toArray();
      assertOrder('SORT orders jobId DESC', results, 'consolidationId', ['order-003', 'order-002']);
    }
    {
      const filter = toMongoQuery(cq('chapter').equals('11'));
      const sort = toMongoSort(orderBy<TestCase>(['dateFiled', 'DESCENDING']));
      const results = await cases.find(filter).sort(sort).toArray();
      assertOrder('SORT cases dateFiled DESC', results, 'caseId', ['091-25-10005', '091-24-10002']);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Multi-field sort
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- MULTI-FIELD SORT ---');
    {
      const filter = toMongoQuery(oq('status').notEqual('rejected'));
      const sort = toMongoSort(
        orderBy<TestOrder>(['status', 'ASCENDING'], ['jobId', 'DESCENDING']),
      );
      const results = await orders.find(filter).sort(sort).toArray();
      // approved desc (300, 200) then pending desc (500, 100)
      assertOrder('SORT status ASC + jobId DESC', results, 'consolidationId', [
        'order-003',
        'order-002',
        'order-005',
        'order-001',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Limit
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- LIMIT ---');
    {
      const filter = toMongoQuery(oq('jobId').greaterThan(0));
      const sort = toMongoSort(orderBy<TestOrder>(['jobId', 'ASCENDING']));
      const results = await orders.find(filter).sort(sort).limit(3).toArray();
      assertCount('LIMIT 3 from orders', results.length, 3);
      assertOrder('LIMIT 3 returns first 3 by jobId ASC', results, 'consolidationId', [
        'order-001',
        'order-002',
        'order-003',
      ]);
    }
    {
      const filter = toMongoQuery(tq('status').equals('active'));
      const sort = toMongoSort(orderBy<TestTrustee>(['trusteeId', 'ASCENDING']));
      const results = await trustees.find(filter).sort(sort).limit(2).toArray();
      assertCount('LIMIT 2 from trustees', results.length, 2);
      assertOrder('LIMIT 2 active trustees by trusteeId ASC', results, 'trusteeId', [
        'trustee-001',
        'trustee-002',
      ]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Projection: pick (INCLUDE)
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- PROJECTION pick ---');
    {
      const filter = toMongoQuery(cq('caseId').equals('091-24-10001'));
      const projection = toMongoProjection(pick<TestCase>('caseId', 'chapter', 'dateFiled'));
      const results = (await cases.find(filter, { projection }).toArray()) as Record<
        string,
        unknown
      >[];
      assertCount('pick returns 1 case', results.length, 1);
      assertFieldPresent('pick case: caseId', results[0], 'caseId');
      assertFieldPresent('pick case: chapter', results[0], 'chapter');
      assertFieldPresent('pick case: dateFiled', results[0], 'dateFiled');
      assertFieldAbsent('pick case: courtName excluded', results[0], 'courtName');
      assertFieldAbsent('pick case: regionId excluded', results[0], 'regionId');
    }
    {
      const filter = toMongoQuery(tq('trusteeId').equals('trustee-001'));
      const projection = toMongoProjection(pick<TestTrustee>('trusteeId', 'name', 'status'));
      const results = (await trustees.find(filter, { projection }).toArray()) as Record<
        string,
        unknown
      >[];
      assertCount('pick returns 1 trustee', results.length, 1);
      assertFieldPresent('pick trustee: trusteeId', results[0], 'trusteeId');
      assertFieldPresent('pick trustee: name', results[0], 'name');
      assertFieldPresent('pick trustee: status', results[0], 'status');
      assertFieldAbsent('pick trustee: firstName excluded', results[0], 'firstName');
      assertFieldAbsent('pick trustee: phoneticTokens excluded', results[0], 'phoneticTokens');
    }

    // ────────────────────────────────────────────────────────────────────────
    // Projection: omit (EXCLUDE)
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- PROJECTION omit ---');
    {
      const filter = toMongoQuery(oq('consolidationId').equals('order-002'));
      const projection = toMongoProjection(
        omit<TestOrder>('courtName', 'courtDivisionCode', 'reason'),
      );
      const results = (await orders.find(filter, { projection }).toArray()) as Record<
        string,
        unknown
      >[];
      assertCount('omit returns 1 order', results.length, 1);
      assertFieldPresent('omit order: consolidationId', results[0], 'consolidationId');
      assertFieldPresent('omit order: status', results[0], 'status');
      assertFieldPresent('omit order: jobId', results[0], 'jobId');
      assertFieldAbsent('omit order: courtName excluded', results[0], 'courtName');
      assertFieldAbsent('omit order: courtDivisionCode excluded', results[0], 'courtDivisionCode');
    }
    {
      const filter = toMongoQuery(tq('trusteeId').equals('trustee-001'));
      const projection = toMongoProjection(omit<TestTrustee>('phoneticTokens', 'softwareId'));
      const results = (await trustees.find(filter, { projection }).toArray()) as Record<
        string,
        unknown
      >[];
      assertCount('omit returns 1 trustee', results.length, 1);
      assertFieldPresent('omit trustee: name', results[0], 'name');
      assertFieldPresent('omit trustee: status', results[0], 'status');
      assertFieldAbsent('omit trustee: phoneticTokens excluded', results[0], 'phoneticTokens');
      assertFieldAbsent('omit trustee: softwareId excluded', results[0], 'softwareId');
    }
  } finally {
    await client.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up integration test fixtures...\n');
  const { client, collections } = await getDb();
  try {
    const r1 = await collections.cases.deleteMany({});
    pass(`Deleted ${r1.deletedCount} doc(s) from "${CASES_COLLECTION}"`);

    const r2 = await collections.trustees.deleteMany({});
    pass(`Deleted ${r2.deletedCount} doc(s) from "${TRUSTEES_COLLECTION}"`);

    const r3 = await collections.orders.deleteMany({});
    pass(`Deleted ${r3.deletedCount} doc(s) from "${ORDERS_COLLECTION}"`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('Query Builder Library — Integration Test Suite');
  console.log('='.repeat(60));

  switch (command) {
    case 'seed':
      await seed();
      break;
    case 'run':
      await run();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run query-builder --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  ${HARNESS} <command>`);
      console.log('\nLocal workflow:');
      console.log('  1. cd query-builder/scripts && ./start-services.sh');
      console.log('  2. Copy .env.local.template to .env.local');
      console.log(`  3. ${HARNESS} seed`);
      console.log(`  4. ${HARNESS} run`);
      console.log(`  5. ${HARNESS} clean`);
      console.log('  6. cd query-builder/scripts && ./stop-services.sh');
      console.log('\nConditions: EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_THAN_OR_EQUAL,');
      console.log('  LESS_THAN, LESS_THAN_OR_EQUAL, CONTAINS, NOT_CONTAINS, EXISTS, REGEX');
      console.log('Conjunctions: AND, OR, NOT (including nested)');
      console.log('SortSpec: ASCENDING, DESCENDING, multi-field');
      console.log('Limit, Projection: pick() (INCLUDE), omit() (EXCLUDE)');
      console.log('\nFixtures: test-cases, test-trustees, test-orders');
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
