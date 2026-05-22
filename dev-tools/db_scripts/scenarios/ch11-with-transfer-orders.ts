/**
 * Scenario: ch11-with-transfer-orders
 * Database: dxtr + cams
 *
 * Creates a Chapter 11 case with two transfer orders: one in pending status (with a
 * suggested destination case number) and one in approved status (with a
 * fully-populated newCase record pointing to Chicago). Used to exercise the transfer
 * orders review queue, the pending orders panel, and the approved orders history on
 * the case detail page.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import MockData from '@common/cams/test-utilities/mock-data.js';
import { getDxtrCsRow, getDxtrPyRow } from '@common/cams/test-utilities/dxtr-acms.mock.js';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const division = MockData.randomOffice();
  const ids = await ctx.generateCaseId(division.courtDivisionCode);
  const chapter = '11';

  const aoCs = getDxtrCsRow(ids.csCaseId, ids.caseNumber, chapter, division);
  const aoPy = getDxtrPyRow(ids.csCaseId, division.courtId, 'db');
  const syncedCase = MockData.getSyncedCase({
    override: {
      caseId: ids.caseId,
      chapter,
      courtDivisionCode: division.courtDivisionCode,
      courtId: division.courtId,
      groupDesignator: division.groupDesignator,
    },
  });

  return [
    // DXTR: case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [aoCs],
    },

    // DXTR: debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [aoPy],
    },

    // Cosmos: synced case document
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          ...syncedCase,
          id: ids.caseId,
          consolidation: [],
          updatedOn: new Date().toISOString(),
          updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
        },
      ],
    },

    // Cosmos: pending transfer order (has docketSuggestedCaseNumber, no newCase)
    {
      db: 'cams',
      collectionOrTable: 'orders',
      data: [
        {
          id: `seed-transfer-pending-${ids.caseId}`,
          orderType: 'transfer',
          orderDate: '2025-02-01',
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
          ...syncedCase,
        },
      ],
    },

    // Cosmos: approved transfer order (has newCase, no docketSuggestedCaseNumber)
    {
      db: 'cams',
      collectionOrTable: 'orders',
      data: [
        {
          id: `seed-transfer-approved-${ids.caseId}`,
          orderType: 'transfer',
          orderDate: '2025-02-15',
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
            dxtrId: 'XFER90001',
            caseId: '521-25-90099', // fictitious transferee case — not seeded, for display only
            chapter: '11',
            caseTitle: 'Transferee Case',
            dateFiled: '2025-02-15',
            officeName: 'Chicago',
            officeCode: 'USTP_CAMS_Region_11_Office_521',
            courtId: '0752',
            courtName: 'U.S. Bankruptcy Court Northern District of Illinois',
            courtDivisionCode: '521',
            courtDivisionName: 'Chicago',
            groupDesignator: 'CH',
            regionId: '11',
            regionName: 'CHICAGO',
          },
          ...syncedCase,
        },
      ],
    },
  ];
}
