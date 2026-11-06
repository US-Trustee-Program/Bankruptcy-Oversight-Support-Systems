/**
 * sync-trustee-case-appointments integration harness.
 *
 * BDD-style scenarios (see scenarios.ts) rendered into real ACMS_INT and DXTR_INT SQL Edge databases
 * and a real MongoDB, then driven IN-PROCESS: source.getEventsForDate -> processAppointments, and
 * asserted against the CAMS state left in Mongo. No Azure Functions host, queues or mocks.
 *
 * Three groups of checks, each reported separately:
 *   query     ACMS fixtures run through the REAL getCmmapAppointmentsRaw. Passes today; keeps the
 *             fixtures and DDL honest against the production SQL.
 *   scenario  source -> sync -> CAMS state, per lane. Fails (NOT IMPLEMENTED) until the ACMS source
 *             exists; later fails on real behavior gaps. That is the point.
 *   driver    per-region bookmark/catch-up flow. NOT IMPLEMENTED until the driver exists.
 *
 * Usage (from test/integration/):
 *   npm run sync-trustee-case-appointments -- <command> [--lane ACMS|DXTR] [--only <key>]
 *
 * Commands:
 *   check-env    Verify environment
 *   seed-schema  [local] Create ACMS_INT and DXTR_INT, apply DDL, load office reference data
 *   run          Run every scenario (wipes the fixture data between scenarios)
 *   list         List scenarios, their basis and lanes
 *   clean        Wipe all fixture data from both SQL databases and Mongo
 *   help         This text
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient, Db } from 'mongodb';
import * as mssql from 'mssql';
import { randomUUID } from 'crypto';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import SyncTrusteeCaseAppointmentsUseCase from '../../../../backend/lib/use-cases/dataflows/sync-trustee-case-appointments';
import { TrusteeAppointmentSource } from '../../../../backend/lib/use-cases/dataflows/trustee-appointment-source';
import {
  buildVariant,
  computeFingerprint,
} from '../../../../backend/lib/use-cases/dataflows/trustee-variant.helpers';
import factory from '../../../../backend/lib/factory';
import { ApplicationContext } from '../../../../backend/lib/adapters/types/basic';
import { TrusteeAppointmentSyncEvent } from '../../../../common/src/cams/dataflow-events';
import DateHelper from '../../../../common/src/date-helper';
import {
  SCENARIOS,
  DRIVER_SCENARIOS,
  PENDING_BEHAVIORS,
  Scenario,
  DriverScenario,
  Pass,
  Row,
  CaseSpec,
  CamsTrustee,
  Person,
  Lane,
  Expect,
  ExpectedAppointment,
  REGION,
  GROUP,
  DIVISION,
  OTHER_DIVISION,
  COURT_ID,
  OTHER_COURT_ID,
  OTHER_GROUP,
  OTHER_REGION,
} from './scenarios';
import { NotImplementedError, getAcmsSource, getDxtrSource, runRegionDriver } from './bindings';

const HARNESS_DIR = path.resolve(__dirname, '../');
const SEED_DIR = path.join(HARNESS_DIR, 'seed');

function loadEnv() {
  const envPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(
      `Missing ${envPath}. Copy .env.local.template to .env.local and set the passwords (see README.md).`,
    );
    process.exit(1);
  }
  dotenv.config({ path: envPath, override: true });
}
loadEnv();

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

type Outcome = {
  name: string;
  group: string;
  status: 'pass' | 'fail' | 'not-implemented' | 'pending';
};
const outcomes: Outcome[] = [];

const realLog = console.log.bind(console); // captured before the filter below
// The production logger prints each DEBUG/INFO/WARN record as a one-element array via console.log.
// Hide those so scenario output stays readable; ERROR records and --verbose still show everything.
if (!process.argv.includes('--verbose')) {
  for (const method of ['log', 'debug', 'info', 'warn'] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const first = args[0];
      if (
        Array.isArray(first) &&
        typeof first[0] === 'string' &&
        /^\[(DEBUG|INFO|WARN)\]/.test(first[0])
      )
        return;
      original(...args);
    };
  }
}

function line(msg: string) {
  realLog(msg);
}

class Reporter {
  failures = 0;
  constructor(
    private readonly group: string,
    private readonly name: string,
  ) {}
  step(kind: 'Given' | 'When' | 'Then' | 'And', text: string) {
    line(`    ${kind.padEnd(5)} ${text}`);
  }
  pass(msg: string) {
    line(`      ✓ ${msg}`);
  }
  fail(msg: string) {
    this.failures += 1;
    line(`      ✗ ${msg}`);
  }
  check(ok: boolean, passMsg: string, failMsg: string) {
    if (ok) this.pass(passMsg);
    else this.fail(failMsg);
  }
  finish(status: 'pass' | 'fail' | 'not-implemented' | 'pending') {
    outcomes.push({ name: this.name, group: this.group, status });
  }
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

function sqlConfig(prefix: 'ACMS_MSSQL' | 'MSSQL', database: string): mssql.config {
  const host = process.env[`${prefix}_HOST`];
  if (!host) throw new Error(`${prefix}_HOST is not set`);
  return {
    server: host,
    port: Number(process.env[`${prefix}_PORT`]) || 1433,
    database,
    user: process.env[`${prefix}_USER`],
    password: process.env[`${prefix}_PASS`],
    options: {
      encrypt: process.env[`${prefix}_ENCRYPT`]?.toLowerCase() === 'true',
      trustServerCertificate:
        process.env[`${prefix}_TRUST_UNSIGNED_CERT`]?.toLowerCase() === 'true',
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  };
}

const acmsDatabase = () => process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
const dxtrDatabase = () => process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';

async function acmsPool(database = acmsDatabase()) {
  return new mssql.ConnectionPool(sqlConfig('ACMS_MSSQL', database)).connect();
}
async function dxtrPool(database = dxtrDatabase()) {
  return new mssql.ConnectionPool(sqlConfig('MSSQL', database)).connect();
}

async function getMongo(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const name = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !name)
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(name) };
}

async function executeSqlFile(pool: mssql.ConnectionPool, file: string) {
  const batches = fs
    .readFileSync(file, 'utf-8')
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const [i, batch] of batches.entries()) {
    try {
      await pool.request().query(batch);
    } catch (e) {
      throw new Error(
        `${path.basename(file)} batch ${i + 1}/${batches.length} failed: ${(e as Error).message}\n${batch.slice(0, 200)}`,
      );
    }
  }
}

async function getContext(): Promise<ApplicationContext> {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

// ---------------------------------------------------------------------------
// Date / name helpers
// ---------------------------------------------------------------------------

/** '2026-07-01' -> 20260701 */
const toAcmsDate = (iso: string): number => Number(iso.replace(/-/g, ''));
/** '2026-07-01' -> '260701' */
const toYymmdd = (iso: string): string => iso.slice(2).replace(/-/g, '');
const fullName = (p: Person): string => [p.first, p.middle, p.last].filter(Boolean).join(' ');
const dashedPhone = (digits: string): string =>
  `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
const parseCaseId = (caseId: string) => {
  const [div, yr, num] = caseId.split('-');
  return {
    div: Number(div),
    yr: Number(yr),
    num: Number(num),
    divisionCode: div,
    caseNumber: `${yr}-${num}`,
  };
};

function acmsChapter(c: CaseSpec): string {
  if (c.acmsChapterRaw) return c.acmsChapterRaw.padEnd(2, ' ');
  return (c.chapter ?? '7').padEnd(2, ' ');
}
const courtFor = (c: CaseSpec) =>
  (c.division ?? DIVISION) === OTHER_DIVISION ? OTHER_COURT_ID : COURT_ID;

// ---------------------------------------------------------------------------
// seed-schema: databases, DDL, DXTR office reference data
// ---------------------------------------------------------------------------

async function seedSchema() {
  line('\nCreating ACMS_INT / DXTR_INT and applying DDL...\n');
  for (const [label, poolFn, db] of [
    ['ACMS', acmsPool, acmsDatabase()],
    ['DXTR', dxtrPool, dxtrDatabase()],
  ] as const) {
    const master = await poolFn('master');
    try {
      await master
        .request()
        .query(
          `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${db}') CREATE DATABASE [${db}]`,
        );
    } finally {
      await master.close();
    }
    line(`  ✓ ${label} database ${db} ready`);
  }

  const acms = await acmsPool();
  try {
    await executeSqlFile(acms, path.join(SEED_DIR, '00-seed-acms-schema.sql'));
    line('  ✓ ACMS schema applied (CMMAP, CMMDB, CMMPR, CMMKE)');
  } finally {
    await acms.close();
  }

  const dxtr = await dxtrPool();
  try {
    await executeSqlFile(dxtr, path.join(SEED_DIR, '00-seed-dxtr-schema.sql'));
    await seedDxtrReference(dxtr);
    line('  ✓ DXTR schema applied and office reference data loaded');
  } finally {
    await dxtr.close();
  }
}

