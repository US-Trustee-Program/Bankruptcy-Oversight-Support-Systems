/**
 * Scenario: dxtr-historical-trustees
 * Database: ACMS (SQL Server) and CAMS (Cosmos DB)
 *
 * Seeds complete test data for historical trustee appointment testing:
 * - Uses existing DXTR cases (091-99-86706, 091-99-87899, 091-99-99943, 091-99-97816, 091-99-98483)
 * - ACMS professional records and appointment history
 * - CAMS trustees and professional ID cross-references
 * - CAMS DXTR appointments (current trustees)
 *
 * Purpose: Support testing features that display trustee history, appointment
 * timelines, and trustee changes over a case's lifecycle.
 *
 * Coverage:
 * - 5 cases with varying trustee history patterns
 * - Single trustee throughout (stable)
 * - Multiple trustees over time (changes)
 * - Recent trustee change
 * - Long tenure trustee
 * - Complex history with 3+ trustees
 *
 * NOTE: Seeds ACMS and CAMS. After seeding, run ACMS migration to pull
 * ACMS appointments into CAMS alongside the existing DXTR appointments.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import sql from 'mssql';
import { generateSearchTokens } from '../lib/phonetic-tokens.js';
import { createDebtor } from '../lib/test-data-utils.js';

const ACMS_CONFIG = {
  user: process.env.ACMS_MSSQL_USER || process.env.MSSQL_USER!,
  password: process.env.ACMS_MSSQL_PASS || process.env.MSSQL_PASS!,
  server: process.env.ACMS_MSSQL_HOST || process.env.MSSQL_HOST!,
  database: process.env.ACMS_MSSQL_DATABASE!,
  options: {
    encrypt: (process.env.ACMS_MSSQL_ENCRYPT || process.env.MSSQL_ENCRYPT) === 'true',
    trustServerCertificate:
      (process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT || process.env.MSSQL_TRUST_UNSIGNED_CERT) ===
      'true',
  },
};

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

// Helper: Parse case ID
function parseCaseId(caseId: string): { courtId: string; caseYear: string; caseNumber: string } {
  const parts = caseId.split('-');
  return {
    courtId: parts[0],
    caseYear: parts[1],
    caseNumber: parts[2],
  };
}

// Helper: Seed ACMS professional
async function seedAcmsProfessional(
  pool: sql.ConnectionPool,
  groupDesignator: string,
  profCode: number,
  lastName: string,
  firstName: string,
): Promise<void> {
  // Check if exists
  const existing = await pool
    .request()
    .input('groupDesignator', sql.VarChar, groupDesignator)
    .input('profCode', sql.Int, profCode).query(`
      SELECT PROF_CODE
      FROM CMMPR
      WHERE GROUP_DESIGNATOR = @groupDesignator
        AND PROF_CODE = @profCode
    `);

  if (existing.recordset.length > 0) {
    return; // Already exists
  }

  await pool
    .request()
    .input('groupDesignator', sql.VarChar, groupDesignator)
    .input('profCode', sql.Int, profCode)
    .input('lastName', sql.VarChar, lastName)
    .input('firstName', sql.VarChar, firstName).query(`
      INSERT INTO CMMPR (
        GROUP_DESIGNATOR,
        PROF_CODE,
        PROF_LAST_NAME,
        PROF_FIRST_NAME,
        PROF_MI,
        DELETE_CODE
      ) VALUES (
        @groupDesignator,
        @profCode,
        @lastName,
        @firstName,
        '',
        ' '
      )
    `);

  console.log(
    `  Created ACMS professional: ${firstName} ${lastName} (${groupDesignator}-${profCode})`,
  );
}

// Helper: Seed ACMS appointment
async function seedAcmsAppointment(
  pool: sql.ConnectionPool,
  caseId: string,
  groupDesignator: string,
  profCode: number,
  assignDate: string,
  dispDate?: string,
): Promise<void> {
  const parsed = parseCaseId(caseId);

  // Get next sequence
  const seqResult = await pool.request().query(`
    SELECT ISNULL(MAX(RECORD_SEQ_NBR), 0) + 1 AS nextSeq
    FROM CMMAP
  `);

  const nextSeq = seqResult.recordset[0].nextSeq;

  // Convert dates to ACMS format (YYYYMMDD as integer)
  const toAcmsDate = (isoDate: string): number => parseInt(isoDate.replace(/-/g, ''));

  const assignDateInt = toAcmsDate(assignDate);
  const dispDateInt = dispDate ? toAcmsDate(dispDate) : 0;

  await pool
    .request()
    .input('seqNbr', sql.Int, nextSeq)
    .input('caseDiv', sql.Int, parseInt(parsed.courtId))
    .input('caseYear', sql.Int, parseInt(parsed.caseYear))
    .input('caseNumber', sql.Int, parseInt(parsed.caseNumber))
    .input('groupDesignator', sql.VarChar, groupDesignator)
    .input('profCode', sql.Int, profCode)
    .input('apptDate', sql.Int, assignDateInt)
    .input('dispDate', sql.Int, dispDateInt).query(`
      INSERT INTO CMMAP (
        RECORD_SEQ_NBR,
        CASE_DIV,
        CASE_YEAR,
        CASE_NUMBER,
        GROUP_DESIGNATOR,
        PROF_CODE,
        APPT_TYPE,
        APPT_DATE,
        DISP_DATE,
        DELETE_CODE
      ) VALUES (
        @seqNbr,
        @caseDiv,
        @caseYear,
        @caseNumber,
        @groupDesignator,
        @profCode,
        'T',
        @apptDate,
        @dispDate,
        ''
      )
    `);

  const status = dispDate ? 'PAST' : 'ACTIVE';
  console.log(`  Created ACMS appointment: ${groupDesignator}-${profCode} (${status})`);
}

// Helper: Create CAMS trustee
function createTrustee(opts: {
  id: string;
  firstName: string;
  lastName: string;
  zoomInfo?: {
    link: string;
    phone: string;
    meetingId: string;
    passcode: string;
    accountEmail?: string;
  };
}): Record<string, unknown> {
  const name = `${opts.firstName} ${opts.lastName}`;
  const now = new Date().toISOString();

  const trusteeData: Record<string, unknown> = {
    _id: opts.id,
    id: opts.id,
    trusteeId: opts.id,
    documentType: 'TRUSTEE',
    name,
    firstName: opts.firstName,
    lastName: opts.lastName,
    status: 'active',
    phoneticTokens: generateSearchTokens(name),
    public: {
      address: {
        address1: '123 Test St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '212-555-0100' },
      email: `${opts.firstName.toLowerCase()}.${opts.lastName.toLowerCase()}@example.com`,
    },
    createdOn: now,
    createdBy: SEEDER,
    updatedOn: now,
    updatedBy: SEEDER,
  };

  if (opts.zoomInfo) {
    trusteeData.zoomInfo = opts.zoomInfo;
  }

  return trusteeData;
}

// Helper: Create CAMS professional ID cross-reference
function createProfessionalIdXref(opts: {
  id: string;
  acmsProfessionalId: string;
  camsTrusteeId: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    _id: opts.id,
    id: opts.id,
    acmsProfessionalId: opts.acmsProfessionalId,
    camsTrusteeId: opts.camsTrusteeId,
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    createdOn: now,
    createdBy: SEEDER,
    updatedOn: now,
    updatedBy: SEEDER,
  };
}

// Helper: Create CAMS DXTR appointment (current trustee)
function createDxtrAppointment(opts: {
  id: string;
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  appointedDate: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    _id: opts.id,
    id: opts.id,
    caseId: opts.caseId,
    trusteeId: opts.trusteeId,
    assignedOn: opts.assignedOn,
    appointedDate: opts.appointedDate,
    unassignedOn: null,
    documentType: 'CASE_APPOINTMENT',
    source: 'dxtr',
    createdOn: now,
    createdBy: SEEDER,
    updatedOn: now,
    updatedBy: SEEDER,
  };
}

// Helper: Create CAMS ACMS appointment (historical trustee)
function createAcmsAppointment(opts: {
  id: string;
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  appointedDate: string;
  unassignedOn?: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    _id: opts.id,
    id: opts.id,
    caseId: opts.caseId,
    trusteeId: opts.trusteeId,
    assignedOn: opts.assignedOn,
    appointedDate: opts.appointedDate,
    unassignedOn: opts.unassignedOn || null,
    documentType: 'CASE_APPOINTMENT',
    source: 'acms',
    createdOn: now,
    createdBy: SEEDER,
    updatedOn: now,
    updatedBy: SEEDER,
  };
}

// Helper: Create CAMS case document matching DXTR case
function createCase(opts: {
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  meeting341Info?: {
    date: string;
    time: string;
    location: string;
    additionalInfo?: string;
  };
}): Record<string, unknown> {
  const parsed = parseCaseId(opts.caseId);
  const now = new Date().toISOString();

  // Generate a unique SEED##### ID (5 digits) by hashing the case number
  const caseNumHash = parseInt(parsed.caseNumber) % 100000;
  const seedId = `SEED${String(caseNumHash).padStart(5, '0')}`;

  const caseData: Record<string, unknown> = {
    id: opts.caseId,
    documentType: 'SYNCED_CASE',
    dxtrId: seedId,
    caseId: opts.caseId,
    caseNumber: `${parsed.caseYear}-${parsed.caseNumber}`,
    chapter: opts.chapter,
    caseTitle: opts.caseTitle,
    dateFiled: opts.dateFiled,
    officeName: 'Buffalo',
    officeCode: 'USTP_CAMS_Region_2_Office_091',
    courtId: '0209',
    courtName: 'U.S. Bankruptcy Court Western District of New York',
    courtDivisionCode: parsed.courtId,
    courtDivisionName: 'Buffalo',
    groupDesignator: 'BU',
    regionId: '02',
    regionName: 'NEW YORK',
    consolidation: [],
    debtor: createDebtor(opts.caseTitle, {
      address1: '123 Test Street',
      city: 'Buffalo',
      state: 'NY',
      zip: '14202',
    }),
    updatedOn: now,
    updatedBy: SEEDER,
  };

  if (opts.meeting341Info) {
    caseData.meeting341Info = opts.meeting341Info;
  }

  return caseData;
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  console.log('\n=== Seeding ACMS/CAMS Historical Trustees ===\n');

  const acmsPool = new sql.ConnectionPool(ACMS_CONFIG);
  await acmsPool.connect();

  const camsCases: Record<string, unknown>[] = [];
  const camsTrustees: Record<string, unknown>[] = [];
  const camsProfessionalIds: Record<string, unknown>[] = [];
  const camsDxtrAppointments: Record<string, unknown>[] = [];
  const camsAcmsAppointments: Record<string, unknown>[] = [];

  try {
    // ── Case 1: Single Stable Trustee (no changes) ──────────────────────────
    console.log('Case 1: Single stable trustee (091-99-86706)');

    // Create case in CAMS
    camsCases.push(
      createCase({
        caseId: '091-99-86706',
        chapter: '11',
        caseTitle: 'Joan Jules Robel II',
        dateFiled: '2023-02-15',
        meeting341Info: {
          date: '2023-03-20',
          time: '10:00 AM',
          location: 'U.S. Bankruptcy Court, 300 Pearl Street, Suite 250, Buffalo, NY 14202',
          additionalInfo: 'Please bring photo ID and proof of social security number',
        },
      }),
    );

    // Create trustee in CAMS with 341 meeting (Zoom info) and state-only address
    camsTrustees.push(
      createTrustee({
        id: 'hist-trustee-stable',
        firstName: 'Stable',
        lastName: 'Trustee',
        zoomInfo: {
          link: 'https://zoom.us/j/1234567890',
          phone: '646-558-8656',
          meetingId: '123 4567 8900',
          passcode: 'trustee123',
          accountEmail: 'stable.trustee@example.com',
        },
      }),
    );

    // Create ACMS professional + cross-reference
    await seedAcmsProfessional(acmsPool, 'BU', 11111, 'Stable', 'Trustee');
    camsProfessionalIds.push(
      createProfessionalIdXref({
        id: 'prof-xref-stable',
        acmsProfessionalId: 'BU-11111',
        camsTrusteeId: 'hist-trustee-stable',
      }),
    );

    // Create current DXTR appointment
    camsDxtrAppointments.push(
      createDxtrAppointment({
        id: 'dxtr-appt-stable',
        caseId: '091-99-86706',
        trusteeId: 'hist-trustee-stable',
        assignedOn: '2020-01-15T00:00:00Z',
        appointedDate: '2020-01-15',
      }),
    );

    // Add older ACMS history (to ACMS database and CAMS)
    await seedAcmsAppointment(acmsPool, '091-99-86706', 'BU', 11111, '2019-01-01', '2019-12-31');
    camsAcmsAppointments.push(
      createAcmsAppointment({
        id: 'acms-appt-stable-1',
        caseId: '091-99-86706',
        trusteeId: 'hist-trustee-stable',
        assignedOn: '2019-01-01T00:00:00Z',
        appointedDate: '2019-01-01',
        unassignedOn: '2019-12-31T00:00:00Z',
      }),
    );

    // ── Case 2: Two Trustees (one change) ───────────────────────────────────
    console.log('\nCase 2: Two trustees (one change) (091-99-87899)');

    // Create case in CAMS
    camsCases.push(
      createCase({
        caseId: '091-99-87899',
        chapter: '11',
        caseTitle: 'Kassulke Group',
        dateFiled: '2023-02-15',
      }),
    );

    // Create trustees in CAMS (add 341 meeting Zoom info to Second trustee)
    camsTrustees.push(
      createTrustee({ id: 'hist-trustee-first', firstName: 'First', lastName: 'Trustee' }),
      createTrustee({
        id: 'hist-trustee-second',
        firstName: 'Second',
        lastName: 'Trustee',
        zoomInfo: {
          link: 'https://zoom.us/j/9876543210',
          phone: '646-558-8656',
          meetingId: '987 6543 2100',
          passcode: 'second456',
        },
      }),
    );

    // Create ACMS professionals + cross-references
    await seedAcmsProfessional(acmsPool, 'BU', 22221, 'First', 'Trustee');
    await seedAcmsProfessional(acmsPool, 'BU', 22222, 'Second', 'Trustee');
    camsProfessionalIds.push(
      createProfessionalIdXref({
        id: 'prof-xref-first',
        acmsProfessionalId: 'BU-22221',
        camsTrusteeId: 'hist-trustee-first',
      }),
      createProfessionalIdXref({
        id: 'prof-xref-second',
        acmsProfessionalId: 'BU-22222',
        camsTrusteeId: 'hist-trustee-second',
      }),
    );

    // Current trustee is Second
    camsDxtrAppointments.push(
      createDxtrAppointment({
        id: 'dxtr-appt-second',
        caseId: '091-99-87899',
        trusteeId: 'hist-trustee-second',
        assignedOn: '2023-07-01T00:00:00Z',
        appointedDate: '2023-07-01',
      }),
    );

    // Add ACMS history for both trustees (to ACMS database and CAMS)
    await seedAcmsAppointment(acmsPool, '091-99-87899', 'BU', 22221, '2020-06-01', '2021-02-28');
    await seedAcmsAppointment(acmsPool, '091-99-87899', 'BU', 22221, '2021-03-01', '2023-06-30');
    await seedAcmsAppointment(acmsPool, '091-99-87899', 'BU', 22222, '2023-07-01');
    camsAcmsAppointments.push(
      createAcmsAppointment({
        id: 'acms-appt-first-1',
        caseId: '091-99-87899',
        trusteeId: 'hist-trustee-first',
        assignedOn: '2020-06-01T00:00:00Z',
        appointedDate: '2020-06-01',
        unassignedOn: '2021-02-28T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-first-2',
        caseId: '091-99-87899',
        trusteeId: 'hist-trustee-first',
        assignedOn: '2021-03-01T00:00:00Z',
        appointedDate: '2021-03-01',
        unassignedOn: '2023-06-30T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-second-1',
        caseId: '091-99-87899',
        trusteeId: 'hist-trustee-second',
        assignedOn: '2023-07-01T00:00:00Z',
        appointedDate: '2023-07-01',
        unassignedOn: undefined,
      }),
    );

    // ── Case 3: Recent Change (within last 6 months) ────────────────────────
    console.log('\nCase 3: Recent trustee change (091-99-99943)');

    // Create case in CAMS
    camsCases.push(
      createCase({
        caseId: '091-99-99943',
        chapter: '12',
        caseTitle: 'Randal Corey Jerde Jr.',
        dateFiled: '2023-02-15',
      }),
    );

    // Create trustees in CAMS
    camsTrustees.push(
      createTrustee({ id: 'hist-trustee-previous', firstName: 'Previous', lastName: 'Trustee' }),
      createTrustee({ id: 'hist-trustee-current', firstName: 'Current', lastName: 'Trustee' }),
    );

    // Create ACMS professionals + cross-references
    await seedAcmsProfessional(acmsPool, 'BU', 33331, 'Previous', 'Trustee');
    await seedAcmsProfessional(acmsPool, 'BU', 33332, 'Current', 'Trustee');
    camsProfessionalIds.push(
      createProfessionalIdXref({
        id: 'prof-xref-previous',
        acmsProfessionalId: 'BU-33331',
        camsTrusteeId: 'hist-trustee-previous',
      }),
      createProfessionalIdXref({
        id: 'prof-xref-current',
        acmsProfessionalId: 'BU-33332',
        camsTrusteeId: 'hist-trustee-current',
      }),
    );

    // Current trustee
    camsDxtrAppointments.push(
      createDxtrAppointment({
        id: 'dxtr-appt-current',
        caseId: '091-99-99943',
        trusteeId: 'hist-trustee-current',
        assignedOn: '2024-10-01T00:00:00Z',
        appointedDate: '2024-10-01',
      }),
    );

    // Add ACMS history (to ACMS database and CAMS)
    await seedAcmsAppointment(acmsPool, '091-99-99943', 'BU', 33331, '2024-01-10', '2024-09-30');
    await seedAcmsAppointment(acmsPool, '091-99-99943', 'BU', 33332, '2024-10-01');
    camsAcmsAppointments.push(
      createAcmsAppointment({
        id: 'acms-appt-previous-1',
        caseId: '091-99-99943',
        trusteeId: 'hist-trustee-previous',
        assignedOn: '2024-01-10T00:00:00Z',
        appointedDate: '2024-01-10',
        unassignedOn: '2024-09-30T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-current-1',
        caseId: '091-99-99943',
        trusteeId: 'hist-trustee-current',
        assignedOn: '2024-10-01T00:00:00Z',
        appointedDate: '2024-10-01',
        unassignedOn: undefined,
      }),
    );

    // ── Case 4: Long Tenure (5+ years, same trustee) ────────────────────────
    console.log('\nCase 4: Long tenure trustee (091-99-97816)');

    // Create case in CAMS
    camsCases.push(
      createCase({
        caseId: '091-99-97816',
        chapter: '12',
        caseTitle: 'Esther August Brown IV',
        dateFiled: '2023-02-15',
      }),
    );

    // Create trustee in CAMS
    camsTrustees.push(
      createTrustee({
        id: 'hist-trustee-longtenure',
        firstName: 'LongTenure',
        lastName: 'Trustee',
      }),
    );

    // Create ACMS professional + cross-reference
    await seedAcmsProfessional(acmsPool, 'BU', 44444, 'LongTenure', 'Trustee');
    camsProfessionalIds.push(
      createProfessionalIdXref({
        id: 'prof-xref-longtenure',
        acmsProfessionalId: 'BU-44444',
        camsTrusteeId: 'hist-trustee-longtenure',
      }),
    );

    // Current appointment
    camsDxtrAppointments.push(
      createDxtrAppointment({
        id: 'dxtr-appt-longtenure',
        caseId: '091-99-97816',
        trusteeId: 'hist-trustee-longtenure',
        assignedOn: '2019-05-01T00:00:00Z',
        appointedDate: '2019-05-01',
      }),
    );

    // Add extensive ACMS history (to ACMS database and CAMS)
    await seedAcmsAppointment(acmsPool, '091-99-97816', 'BU', 44444, '2017-01-01', '2017-12-31');
    await seedAcmsAppointment(acmsPool, '091-99-97816', 'BU', 44444, '2018-01-01', '2019-04-30');
    await seedAcmsAppointment(acmsPool, '091-99-97816', 'BU', 44444, '2019-05-01');
    camsAcmsAppointments.push(
      createAcmsAppointment({
        id: 'acms-appt-longtenure-1',
        caseId: '091-99-97816',
        trusteeId: 'hist-trustee-longtenure',
        assignedOn: '2017-01-01T00:00:00Z',
        appointedDate: '2017-01-01',
        unassignedOn: '2017-12-31T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-longtenure-2',
        caseId: '091-99-97816',
        trusteeId: 'hist-trustee-longtenure',
        assignedOn: '2018-01-01T00:00:00Z',
        appointedDate: '2018-01-01',
        unassignedOn: '2019-04-30T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-longtenure-3',
        caseId: '091-99-97816',
        trusteeId: 'hist-trustee-longtenure',
        assignedOn: '2019-05-01T00:00:00Z',
        appointedDate: '2019-05-01',
        unassignedOn: undefined,
      }),
    );

    // ── Case 5: Complex History (3+ trustees) ───────────────────────────────
    console.log('\nCase 5: Complex history with 3 trustees (091-99-98483)');

    // Create case in CAMS
    camsCases.push(
      createCase({
        caseId: '091-99-98483',
        chapter: '15',
        caseTitle: 'Raheem Shawn Davis Sr.',
        dateFiled: '2023-02-15',
      }),
    );

    // Create trustees in CAMS
    camsTrustees.push(
      createTrustee({ id: 'hist-trustee-original', firstName: 'Original', lastName: 'Trustee' }),
      createTrustee({ id: 'hist-trustee-interim', firstName: 'Interim', lastName: 'Trustee' }),
      createTrustee({ id: 'hist-trustee-final', firstName: 'Final', lastName: 'Trustee' }),
    );

    // Create ACMS professionals + cross-references
    await seedAcmsProfessional(acmsPool, 'BU', 55551, 'Original', 'Trustee');
    await seedAcmsProfessional(acmsPool, 'BU', 55552, 'Interim', 'Trustee');
    await seedAcmsProfessional(acmsPool, 'BU', 55553, 'Final', 'Trustee');
    camsProfessionalIds.push(
      createProfessionalIdXref({
        id: 'prof-xref-original',
        acmsProfessionalId: 'BU-55551',
        camsTrusteeId: 'hist-trustee-original',
      }),
      createProfessionalIdXref({
        id: 'prof-xref-interim',
        acmsProfessionalId: 'BU-55552',
        camsTrusteeId: 'hist-trustee-interim',
      }),
      createProfessionalIdXref({
        id: 'prof-xref-final',
        acmsProfessionalId: 'BU-55553',
        camsTrusteeId: 'hist-trustee-final',
      }),
    );

    // Current trustee
    camsDxtrAppointments.push(
      createDxtrAppointment({
        id: 'dxtr-appt-final',
        caseId: '091-99-98483',
        trusteeId: 'hist-trustee-final',
        assignedOn: '2023-04-01T00:00:00Z',
        appointedDate: '2023-04-01',
      }),
    );

    // Add ACMS history for all three trustees (to ACMS database and CAMS)
    await seedAcmsAppointment(acmsPool, '091-99-98483', 'BU', 55551, '2016-05-01', '2018-08-14');
    await seedAcmsAppointment(acmsPool, '091-99-98483', 'BU', 55551, '2018-08-15', '2020-12-31');
    await seedAcmsAppointment(acmsPool, '091-99-98483', 'BU', 55552, '2021-01-01', '2023-03-31');
    await seedAcmsAppointment(acmsPool, '091-99-98483', 'BU', 55553, '2023-04-01');
    camsAcmsAppointments.push(
      createAcmsAppointment({
        id: 'acms-appt-original-1',
        caseId: '091-99-98483',
        trusteeId: 'hist-trustee-original',
        assignedOn: '2016-05-01T00:00:00Z',
        appointedDate: '2016-05-01',
        unassignedOn: '2018-08-14T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-original-2',
        caseId: '091-99-98483',
        trusteeId: 'hist-trustee-original',
        assignedOn: '2018-08-15T00:00:00Z',
        appointedDate: '2018-08-15',
        unassignedOn: '2020-12-31T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-interim-1',
        caseId: '091-99-98483',
        trusteeId: 'hist-trustee-interim',
        assignedOn: '2021-01-01T00:00:00Z',
        appointedDate: '2021-01-01',
        unassignedOn: '2023-03-31T00:00:00Z',
      }),
      createAcmsAppointment({
        id: 'acms-appt-final-1',
        caseId: '091-99-98483',
        trusteeId: 'hist-trustee-final',
        assignedOn: '2023-04-01T00:00:00Z',
        appointedDate: '2023-04-01',
        unassignedOn: undefined,
      }),
    );

    console.log('\n✅ Seeding complete');
    console.log(
      `✅ Using 5 existing DXTR cases (091-99-86706, 091-99-87899, 091-99-99943, 091-99-97816, 091-99-98483)`,
    );
    console.log(`✅ Created ${camsCases.length} cases in CAMS`);
    console.log(`✅ Created ${camsTrustees.length} CAMS trustees`);
    console.log(`✅ Created ${camsProfessionalIds.length} professional ID cross-references`);
    console.log(`✅ Created ${camsDxtrAppointments.length} DXTR appointments (current)`);
    console.log(`✅ Created ${camsAcmsAppointments.length} ACMS appointments (historical)`);
    console.log('\nNext steps:');
    console.log('  1. Verify cases appear in CAMS UI with full trustee history');
  } finally {
    await acmsPool.close();
  }

  // TRUSTEE_APPOINTMENT records so Stable Trustee and Second Trustee appear active
  // in the trustee list (court 0209 / Buffalo matches their seeded cases).
  const camsTrusteeAppointments: Record<string, unknown>[] = [
    {
      id: 'hist-trustee-appt-stable',
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: 'hist-trustee-stable',
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '0209',
      divisionCodes: ['091'],
      appointedDate: '2019-01-01',
      status: 'active',
      effectiveDate: '2019-01-01',
      courtName: 'U.S. Bankruptcy Court Western District of New York',
      courtDivisionName: 'Buffalo',
      updatedOn: '2025-03-01T00:00:00.000Z',
      updatedBy: SEEDER,
    },
    {
      id: 'hist-trustee-appt-second',
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: 'hist-trustee-second',
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '0209',
      divisionCodes: ['091'],
      appointedDate: '2023-07-01',
      status: 'active',
      effectiveDate: '2023-07-01',
      courtName: 'U.S. Bankruptcy Court Western District of New York',
      courtDivisionName: 'Buffalo',
      updatedOn: '2025-03-01T00:00:00.000Z',
      updatedBy: SEEDER,
    },
  ];

  // Return CAMS operations
  return [
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: camsCases,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: camsTrustees,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-professional-ids',
      data: camsProfessionalIds,
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: [...camsDxtrAppointments, ...camsAcmsAppointments, ...camsTrusteeAppointments],
    },
  ];
}
