/**
 * Scenario: consolidation-scenarios
 * Database: cams only
 *
 * Seeds consolidation order data using existing DXTR cases to exercise
 * consolidation features:
 *
 *   - A pending administrative consolidation linking Ch7 and Ch11 cases
 *   - An approved substantive consolidation (Ch13 as lead, Ch7 as member)
 *
 * NOTE: Uses existing DXTR cases - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';

// Existing DXTR cases
const CH7_CASE_ID = '091-99-87899'; // Actually Ch 11 (Kassulke Group)
const CH11_CASE_ID = '091-99-00874';
const CH13_CASE_ID = '091-99-92748'; // Actually Ch 12 (Botsford LLC)

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Ensure all cases exist in DXTR (guard against accidental deletion)
  const case1 = await ensureDxtrCase(ctx, {
    divisionCode: '091',
    chapter: '11',
    debtorName: 'Kassulke Group',
    courtId: '0209',
    groupDesignator: 'BU',
    caseInfo: { caseId: CH7_CASE_ID, caseNumber: '99-87899', csCaseId: 'SEED87899' },
  });

  const case2 = await ensureDxtrCase(ctx, {
    divisionCode: '091',
    chapter: '11',
    debtorName: 'SEED Consolidation Ch11 Case',
    courtId: '0209',
    groupDesignator: 'NY',
    caseInfo: { caseId: CH11_CASE_ID, caseNumber: '99-00874', csCaseId: 'SEED00874' },
  });

  const case3 = await ensureDxtrCase(ctx, {
    divisionCode: '091',
    chapter: '12',
    debtorName: 'Botsford LLC',
    courtId: '0209',
    groupDesignator: 'BU',
    caseInfo: { caseId: CH13_CASE_ID, caseNumber: '99-92748', csCaseId: 'SEED92748' },
  });

  const ch7Case = {
    id: CH7_CASE_ID,
    documentType: 'SYNCED_CASE',
    dxtrId: 'SEED87899',
    caseId: CH7_CASE_ID,
    caseNumber: '99-87899',
    chapter: '11',
    caseTitle: 'Kassulke Group',
    dateFiled: '1999-01-01',
    officeName: 'Buffalo',
    officeCode: 'USTP_CAMS_Region_2_Office_091',
    courtId: '0209',
    courtName: 'U.S. Bankruptcy Court Western District of New York',
    courtDivisionCode: '091',
    courtDivisionName: 'Buffalo',
    groupDesignator: 'BU',
    regionId: '02',
    regionName: 'NEW YORK',
    consolidation: [],
    debtor: {
      name: 'SEED Consolidation Ch7 Case',
      address1: '100 Consolidation St',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Buffalo, NY 14202',
      taxId: undefined,
      ssn: undefined,
    },
    updatedOn: '2026-01-01T10:00:00.000Z',
    updatedBy: SEEDER,
  };

  const ch11Case = {
    id: CH11_CASE_ID,
    documentType: 'SYNCED_CASE',
    dxtrId: 'SEED00874',
    caseId: CH11_CASE_ID,
    caseNumber: '99-00874',
    chapter: '11',
    caseTitle: 'SEED Consolidation Ch11 Case',
    dateFiled: '2026-01-02',
    officeName: 'Manhattan',
    officeCode: 'USTP_CAMS_Region_2_Office_091',
    courtId: '0209',
    courtName: 'U.S. Bankruptcy Court Southern District of New York',
    courtDivisionCode: '091',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'NEW YORK',
    consolidation: [],
    debtor: {
      name: 'SEED Consolidation Ch11 Case',
      address1: '200 Consolidation Ave',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Manhattan, NY 10002',
      taxId: undefined,
      ssn: undefined,
    },
    updatedOn: '2026-01-02T10:00:00.000Z',
    updatedBy: SEEDER,
  };

  const ch13Case = {
    id: CH13_CASE_ID,
    documentType: 'SYNCED_CASE',
    dxtrId: 'SEED92748',
    caseId: CH13_CASE_ID,
    caseNumber: '99-92748',
    chapter: '12',
    caseTitle: 'Botsford LLC',
    dateFiled: '1999-01-01',
    officeName: 'Buffalo',
    officeCode: 'USTP_CAMS_Region_2_Office_091',
    courtId: '0209',
    courtName: 'U.S. Bankruptcy Court Western District of New York',
    courtDivisionCode: '091',
    courtDivisionName: 'Buffalo',
    groupDesignator: 'BU',
    regionId: '02',
    regionName: 'NEW YORK',
    consolidation: [],
    debtor: {
      name: 'SEED Consolidation Ch13 Case',
      address1: '300 Consolidation Blvd',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Buffalo, NY 14203',
      taxId: undefined,
      ssn: undefined,
    },
    updatedOn: '2026-01-03T10:00:00.000Z',
    updatedBy: SEEDER,
  };

  return [
    // ── DXTR operations (if cases missing) ───────────────────────────────────
    ...case1.operations,
    ...case2.operations,
    ...case3.operations,

    // ── Cosmos: Ch7 synced case document ─────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [ch7Case],
    },

    // ── Cosmos: Ch11 synced case document ────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [ch11Case],
    },

    // ── Cosmos: Ch13 synced case document ────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [ch13Case],
    },

    // ── Cosmos: pending administrative consolidation (Ch7 + Ch11) ────────────
    {
      db: 'cams',
      collectionOrTable: 'consolidations',
      data: [
        {
          id: `seed-consolidation-pending-${CH7_CASE_ID}-${CH11_CASE_ID}`,
          consolidationId: `seed-consol-pending-id-${CH7_CASE_ID}`,
          consolidationType: 'administrative',
          orderType: 'consolidation',
          orderDate: '2025-02-10',
          status: 'pending',
          courtName: ch7Case.courtName,
          courtDivisionCode: ch7Case.courtDivisionCode,
          jobId: 900001,
          memberCases: [
            {
              ...ch7Case,
              orderDate: '2025-02-10',
              docketEntries: [
                {
                  sequenceNumber: 1,
                  dateFiled: '2025-02-10',
                  summaryText: 'Consolidation motion',
                  fullText: 'Motion to consolidate cases.',
                },
              ],
            },
            {
              ...ch11Case,
              orderDate: '2025-02-10',
              docketEntries: [
                {
                  sequenceNumber: 1,
                  dateFiled: '2025-02-10',
                  summaryText: 'Consolidation motion',
                  fullText: 'Motion to consolidate cases.',
                },
              ],
            },
          ],
          updatedOn: '2025-02-10T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: approved substantive consolidation (Ch13 lead, Ch7 member) ───
    {
      db: 'cams',
      collectionOrTable: 'consolidations',
      data: [
        {
          id: `seed-consolidation-approved-${CH13_CASE_ID}`,
          consolidationId: `seed-consol-approved-id-${CH13_CASE_ID}`,
          consolidationType: 'substantive',
          orderType: 'consolidation',
          orderDate: '2025-02-20',
          status: 'approved',
          courtName: ch13Case.courtName,
          courtDivisionCode: ch13Case.courtDivisionCode,
          jobId: 900002,
          leadCase: ch13Case,
          memberCases: [
            {
              ...ch7Case,
              orderDate: '2025-02-20',
              docketEntries: [
                {
                  sequenceNumber: 1,
                  dateFiled: '2025-02-20',
                  summaryText: 'Consolidation order',
                  fullText: 'Order approving substantive consolidation.',
                },
              ],
            },
          ],
          updatedOn: '2025-02-20T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
