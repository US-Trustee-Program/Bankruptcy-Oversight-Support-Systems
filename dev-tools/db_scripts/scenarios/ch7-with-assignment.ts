/**
 * Scenario: ch7-with-assignment
 * Database: dxtr + cams
 *
 * Creates a Chapter 7 case with a synced Cosmos document, an active trial attorney
 * assignment, and an initial review note. Used to exercise the case detail page,
 * the case assignment panel, and the case notes section.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import MockData from '@common/cams/test-utilities/mock-data.js';
import { getDxtrCsRow, getDxtrPyRow } from '@common/cams/test-utilities/dxtr-acms.mock.js';

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const division = MockData.randomOffice();
  const ids = await ctx.generateCaseId(division.courtDivisionCode);
  const chapter = '7';

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
