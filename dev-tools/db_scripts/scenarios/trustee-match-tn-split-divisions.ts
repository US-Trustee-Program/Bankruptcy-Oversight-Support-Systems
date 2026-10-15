/**
 * Scenario: trustee-match-tn-split-divisions
 * Database: dxtr + cams
 *
 * Seeds the inputs for a live run of sync-trustee-case-appointments that should produce an
 * IMPERFECT_MATCH for each Eastern District of Tennessee (court 0649) division pair split by
 * CAMS-936:
 *
 *   Case (CS_DIV / ustDivisionCode) | Trustee appointed only in | Shared CS_DIV_ACMS
 *   --------------------------------|---------------------------|-------------------
 *   Winchester   (494)              | Chattanooga (491)         | 491
 *   Johnson City (495)              | Greeneville (492)         | 492
 *
 * Before CAMS-936, matching compared the shared CS_DIV_ACMS code, so each pair auto-linked as a
 * perfect match. Now it compares the SYNCED_CASE's ustDivisionCode against the appointment's
 * divisionCodes, so each case should get a pending IMPERFECT_MATCH verification whose single
 * candidate scores districtDivisionScore 50 (same court, other division) and chapterScore 0.
 * Name, address, phone and email are identical on both sides.
 *
 * Seeds, per pair:
 *   - DXTR: a SEED case (AO_CS + debtor AO_PY via ensureDxtrCase), a trustee party (AO_PY
 *     PY_ROLE='tr'), and a trustee-appointed transaction (AO_TX TX_TYPE='A', TX_CODE='TR')
 *     dated at seed time - the event sync-trustee-case-appointments reads.
 *   - Cosmos: the SYNCED_CASE (with ustDivisionCode), and a CAMS trustee with the same name and
 *     contact as the DXTR party, holding one active chapter 7 appointment in the sibling
 *     division only.
 *
 * To exercise it:
 *   1. npm run seed:local -- --scenario=trustee-match-tn-split-divisions
 *   2. Start sync-trustee-case-appointments. The AO_TX rows are dated at seed time, so the stored
 *      sync state picks them up; otherwise pass a lastSyncDate just before the seed time.
 *   3. Expect two pending trustee-match-verification documents, mismatchReason IMPERFECT_MATCH.
 *
 * AO_TX rows are insert-only, keyed on case + transaction type: re-seeding does not re-date
 * them, so a second sync run won't see them again. Unseed (which deletes SEED AO_TX rows) and
 * re-seed to repeat the run.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';
import { createDebtor, createTrusteeBase } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const COURT_ID = '0649';
const GROUP_DESIGNATOR = 'CN';
const COURT_NAME = 'U.S. Bankruptcy Court Eastern District of Tennessee';
const REGION_ID = '08';
const REGION_NAME = 'ATLANTA';
const CHAPTER = '7';

// Values used by the existing hand-inserted TR rows in the shared DXTR copy. The sync query
// reads neither column.
const DE_SEQNO = 999;
const JOB_ID = 7250000;

type SplitPair = {
  caseDivision: { code: string; name: string; officeCode: string };
  trusteeDivision: { code: string; name: string };
  acmsDivisionCode: string;
  caseInfo: { caseId: string; caseNumber: string; csCaseId: string };
  debtor: { name: string; address1: string; city: string; zip: string; ssn: string };
  trustee: {
    id: string;
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    zipCode: string;
    phone: string;
    email: string;
  };
  dateFiled: string;
};

const PAIRS: SplitPair[] = [
  {
    caseDivision: { code: '494', name: 'Winchester', officeCode: '4' },
    trusteeDivision: { code: '491', name: 'Chattanooga' },
    acmsDivisionCode: '491',
    caseInfo: { caseId: '491-26-99604', caseNumber: '26-99604', csCaseId: 'SEED99604' },
    debtor: {
      name: 'SEED Winchester Split Debtor',
      address1: '4 Winchester Way',
      city: 'Winchester',
      zip: '37398',
      ssn: '***-**-4944',
    },
    trustee: {
      id: 'seed-trustee-tn-split-chattanooga',
      firstName: 'Winnie',
      lastName: 'Winsplit',
      address1: '491 Market St',
      city: 'Chattanooga',
      zipCode: '37402',
      phone: '423-555-0491',
      email: 'winnie.winsplit@example.com',
    },
    dateFiled: '2026-02-02',
  },
  {
    caseDivision: { code: '495', name: 'Johnson City', officeCode: '5' },
    trusteeDivision: { code: '492', name: 'Greeneville' },
    acmsDivisionCode: '492',
    caseInfo: { caseId: '492-26-99605', caseNumber: '26-99605', csCaseId: 'SEED99605' },
    debtor: {
      name: 'SEED Johnson City Split Debtor',
      address1: '5 Johnson City Way',
      city: 'Johnson City',
      zip: '37601',
      ssn: '***-**-4955',
    },
    trustee: {
      id: 'seed-trustee-tn-split-greeneville',
      firstName: 'Jonah',
      lastName: 'Johnsplit',
      address1: '492 Main St',
      city: 'Greeneville',
      zipCode: '37743',
      phone: '423-555-0492',
      email: 'jonah.johnsplit@example.com',
    },
    dateFiled: '2026-02-03',
  },
];

/**
 * REC is fixed-width: the sync reads the appointment date (YYMMDD) at positions 24-29 and the
 * professional code at 17-21. The professional code is left blank, like the existing TR rows.
 */
