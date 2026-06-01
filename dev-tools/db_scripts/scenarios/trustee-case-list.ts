/**
 * Scenario: trustee-case-list
 * Database: cams only
 *
 * Seeds test data for the CAMS-593 Trustee Case List feature:
 *
 *   - "Paginated Trustee" (cams-593-paginated) — 60 active CASE_APPOINTMENT docs
 *     across chapters 7, 11, and 13 with varied dateFiled dates (2020–2024).
 *     Used to test pagination (3 pages: 25/25/10).
 *
 *   - "Empty Trustee" (cams-593-empty) — no active CASE_APPOINTMENT docs.
 *     Used to test the empty state ("No case appointments found.").
 *
 * NOTE: Seeds directly into Cosmos — no DXTR/ACMS dependency required.
 * unassignedOn is set to null (not omitted) to match the repo query pattern.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

const PAGINATED_TRUSTEE_ID = 'cams-593-paginated';
const EMPTY_TRUSTEE_ID = 'cams-593-empty';
const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const COURT_ID = '091';
const NOW = '2026-01-01T00:00:00.000Z';

const CHAPTERS = ['7', '7', '7', '11', '13'] as const;

function makeCaseId(index: number): string {
  const year = 20 + Math.floor(index / 12);
  const seq = String(index + 1).padStart(5, '0');
  return `${COURT_ID}-${year}-${seq}`;
}

function makeDateFiled(index: number): string {
  const year = 2020 + Math.floor(index / 12);
  const month = String((index % 12) + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function makeAssignedOn(index: number): string {
  return `${makeDateFiled(index).slice(0, 7)}-15T00:00:00Z`;
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  const caseIds = Array.from({ length: 60 }, (_, i) => makeCaseId(i));

  const syncedCases = caseIds.map((caseId, i) => ({
    id: caseId,
    documentType: 'SYNCED_CASE',
    caseId,
    caseNumber: caseId.slice(4),
    chapter: CHAPTERS[i % CHAPTERS.length],
    caseTitle: `Test Case ${i + 1}`,
    dateFiled: makeDateFiled(i),
    officeName: 'Buffalo',
    officeCode: 'USTP_CAMS_Region_2_Office_091',
    courtId: '0209',
    courtName: 'U.S. Bankruptcy Court Western District of New York',
    courtDivisionCode: COURT_ID,
    courtDivisionName: 'Buffalo',
    groupDesignator: 'BU',
    regionId: '02',
    regionName: 'NEW YORK',
    consolidation: [],
    debtor: {
      name: `Test Debtor ${i + 1}`,
      address1: `${i + 1} Test St`,
      cityStateZipCountry: 'Buffalo, NY 14202',
    },
    updatedOn: NOW,
    updatedBy: SEEDER,
  }));

  const caseAppointments = caseIds.map((caseId, i) => ({
    id: `cams-593-appt-${String(i + 1).padStart(3, '0')}`,
    documentType: 'CASE_APPOINTMENT',
    caseId,
    trusteeId: PAGINATED_TRUSTEE_ID,
    assignedOn: makeAssignedOn(i),
    appointedDate: makeDateFiled(i),
    unassignedOn: null,
    source: 'dxtr',
    createdOn: NOW,
    createdBy: SEEDER,
    updatedOn: NOW,
    updatedBy: SEEDER,
  }));

  return [
    // ── Paginated trustee ────────────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: PAGINATED_TRUSTEE_ID,
          documentType: 'TRUSTEE',
          trusteeId: PAGINATED_TRUSTEE_ID,
          name: 'Paginated Trustee',
          firstName: 'Paginated',
          lastName: 'Trustee',
          status: 'active',
          public: {
            address: {
              address1: '100 Pagination Ave',
              city: 'Buffalo',
              state: 'NY',
              zipCode: '14202',
              countryCode: 'US',
            },
            phone: { number: '716-555-0100' },
            email: 'paginated.trustee@example.com',
          },
          updatedOn: NOW,
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Empty trustee ────────────────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        {
          id: EMPTY_TRUSTEE_ID,
          documentType: 'TRUSTEE',
          trusteeId: EMPTY_TRUSTEE_ID,
          name: 'Empty Trustee',
          firstName: 'Empty',
          lastName: 'Trustee',
          status: 'active',
          public: {
            address: {
              address1: '200 Empty St',
              city: 'Buffalo',
              state: 'NY',
              zipCode: '14202',
              countryCode: 'US',
            },
            phone: { number: '716-555-0200' },
            email: 'empty.trustee@example.com',
          },
          updatedOn: NOW,
          updatedBy: SEEDER,
        },
      ],
    },

    // ── 60 SyncedCase documents ──────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: syncedCases,
    },

    // ── 60 CASE_APPOINTMENT documents ────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: caseAppointments,
    },
  ];
}
