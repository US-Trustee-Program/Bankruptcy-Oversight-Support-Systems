/**
 * Scenario: ch11-with-transfer-orders
 * Database: cams only
 *
 * Seeds transfer order data using existing DXTR case 091-99-00874 to exercise
 * transfer order features:
 *
 *   - One pending transfer order (with suggested case number)
 *   - One approved transfer order (with fully-populated newCase pointing to Chicago)
 *
 * NOTE: Uses existing DXTR case - no DXTR seeding required.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { ensureDxtrCase } from '../lib/ensure-dxtr-case.js';

// Existing DXTR case in Manhattan (091)
const CASE_ID = '091-99-00874';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  // Ensure case exists in DXTR (guard against accidental deletion)
  const { operations: dxtrOps } = await ensureDxtrCase(ctx, {
    divisionCode: '091',
    chapter: '11',
    debtorName: 'SEED Transfer Orders Demo',
    courtId: '0209',
    groupDesignator: 'NY',
    caseInfo: {
      caseId: CASE_ID,
      caseNumber: '99-00874',
      csCaseId: 'SEED00874',
    },
  });

  return [
    // ── DXTR operations (if case missing) ────────────────────────────────────
    ...dxtrOps,

    // ── Cosmos: synced case document ─────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: CASE_ID,
          documentType: 'SYNCED_CASE',
          dxtrId: 'SEED00874',
          caseId: CASE_ID,
          caseNumber: '99-00874',
          chapter: '11',
          caseTitle: 'SEED Transfer Orders Demo',
          dateFiled: '2026-01-01',
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
            name: 'SEED Transfer Orders Demo',
            address1: '456 Transfer Ave',
            address2: undefined,
            address3: undefined,
            cityStateZipCountry: 'Manhattan, NY 10002',
            taxId: undefined,
            ssn: undefined,
          },
          updatedOn: '2026-01-01T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: pending transfer order ───────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'orders',
      data: [
        {
          id: `seed-transfer-pending-${CASE_ID}`,
          documentType: 'TRANSFER_ORDER',
          orderType: 'transfer',
          caseId: CASE_ID,
          orderDate: '2025-02-01',
          taskDate: '2012-06-14',
          status: 'pending',
          docketSuggestedCaseNumber: '25-90099',
          docketEntries: [
            {
              sequenceNumber: 1,
              dateFiled: '2025-02-01',
              summaryText: 'Order to transfer case',
              fullText: 'Order directing transfer of case to another district.',
            },
          ],
          dxtrId: 'SEED00874',
          caseNumber: '99-00874',
          chapter: '11',
          caseTitle: 'SEED Transfer Orders Demo',
          dateFiled: '2026-01-01',
          officeName: 'Manhattan',
          officeCode: 'USTP_CAMS_Region_2_Office_091',
          courtId: '0209',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionCode: '091',
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
          debtor: {
            name: 'SEED Transfer Orders Demo',
            address1: '456 Transfer Ave',
            address2: undefined,
            address3: undefined,
            cityStateZipCountry: 'Manhattan, NY 10002',
            taxId: undefined,
            ssn: undefined,
          },
          updatedOn: '2025-02-01T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: approved transfer order ──────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'orders',
      data: [
        {
          id: `seed-transfer-approved-${CASE_ID}`,
          documentType: 'TRANSFER_ORDER',
          orderType: 'transfer',
          caseId: CASE_ID,
          orderDate: '2025-02-15',
          taskDate: '2018-09-03',
          status: 'approved',
          docketEntries: [
            {
              sequenceNumber: 1,
              dateFiled: '2025-02-15',
              summaryText: 'Transfer approved',
              fullText: 'Transfer order approved by court.',
            },
          ],
          newCase: {
            dxtrId: 'XFER81781',
            caseId: '674-99-81781',
            chapter: '12',
            caseTitle: 'Jackson-Robinson',
            dateFiled: '1999-01-01',
            officeName: 'Unknown',
            officeCode: 'USTP_CAMS_Region_Unknown_Office_674',
            courtId: '0674',
            courtName: 'U.S. Bankruptcy Court District 674',
            courtDivisionCode: '674',
            courtDivisionName: 'District 674',
            groupDesignator: 'UK',
            regionId: '11',
            regionName: 'CHICAGO',
          },
          dxtrId: 'SEED00874',
          caseNumber: '99-00874',
          chapter: '11',
          caseTitle: 'SEED Transfer Orders Demo',
          dateFiled: '2026-01-01',
          officeName: 'Manhattan',
          officeCode: 'USTP_CAMS_Region_2_Office_091',
          courtId: '0209',
          courtName: 'U.S. Bankruptcy Court Southern District of New York',
          courtDivisionCode: '091',
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'NEW YORK',
          debtor: {
            name: 'SEED Transfer Orders Demo',
            address1: '456 Transfer Ave',
            address2: undefined,
            address3: undefined,
            cityStateZipCountry: 'Manhattan, NY 10002',
            taxId: undefined,
            ssn: undefined,
          },
          updatedOn: '2025-02-15T10:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
