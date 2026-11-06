/**
 * sync-trustee-case-appointments integration harness.
 *
 * BDD-style scenarios (see scenarios.ts) rendered into real ACMS_INT and DXTR_INT SQL Edge databases
 * and a real MongoDB, then driven IN-PROCESS: source.getEventsForDate -> processAppointments, and
 * asserted against the CAMS state left in Mongo. No Azure Functions host, queues or mocks.
 *
 * Fixtures are segmented by region (three regions; region 02 has two divisions) because CAMS-955/956/957
 * all work per region: per-region bookmarks, per-region ACMS/DXTR source, per-region tasks.
 *
 * Groups of checks, each reported separately:
 *   query     ACMS fixtures run through the REAL getCmmapAppointmentsRaw. Passes today; keeps the
 *             fixtures and DDL honest against the production SQL.
 *   scenario  source -> sync -> CAMS state, per lane. Fails (NOT IMPLEMENTED) until the ACMS source
 *             exists; later fails on real behavior gaps. That is the point.
 *   driver    per-region bookmark/catch-up/source-routing flow. NOT IMPLEMENTED until the driver exists.
 *
 * Usage (from test/integration/):
 *   npm run sync-trustee-case-appointments -- <command> [options]
 *
 * Commands:
 *   check-env    Verify environment
 *   seed-schema  Create ACMS_INT and DXTR_INT, apply DDL, load office reference data
 *   run          Run every scenario; options: --lane ACMS|DXTR, --region 02, --only <key>, --verbose
 *   list         List scenarios with region, lanes and basis
 *   replay       Run real staging exports through the ACMS source and print AGGREGATE outcomes only:
 *                  replay --professional-ids <file> --trustees <file> [--region 02] [--limit 500]
 *                Exports are PII; pass paths into a checkout where they are gitignored (for example
 *                ../CAMS/test/integration/sync-acms-professional-ids-audit/fixtures). Never copy exports into this repo.
 *                Real rows are loaded into the LOCAL containers and wiped when the command ends; --verbose is
 *                ignored by replay so production log lines (which can carry names) stay hidden.
 *   check-env    Verify environment
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
import { generateSearchTokens } from '../../../../backend/lib/adapters/utils/phonetic-helper';
import factory from '../../../../backend/lib/factory';
import { ApplicationContext } from '../../../../backend/lib/adapters/types/basic';
import { TrusteeAppointmentSyncEvent } from '../../../../common/src/cams/dataflow-events';
import DateHelper from '../../../../common/src/date-helper';
import {
  SCENARIOS,
  DRIVER_SCENARIOS,
  PENDING_BEHAVIORS,
  DIVISIONS,
  REGION,
  Scenario,
  DriverScenario,
  Pass,
  Row,
  CaseSpec,
  CamsTrustee,
  CamsAppointment,
  Person,
  Lane,
  Expect,
  ExpectedAppointment,
  ExpectedTask,
  divisionOfCase,
  regionOfCase,
} from './scenarios';
import {
  NotImplementedError,
  getAcmsSource,
  getDxtrSource,
  runRegionDriver,
  seedRegionState,
  readRegionBookmark,
} from './bindings';

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
// loadEnv() runs from main() so that `list` and `help` work on a fresh checkout.

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const realLog = console.log.bind(console); // captured before the filter below
// The production logger prints each DEBUG/INFO/WARN record as a one-element array. Hide those so
// scenario output stays readable; ERROR records and --verbose still show everything.
if (!process.argv.includes('--verbose') || process.argv[2] === 'replay') {
  for (const method of ['log', 'debug', 'info', 'warn'] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const first = args[0];
      if (
        Array.isArray(first) &&
        typeof first[0] === 'string' &&
        /^\[(DEBUG|INFO|WARN)\]/.test(first[0])
      ) {
        return;
      }
      original(...args);
    };
  }
}

function line(msg: string) {
  realLog(msg);
}

type Status = 'pass' | 'fail' | 'not-implemented';
type Outcome = { name: string; group: string; status: Status };
const outcomes: Outcome[] = [];

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
  finish(status: Status) {
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
    requestTimeout: 120000,
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
  // ignoreUndefined matches production (mongo-humble.ts): undefined members are omitted, not stored as null.
  const client = new MongoClient(uri, { ignoreUndefined: true, serverSelectionTimeoutMS: 5000 });
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
const upper = (s?: string): string => (s ?? '').toUpperCase();
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Full name as a CAMS trustee carries it: "First M Last, Jr.". */
function camsName(p: Person): string {
  const base = [p.first, p.middle, p.last].filter(Boolean).join(' ');
  return p.generation ? `${base}, ${p.generation}` : base;
}