/**
 * Office reference data: groups NY (div 081 / court 0208, real codes), UT (div 066 / court 0206, the
 * Utica NY group, NOT Utah) and the synthetic PA (div 301 / court 0301) in region 03. The ACMS source
 * resolves region -> divisions and court ids from this, exactly as production does.
 */
async function seedDxtrReference(pool: mssql.ConnectionPool) {
  await pool.request().batch(`
    DELETE FROM dbo.AO_CS_DIV; DELETE FROM dbo.AO_OFFICE; DELETE FROM dbo.AO_COURT;
    DELETE FROM dbo.AO_GRP_DES; DELETE FROM dbo.AO_REGION;
    INSERT INTO dbo.AO_REGION (REGION_ID, REGION_NAME) VALUES ('${REGION}', 'NEW YORK'), ('${OTHER_REGION}', 'SYNTHETIC REGION 3');
    INSERT INTO dbo.AO_GRP_DES (GRP_DES, REGION_ID) VALUES ('${GROUP}', '${REGION}'), ('UT', '${REGION}'), ('${OTHER_GROUP}', '${OTHER_REGION}');
    INSERT INTO dbo.AO_COURT (COURT_ID, COURT_TITLE, COURT_NAME, DISTRICT_ALPHA) VALUES
      ('${COURT_ID}', 'United States Bankruptcy Court', 'Southern District of New York', 'NY'),
      ('0206', 'United States Bankruptcy Court', 'Northern District of New York', 'AL'),
      ('${OTHER_COURT_ID}', 'United States Bankruptcy Court', 'Synthetic District 3', 'SD');
    INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS) VALUES
      ('${COURT_ID}', '1', 'Manhattan', 'Manhattan', 'Y'),
      ('0206', '6', 'Utica', 'Utica', 'Y'),
      ('${OTHER_COURT_ID}', '1', 'Synthetic Office 3', 'Synthetic Office 3', 'Y');
    INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, CS_DIV_ACMS) VALUES
      ('${DIVISION}', '${GROUP}', '${COURT_ID}', '1', 'NY', '${DIVISION}'),
      ('066', 'UT', '0206', '6', 'NY', '066'),
      ('${OTHER_DIVISION}', '${OTHER_GROUP}', '${OTHER_COURT_ID}', '1', 'PA', '${OTHER_DIVISION}');
  `);
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

const MONGO_COLLECTIONS = [
  'cases',
  'trustees',
  'trustee-appointments',
  'trustee-professional-ids',
  'trustee-variation',
  'trustee-match-verification',
  'case-trustee-appointments',
  'trustee-case-appointments',
  'runtime-state',
];

async function wipeAll() {
  const acms = await acmsPool();
  try {
    await acms
      .request()
      .batch(
        'DELETE FROM dbo.CMMKE; DELETE FROM dbo.CMMAP; DELETE FROM dbo.CMMDB; DELETE FROM dbo.CMMPR;',
      );
  } finally {
    await acms.close();
  }
  const dxtr = await dxtrPool();
  try {
    await dxtr
      .request()
      .batch('DELETE FROM dbo.AO_TX; DELETE FROM dbo.AO_PY; DELETE FROM dbo.AO_CS;');
  } finally {
    await dxtr.close();
  }
  const { client, db } = await getMongo();
  try {
    for (const name of MONGO_COLLECTIONS) await db.collection(name).deleteMany({});
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// Renderers: scenario -> source rows
// ---------------------------------------------------------------------------

async function renderAcms(
  pool: mssql.ConnectionPool,
  cases: CaseSpec[],
  rows: Row[],
  passChangeDate: string,
) {
  await pool
    .request()
    .batch(
      'DELETE FROM dbo.CMMKE; DELETE FROM dbo.CMMAP; DELETE FROM dbo.CMMDB; DELETE FROM dbo.CMMPR;',
    );

  for (const c of cases) {
    const { div, yr, num } = parseCaseId(c.caseId);
    await pool
      .request()
      .input('div', mssql.Numeric(3, 0), div)
      .input('yr', mssql.Numeric(2, 0), yr)
      .input('num', mssql.Numeric(5, 0), num)
      .input('del', mssql.Char(1), c.cmmdbDeleted ? 'D' : ' ')
      .input('filed', mssql.Numeric(8, 0), toAcmsDate(c.filed ?? '2026-01-15'))
      .input('chapt', mssql.Char(2), acmsChapter(c))
      .input('closed', mssql.Numeric(8, 0), c.closedByCourt ? toAcmsDate(c.closedByCourt) : 0)
      .query(`
        INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, DELETE_CODE, CASE_FILED_DATE, CURR_CASE_CHAPT, CLOSED_BY_COURT_DATE)
        VALUES (@div, @yr, @num, @del, @filed, @chapt, @closed)`);
    if (c.reopenedOn) {
      await pool
        .request()
        .input('div', mssql.Numeric(3, 0), div)
        .input('yr', mssql.Numeric(2, 0), yr)
        .input('num', mssql.Numeric(5, 0), num)
        .input('occ', mssql.Numeric(8, 0), toAcmsDate(c.reopenedOn)).query(`
          INSERT INTO dbo.CMMKE (CASE_DIV, CASE_YEAR, CASE_NUMBER, EVENT_CODE_TYPE, EVENT_CODE, GROUP_DESIGNATOR, ORIGINAL_OCC_DATE)
          VALUES (@div, @yr, @num, 'O', 'OCO', '${GROUP}', @occ)`);
    }
  }

  const seenProfessionals = new Set<string>();
  const seqByCase = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.prof.group}-${r.prof.code}`;
    if (!seenProfessionals.has(key)) {
      seenProfessionals.add(key);
      const p = r.prof.person;
      await pool
        .request()
        .input('grp', mssql.Char(2), r.prof.group)
        .input('code', mssql.Numeric(5, 0), r.prof.code)
        .input('del', mssql.Char(1), r.prof.cmmprDeleted ? 'D' : ' ')
        .input('last', mssql.Char(30), p.last)
        .input('first', mssql.Char(20), p.first)
        .input('mi', mssql.Char(1), p.middle ?? '')
        .input('addr1', mssql.Char(30), p.address1)
        .input('city', mssql.Char(20), p.city)
        .input('state', mssql.Char(2), p.state)
        .input('zip', mssql.Numeric(9, 0), Number(p.zip))
        .input('phone', mssql.Numeric(10, 0), Number(p.phone)).query(`
          INSERT INTO dbo.CMMPR (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
            PROF_ADDRESS1, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_COMMERCIAL_PHONE_NBR)
          VALUES (@grp, @code, @del, @last, @first, @mi, @addr1, @city, @state, @zip, @phone)`);
    }
    const { div, yr, num } = parseCaseId(r.caseId);
    const seq = (seqByCase.get(r.caseId) ?? 0) + 1;
    seqByCase.set(r.caseId, seq);
    await pool
      .request()
      .input('seq', mssql.Numeric(5, 0), seq)
      .input('div', mssql.Numeric(3, 0), div)
      .input('yr', mssql.Numeric(2, 0), yr)
      .input('num', mssql.Numeric(5, 0), num)
      .input('grp', mssql.Char(2), r.prof.group)
      .input('code', mssql.Numeric(5, 0), r.prof.code)
      .input('type', mssql.Char(2), r.apptType ?? 'TR')
      .input('appt', mssql.Numeric(11, 0), r.apptDate ? toAcmsDate(r.apptDate) : 0)
      .input('disp', mssql.Numeric(11, 0), r.dispDate ? toAcmsDate(r.dispDate) : 0)
      .input('del', mssql.Char(1), r.deleted ? 'D' : ' ')
      .input('region', mssql.Char(2), r.region ?? REGION)
      .input('cdb', mssql.Numeric(8, 0), toAcmsDate(r.changeDate ?? passChangeDate)).query(`
        INSERT INTO dbo.CMMAP (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_TYPE,
          APPT_DATE, DISP_DATE, DELETE_CODE, REGION_CODE, CDB_UPDATE_DATE)
        VALUES (@seq, @div, @yr, @num, @grp, @code, @type, @appt, @disp, @del, @region, @cdb)`);
  }
}

async function renderDxtr(
  pool: mssql.ConnectionPool,
  cases: CaseSpec[],
  rows: Row[],
  passChangeDate: string,
) {
  await pool
    .request()
    .batch('DELETE FROM dbo.AO_TX; DELETE FROM dbo.AO_PY; DELETE FROM dbo.AO_CS;');
  let id = 999000000;
  const dxtrIdByCase = new Map<string, string>();
  for (const c of cases) {
    id += 1;
    const dxtrId = String(id);
    dxtrIdByCase.set(c.caseId, dxtrId);
    const { divisionCode, caseNumber } = parseCaseId(c.caseId);
    const court = courtFor(c);
    await pool
      .request()
      .input('id', mssql.VarChar(9), dxtrId)
      .input('court', mssql.VarChar(4), court)
      .input('caseId', mssql.VarChar(10), caseNumber)
      .input('div', mssql.VarChar(3), divisionCode)
      .input('chapter', mssql.VarChar(3), c.chapter ?? '7')
      .input(
        'grp',
        mssql.VarChar(2),
        (c.division ?? DIVISION) === OTHER_DIVISION ? OTHER_GROUP : GROUP,
      ).query(`
        INSERT INTO dbo.AO_CS (CS_CASEID, COURT_ID, CASE_ID, CS_DIV, CS_CHAPTER, GRP_DES)
        VALUES (@id, @court, @caseId, @div, @chapter, @grp)`);
  }
  for (const r of rows) {
    const c = cases.find((x) => x.caseId === r.caseId)!;
    const dxtrId = dxtrIdByCase.get(r.caseId)!;
    const p = r.prof.person;
    await pool
      .request()
      .input('id', mssql.VarChar(9), dxtrId)
      .input('court', mssql.VarChar(4), courtFor(c))
      .input('first', mssql.VarChar(30), p.first)
      .input('mid', mssql.VarChar(25), p.middle ?? '')
      .input('last', mssql.VarChar(200), p.last)
      .input('addr1', mssql.VarChar(60), p.address1)
      .input('city', mssql.VarChar(30), p.city)
      .input('state', mssql.VarChar(2), p.state)
      .input('zip', mssql.VarChar(13), p.zip)
      .input('phone', mssql.VarChar(30), dashedPhone(p.phone))
      .input('email', mssql.VarChar(60), p.email ?? '').query(`
        INSERT INTO dbo.AO_PY (CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
          PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY, PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL)
        VALUES (@id, @court, 'tr', @first, @mid, @last, '', @addr1, '', '', @city, @state, @zip, 'USA', @phone, '', @email)`);
    await pool
      .request()
      .input('id', mssql.VarChar(9), dxtrId)
      .input('court', mssql.VarChar(4), courtFor(c))
      .input('txDate', mssql.DateTime2, new Date(`${r.changeDate ?? passChangeDate}T00:00:00Z`))
      .input('rec', mssql.VarChar(237), ''.padEnd(237, ' ')).query(`
        INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
        VALUES (@id, @court, 'A', 'TR', @txDate, STUFF(@rec, 24, 6, '${toYymmdd(r.apptDate)}'))`);
  }
}

// ---------------------------------------------------------------------------
// Mongo seeding (the "Given" about CAMS state)
// ---------------------------------------------------------------------------

const SYSTEM = { id: 'SYSTEM', name: 'SYSTEM' };
const nowIso = () => new Date().toISOString();

async function seedCasesAndTrustees(db: Db, s: { cases: CaseSpec[]; cams?: Scenario['cams'] }) {
  const now = nowIso();
  for (const c of s.cases) {
    const state = c.cams ?? 'synced';
    if (state === 'absent') continue;
    const { divisionCode } = parseCaseId(c.caseId);
    await db.collection('cases').replaceOne(
      { documentType: 'SYNCED_CASE', caseId: c.caseId },
      {
        documentType: 'SYNCED_CASE',
        caseId: c.caseId,
        dxtrId: c.caseId,
        courtId: courtFor(c),
        courtName: 'Integration Test Court',
        courtDivisionCode: divisionCode,
        courtDivisionName: 'Integration Division',
        officeCode: '1',
        officeName: 'Integration Division',
        groupDesignator: (c.division ?? DIVISION) === OTHER_DIVISION ? OTHER_GROUP : GROUP,
        regionId: (c.division ?? DIVISION) === OTHER_DIVISION ? OTHER_REGION : REGION,
        regionName: 'Region',
        chapter: c.chapter ?? '7',
        caseTitle: `Fixture Debtor ${c.caseId}`,
        dateFiled: c.filed ?? '2026-01-15',
        debtor: { name: `Fixture Debtor ${c.caseId}` },
        ...(typeof state === 'object' ? { movedToCaseId: state.movedTo } : {}),
        updatedOn: now,
        updatedBy: SYSTEM,
      },
      { upsert: true },
    );
  }

  for (const t of s.cams?.trustees ?? []) {
    await seedTrustee(db, t, now);
  }
  for (const link of s.cams?.links ?? []) {
    await db.collection('trustee-professional-ids').insertOne({
      id: randomUUID(),
      documentType: 'TRUSTEE_PROFESSIONAL_ID',
      camsTrusteeId: link.trustee,
      acmsProfessionalId: link.acms,
      disposition: link.disposition ?? 'linked',
      ...((link.disposition ?? 'linked') === 'linked' ? { linkMethod: 'manual' } : {}),
      nameMatchCount: 1,
      evidence: {},
      createdOn: now,
      createdBy: SYSTEM,
      updatedOn: now,
      updatedBy: SYSTEM,
    });
  }
  for (const e of s.cams?.existing ?? []) {
    const doc = {
      id: randomUUID(),
      documentType: 'CASE_APPOINTMENT',
      caseId: e.caseId,
      trusteeId: e.trustee,
      assignedOn: e.assignedOn,
      appointedDate: e.assignedOn,
      ...(e.unassignedOn ? { unassignedOn: e.unassignedOn } : {}),
      checks: {
        matchedCase: true,
        matchedTrustee: true,
        matchedTrusteeAppointment: true,
        matchedBy: 'seed',
      },
      createdOn: '2026-01-01T00:00:00.000Z',
      createdBy: SYSTEM,
      updatedOn: '2026-01-01T00:00:00.000Z',
      updatedBy: SYSTEM,
    };
    // Dual-written in production (one partition per access path); seed both identically.
    await db.collection('case-trustee-appointments').insertOne({ ...doc });
    await db.collection('trustee-case-appointments').insertOne({ ...doc, id: randomUUID() });
  }
}

async function seedTrustee(db: Db, t: CamsTrustee, now: string) {
  const p = t.person;
  await db.collection('trustees').replaceOne(
    { documentType: 'TRUSTEE', trusteeId: t.id },
    {
      documentType: 'TRUSTEE',
      trusteeId: t.id,
      name: fullName(p),
      firstName: p.first,
      middleName: p.middle,
      lastName: p.last,
      public: {
        address: {
          address1: p.address1,
          city: p.city,
          state: p.state,
          zipCode: p.zip,
          countryCode: 'US',
        },
        phone: { number: dashedPhone(p.phone) },
        ...(p.email ? { email: p.email } : {}),
      },
      updatedOn: now,
      updatedBy: SYSTEM,
    },
    { upsert: true },
  );
  if (t.covers) {
    await db.collection('trustee-appointments').replaceOne(
      { documentType: 'TRUSTEE_APPOINTMENT', trusteeId: t.id, courtId: COURT_ID },
      {
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: t.id,
        chapter: '7',
        appointmentType: 'panel',
        courtId: COURT_ID,
        divisionCode: DIVISION,
        appointedDate: '2020-01-01',
        status: 'active',
        effectiveDate: '2020-01-01',
        createdOn: now,
        createdBy: SYSTEM,
        updatedOn: now,
        updatedBy: SYSTEM,
      },
      { upsert: true },
    );
  }
}

/** Variations and pending tasks key off the fingerprint of the event the source actually returns. */
async function seedEventDerivedState(
  db: Db,
  s: Scenario,
  events: TrusteeAppointmentSyncEvent[],
  lane: Lane,
): Promise<void> {
  const now = nowIso();
  const byLast = (last: string) => events.find((e) => e.sourceTrustee.lastName?.trim() === last);
  for (const v of s.cams?.variations ?? []) {
    const ev = byLast(v.last);
    if (!ev)
      throw new Error(`Given: no source event for trustee "${v.last}" to derive a variation from`);
    const variant = buildVariant(ev.sourceTrustee);
    await db.collection('trustee-variation').insertOne({
      id: randomUUID(),
      documentType: 'TRUSTEE_VARIATION',
      fingerprint: computeFingerprint(variant),
      variant,
      trusteeId: v.trustee,
      createdOn: now,
      createdBy: SYSTEM,
      updatedOn: now,
      updatedBy: SYSTEM,
    });
  }
  for (const t of s.cams?.pendingTasks ?? []) {
    const ev = byLast(t.last);
    if (!ev)
      throw new Error(
        `Given: no source event for trustee "${t.last}" to derive a pending task from`,
      );
    const variant = buildVariant(ev.sourceTrustee);
    await db.collection('trustee-match-verification').insertOne({
      id: randomUUID(),
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      caseId: 'SEEDED-ORIGIN-CASE',
      courtId: ev.courtId,
      sourceTrustee: ev.sourceTrustee,
      mismatchReason: 'no match',
      source: lane,
      findings: {},
      taskType: 'trustee-match',
      status: 'pending',
      taskDate: now,
      fingerprint: computeFingerprint(variant),
      variant,
      createdOn: now,
      createdBy: SYSTEM,
      updatedOn: now,
      updatedBy: SYSTEM,
    });
  }
}

// ---------------------------------------------------------------------------
// Source read + sync pass (the "When")
// ---------------------------------------------------------------------------

async function readEvents(
  context: ApplicationContext,
  source: TrusteeAppointmentSource,
  lane: Lane,
  region: string,
  changeDate: string,
): Promise<TrusteeAppointmentSyncEvent[]> {
  // The DXTR read is "transactions AFTER this date" (TX_DATE > start), so ask from the day before.
  const readDate = lane === 'DXTR' ? DateHelper.subtractDays(changeDate, 1) : changeDate;
  const events: TrusteeAppointmentSyncEvent[] = [];
  let lastId: string | undefined;
  for (let page = 0; page < 1000; page += 1) {
    const result = await source.getEventsForDate(context, region, readDate, lastId);
    events.push(...result.events);
    if (!result.lastId) return events;
    lastId = result.lastId;
  }
  throw new Error('Source paging did not terminate after 1000 pages');
}

// ---------------------------------------------------------------------------
// Assertions (the "Then")
// ---------------------------------------------------------------------------

const day = (iso?: string): string | undefined => (iso ? iso.slice(0, 10) : undefined);

type AppointmentDoc = {
  trusteeId: string;
  caseId: string;
  assignedOn: string;
  unassignedOn?: string;
  isSurrogate?: boolean;
  chapter?: string;
  closedDate?: string;
  reopenedDate?: string;
  updatedOn?: string;
  checks?: { matchedBy?: string; matchedTrusteeAppointment?: boolean };
};

function describeAppointment(a: AppointmentDoc): string {
  const who = a.isSurrogate ? 'PLACEHOLDER' : a.trusteeId;
  return `${who} ${day(a.assignedOn)}→${day(a.unassignedOn) ?? 'open'}`;
}

function matchesExpected(a: AppointmentDoc, e: ExpectedAppointment): string[] {
  const problems: string[] = [];
  const isPlaceholder = e.trustee === 'PLACEHOLDER';
  if (isPlaceholder !== Boolean(a.isSurrogate))
    problems.push(isPlaceholder ? 'expected a placeholder' : 'unexpected placeholder');
  if (!isPlaceholder && a.trusteeId !== e.trustee)
    problems.push(`trustee ${a.trusteeId} ≠ ${e.trustee}`);
  if (day(a.assignedOn) !== e.assignedOn)
    problems.push(`assignedOn ${day(a.assignedOn)} ≠ ${e.assignedOn}`);
  if (e.unassignedOn === undefined && a.unassignedOn)
    problems.push(`should be open but closed ${day(a.unassignedOn)}`);
  if (e.unassignedOn === 'ANY' && !a.unassignedOn) problems.push('should be closed but is open');
  if (e.unassignedOn && e.unassignedOn !== 'ANY' && day(a.unassignedOn) !== e.unassignedOn) {
    problems.push(`unassignedOn ${day(a.unassignedOn) ?? 'open'} ≠ ${e.unassignedOn}`);
  }
  const by = a.checks?.matchedBy;
  if (e.matchedBy === 'PIPELINE') {
    if (!by || by === 'professional-id' || by === 'variation')
      problems.push(`matchedBy "${by}" is not a pipeline stage`);
  } else if (e.matchedBy !== undefined && by !== e.matchedBy) {
    problems.push(`matchedBy "${by}" ≠ "${e.matchedBy}"`);
  }
  if (
    e.matchedTrusteeAppointment !== undefined &&
    a.checks?.matchedTrusteeAppointment !== e.matchedTrusteeAppointment
  ) {
    problems.push(
      `matchedTrusteeAppointment ${a.checks?.matchedTrusteeAppointment} ≠ ${e.matchedTrusteeAppointment}`,
    );
  }
  if (e.chapter !== undefined && a.chapter !== e.chapter)
    problems.push(`chapter ${a.chapter} ≠ ${e.chapter}`);
  if (e.closedDate !== undefined && day(a.closedDate) !== e.closedDate)
    problems.push(`closedDate ${day(a.closedDate)} ≠ ${e.closedDate}`);
  if (e.reopenedDate !== undefined && day(a.reopenedDate) !== e.reopenedDate)
    problems.push(`reopenedDate ${day(a.reopenedDate)} ≠ ${e.reopenedDate}`);
  return problems;
}

/** Order-insensitive exact-set comparison of actual vs expected appointments. */
function assertAppointments(
  r: Reporter,
  caseId: string,
  actual: AppointmentDoc[],
  expected: ExpectedAppointment[],
) {
  const label = `case ${caseId}`;
  if (actual.length !== expected.length) {
    r.fail(
      `${label}: expected ${expected.length} appointment(s), found ${actual.length} [${actual.map(describeAppointment).join('; ') || 'none'}]`,
    );
    return;
  }
  const remaining = [...actual];
  const unmatched: string[] = [];
  for (const e of expected) {
    const idx = remaining.findIndex((a) => matchesExpected(a, e).length === 0);
    if (idx >= 0) remaining.splice(idx, 1);
    else {
      const closest = remaining.map(
        (a) => `${describeAppointment(a)}: ${matchesExpected(a, e).join(', ')}`,
      );
      unmatched.push(
        `${e.trustee} ${e.assignedOn}${e.unassignedOn ? `→${e.unassignedOn}` : ''} (closest: ${closest.join(' | ') || 'none'})`,
      );
    }
  }
  if (unmatched.length > 0) r.fail(`${label}: no appointment matched ${unmatched.join('; ')}`);
  else
    r.pass(
      `${label}: ${expected.map((e) => `${e.trustee} ${e.assignedOn}${e.unassignedOn ? `→${e.unassignedOn}` : ''}`).join(', ') || 'no appointments'}`,
    );
}

async function assertExpect(
  r: Reporter,
  db: Db,
  expect: Expect,
  outcome: { events: number; dlq: number; notYetSynced: number },
  lane: Lane,
  seededUpdatedOn: Map<string, string>,
) {
  if (expect.sourceEvents !== undefined) {
    r.step('Then', `the source returns ${expect.sourceEvents} event(s)`);
    r.check(
      outcome.events === expect.sourceEvents,
      `${outcome.events} event(s)`,
      `source returned ${outcome.events}, expected ${expect.sourceEvents}`,
    );
  }
  if (expect.dlq !== undefined) {
    r.step('Then', `${expect.dlq} record(s) go to the dead-letter queue`);
    r.check(
      outcome.dlq === expect.dlq,
      `${outcome.dlq} in DLQ`,
      `DLQ has ${outcome.dlq}, expected ${expect.dlq}`,
    );
  }
  if (expect.notYetSynced !== undefined) {
    r.step('Then', `${expect.notYetSynced} event(s) are reported not yet synced`);
    r.check(
      outcome.notYetSynced === expect.notYetSynced,
      `${outcome.notYetSynced} not-yet-synced`,
      `${outcome.notYetSynced} not-yet-synced, expected ${expect.notYetSynced}`,
    );
  }
  for (const [caseId, expected] of Object.entries(expect.appointments ?? {})) {
    r.step(
      'Then',
      `case ${caseId} has ${expected.length === 0 ? 'no appointments' : `${expected.length} appointment(s)`}`,
    );
    const primary = (await db
      .collection('case-trustee-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', caseId })
      .toArray()) as unknown as AppointmentDoc[];
    const secondary = (await db
      .collection('trustee-case-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', caseId })
      .toArray()) as unknown as AppointmentDoc[];
    assertAppointments(r, caseId, primary, expected);
    const key = (a: AppointmentDoc) =>
      `${a.trusteeId}|${day(a.assignedOn)}|${day(a.unassignedOn) ?? ''}`;
    const a = primary.map(key).sort().join(',');
    const b = secondary.map(key).sort().join(',');
    r.check(
      a === b,
      `case ${caseId}: both partitions agree`,
      `case ${caseId}: partitions disagree [${a}] vs [${b}]`,
    );
    for (const doc of primary.filter((d) => !d.isSurrogate)) {
      r.check(
        typeof doc.checks?.matchedTrusteeAppointment === 'boolean',
        `case ${caseId}: checks.matchedTrusteeAppointment is a boolean`,
        `case ${caseId}: checks.matchedTrusteeAppointment is ${String(doc.checks?.matchedTrusteeAppointment)}, expected a boolean (defaults to false)`,
      );
    }
  }
  for (const caseId of expect.untouched ?? []) {
    r.step('And', `case ${caseId}'s existing appointment is untouched`);
    const docs = (await db
      .collection('case-trustee-appointments')
      .find({ caseId })
      .toArray()) as unknown as AppointmentDoc[];
    const changed = docs.filter((d) => d.updatedOn !== seededUpdatedOn.get(caseId));
    r.check(changed.length === 0, 'unchanged', `${changed.length} appointment(s) modified`);
  }
  for (const t of expect.tasks ?? []) {
    r.step(
      'Then',
      `${t.count} identity task(s) for "${t.last}"${t.source ? ` from ${t.source}` : ''}${t.reason ? ` (${t.reason})` : ''}`,
    );
    const tasks = await db
      .collection('trustee-match-verification')
      .find({
        $or: [
          { 'sourceTrustee.lastName': new RegExp(`^\\s*${t.last}\\s*$`) },
          { 'sourceTrustee.fullName': new RegExp(`\\b${t.last}\\b`) },
        ],
      })
      .toArray();
    if (tasks.length !== t.count) {
      r.fail(`found ${tasks.length} task(s), expected ${t.count}`);
      continue;
    }
    for (const task of tasks) {
      const problems: string[] = [];
      if (t.source && task.source !== t.source)
        problems.push(`source ${task.source} ≠ ${t.source}`);
      if (t.reason && task.mismatchReason !== t.reason)
        problems.push(`reason "${task.mismatchReason}" ≠ "${t.reason}"`);
      if (t.acmsProfessionalId && task.acmsProfessionalId !== t.acmsProfessionalId)
        problems.push(`acmsProfessionalId ${task.acmsProfessionalId} ≠ ${t.acmsProfessionalId}`);
      if (task.status !== 'pending') problems.push(`status ${task.status} ≠ pending`);
      r.check(
        problems.length === 0,
        `task ok (${task.source}, ${task.mismatchReason}, ${task.status})`,
        problems.join(', '),
      );
    }
    if (tasks.length === 0) r.pass('no task');
  }
  void lane;
}

// ---------------------------------------------------------------------------
// Scenario execution
// ---------------------------------------------------------------------------

function expectFor(pass: Pass, s: Scenario, lane: Lane): Expect {
  return lane === 'DXTR' && s.dxtrExpect ? { ...pass.expect, ...s.dxtrExpect } : pass.expect;
}

async function runScenarioLane(
  context: ApplicationContext,
  s: Scenario,
  lane: Lane,
): Promise<void> {
  const r = new Reporter('scenario', `${s.title} [${lane}]`);
  line(`\n  Scenario: ${s.title}   [${lane}] (${s.basis}${s.note ? `; ${s.note}` : ''})`);

  try {
    await wipeAll();
    const { client, db } = await getMongo();
    try {
      r.step(
        'Given',
        `${s.cases.length} case(s), ${s.cams?.trustees?.length ?? 0} CAMS trustee(s), ${s.cams?.links?.length ?? 0} professional-id link(s)`,
      );
      await seedCasesAndTrustees(db, s);
      const seededUpdatedOn = new Map<string, string>();
      for (const e of s.cams?.existing ?? [])
        seededUpdatedOn.set(e.caseId, '2026-01-01T00:00:00.000Z');

      const source = lane === 'ACMS' ? await getAcmsSource() : getDxtrSource();
      const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);

      const sqlPool = lane === 'ACMS' ? await acmsPool() : await dxtrPool();
      try {
        let firstPass = true;
        for (const [i, pass] of s.passes.entries()) {
          const region = pass.region ?? REGION;
          if (lane === 'ACMS') await renderAcms(sqlPool, s.cases, pass.rows, pass.changeDate);
          else await renderDxtr(sqlPool, s.cases, pass.rows, pass.changeDate);

          if (
            firstPass &&
            ((s.cams?.variations?.length ?? 0) > 0 || (s.cams?.pendingTasks?.length ?? 0) > 0)
          ) {
            const probe = await readEvents(context, source, lane, region, pass.changeDate);
            await seedEventDerivedState(db, s, probe, lane);
          }
          firstPass = false;

          r.step(
            'When',
            `${s.passes.length > 1 ? `pass ${i + 1}: ` : ''}the ${lane} source is read for region ${region} on ${pass.changeDate} and the sync runs (${pass.rows.length} source row(s))`,
          );
          const events = await readEvents(context, source, lane, region, pass.changeDate);
          const result = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, events);
          await assertExpect(
            r,
            db,
            expectFor(pass, s, lane),
            {
              events: events.length,
              dlq: result.dlqMessages.length,
              notYetSynced: result.notYetSyncedEvents.length,
            },
            lane,
            seededUpdatedOn,
          );
        }
      } finally {
        await sqlPool.close();
      }
    } finally {
      await client.close();
    }
    r.finish(r.failures === 0 ? 'pass' : 'fail');
  } catch (e) {
    if (e instanceof NotImplementedError) {
      line(`      ⊘ NOT IMPLEMENTED: ${e.message}`);
      r.finish('not-implemented');
    } else {
      r.fail(`error: ${(e as Error).message}`);
      r.finish('fail');
    }
  }
}

