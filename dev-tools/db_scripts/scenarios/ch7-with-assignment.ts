/**
 * Scenario: ch7-with-assignment
 * Database: dxtr + cams
 *
 * Seeds a Chapter 7 case with assignment and note data to exercise
 * case assignment and note features:
 *
 *   - Chapter 7 case in DXTR (AO_CS + AO_PY debtor)
 *   - Synced case in CAMS
 *   - Active trial attorney assignment to Taylor Seedattorney
 *   - Initial review note authored by Taylor Seedattorney
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const DIVISION_CODE = '081'; // Manhattan

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Generate unique case ID in seed range (90000-99999)
  const { caseId, caseNumber, csCaseId } = await ctx.generateCaseId(DIVISION_CODE);

  const courtId = '0208';
  const debtorName = 'SEED Case Assignment Demo';

  return [
    // ── DXTR: AO_CS (Case Master) ────────────────────────────────────────────
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: csCaseId,
          COURT_ID: courtId,
          CS_CASE_NUMBER: caseNumber.split('-')[1], // Just the number part
          CS_DIV: DIVISION_CODE,
          GRP_DES: 'NY', // Manhattan group designator
          CASE_ID: caseNumber,
          CS_SHORT_TITLE: debtorName,
          CS_CHAPTER: '7',
          CS_TYPE: 'bk',
          CS_FEE_STATUS: 'p',
          CS_JOINT: 'n',
          CS_VOL_INVOL: 'v',
          CS_DATE_FILED: new Date('1999-01-01'),
        },
      ],
    },

    // ── DXTR: AO_PY (Party - Debtor) ─────────────────────────────────────────
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: csCaseId,
          COURT_ID: courtId,
          PY_ROLE: 'DB', // debtor (uppercase)
          PY_LAST_NAME: debtorName,
          PY_FIRST_NAME: null,
          PY_MIDDLE_NAME: null,
          PY_ADDRESS1: '123 Test St',
          PY_ADDRESS2: null,
          PY_ADDRESS3: null,
          PY_CITY: 'Manhattan',
          PY_STATE: 'NY',
          PY_ZIP: '10001',
          PY_COUNTRY: 'United States',
        },
      ],
    },

    // ── Cosmos: synced case document ─────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: caseId,
          documentType: 'SYNCED_CASE',
          dxtrId: csCaseId,
          caseId,
          caseNumber,
          chapter: '7',
          caseTitle: debtorName,
          dateFiled: '1999-01-01',
          officeName: 'Manhattan',
          officeCode: 'USTP_CAMS_Region_2_Office_081',
          courtId,
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionCode: DIVISION_CODE,
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
          consolidation: [],
          debtor: {
            name: debtorName,
            address1: '123 Test St',
            address2: undefined,
            address3: undefined,
            cityStateZipCountry: 'Manhattan, NY 10001',
            taxId: undefined,
            ssn: undefined,
          },
          updatedOn: '1999-01-01T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: active trial attorney assignment ─────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'assignments',
      data: [
        {
          id: `seed-assignment-${caseId}`,
          documentType: 'ASSIGNMENT',
          caseId,
          userId: 'seed-user-trial-attorney-001',
          name: 'Taylor Seedattorney',
          role: 'TrialAttorney',
          assignedOn: '2025-01-20',
          updatedOn: '2025-01-20',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: initial review note ──────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: `seed-note-${caseId}`,
          documentType: 'NOTE',
          caseId,
          title: 'Initial Review Note',
          content: 'Seed note for development and testing.',
          createdOn: '2025-01-20',
          createdBy: { id: 'seed-user-trial-attorney-001', name: 'Taylor Seedattorney' },
          updatedOn: '2025-01-20',
          updatedBy: { id: 'seed-user-trial-attorney-001', name: 'Taylor Seedattorney' },
        },
      ],
    },
  ];
}