function dxtrPhone(p: Person): string {
  const d = p.phone;
  if (!d) return '';
  switch (p.phoneStyle) {
    case 'parens':
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    case 'space':
      return `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`;
    default:
      return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
}
const camsPhone = (p: Person): string =>
  p.phone ? `${p.phone.slice(0, 3)}-${p.phone.slice(3, 6)}-${p.phone.slice(6)}` : '';

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

/** Does a source event's trustee match a scenario lookup key (a unique last name, any case)? */
function eventMatchesKey(e: TrusteeAppointmentSyncEvent, key: string): boolean {
  if (!key) return false;
  const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(key)}([^A-Za-z0-9]|$)`, 'i');
  return re.test(e.sourceTrustee.fullName ?? '') || re.test(e.sourceTrustee.lastName ?? '');
}

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
    await seedDxtrReference(dxtr, Object.values(DIVISIONS));
    line(
      `  ✓ DXTR schema applied and office reference data loaded (${Object.keys(DIVISIONS).length} divisions)`,
    );
  } finally {
    await dxtr.close();
  }
}

type GeoRow = {
  code: string;
  region: string;
  regionName: string;
  group: string;
  court: string;
  courtName: string;
  officeCode: string;
  officeName: string;
  state: string;
  /** AO_CS.CS_DIV when it differs from the ACMS division code (AO_CS_DIV.CS_DIV_ACMS). */
  dxtrDivision?: string;
};

/**
 * Office reference data from the scenario geography. The ACMS source resolves region -> groups and
 * divisions and court ids from this, exactly as production does.
 */
async function seedDxtrReference(pool: mssql.ConnectionPool, geo: GeoRow[]) {
  await pool
    .request()
    .batch(
      'DELETE FROM dbo.AO_CS_DIV; DELETE FROM dbo.AO_OFFICE; DELETE FROM dbo.AO_COURT; DELETE FROM dbo.AO_GRP_DES; DELETE FROM dbo.AO_REGION;',
    );
  const regions = new Map<string, string>();
  const groups = new Map<string, string>();
  const courts = new Map<string, string>();
  for (const g of geo) {
    regions.set(g.region, g.regionName);
    groups.set(g.group, g.region);
    courts.set(g.court, g.courtName);
  }
  const insert = async (sql: string, values: string[][]) => {
    for (const v of values) {
      const req = pool.request();
      v.forEach((val, i) => req.input(`p${i}`, mssql.VarChar, val));
      await req.query(sql);
    }
  };
  await insert(
    'INSERT INTO dbo.AO_REGION (REGION_ID, REGION_NAME) VALUES (@p0, @p1)',
    [...regions].map(([k, v]) => [k, v]),
  );
  await insert(
    'INSERT INTO dbo.AO_GRP_DES (GRP_DES, REGION_ID) VALUES (@p0, @p1)',
    [...groups].map(([k, v]) => [k, v]),
  );
  await insert(
    "INSERT INTO dbo.AO_COURT (COURT_ID, COURT_TITLE, COURT_NAME, DISTRICT_ALPHA) VALUES (@p0, 'United States Bankruptcy Court', @p1, 'XX')",
    [...courts].map(([k, v]) => [k, v]),
  );
  await insert(
    "INSERT INTO dbo.AO_OFFICE (COURT_ID, OFFICE_CODE, OFFICE_NAME, OFFICE_NAME_DISPLAY, CAMS) VALUES (@p0, @p1, @p2, @p2, 'Y')",
    geo.map((g) => [g.court, g.officeCode, g.officeName]),
  );
  await insert(
    'INSERT INTO dbo.AO_CS_DIV (CS_DIV, GRP_DES, COURT_ID, OFFICE_CODE, STATE, CS_DIV_ACMS) VALUES (@p0, @p1, @p2, @p3, @p4, @p5)',
    geo.map((g) => [g.dxtrDivision ?? g.code, g.group, g.court, g.officeCode, g.state, g.code]),
  );
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

async function wipeAcms(pool: mssql.ConnectionPool) {
  await pool
    .request()
    .batch(
      'DELETE FROM dbo.CMMKE; DELETE FROM dbo.CMMAP; DELETE FROM dbo.CMMDB; DELETE FROM dbo.CMMPR;',
    );
}
async function wipeDxtrCases(pool: mssql.ConnectionPool) {
  await pool
    .request()
    .batch('DELETE FROM dbo.AO_TX; DELETE FROM dbo.AO_PY; DELETE FROM dbo.AO_CS;');
}

async function wipeAll() {
  const acms = await acmsPool();
  try {
    await wipeAcms(acms);
  } finally {
    await acms.close();
  }
  const dxtr = await dxtrPool();
  try {
    await wipeDxtrCases(dxtr);
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
// Renderers: scenario -> source rows. ACMS text is upper-cased, as in real CMMPR (6,769 of 6,770).
// ---------------------------------------------------------------------------

function acmsLastName(p: Person): string {
  return upper(`${p.last}${p.generation ? `, ${p.generation}` : ''}${p.acmsLastSuffix ?? ''}`);
}

async function insertAcmsCase(pool: mssql.ConnectionPool, c: CaseSpec) {
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
    .input('closedUst', mssql.Numeric(8, 0), c.closedByUst ? toAcmsDate(c.closedByUst) : 0).query(`
      INSERT INTO dbo.CMMDB (CASE_DIV, CASE_YEAR, CASE_NUMBER, DELETE_CODE, CASE_FILED_DATE, CURR_CASE_CHAPT, CLOSED_BY_COURT_DATE, CLOSED_BY_UST_DATE)
      VALUES (@div, @yr, @num, @del, @filed, @chapt, @closed, @closedUst)`);
  if (c.reopenedOn) {
    await pool
      .request()
      .input('div', mssql.Numeric(3, 0), div)
      .input('yr', mssql.Numeric(2, 0), yr)
      .input('num', mssql.Numeric(5, 0), num)
      .input('grp', mssql.Char(2), divisionOfCase(c.caseId).group)
      .input('occ', mssql.Numeric(8, 0), toAcmsDate(c.reopenedOn)).query(`
        INSERT INTO dbo.CMMKE (CASE_DIV, CASE_YEAR, CASE_NUMBER, EVENT_CODE_TYPE, EVENT_CODE, GROUP_DESIGNATOR, ORIGINAL_OCC_DATE)
        VALUES (@div, @yr, @num, 'O', 'OCO', @grp, @occ)`);
  }
}

async function insertAcmsProfessional(
  pool: mssql.ConnectionPool,
  group: string,
  code: number,
  p: Person,
  deleted: boolean,
) {
  const zip = p.noCityStateZip ? 0 : Number(`${p.zip}${p.zipPlus4 ?? ''}`);
  await pool
    .request()
    .input('grp', mssql.Char(2), group)
    .input('code', mssql.Numeric(5, 0), code)
    .input('del', mssql.Char(1), deleted ? 'D' : ' ')
    .input('last', mssql.Char(30), acmsLastName(p))
    .input('first', mssql.Char(20), upper(p.first))
    .input('mi', mssql.Char(1), upper(p.middle?.slice(0, 1)))
    .input('addr1', mssql.Char(30), p.noAddress ? '' : upper(p.address1))
    .input('addr2', mssql.Char(30), p.noAddress ? '' : upper(p.address2))
    .input('city', mssql.Char(20), p.noCityStateZip ? '' : upper(p.city))
    .input('state', mssql.Char(2), p.noCityStateZip ? '' : upper(p.state))
    .input('zip', mssql.Numeric(9, 0), zip)
    .input('phone', mssql.Numeric(10, 0), p.phone ? Number(p.phone) : 0).query(`
      INSERT INTO dbo.CMMPR (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
        PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_COMMERCIAL_PHONE_NBR)
      VALUES (@grp, @code, @del, @last, @first, @mi, @addr1, @addr2, @city, @state, @zip, @phone)`);
}

async function renderAcms(
  pool: mssql.ConnectionPool,
  cases: CaseSpec[],
  rows: Row[],
  passChangeDate: string,
) {
  await wipeAcms(pool);
  for (const c of cases) await insertAcmsCase(pool, c);

  const seenProfessionals = new Set<string>();
  const seqByCase = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.prof.group}-${r.prof.code}`;
    if (!seenProfessionals.has(key)) {
      seenProfessionals.add(key);
      if (!r.prof.cmmprMissing)
        await insertAcmsProfessional(
          pool,
          r.prof.group,
          r.prof.code,
          r.prof.person,
          Boolean(r.prof.cmmprDeleted),
        );
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
      .input('region', mssql.Char(2), r.region ?? regionOfCase(r.caseId))
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
  await wipeDxtrCases(pool);
  let id = 999000000;
  const dxtrIdByCase = new Map<string, string>();
  for (const c of cases) {
    id += 1;
    const dxtrId = String(id);
    dxtrIdByCase.set(c.caseId, dxtrId);
    const { divisionCode, caseNumber } = parseCaseId(c.caseId);
    const division = divisionOfCase(c.caseId);
    await pool
      .request()
      .input('id', mssql.VarChar(9), dxtrId)
      .input('court', mssql.VarChar(4), division.court)
      .input('caseId', mssql.VarChar(10), caseNumber)
      .input('div', mssql.VarChar(3), division.dxtrDivision ?? divisionCode)
      .input('chapter', mssql.VarChar(3), c.chapter ?? '7')
      .input('grp', mssql.VarChar(2), division.group).query(`
        INSERT INTO dbo.AO_CS (CS_CASEID, COURT_ID, CASE_ID, CS_DIV, CS_CHAPTER, GRP_DES)
        VALUES (@id, @court, @caseId, @div, @chapter, @grp)`);
  }
  for (const r of rows) {
    const dxtrId = dxtrIdByCase.get(r.caseId)!;
    const court = divisionOfCase(r.caseId).court;
    const p = r.prof.person;
    const t = (s?: string) => (p.dxtrUpper ? upper(s) : (s ?? ''));
    const zip = p.dxtrZipPlus4 && p.zipPlus4 ? `${p.zip}-${p.zipPlus4}` : p.zip;
    await pool
      .request()
      .input('id', mssql.VarChar(9), dxtrId)
      .input('court', mssql.VarChar(4), court)
      .input('first', mssql.VarChar(30), t(p.first))
      .input('mid', mssql.VarChar(25), t(p.middle))
      .input('last', mssql.VarChar(200), t(p.last))
      .input('gen', mssql.VarChar(9), t(p.generation))
      .input('addr1', mssql.VarChar(60), t(p.address1))
      .input('addr2', mssql.VarChar(60), t(p.address2))
      .input('city', mssql.VarChar(30), t(p.city))
      .input('state', mssql.VarChar(2), t(p.state))
      .input('zip', mssql.VarChar(13), zip)
      .input('phone', mssql.VarChar(30), dxtrPhone(p))
      .input('email', mssql.VarChar(60), p.email ?? '').query(`
        INSERT INTO dbo.AO_PY (CS_CASEID, COURT_ID, PY_ROLE, PY_FIRST_NAME, PY_MIDDLE_NAME, PY_LAST_NAME, PY_GENERATION,
          PY_ADDRESS1, PY_ADDRESS2, PY_ADDRESS3, PY_CITY, PY_STATE, PY_ZIP, PY_COUNTRY, PY_PHONENO, PY_FAX_PHONE, PY_E_MAIL)
        VALUES (@id, @court, 'tr', @first, @mid, @last, @gen, @addr1, @addr2, '', @city, @state, @zip, 'USA', @phone, '', @email)`);
    const profCode = (r.dxtrProfCode ?? '     ').padEnd(5, ' ').slice(0, 5);
    await pool
      .request()
      .input('id', mssql.VarChar(9), dxtrId)
      .input('court', mssql.VarChar(4), court)
      .input('txDate', mssql.DateTime2, new Date(`${r.changeDate ?? passChangeDate}T00:00:00Z`))
      .input('rec', mssql.VarChar(237), ''.padEnd(237, ' ')).query(`
        INSERT INTO dbo.AO_TX (CS_CASEID, COURT_ID, TX_TYPE, TX_CODE, TX_DATE, REC)
        VALUES (@id, @court, 'A', 'TR', @txDate, STUFF(STUFF(@rec, 24, 6, '${toYymmdd(r.apptDate)}'), 17, 5, '${profCode}'))`);
  }
}

// ---------------------------------------------------------------------------
// Mongo seeding (the "Given" about CAMS state)
// ---------------------------------------------------------------------------

const SYSTEM = { id: 'SYSTEM', name: 'SYSTEM' };
const nowIso = () => new Date().toISOString();
const SEEDED_UPDATED_ON = '2026-01-01T00:00:00.000Z';

function appointmentsOf(t: CamsTrustee): CamsAppointment[] {
  if (t.appointments) return t.appointments;
  if (t.covers)
    return [{ court: DIVISIONS['081'].court, division: '081', chapter: '7', status: 'active' }];
  return [];
}

async function seedCasesAndTrustees(db: Db, s: { cases: CaseSpec[]; cams?: Scenario['cams'] }) {
  const now = nowIso();
  for (const c of s.cases) {
    const state = c.cams ?? 'synced';
    if (state === 'absent') continue;
    const division = divisionOfCase(c.caseId);
    await db.collection('cases').replaceOne(
      { documentType: 'SYNCED_CASE', caseId: c.caseId },
      {
        documentType: 'SYNCED_CASE',
        caseId: c.caseId,
        dxtrId: c.caseId,
        courtId: division.court,
        courtName: division.courtName,
        courtDivisionCode: division.code,
        courtDivisionName: division.officeName,
        officeCode: division.officeCode,
        officeName: division.officeName,
        groupDesignator: division.group,
        regionId: division.region,
        regionName: division.regionName,
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

  for (const t of s.cams?.trustees ?? []) await seedTrustee(db, t, now);

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
      createdOn: SEEDED_UPDATED_ON,
      createdBy: SYSTEM,
      updatedOn: SEEDED_UPDATED_ON,
      updatedBy: SYSTEM,
    };
    // Dual-written in production with ONE id (trustee-case-appointments.mongo.repository.ts upsert); the close
    // path replaces by documentType + id in both partitions, so the id must match or the close fails.
    await db.collection('case-trustee-appointments').insertOne({ ...doc });
    await db.collection('trustee-case-appointments').insertOne({ ...doc });
  }
}

async function seedTrustee(db: Db, t: CamsTrustee, now: string) {
  const p = t.person;
  const name = camsName(p);
  await db.collection('trustees').replaceOne(
    { documentType: 'TRUSTEE', trusteeId: t.id },
    {
      documentType: 'TRUSTEE',
      trusteeId: t.id,
      id: t.id,
      name,
      firstName: p.first,
      middleName: p.middle,
      lastName: p.last,
      status: 'active',
      // Real trustees all carry phoneticTokens (5,212 of 5,212) and a legacy block.
      phoneticTokens: generateSearchTokens(name),
      legacy: { truIds: [] },
      public: {
        address: {
          address1: p.address1,
          ...(p.address2 ? { address2: p.address2 } : {}),
          city: p.city,
          state: p.state,
          zipCode: p.zip,
          countryCode: 'US',
        },
        ...(t.companyName ? { companyName: t.companyName } : {}),
        ...(p.phone ? { phone: { number: camsPhone(p) } } : {}),
        ...(p.email ? { email: p.email } : {}),
      },
      updatedOn: now,
      updatedBy: SYSTEM,
    },
    { upsert: true },
  );
  for (const a of appointmentsOf(t)) {
    await db.collection('trustee-appointments').replaceOne(
      {
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: t.id,
        courtId: a.court,
        divisionCode: a.division,
        chapter: a.chapter,
        status: a.status ?? 'active',
      },
      {
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: t.id,
        chapter: a.chapter,
        appointmentType: 'panel',
        courtId: a.court,
        divisionCode: a.division,
        appointedDate: '2020-01-01',
        status: a.status ?? 'active',
        effectiveDate: '2020-01-01',
        createdOn: now,
        createdBy: SYSTEM,
        updatedOn: now,
        updatedBy: SYSTEM,
      },
      { upsert: true },
    );
  }
  const declared = appointmentsOf(t).length;
  const stored = await db
    .collection('trustee-appointments')
    .countDocuments({ documentType: 'TRUSTEE_APPOINTMENT', trusteeId: t.id });
  if (stored !== declared) {
    throw new Error(
      `Fixture error: trustee ${t.id} declares ${declared} appointment(s) but ${stored} were stored (duplicate court/division/chapter/status?)`,
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
  for (const v of s.cams?.variations ?? []) {
    const ev = events.find((e) => eventMatchesKey(e, v.last));
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
    const ev = events.find((e) => eventMatchesKey(e, t.last));
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
// Source read (the "When")
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
  for (let page = 0; page < 10000; page += 1) {
    const result = await source.getEventsForDate(context, region, readDate, lastId);
    events.push(...result.events);
    if (!result.lastId) return events;
    lastId = result.lastId;
  }
  throw new Error('Source paging did not terminate after 10000 pages');
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

const fmtExpected = (e: ExpectedAppointment) =>
  `${e.trustee} ${e.assignedOn}${e.unassignedOn ? `→${e.unassignedOn}` : ''}`;

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
      unmatched.push(`${fmtExpected(e)} (closest: ${closest.join(' | ') || 'none'})`);
    }
  }
  if (unmatched.length > 0) r.fail(`${label}: no appointment matched ${unmatched.join('; ')}`);
  else r.pass(`${label}: ${expected.map(fmtExpected).join(', ') || 'no appointments'}`);
}

async function assertTasks(r: Reporter, db: Db, tasks: ExpectedTask[], tasksTotal?: number) {
  const all = await db.collection('trustee-match-verification').find({}).toArray();
  if (tasksTotal !== undefined) {
    r.step('Then', `${tasksTotal} identity task(s) exist in total, under any name`);
    r.check(
      all.length === tasksTotal,
      `${all.length} task(s) in total`,
      `found ${all.length} task(s) in total, expected ${tasksTotal}`,
    );
  }
  for (const t of tasks) {
    if (!t.last.trim()) {
      throw new Error(
        'Fixture error: an expected task has an empty lookup key and would pass vacuously',
      );
    }
    r.step(
      'Then',
      `${t.count} identity task(s) for "${t.last}"${t.source ? ` from ${t.source}` : ''}${t.reason ? ` (${t.reason})` : ''}${t.court ? ` in court ${t.court}` : ''}`,
    );
    const matching = all.filter((task) =>
      eventMatchesKey({ sourceTrustee: task.sourceTrustee } as TrusteeAppointmentSyncEvent, t.last),
    );
    if (matching.length !== t.count) {
      r.fail(`found ${matching.length} task(s), expected ${t.count}`);
      continue;
    }
    for (const task of matching) {
      const problems: string[] = [];
      if (t.source && task.source !== t.source)
        problems.push(`source ${task.source} ≠ ${t.source}`);
      if (t.reason && task.mismatchReason !== t.reason)
        problems.push(`reason "${task.mismatchReason}" ≠ "${t.reason}"`);
      if (t.acmsProfessionalId && task.acmsProfessionalId !== t.acmsProfessionalId)
        problems.push(`acmsProfessionalId ${task.acmsProfessionalId} ≠ ${t.acmsProfessionalId}`);
      if (t.court && task.courtId !== t.court)
        problems.push(`courtId ${task.courtId} ≠ ${t.court}`);
      if (task.status !== 'pending') problems.push(`status ${task.status} ≠ pending`);
      r.check(
        problems.length === 0,
        `task ok (${task.source}, ${task.mismatchReason}, ${task.courtId}, ${task.status})`,
        problems.join(', '),
      );
    }
    if (matching.length === 0) r.pass('no task');
  }
}

async function assertExpect(
  r: Reporter,
  db: Db,
  expect: Expect,
  outcome: { events: number; dlq: number; notYetSynced: number },
) {
  // "Nothing written" is identical to "the source never returned the row" unless the read is asserted.
  const expectsNothing =
    expect.appointments !== undefined &&
    Object.keys(expect.appointments).length > 0 &&
    Object.values(expect.appointments).every((a) => a.length === 0);
  if (expectsNothing && expect.sourceEvents === undefined) {
    r.fail('Fixture error: this pass expects nothing written but declares no sourceEvents');
  }
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
  await assertUntouched(r, db, expect.untouched ?? []);
  await assertTasks(r, db, expect.tasks ?? [], expect.tasksTotal);
}

async function assertUntouched(r: Reporter, db: Db, caseIds: string[]) {
  for (const caseId of caseIds) {
    r.step('And', `case ${caseId}'s existing appointment is untouched`);
    const docs = (await db
      .collection('case-trustee-appointments')
      .find({ caseId })
      .toArray()) as unknown as AppointmentDoc[];
    const changed = docs.filter((d) => d.updatedOn !== SEEDED_UPDATED_ON);
    r.check(
      docs.length > 0 && changed.length === 0,
      'unchanged',
      docs.length === 0 ? 'appointment is gone' : `${changed.length} appointment(s) modified`,
    );
  }
}

// ---------------------------------------------------------------------------
// Scenario execution
// ---------------------------------------------------------------------------

function expectFor(pass: Pass, s: Scenario, lane: Lane): Expect {
  return lane === 'DXTR' && s.dxtrExpect ? { ...pass.expect, ...s.dxtrExpect } : pass.expect;
}

const regionOf = (s: Scenario, pass: Pass) => pass.region ?? s.region ?? REGION;

async function runScenarioLane(
  context: ApplicationContext,
  s: Scenario,
  lane: Lane,
): Promise<void> {
  const r = new Reporter('scenario', `${s.title} [${lane}]`);
  line(
    `\n  Scenario: ${s.title}   [${lane}, region ${s.region ?? REGION}] (${s.basis}${s.note ? `; ${s.note}` : ''})`,
  );

  try {
    await wipeAll();
    const { client, db } = await getMongo();
    try {
      r.step(
        'Given',
        `${s.cases.length} case(s), ${s.cams?.trustees?.length ?? 0} CAMS trustee(s), ${s.cams?.links?.length ?? 0} professional-id link(s)`,
      );
      await seedCasesAndTrustees(db, s);

      const source = lane === 'ACMS' ? await getAcmsSource() : getDxtrSource();
      const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);

      const sqlPool = lane === 'ACMS' ? await acmsPool() : await dxtrPool();
      try {
        let firstPass = true;
        for (const [i, pass] of s.passes.entries()) {
          const region = regionOf(s, pass);
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
          await assertExpect(r, db, expectFor(pass, s, lane), {
            events: events.length,
            dlq: result.dlqMessages.length,
            notYetSynced: result.notYetSyncedEvents.length,
          });
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
        const region = regionOf(s, pass);
        await renderAcms(pool, s.cases, pass.rows, pass.changeDate);
        r.step('When', `getCmmapAppointmentsRaw(region ${region}, change date ${pass.changeDate})`);
        const rows = await gateway.getCmmapAppointmentsRaw(
          context,
          0,
          1000,
          null,
          region,
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

async function runDriverScenario(context: ApplicationContext, s: DriverScenario): Promise<void> {
  const r = new Reporter('driver', s.title);
  line(`\n  Scenario: ${s.title}   [driver] (${s.basis}${s.note ? `; ${s.note}` : ''})`);
  try {
    await wipeAll();
    const { client, db } = await getMongo();
    const acms = await acmsPool();
    const dxtr = await dxtrPool();
    try {
      const acmsRows = s.rows.filter((x) => x.source === 'ACMS');
      const dxtrRows = s.rows.filter((x) => x.source === 'DXTR');
      r.step(
        'Given',
        `${acmsRows.length} ACMS and ${dxtrRows.length} DXTR row(s); bookmarks ${JSON.stringify(s.bookmarks ?? {})}; switched to DXTR: ${JSON.stringify(s.switchedToDxtr ?? [])}`,
      );
      await seedCasesAndTrustees(db, s);
      await renderAcms(acms, s.cases, acmsRows, s.runDate);
      await renderDxtr(dxtr, s.cases, dxtrRows, s.runDate);
      await seedRegionState(db, { bookmarks: s.bookmarks, switchedToDxtr: s.switchedToDxtr });

      r.step('When', `the driver runs on ${s.runDate} for region(s) ${s.regions.join(', ')}`);
      await runRegionDriver(context, { regions: s.regions, runDate: s.runDate });

      for (const [caseId, expected] of Object.entries(s.expect.written)) {
        r.step(
          'Then',
          `case ${caseId} (region ${regionOfCase(caseId)}) has ${expected.map(fmtExpected).join(', ')}`,
        );
        const docs = (await db
          .collection('case-trustee-appointments')
          .find({ documentType: 'CASE_APPOINTMENT', caseId })
          .toArray()) as unknown as AppointmentDoc[];
        assertAppointments(r, caseId, docs, expected);
      }
      for (const caseId of s.expect.notWritten) {
        r.step('Then', `case ${caseId} (region ${regionOfCase(caseId)}) is untouched`);
        const n = await db.collection('case-trustee-appointments').countDocuments({ caseId });
        r.check(n === 0, 'untouched', `${n} appointment(s) written`);
      }
      await assertUntouched(r, db, s.expect.kept ?? []);
      for (const [region, expected] of Object.entries(s.expect.bookmarks)) {
        r.step('Then', `the bookmark for region ${region} is ${expected}`);
        const actual = await readRegionBookmark(db, region);
        r.check(actual === expected, `bookmark ${actual}`, `bookmark is ${actual ?? 'unset'}`);
      }
      await assertTasks(r, db, s.expect.tasks ?? [], s.expect.tasksTotal);
    } finally {
      await acms.close();
      await dxtr.close();
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
// replay: real staging exports -> ACMS source -> AGGREGATE outcomes (no values printed)
// ---------------------------------------------------------------------------

type ExportDoc = Record<string, unknown>;

function loadExport(file: string): ExportDoc[] {
  const j = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const arr = Array.isArray(j) ? j : (Object.values(j).find(Array.isArray) as ExportDoc[]);
  return arr.map((d: ExportDoc) => {
    const { _id, ...rest } = d;
    void _id;
    return rest;
  });
}

function splitCityStateZip(s?: string): { city: string; state: string; zip: number } {
  const m = (s ?? '').match(/^(.*?)\s+([A-Z]{2})\s+(\d{5})(?:-?(\d{4}))?/);
  if (!m) return { city: '', state: '', zip: 0 };
  return { city: m[1], state: m[2], zip: Number(`${m[3]}${m[4] ?? ''}`) };
}

async function replay() {
  const get = (flag: string) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const idsFile = get('--professional-ids');
  const trusteesFile = get('--trustees');
  const region = get('--region') ?? REGION;
  const limit = Number(get('--limit') ?? 500);
  if (!idsFile || !trusteesFile) {
    line('replay needs --professional-ids <file> and --trustees <file> (see help).');
    process.exitCode = 1;
    return;
  }

  const context = await getContext();
  // The sync half needs the ACMS source; the seeding and the production-query check do not.
  const source = await getAcmsSource().catch((e) => {
    if (e instanceof NotImplementedError) return undefined;
    throw e;
  });
  if (!source) {
    line(
      '\n  ⊘ NOT IMPLEMENTED: the ACMS source does not exist yet; replay will seed and check the production query only.',
    );
  }

  const ids = loadExport(idsFile)
    .filter((d) => (d.evidence as { sourceRaw?: unknown } | undefined)?.sourceRaw)
    .slice(0, limit);
  const trustees = loadExport(trusteesFile);
  line(
    `\n  Loaded ${ids.length} professional-id record(s) and ${trustees.length} CAMS trustee(s) (limit ${limit}).`,
  );

  await wipeAll();
  const { client, db } = await getMongo();
  const acms = await acmsPool();
  const dxtr = await dxtrPool();
  try {
    // Geography: one synthetic division per distinct group, all in the requested region.
    const groups = [...new Set(ids.map((d) => String(d.acmsProfessionalId).split('-')[0]))];
    const geo: GeoRow[] = groups.map((group, i) => ({
      code: String(100 + i),
      region,
      regionName: `REPLAY REGION ${region}`,
      group,
      court: String(1000 + i),
      courtName: `Replay Court ${group}`,
      officeCode: '1',
      officeName: `Replay Office ${group}`,
      state: 'XX',
    }));
    await seedDxtrReference(dxtr, geo);
    const divisionOf = new Map(geo.map((g) => [g.group, g]));

    // CAMS trustees and the links the export already holds.
    if (trustees.length)
      await db.collection('trustees').insertMany(trustees.map((t) => ({ ...t })));
    const links = ids.filter((d) => d.disposition === 'linked');
    if (links.length)
      await db
        .collection('trustee-professional-ids')
        .insertMany(
          links.map((d) => ({ ...d, evidence: {} })) as unknown as Record<string, unknown>[],
        );

    // One synthetic case and CMMAP row per professional.
    let n = 0;
    const date = '2026-07-01';
    const changeDate = '2026-07-02';
    for (const d of ids) {
      const [group, codeStr] = String(d.acmsProfessionalId).split('-');
      const g = divisionOf.get(group)!;
      n += 1;
      const caseId = `${g.code}-26-${String(n).padStart(5, '0')}`;
      const raw = (d.evidence as { sourceRaw: Record<string, unknown> }).sourceRaw as {
        firstName?: string;
        middleName?: string;
        lastName?: string;
        legacy?: {
          address1?: string;
          address2?: string;
          cityStateZipCountry?: string;
          phone?: string;
        };
      };
      const csz = splitCityStateZip(raw.legacy?.cityStateZipCountry);
      await acms
        .request()
        .input('grp', mssql.Char(2), group)
        .input('code', mssql.Numeric(5, 0), Number(codeStr))
        .input('last', mssql.Char(30), raw.lastName ?? '')
        .input('first', mssql.Char(20), raw.firstName ?? '')
        .input('mi', mssql.Char(1), (raw.middleName ?? '').slice(0, 1))
        .input('a1', mssql.Char(30), raw.legacy?.address1 ?? '')
        .input('a2', mssql.Char(30), raw.legacy?.address2 ?? '')
        .input('city', mssql.Char(20), csz.city)
        .input('state', mssql.Char(2), csz.state)
        .input('zip', mssql.Numeric(9, 0), csz.zip)
        .input(
          'phone',
          mssql.Numeric(10, 0),
          Number((raw.legacy?.phone ?? '').replace(/\D/g, '')) || 0,
        ).query(`
          INSERT INTO dbo.CMMPR (GROUP_DESIGNATOR, UST_PROF_CODE, DELETE_CODE, PROF_LAST_NAME, PROF_FIRST_NAME, PROF_MI,
            PROF_ADDRESS1, PROF_ADDRESS2, PROF_CITY, PROF_STATE, PROF_ZIP, PROF_COMMERCIAL_PHONE_NBR)
          VALUES (@grp, @code, ' ', @last, @first, @mi, @a1, @a2, @city, @state, @zip, @phone)`);
      await insertAcmsCase(acms, { caseId });
      const { div, yr, num } = parseCaseId(caseId);
      await acms
        .request()
        .input('div', mssql.Numeric(3, 0), div)
        .input('yr', mssql.Numeric(2, 0), yr)
        .input('num', mssql.Numeric(5, 0), num)
        .input('grp', mssql.Char(2), group)
        .input('code', mssql.Numeric(5, 0), Number(codeStr))
        .input('appt', mssql.Numeric(11, 0), toAcmsDate(date))
        .input('region', mssql.Char(2), region)
        .input('cdb', mssql.Numeric(8, 0), toAcmsDate(changeDate)).query(`
          INSERT INTO dbo.CMMAP (RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER, GROUP_DESIGNATOR, PROF_CODE, APPT_TYPE,
            APPT_DATE, DISP_DATE, DELETE_CODE, REGION_CODE, CDB_UPDATE_DATE)
          VALUES (1, @div, @yr, @num, @grp, @code, 'TR', @appt, 0, ' ', @region, @cdb)`);
      await db.collection('cases').insertOne({
        documentType: 'SYNCED_CASE',
        caseId,
        dxtrId: caseId,
        courtId: g.court,
        courtDivisionCode: g.code,
        groupDesignator: group,
        regionId: region,
        chapter: '7',
        dateFiled: '2026-01-15',
        debtor: { name: 'Replay Debtor' },
        updatedOn: nowIso(),
        updatedBy: SYSTEM,
      });
    }

    line(`  Seeded ${n} professional(s) across ${groups.length} group(s) in region ${region}.`);

    // Real-shape check through the PRODUCTION ACMS query: seeded rows should come back.
    const gateway = factory.getAcmsGateway(context);
    let returned = 0;
    let lastId = 0;
    for (let page = 0; page < 10000; page += 1) {
      const rows = await gateway.getCmmapAppointmentsRaw(
        context,
        lastId,
        500,
        null,
        region,
        changeDate,
      );
      if (rows.length === 0) break;
      returned += rows.length;
      lastId = Math.max(...rows.map((r) => Number(r.id)));
    }
    line(
      `  Production query returned ${returned} of ${n} seeded row(s) (the rest are excluded by its filters, e.g. sentinel codes).`,
    );

    if (!source) {
      line('  Stopping before the sync: no ACMS source yet.');
      return;
    }
    line('  Running the sync...');
    const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);
    const events = await readEvents(context, source, 'ACMS', region, changeDate);
    const result = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, events);

    // Aggregates only.
    const appts = (await db
      .collection('case-trustee-appointments')
      .find({})
      .toArray()) as unknown as AppointmentDoc[];
    const tally = (xs: string[]) => {
      const m = new Map<string, number>();
      xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
      return [...m]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v}`)
        .join('  ');
    };
    const tasks = await db.collection('trustee-match-verification').find({}).toArray();
    line(`\n  Source returned ${events.length} event(s) for ${ids.length} professional(s).`);
    line(
      `  Appointments written: ${appts.length} (placeholders ${appts.filter((a) => a.isSurrogate).length})`,
    );
    line(
      `  matchedBy: ${tally(appts.filter((a) => !a.isSurrogate).map((a) => a.checks?.matchedBy ?? '<none>'))}`,
    );
    line(
      `  matchedTrusteeAppointment: ${tally(appts.filter((a) => !a.isSurrogate).map((a) => String(a.checks?.matchedTrusteeAppointment)))}`,
    );
    line(
      `  Identity tasks: ${tasks.length}  by reason: ${tally(tasks.map((t) => String(t.mismatchReason)))}  by source: ${tally(tasks.map((t) => String(t.source)))}`,
    );
    line(
      `  DLQ: ${result.dlqMessages.length}  not-yet-synced: ${result.notYetSyncedEvents.length}  retryable: ${result.retryableEvents.length}`,
    );
    line(`  Distribution: ${JSON.stringify(result.scenarioDistribution)}`);

    // Agreement with the export's own dispositions (what the professional-id sync decided).
    const byDisposition = new Map<
      string,
      { n: number; sameTrustee: number; placeholder: number }
    >();
    const trusteeByCase = new Map(
      appts.filter((a) => !a.isSurrogate).map((a) => [a.caseId, a.trusteeId]),
    );
    const placeholderCases = new Set(appts.filter((a) => a.isSurrogate).map((a) => a.caseId));
    let i = 0;
    for (const d of ids) {
      i += 1;
      const g = divisionOf.get(String(d.acmsProfessionalId).split('-')[0])!;
      const caseId = `${g.code}-26-${String(i).padStart(5, '0')}`;
      const k = String(d.disposition);
      const row = byDisposition.get(k) ?? { n: 0, sameTrustee: 0, placeholder: 0 };
      row.n += 1;
      if (trusteeByCase.get(caseId) === d.camsTrusteeId) row.sameTrustee += 1;
      if (placeholderCases.has(caseId)) row.placeholder += 1;
      byDisposition.set(k, row);
    }
    line('\n  Agreement with the export (professional-id disposition -> what the sync did):');
    for (const [k, v] of byDisposition) {
      line(
        `    ${k.padEnd(10)} n=${v.n}  resolved to the exported trustee: ${v.sameTrustee}  placeholder: ${v.placeholder}`,
      );
    }
  } finally {
    await acms.close();
    await dxtr.close();
    await client.close();
    // Replay geography is not the scenario geography; restore it for scenario runs.
    const d = await dxtrPool();
    try {
      await seedDxtrReference(d, Object.values(DIVISIONS));
    } finally {
      await d.close();
    }
    await wipeAll();
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
  return { lane: get('--lane') as Lane | undefined, only: get('--only'), region: get('--region') };
}

async function run() {
  const { lane, only, region } = parseArgs();
  if (!(await preflight())) return;
  const context = await getContext();
  const selected = SCENARIOS.filter(
    (s) =>
      (!only || s.key === only) &&
      (!region || (s.region ?? REGION) === region || s.passes.some((p) => p.region === region)),
  );

  line('\n=== Layer 0: fixtures through the production ACMS query (passes today) ===');
  if (!lane || lane === 'ACMS') for (const s of selected) await runQueryGrounding(context, s);

  line('\n=== Scenarios: source → sync → CAMS state ===');
  for (const s of selected) {
    for (const l of s.lanes) {
      if (lane && lane !== l) continue;

      await runScenarioLane(context, s, l);
    }
  }

  if (!only && (!lane || lane === 'ACMS')) {
    line('\n=== Region driver: bookmark, catch-up and source routing ===');
    for (const d of DRIVER_SCENARIOS) {
      if (region && !d.regions.includes(region)) continue;
      await runDriverScenario(context, d);
    }
  }

  await wipeAll();
  summarize();
}

/** Exit codes: 0 all pass, 1 failures (regressions or infrastructure), 2 only not-implemented targets, 3 infrastructure down. */
function summarize() {
  const count = (status: Status, group?: string) =>
    outcomes.filter((o) => o.status === status && (!group || o.group === group)).length;
  line('\n=== Summary ===');
  for (const g of ['query', 'scenario', 'driver']) {
    const total = outcomes.filter((o) => o.group === g).length;
    if (total === 0) continue;
    line(
      `  ${g.padEnd(9)} ${count('pass', g)} passed, ${count('fail', g)} failed, ${count('not-implemented', g)} not implemented (of ${total})`,
    );
  }
  line('\n  Not covered by this harness (see scenarios.ts PENDING_BEHAVIORS):');
  for (const p of PENDING_BEHAVIORS) line(`   - ${p.title}: ${p.reason}`);
  const failed = count('fail');
  const targets = count('not-implemented');
  if (failed > 0) {
    line(
      `\n  ${failed} FAILED (a regression, an unmet expectation, or infrastructure trouble) and ${targets} not implemented (targets).`,
    );
    process.exitCode = 1;
  } else if (targets > 0) {
    line(`\n  No failures. ${targets} not implemented (targets while CAMS-955 is being built).`);
    process.exitCode = 2;
  } else {
    line('\n  All scenarios pass.');
    process.exitCode = 0;
  }
}

/** Fail fast, with its own exit code, when a database is unreachable, instead of 94 identical failures. */
async function preflight(): Promise<boolean> {
  const problems: string[] = [];
  try {
    const { client, db } = await getMongo();
    await db.command({ ping: 1 });
    await client.close();
  } catch (e) {
    problems.push(`MongoDB: ${(e as Error).message}`);
  }
  for (const [label, connect] of [
    ['ACMS SQL', acmsPool],
    ['DXTR SQL', dxtrPool],
  ] as const) {
    try {
      const pool = await connect();
      await pool.request().query('SELECT 1');
      await pool.close();
    } catch (e) {
      problems.push(`${label}: ${(e as Error).message}`);
    }
  }
  if (problems.length > 0) {
    line(
      '\n  Infrastructure is not reachable (is start-services.sh running, and seed-schema done?):',
    );
    for (const problem of problems) line(`   - ${problem}`);
    process.exitCode = 3;
    return false;
  }
  return true;
}

function list() {
  line('\nScenarios (key | region | lanes | basis | title):');
  for (const s of SCENARIOS) {
    const regions = [
      ...new Set([s.region ?? REGION, ...s.passes.map((p) => p.region).filter(Boolean)]),
    ].join(',');
    line(
      `  ${s.key.padEnd(52)} ${regions.padEnd(8)} ${s.lanes.join('+').padEnd(10)} ${s.basis.padEnd(12)} ${s.title}`,
    );
  }
  line('\nDriver scenarios:');
  for (const d of DRIVER_SCENARIOS) {
    line(
      `  ${d.key.padEnd(52)} ${d.regions.join(',').padEnd(8)} ${'driver'.padEnd(10)} ${d.basis.padEnd(12)} ${d.title}`,
    );
  }
  const byRegion = new Map<string, number>();
  for (const s of SCENARIOS)
    byRegion.set(s.region ?? REGION, (byRegion.get(s.region ?? REGION) ?? 0) + 1);
  line(`\n  Scenarios by default region: ${[...byRegion].map(([k, v]) => `${k}:${v}`).join('  ')}`);
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

/**
 * Refuse to run anything destructive unless every target is local and the Mongo database name is
 * disposable. wipeAll() deletes every document in nine collections and every fixture table row, and
 * .env.local is often assembled from other checkouts' files, so a wrong host must never reach it.
 * The name rule copies the '-idxtest-' convention of ../_lib/ephemeral-cosmos-database.ts.
 */
function assertLocalTargets() {
  const problems: string[] = [];
  const isLocal = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '::1';

  const dbName = process.env.COSMOS_DATABASE_NAME ?? '';
  if (!dbName.includes('-idxtest-')) {
    problems.push(
      `COSMOS_DATABASE_NAME '${dbName}' must contain '-idxtest-' (disposable databases only)`,
    );
  }

  const uri = process.env.MONGO_CONNECTION_STRING ?? '';
  const match = uri.match(/^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/);
  if (!match || match[1]) {
    problems.push('MONGO_CONNECTION_STRING must be a plain mongodb:// URI to a local host');
  } else {
    for (const hostPort of match[2].split(',')) {
      const host = hostPort.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
      if (!isLocal(host)) problems.push(`MONGO_CONNECTION_STRING host '${host}' is not local`);
    }
  }
  for (const name of ['ACMS_MSSQL_HOST', 'MSSQL_HOST']) {
    const host = process.env[name] ?? '';
    if (!isLocal(host)) problems.push(`${name} '${host}' is not local`);
  }

  if (problems.length > 0) {
    console.error(
      '\nRefusing to run: this harness wipes its databases and only runs against local containers.',
    );
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(4);
  }
}

async function main() {
  const command = process.argv[2] ?? 'help';
  if (command !== 'list' && command !== 'help') loadEnv();
  if (['seed-schema', 'run', 'replay', 'clean'].includes(command)) assertLocalTargets();
  switch (command) {
    case 'check-env':
      return checkEnv();
    case 'seed-schema':
      return seedSchema();
    case 'run':
      return run();
    case 'list':
      return list();
    case 'replay':
      return replay();
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