/** Layer 0: fixtures through the real production ACMS query, independent of the unbuilt source. */
async function runQueryGrounding(context: ApplicationContext, s: Scenario): Promise<void> {
  const passes = s.passes.filter((p) => p.expect.sourceEvents !== undefined);
  if (passes.length === 0 || !s.lanes.includes('ACMS')) return;
  const r = new Reporter('query', s.title);
  line(`\n  Query: ${s.title}`);
  try {
    await wipeAll();
    const pool = await acmsPool();
    try {
      const gateway = factory.getAcmsGateway(context);
      for (const pass of passes) {
        await renderAcms(pool, s.cases, pass.rows, pass.changeDate);
        r.step(
          'When',
          `getCmmapAppointmentsRaw(region ${pass.region ?? REGION}, change date ${pass.changeDate})`,
        );
        const rows = await gateway.getCmmapAppointmentsRaw(
          context,
          0,
          1000,
          null,
          pass.region ?? REGION,
          pass.changeDate,
        );
        r.step('Then', `${pass.expect.sourceEvents} row(s) are returned`);
        r.check(
          rows.length === pass.expect.sourceEvents,
          `${rows.length} row(s)`,
          `returned ${rows.length}, expected ${pass.expect.sourceEvents}`,
        );
      }
    } finally {
      await pool.close();
    }
    r.finish(r.failures === 0 ? 'pass' : 'fail');
  } catch (e) {
    r.fail(`error: ${(e as Error).message}`);
    r.finish('fail');
  }
}

