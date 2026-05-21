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

import type { SeedContext, GeneratedCaseId, SeedOperation } from '../../runner.js';
import { buildCaseSummary } from '../lib/scenario-helpers.js';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const ch7: GeneratedCaseId = await ctx.generateCaseId('081');
  const ch11: GeneratedCaseId = await ctx.generateCaseId('081');
  const ch13: GeneratedCaseId = await ctx.generateCaseId('081');

  const ch7Summary = buildCaseSummary(ch7, '7', 'Seed Chapter 7 Case', 'Alice Seedcase');
  const ch11Summary = buildCaseSummary(ch11, '11', 'Seed Chapter 11 Case', 'Robert Seedcase');
  const ch13Summary = buildCaseSummary(ch13, '13', 'Seed Chapter 13 Case', 'Carol Seedcase');

  return [
    // DXTR: Ch7 case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [
        {
          CS_CASEID: ch7.csCaseId,
          COURT_ID: '0208',
          CS_DIV: '081',
          GRP_DES: 'NY',
          CASE_ID: ch7.caseNumber,
          CS_SHORT_TITLE: 'Seed Chapter 7 Case',
          CS_CHAPTER: '7',
          CS_DATE_FILED: '2025-01-15',
          LAST_UPDATE_DATE: '2025-01-15T00:00:00',
        },
      ],
    },

    // DXTR: Ch11 case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [
        {
          CS_CASEID: ch11.csCaseId,
          COURT_ID: '0208',
          CS_DIV: '081',
          GRP_DES: 'NY',
          CASE_ID: ch11.caseNumber,
          CS_SHORT_TITLE: 'Seed Chapter 11 Case',
          CS_CHAPTER: '11',
          CS_DATE_FILED: '2025-01-15',
          LAST_UPDATE_DATE: '2025-01-15T00:00:00',
        },
      ],
    },

    // DXTR: Ch13 case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [
        {
          CS_CASEID: ch13.csCaseId,
          COURT_ID: '0208',
          CS_DIV: '081',
          GRP_DES: 'NY',
          CASE_ID: ch13.caseNumber,
          CS_SHORT_TITLE: 'Seed Chapter 13 Case',
          CS_CHAPTER: '13',
          CS_DATE_FILED: '2025-01-15',
          LAST_UPDATE_DATE: '2025-01-15T00:00:00',
        },
      ],
    },

    // DXTR: Ch7 debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [
        {
          CS_CASEID: ch7.csCaseId,
          COURT_ID: '0208',
          PY_ROLE: 'db',
          PY_LAST_NAME: 'Seedcase',
          PY_FIRST_NAME: 'Alice',
          PY_ADDRESS1: '100 Test Street',
          PY_CITY: 'New York',
          PY_STATE: 'NY',
          PY_ZIP: '10001',
        },
      ],
    },

    // DXTR: Ch11 debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [
        {
          CS_CASEID: ch11.csCaseId,
          COURT_ID: '0208',
          PY_ROLE: 'db',
          PY_LAST_NAME: 'Seedcase',
          PY_FIRST_NAME: 'Robert',
          PY_ADDRESS1: '100 Test Street',
          PY_CITY: 'New York',
          PY_STATE: 'NY',
          PY_ZIP: '10001',
        },
      ],
    },

    // DXTR: Ch13 debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [
        {
          CS_CASEID: ch13.csCaseId,
          COURT_ID: '0208',
          PY_ROLE: 'db',
          PY_LAST_NAME: 'Seedcase',
          PY_FIRST_NAME: 'Carol',
          PY_ADDRESS1: '100 Test Street',
          PY_CITY: 'New York',
          PY_STATE: 'NY',
          PY_ZIP: '10001',
        },
      ],
    },

    // Cosmos: Ch7 synced case document
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: ch7.caseId,
          documentType: 'SYNCED_CASE',
          ...ch7Summary,
          consolidation: [],
          updatedOn: '2025-01-15T00:00:00.000Z',
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
          id: ch11.caseId,
          documentType: 'SYNCED_CASE',
          ...ch11Summary,
          consolidation: [],
          updatedOn: '2025-01-15T00:00:00.000Z',
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
          id: ch13.caseId,
          documentType: 'SYNCED_CASE',
          ...ch13Summary,
          consolidation: [],
          updatedOn: '2025-01-15T00:00:00.000Z',
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
          id: `seed-consolidation-pending-${ch7.caseId}-${ch11.caseId}`,
          consolidationId: `seed-consol-pending-id-${ch7.caseId}`,
          consolidationType: 'administrative',
          orderType: 'consolidation',
          orderDate: '2025-02-10',
          status: 'pending',
          courtName: ch7Summary.courtName,
          courtDivisionCode: '081',
          jobId: 900001,
          memberCases: [
            {
              ...ch7Summary,
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
              ...ch11Summary,
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
          id: `seed-consolidation-approved-${ch13.caseId}`,
          consolidationId: `seed-consol-approved-id-${ch13.caseId}`,
          consolidationType: 'substantive',
          orderType: 'consolidation',
          orderDate: '2025-02-20',
          status: 'approved',
          courtName: ch13Summary.courtName,
          courtDivisionCode: '081',
          jobId: 900002,
          leadCase: {
            ...ch13Summary,
          },
          memberCases: [
            {
              ...ch7Summary,
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
