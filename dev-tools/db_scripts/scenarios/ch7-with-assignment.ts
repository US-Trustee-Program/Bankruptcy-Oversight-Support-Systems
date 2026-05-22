/**
 * Scenario: ch7-with-assignment
 * Database: cams only
 *
 * Seeds case assignment and note data using existing DXTR case 081-26-91522 to exercise
 * case assignment and note features:
 *
 *   - Active trial attorney assignment to Taylor Seedattorney
 *   - Initial review note authored by Taylor Seedattorney
 *
 * NOTE: Uses existing DXTR case - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

// Existing DXTR case in Manhattan (081)
const CASE_ID = '081-26-91522';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: synced case document ─────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: CASE_ID,
          documentType: 'SYNCED_CASE',
          dxtrId: 'SEED91522',
          caseId: CASE_ID,
          caseNumber: '26-91522',
          chapter: '7',
          caseTitle: 'SEED Case Assignment Demo',
          dateFiled: '2026-01-01',
          officeName: 'Manhattan',
          officeCode: 'USTP_CAMS_Region_2_Office_081',
          courtId: '0208',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionCode: '081',
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
          consolidation: [],
          debtor: {
            name: 'SEED Case Assignment Demo',
            address1: '123 Test St',
            address2: undefined,
            address3: undefined,
            cityStateZipCountry: 'Manhattan, NY 10001',
            taxId: undefined,
            ssn: undefined,
          },
          updatedOn: '2026-01-01T10:00:00.000Z',
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
          id: `seed-assignment-${CASE_ID}`,
          documentType: 'ASSIGNMENT',
          caseId: CASE_ID,
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
          id: `seed-note-${CASE_ID}`,
          documentType: 'NOTE',
          caseId: CASE_ID,
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
