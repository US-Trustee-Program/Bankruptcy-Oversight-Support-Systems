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
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };
const DIVISION_CODE = '081'; // Manhattan

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const debtorName = 'SEED Case Assignment Demo';
  const courtId = '0208';

  // Ensure case exists in DXTR (creates if needed)
  const { operations: dxtrOps, caseInfo } = await ensureDxtrCase(ctx, {
    divisionCode: DIVISION_CODE,
    chapter: '7',
    debtorName,
    courtId,
    groupDesignator: 'NY',
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
