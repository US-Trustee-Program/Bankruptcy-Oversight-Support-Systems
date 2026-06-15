/**
 * Scenario: ch7-with-assignment
 * Database: dxtr + cams
 *
 * Seeds a Chapter 7 case with assignment and note data to exercise
 * case assignment and note features:
 *
 *   - Chapter 7 case 081-26-99476 in DXTR (AO_CS + AO_PY debtor)
 *   - Synced case in CAMS
 *   - Active trial attorney assignment to Taylor Seedattorney
 *   - Initial review note authored by Taylor Seedattorney
 *
 * NOTE: Uses fixed case number 081-26-99476 for predictable testing.
 *       Uses ensureDxtrCase() to work with existing DXTR data if present.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';
import { createDebtor } from '../lib/test-data-utils.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const DIVISION_CODE = '081'; // Manhattan
const COURT_ID = '0208';
const CASE_YEAR = '26';
const CASE_NUMBER = '99476';
const CASE_ID = `${DIVISION_CODE}-${CASE_YEAR}-${CASE_NUMBER}`;

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const debtorName = 'SEED Case Assignment Demo';

  // Ensure case exists in DXTR (uses existing if found, creates if not)
  const { operations: dxtrOps, caseInfo } = await ensureDxtrCase(ctx, {
    divisionCode: DIVISION_CODE,
    chapter: '7',
    debtorName,
    courtId: COURT_ID,
    groupDesignator: 'NY',
    caseInfo: {
      caseId: CASE_ID,
      caseNumber: `${CASE_YEAR}-${CASE_NUMBER}`,
      csCaseId: 'SEED99476', // Will be checked/created with this ID
    },
  });

  const { caseId, caseNumber, csCaseId } = caseInfo;

  return [
    // ── DXTR operations (if case doesn't exist) ──────────────────────────────
    ...dxtrOps,

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
          dateFiled: '2026-01-15',
          officeName: 'Manhattan',
          officeCode: 'USTP_CAMS_Region_2_Office_081',
          courtId: COURT_ID,
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionCode: DIVISION_CODE,
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
          consolidation: [],
          debtor: createDebtor(debtorName, {
            address1: '123 Test St',
            city: 'Manhattan',
            state: 'NY',
            zip: '10001',
            ssn: '***-**-5432',
          }),
          updatedOn: '2026-01-15T10:00:00.000Z',
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
          assignedOn: '2026-01-20',
          updatedOn: '2026-01-20',
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
          createdOn: '2026-01-20',
          createdBy: { id: 'seed-user-trial-attorney-001', name: 'Taylor Seedattorney' },
          updatedOn: '2026-01-20',
          updatedBy: { id: 'seed-user-trial-attorney-001', name: 'Taylor Seedattorney' },
        },
      ],
    },
  ];
}
