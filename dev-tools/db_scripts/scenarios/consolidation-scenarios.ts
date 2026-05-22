/**
 * Scenario: consolidation-scenarios
 * Database: dxtr + cams
 *
 * Creates three cases (Chapter 7, 11, and 13) in the Manhattan division, then
 * seeds two consolidation orders against them:
 *   - A pending administrative consolidation linking the Ch7 and Ch11 cases.
 *   - An approved substantive consolidation where the Ch13 case is the lead and
 *     the Ch7 case is a member.
 * Used to exercise the consolidation review queue, the pending consolidations
 * panel, and the approved consolidation history on the case detail page.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import MockData from '@common/cams/test-utilities/mock-data.js';
import { getDxtrCsRow, getDxtrPyRow } from '@common/cams/test-utilities/dxtr-acms.mock.js';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const ch7Division = MockData.randomOffice();
  const ch7Ids = await ctx.generateCaseId(ch7Division.courtDivisionCode);
  const ch7SyncedCase = MockData.getSyncedCase({
    override: {
      caseId: ch7Ids.caseId,
      chapter: '7',
      courtDivisionCode: ch7Division.courtDivisionCode,
      courtId: ch7Division.courtId,
      groupDesignator: ch7Division.groupDesignator,
    },
  });

  const ch11Division = MockData.randomOffice();
  const ch11Ids = await ctx.generateCaseId(ch11Division.courtDivisionCode);
  const ch11SyncedCase = MockData.getSyncedCase({
    override: {
      caseId: ch11Ids.caseId,
      chapter: '11',
      courtDivisionCode: ch11Division.courtDivisionCode,
      courtId: ch11Division.courtId,
      groupDesignator: ch11Division.groupDesignator,
    },
  });

  const ch13Division = MockData.randomOffice();
  const ch13Ids = await ctx.generateCaseId(ch13Division.courtDivisionCode);
  const ch13SyncedCase = MockData.getSyncedCase({
    override: {
      caseId: ch13Ids.caseId,
      chapter: '13',
      courtDivisionCode: ch13Division.courtDivisionCode,
      courtId: ch13Division.courtId,
      groupDesignator: ch13Division.groupDesignator,
    },
  });

  return [
    // DXTR: Ch7 case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [getDxtrCsRow(ch7Ids.csCaseId, ch7Ids.caseNumber, '7', ch7Division)],
    },

    // DXTR: Ch11 case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [getDxtrCsRow(ch11Ids.csCaseId, ch11Ids.caseNumber, '11', ch11Division)],
    },

    // DXTR: Ch13 case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [getDxtrCsRow(ch13Ids.csCaseId, ch13Ids.caseNumber, '13', ch13Division)],
    },

    // DXTR: Ch7 debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [getDxtrPyRow(ch7Ids.csCaseId, ch7Division.courtId, 'db')],
    },

    // DXTR: Ch11 debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [getDxtrPyRow(ch11Ids.csCaseId, ch11Division.courtId, 'db')],
    },

    // DXTR: Ch13 debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [getDxtrPyRow(ch13Ids.csCaseId, ch13Division.courtId, 'db')],
    },

    // Cosmos: Ch7 synced case document
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          ...ch7SyncedCase,
          id: ch7Ids.caseId,
          consolidation: [],
          updatedOn: new Date().toISOString(),
          updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
        },
      ],
    },

    // Cosmos: Ch11 synced case document
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          ...ch11SyncedCase,
          id: ch11Ids.caseId,
          consolidation: [],
          updatedOn: new Date().toISOString(),
          updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
        },
      ],
    },

    // Cosmos: Ch13 synced case document
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          ...ch13SyncedCase,
          id: ch13Ids.caseId,
          consolidation: [],
          updatedOn: new Date().toISOString(),
          updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
        },
      ],
    },

    // Cosmos: pending administrative consolidation (Ch7 + Ch11, no leadCase)
    {
      db: 'cams',
      collectionOrTable: 'consolidations',
      data: [
        {
          id: `seed-consolidation-pending-${ch7Ids.caseId}-${ch11Ids.caseId}`,
          consolidationId: `seed-consol-pending-id-${ch7Ids.caseId}`,
          consolidationType: 'administrative',
          orderType: 'consolidation',
          orderDate: '2025-02-10',
          status: 'pending',
          courtName: ch7SyncedCase.courtName,
          courtDivisionCode: ch7Division.courtDivisionCode,
          jobId: 900001,
          memberCases: [
            {
              ...ch7SyncedCase,
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
              ...ch11SyncedCase,
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
        },
      ],
    },

    // Cosmos: approved substantive consolidation (Ch13 as lead, Ch7 as member)
    {
      db: 'cams',
      collectionOrTable: 'consolidations',
      data: [
        {
          id: `seed-consolidation-approved-${ch13Ids.caseId}`,
          consolidationId: `seed-consol-approved-id-${ch13Ids.caseId}`,
          consolidationType: 'substantive',
          orderType: 'consolidation',
          orderDate: '2025-02-20',
          status: 'approved',
          courtName: ch13SyncedCase.courtName,
          courtDivisionCode: ch13Division.courtDivisionCode,
          jobId: 900002,
          leadCase: ch13SyncedCase,
          memberCases: [
            {
              ...ch7SyncedCase,
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
        },
      ],
    },
  ];
}