async function readBookmark(db: Db, region: string): Promise<string | undefined> {
  const docs = await db
    .collection('runtime-state')
    .find({ documentType: /REGION/ })
    .toArray();
  for (const d of docs) {
    const v = (d.regions?.[region] ?? d.region?.[region])?.lastSyncDate as string | undefined;
    if (v) return v.slice(0, 10);
  }
  return undefined;
}

async function runDriverScenario(context: ApplicationContext, s: DriverScenario): Promise<void> {
  const r = new Reporter('driver', s.title);
  line(`\n  Scenario: ${s.title}   [driver] (${s.basis}${s.note ? `; ${s.note}` : ''})`);
  try {
    await wipeAll();
    const { client, db } = await getMongo();
    const pool = await acmsPool();
    try {
      r.step(
        'Given',
        `${s.rows.length} ACMS row(s) across change dates; bookmarks ${JSON.stringify(s.bookmarks ?? {})}`,
      );
      await seedCasesAndTrustees(db, s);
      await renderAcms(pool, s.cases, s.rows, s.runDate);
      for (const [region, date] of Object.entries(s.bookmarks ?? {})) {
        await db.collection('runtime-state').insertOne({
          id: randomUUID(),
          documentType: 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
          regions: { [region]: { lastSyncDate: date } },
        });
      }
      r.step('When', `the driver runs on ${s.runDate} for region(s) ${s.regions.join(', ')}`);
      await runRegionDriver(context, { regions: s.regions, runDate: s.runDate });
      for (const caseId of s.expect.written) {
        r.step('Then', `case ${caseId} has an appointment`);
        const n = await db.collection('case-trustee-appointments').countDocuments({ caseId });
        r.check(n > 0, 'written', 'nothing written');
      }
      for (const caseId of s.expect.notWritten) {
        r.step('Then', `case ${caseId} is untouched`);
        const n = await db.collection('case-trustee-appointments').countDocuments({ caseId });
        r.check(n === 0, 'untouched', `${n} appointment(s) written`);
      }
      for (const [region, expected] of Object.entries(s.expect.bookmarks)) {
        r.step('Then', `the bookmark for region ${region} is ${expected}`);
        const actual = await readBookmark(db, region);
        r.check(actual === expected, `bookmark ${actual}`, `bookmark is ${actual ?? 'unset'}`);
      }
    } finally {
      await pool.close();
      await client.close();
    }
    r.finish(r.failures === 0 ? 'pass' : 'fail');
  } catch (e) {
    if (e instanceof NotImplementedError) {
      line(`      ⊘ NOT IMPLEMENTED: ${e.message}`);
      r.finish('not-implemented');
    } else {
      r.fail(`error: ${(e as Error).message}`);
      r.finish('fail');
    }
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(3);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return { lane: get('--lane') as Lane | undefined, only: get('--only') };
}

async function run() {
  const { lane, only } = parseArgs();
  const context = await getContext();
  const selected = SCENARIOS.filter((s) => !only || s.key === only);

  line('\n=== Layer 0: fixtures through the production ACMS query (passes today) ===');
  if (!lane || lane === 'ACMS') for (const s of selected) await runQueryGrounding(context, s);

  line('\n=== Scenarios: source → sync → CAMS state ===');
  for (const s of selected) {
    for (const l of s.lanes) {
      if (lane && lane !== l) continue;
      if (s.pending) {
        line(`\n  Scenario: ${s.title}   [${l}] PENDING: ${s.pending}`);
        outcomes.push({ name: `${s.title} [${l}]`, group: 'scenario', status: 'pending' });
        continue;
      }
      await runScenarioLane(context, s, l);
    }
  }

  if (!only && (!lane || lane === 'ACMS')) {
    line('\n=== Region driver: bookmark and catch-up ===');
    for (const d of DRIVER_SCENARIOS) await runDriverScenario(context, d);
  }

  await wipeAll();
  summarize();
}

function summarize() {
  const count = (status: Outcome['status'], group?: string) =>
    outcomes.filter((o) => o.status === status && (!group || o.group === group)).length;
  line('\n=== Summary ===');
  for (const g of ['query', 'scenario', 'driver']) {
    const total = outcomes.filter((o) => o.group === g).length;
    if (total === 0) continue;
    line(
      `  ${g.padEnd(9)} ${count('pass', g)} passed, ${count('fail', g)} failed, ${count('not-implemented', g)} not implemented, ${count('pending', g)} pending (of ${total})`,
    );
  }
  line('\n  Not covered by this harness (see scenarios.ts PENDING_BEHAVIORS):');
  for (const p of PENDING_BEHAVIORS) line(`   - ${p.title}: ${p.reason}`);
  const bad = count('fail') + count('not-implemented');
  line(
    bad === 0
      ? '\n  All scenarios pass.'
      : `\n  ${bad} scenario(s) not passing. While CAMS-955 is being built this is expected; each one is a target.`,
  );
  process.exitCode = bad === 0 ? 0 : 1;
}

function list() {
  line('\nScenarios (key | lanes | basis | title):');
  for (const s of SCENARIOS)
    line(`  ${s.key.padEnd(40)} ${s.lanes.join('+').padEnd(10)} ${s.basis.padEnd(12)} ${s.title}`);
  line('\nDriver scenarios:');
  for (const d of DRIVER_SCENARIOS)
    line(`  ${d.key.padEnd(40)} ${'driver'.padEnd(10)} ${d.basis.padEnd(12)} ${d.title}`);
}

async function checkEnv() {
  const required = [
    'MONGO_CONNECTION_STRING',
    'COSMOS_DATABASE_NAME',
    'ACMS_MSSQL_HOST',
    'ACMS_MSSQL_PASS',
    'MSSQL_HOST',
    'MSSQL_PASS',
  ];
  let ok = true;
  for (const name of required) {
    const present = Boolean(process.env[name]);
    ok = ok && present;
    line(`  ${present ? '✓' : '✗'} ${name}`);
  }
  if (!ok) process.exitCode = 1;
}

function help() {
  const header = fs.readFileSync(__filename, 'utf-8').split('*/')[0];
  line(header.replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
}

async function main() {
  const command = process.argv[2] ?? 'help';
  switch (command) {
    case 'check-env':
      return checkEnv();
    case 'seed-schema':
      return seedSchema();
    case 'run':
      return run();
    case 'list':
      return list();
    case 'clean':
      await wipeAll();
      return line('Wiped fixture data.');
    default:
      return help();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 100));
