/**
 * Scenario: ch7-with-assignment
 * Database: dxtr + cams
 *
 * Creates a Chapter 7 case in the Manhattan division with a synced Cosmos document,
 * an active trial attorney assignment, and an initial review note. Used to exercise
 * the case detail page, the case assignment panel, and the case notes section.
 */

import type { SeedContext, GeneratedCaseId, SeedOperation } from '../../runner.js';
import { buildCaseSummary } from '../lib/scenario-helpers.js';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const ids: GeneratedCaseId = await ctx.generateCaseId('081');

  return [
    // DXTR: case record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      data: [
        {
          CS_CASEID: ids.csCaseId,
          COURT_ID: '0208',
          CS_DIV: '081',
          GRP_DES: 'NY',
          CASE_ID: ids.caseNumber,
          CS_SHORT_TITLE: 'SEED Ch7 Assignment Case',
          CS_CHAPTER: '7',
          CS_DATE_FILED: '2025-01-15',
          LAST_UPDATE_DATE: '2025-01-15T00:00:00',
        },
      ],
    },

    // DXTR: debtor party record
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      insertOnly: true,
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      data: [
        {
          CS_CASEID: ids.csCaseId,
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

    // Cosmos: synced case document
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: ids.caseId,
          documentType: 'SYNCED_CASE',
          ...buildCaseSummary(ids, '7', 'SEED Ch7 Assignment Case', 'Alice Seedcase'),
          consolidation: [],
          updatedOn: '2025-01-15T00:00:00.000Z',
          updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
        },
      ],
    },

    // Cosmos: active trial attorney assignment
    {
      db: 'cams',
      collectionOrTable: 'assignments',
      data: [
        {
          id: `seed-assignment-${ids.caseId}`,
          documentType: 'ASSIGNMENT',
          caseId: ids.caseId,
          userId: 'seed-user-trial-attorney-001',
          name: 'Taylor Seedattorney',
          role: 'TrialAttorney',
          assignedOn: '2025-01-20',
          updatedOn: '2025-01-20',
          updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
        },
      ],
    },

    // Cosmos: initial review note
    {
      db: 'cams',
      collectionOrTable: 'cases',
      data: [
        {
          id: `seed-note-${ids.caseId}`,
          documentType: 'NOTE',
          caseId: ids.caseId,
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