function buildTrusteeAppointedRec(appointedOn: Date): string {
  const yymmdd = appointedOn.toISOString().slice(2, 10).replace(/-/g, '');
  return ' '.repeat(23) + yymmdd;
}

async function seedPair(
  ctx: SeedContext,
  pair: SplitPair,
  appointedOn: Date,
): Promise<{ operations: SeedOperation[]; documents: Record<string, Record<string, unknown>[]> }> {
  const { caseDivision, trusteeDivision, caseInfo, debtor, trustee } = pair;

  const dxtrCase = await ensureDxtrCase(ctx, {
    divisionCode: caseDivision.code, // bare CS_DIV; caseId keeps the shared ACMS prefix
    chapter: CHAPTER,
    debtorName: debtor.name,
    courtId: COURT_ID,
    groupDesignator: GROUP_DESIGNATOR,
    caseInfo,
  });

  const operations: SeedOperation[] = [
    ...dxtrCase.operations,
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: caseInfo.csCaseId,
          COURT_ID: COURT_ID,
          PY_ROLE: 'tr',
          PY_FIRST_NAME: trustee.firstName,
          PY_MIDDLE_NAME: null,
          PY_LAST_NAME: trustee.lastName,
          PY_ADDRESS1: trustee.address1,
          PY_CITY: trustee.city,
          PY_STATE: 'TN',
          PY_ZIP: trustee.zipCode,
          PY_COUNTRY: 'US',
          PY_PHONENO: trustee.phone,
          PY_E_MAIL: trustee.email,
        },
      ],
    },
    {
      db: 'dxtr',
      collectionOrTable: 'AO_TX',
      // TX_ID is an identity column, so the MERGE keys on the case + transaction type instead.
      primaryKey: ['CS_CASEID', 'COURT_ID', 'TX_TYPE', 'TX_CODE'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: caseInfo.csCaseId,
          COURT_ID: COURT_ID,
          DE_SEQNO,
          CASE_ID: caseInfo.caseNumber,
          JOB_ID,
          TX_TYPE: 'A',
          TX_CODE: 'TR',
          TX_DATE: appointedOn,
          REC: buildTrusteeAppointedRec(appointedOn),
        },
      ],
    },
  ];

  const syncedCase = {
    id: caseInfo.caseId,
    documentType: 'SYNCED_CASE',
    dxtrId: caseInfo.csCaseId,
    caseId: caseInfo.caseId,
    caseNumber: caseInfo.caseNumber,
    chapter: CHAPTER,
    caseTitle: debtor.name,
    dateFiled: pair.dateFiled,
    officeName: caseDivision.name,
    officeCode: caseDivision.officeCode,
    courtId: COURT_ID,
    courtName: COURT_NAME,
    courtDivisionCode: pair.acmsDivisionCode,
    ustDivisionCode: caseDivision.code,
    courtDivisionName: caseDivision.name,
    groupDesignator: GROUP_DESIGNATOR,
    regionId: REGION_ID,
    regionName: REGION_NAME,
    consolidation: [],
    debtor: createDebtor(debtor.name, {
      address1: debtor.address1,
      city: debtor.city,
      state: 'TN',
      zip: debtor.zip,
      ssn: debtor.ssn,
    }),
    updatedOn: `${pair.dateFiled}T10:00:00.000Z`,
    updatedBy: SEEDER,
  };

  const camsTrustee = {
    ...createTrusteeBase({
      id: trustee.id,
      firstName: trustee.firstName,
      lastName: trustee.lastName,
      status: 'active',
      address1: trustee.address1,
      city: trustee.city,
      state: 'TN',
      zipCode: trustee.zipCode,
      phone: trustee.phone,
      email: trustee.email,
    }),
    updatedOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };

  const siblingDivisionAppointment = {
    id: `${trustee.id}-appt`,
    documentType: 'TRUSTEE_APPOINTMENT',
    trusteeId: trustee.id,
    chapter: CHAPTER,
    appointmentType: 'panel',
    courtId: COURT_ID,
    // Only the sibling division - deliberately NOT caseDivision.code.
    divisionCodes: [trusteeDivision.code],
    appointedDate: '2026-01-01',
    status: 'active',
    effectiveDate: '2026-01-01',
    courtName: COURT_NAME,
    courtDivisionName: trusteeDivision.name,
    createdOn: '2026-01-01T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };

  return {
    operations,
    documents: {
      cases: [syncedCase],
      trustees: [camsTrustee],
      'trustee-appointments': [siblingDivisionAppointment],
    },
  };
}

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const appointedOn = new Date();
  const operations: SeedOperation[] = [];
  const documents: Record<string, Record<string, unknown>[]> = {
    cases: [],
    trustees: [],
    'trustee-appointments': [],
  };

  for (const pair of PAIRS) {
    const seeded = await seedPair(ctx, pair, appointedOn);
    operations.push(...seeded.operations);
    for (const [collection, docs] of Object.entries(seeded.documents)) {
      documents[collection].push(...docs);
    }
  }

  for (const [collection, data] of Object.entries(documents)) {
    operations.push({ db: 'cams', collectionOrTable: collection, data });
  }

  return operations;
}
