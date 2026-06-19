/**
 * Scenario: trustee-case-list
 * Database: dxtr + cams
 *
 * Seeds test data for the CAMS-593 Trustee Case List feature:
 *
 *   - "Paginated Trustee" (cams-593-paginated) — 60 CASE_APPOINTMENT docs
 *     across chapters 7, 11, and 13 with varied dateFiled dates (2020–2024).
 *     Cases at index 2 and 7 have a closedDate set (closed status).
 *     Used to test pagination (3 pages: 25/25/10) and status filtering.
 *
 *   - "Empty Trustee" (cams-593-empty) — no active CASE_APPOINTMENT docs.
 *     Used to test the empty state ("No case appointments found.").
 *
 * Each case is seeded in both DXTR (AO_CS + AO_PY) and Cosmos (SYNCED_CASE)
 * so case detail links from the trustee case list render completely.
 *
 * NOTE: unassignedOn is set to null (not omitted) to match the repo query pattern.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';
import { createDebtor, createTrusteeBase } from '../lib/test-data-utils.js';

const PAGINATED_TRUSTEE_ID = 'cams-593-paginated';
const EMPTY_TRUSTEE_ID = 'cams-593-empty';
const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const DIVISION_CODE = '091';
const COURT_ID = '0209';
const NOW = '2026-01-01T00:00:00.000Z';

const CHAPTERS = ['7', '7', '7', '11', '13'] as const;

const DEBTOR_FIRST_NAMES = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Elena',
  'Frank',
  'Grace',
  'Henry',
  'Iris',
  'James',
  'Karen',
  'Louis',
  'Maria',
  'Nathan',
  'Olivia',
  'Paul',
  'Quinn',
  'Rachel',
  'Samuel',
  'Tara',
  'Uma',
  'Victor',
  'Wendy',
  'Xavier',
  'Yolanda',
  'Zachary',
  'Anna',
  'Brian',
  'Claire',
  'Derek',
];

const DEBTOR_LAST_NAMES = [
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Wilson',
  'Anderson',
  'Taylor',
  'Thomas',
  'Jackson',
  'White',
  'Harris',
  'Martin',
  'Thompson',
  'Young',
  'Robinson',
  'Lewis',
  'Walker',
  'Hall',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Green',
  'Adams',
  'Baker',
  'Nelson',
  'Carter',
];

const STREETS = [
  '123 Main St',
  '456 Oak Ave',
  '789 Elm Blvd',
  '321 Pine Rd',
  '654 Maple Dr',
  '987 Cedar Ln',
  '147 Birch Way',
  '258 Walnut Ct',
  '369 Spruce Pl',
  '741 Ash St',
];

function makeDebtorName(index: number): string {
  const chapter = CHAPTERS[index % CHAPTERS.length];
  if (chapter === '11') {
    return `${DEBTOR_LAST_NAMES[index % DEBTOR_LAST_NAMES.length]} Industries LLC`;
  }
  return `${DEBTOR_LAST_NAMES[index % DEBTOR_LAST_NAMES.length]}, ${DEBTOR_FIRST_NAMES[index % DEBTOR_FIRST_NAMES.length]}`;
}

function makeDateFiled(index: number): string {
  const year = 2020 + Math.floor(index / 12);
  const month = String((index % 12) + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function makeAppointedDate(index: number): string {
  const year = 2020 + Math.floor(index / 12);
  const month = String((index % 12) + 1).padStart(2, '0');
  return `${year}-${month}-15`;
}

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const operations: SeedOperation[] = [];

  // ── Trustees ────────────────────────────────────────────────────────────────
  operations.push({
    db: 'cams',
    collectionOrTable: 'trustees',
    data: [
      {
        ...createTrusteeBase({
          id: PAGINATED_TRUSTEE_ID,
          firstName: 'Paginated',
          lastName: 'Trustee',
          status: 'active',
          address1: '100 Pagination Ave',
          city: 'Buffalo',
          state: 'NY',
          zipCode: '14202',
          phone: '716-555-0100',
          email: 'paginated.trustee@example.com',
        }),
        updatedOn: NOW,
        updatedBy: SEEDER,
      },
      {
        ...createTrusteeBase({
          id: EMPTY_TRUSTEE_ID,
          firstName: 'Empty',
          lastName: 'Trustee',
          status: 'active',
          address1: '200 Empty St',
          city: 'Buffalo',
          state: 'NY',
          zipCode: '14202',
          phone: '716-555-0200',
          email: 'empty.trustee@example.com',
        }),
        updatedOn: NOW,
        updatedBy: SEEDER,
      },
    ],
  });

  // ── 60 cases: DXTR + Cosmos + appointments ──────────────────────────────────
  const CLOSED_INDICES = new Set([2, 7]);
  const syncedCases: Record<string, unknown>[] = [];
  const appointments: Record<string, unknown>[] = [];

  const caseResults = await Promise.all(
    Array.from({ length: 60 }, (_, i) =>
      ensureDxtrCase(ctx, {
        divisionCode: DIVISION_CODE,
        chapter: CHAPTERS[i % CHAPTERS.length],
        debtorName: makeDebtorName(i),
        courtId: COURT_ID,
        groupDesignator: 'BU',
      }).then((result) => ({ ...result, i })),
    ),
  );

  for (const { operations: dxtrOps, caseInfo, i } of caseResults) {
    const chapter = CHAPTERS[i % CHAPTERS.length];
    const debtorName = makeDebtorName(i);
    const dateFiled = makeDateFiled(i);
    const isCorporate = chapter === '11';
    const street = STREETS[i % STREETS.length];
    const { caseId, caseNumber, csCaseId } = caseInfo;

    operations.push(...dxtrOps);

    // Parse YYYY-MM-DD as UTC to avoid timezone-dependent date shifts
    const [year, month, day] = dateFiled.split('-').map(Number);
    const dateFiledUtc = new Date(Date.UTC(year, month - 1, day));

    // AO_DE: 3 docket entries per case so the docket tab renders
    operations.push({
      db: 'dxtr',
      collectionOrTable: 'AO_DE',
      primaryKey: ['CS_CASEID', 'COURT_ID', 'DE_SEQNO'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: csCaseId,
          COURT_ID: COURT_ID,
          DE_SEQNO: 1,
          DE_DOCUMENT_NUM: 1,
          DE_DATE_FILED: dateFiledUtc,
          DO_SUMMARY_TEXT: 'Voluntary Petition for Individuals Filing for Bankruptcy',
          DT_TEXT: 'Petition filed by debtor.',
        },
        {
          CS_CASEID: csCaseId,
          COURT_ID: COURT_ID,
          DE_SEQNO: 2,
          DE_DOCUMENT_NUM: 2,
          DE_DATE_FILED: dateFiledUtc,
          DO_SUMMARY_TEXT: 'Notice of Commencement of Case',
          DT_TEXT: 'Notice issued to all creditors.',
        },
        {
          CS_CASEID: csCaseId,
          COURT_ID: COURT_ID,
          DE_SEQNO: 3,
          DE_DOCUMENT_NUM: null,
          DE_DATE_FILED: dateFiledUtc,
          DO_SUMMARY_TEXT: 'Meeting of Creditors Scheduled',
          DT_TEXT: '341 meeting scheduled.',
        },
      ],
    });

    const closedDate = CLOSED_INDICES.has(i) ? `${makeDateFiled(i).slice(0, 4)}-12-31` : undefined;

    syncedCases.push({
      id: caseId,
      documentType: 'SYNCED_CASE',
      dxtrId: csCaseId,
      caseId,
      caseNumber,
      chapter,
      caseTitle: debtorName,
      dateFiled,
      ...(closedDate ? { closedDate } : {}),
      petitionLabel: 'Original petition',
      debtorTypeCode: isCorporate ? 'CB' : 'IC',
      debtorTypeLabel: isCorporate ? 'Corporate Business' : 'Individual Consumer',
      officeName: 'Buffalo',
      officeCode: 'USTP_CAMS_Region_2_Office_091',
      courtId: COURT_ID,
      courtName: 'U.S. Bankruptcy Court Western District of New York',
      courtDivisionCode: DIVISION_CODE,
      courtDivisionName: 'Buffalo',
      groupDesignator: 'BU',
      regionId: '02',
      regionName: 'NEW YORK',
      consolidation: [],
      debtor: createDebtor(debtorName, {
        address1: street,
        city: 'Buffalo',
        state: 'NY',
        zip: '14202',
        ...(isCorporate
          ? { taxId: `${String(i + 10).padStart(2, '0')}-${String(i + 1000000).padStart(7, '0')}` }
          : { ssn: `***-**-${String((i * 7 + 1234) % 10000).padStart(4, '0')}` }),
      }),
      updatedOn: NOW,
      updatedBy: SEEDER,
    });

    appointments.push({
      id: `cams-593-appt-${String(i + 1).padStart(3, '0')}`,
      documentType: 'CASE_APPOINTMENT',
      caseId,
      trusteeId: PAGINATED_TRUSTEE_ID,
      assignedOn: `${dateFiled.slice(0, 7)}-15T00:00:00Z`,
      appointedDate: makeAppointedDate(i),
      unassignedOn: null,
      source: 'dxtr',
      createdOn: NOW,
      createdBy: SEEDER,
      updatedOn: NOW,
      updatedBy: SEEDER,
    });
  }

  operations.push({
    db: 'cams',
    collectionOrTable: 'cases',
    data: syncedCases,
  });

  operations.push({
    db: 'cams',
    collectionOrTable: 'trustee-appointments',
    data: appointments,
  });

  // TRUSTEE_APPOINTMENT so Paginated Trustee appears active in the trustee list.
  // (The 60 appointments above are CASE_APPOINTMENTs — a different document type.)
  operations.push({
    db: 'cams',
    collectionOrTable: 'trustee-appointments',
    data: [
      {
        id: 'cams-593-trustee-appt-paginated',
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: PAGINATED_TRUSTEE_ID,
        chapter: '7',
        appointmentType: 'panel',
        courtId: COURT_ID,
        divisionCode: DIVISION_CODE,
        divisionCodes: [DIVISION_CODE],
        appointedDate: '2020-01-01',
        status: 'active',
        effectiveDate: '2020-01-01',
        courtName: 'U.S. Bankruptcy Court Western District of New York',
        courtDivisionName: 'Buffalo',
        createdOn: '2020-01-01T00:00:00.000Z',
        createdBy: SEEDER,
        updatedOn: '2020-01-01T00:00:00.000Z',
        updatedBy: SEEDER,
      },
    ],
  });

  return operations;
}
