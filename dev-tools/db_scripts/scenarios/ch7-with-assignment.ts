/**
 * Scenario: ch7-with-assignment
 * Database: dxtr + cams
 *
 * Creates a Chapter 7 case in the Manhattan division with a synced Cosmos document,
 * an active trial attorney assignment, and an initial review note. Used to exercise
 * the case detail page, the case assignment panel, and the case notes section.
 */

import type { SeedOperation } from '../../runner.js';

interface GeneratedCaseId {
  caseId: string;
  caseNumber: string;
  csCaseId: string;
}

interface SeedContext {
  generateCaseId: (divisionCode: string) => Promise<GeneratedCaseId>;
}

function buildCaseSummary(
  ids: GeneratedCaseId,
  chapter: string,
  caseTitle: string,
  debtorName: string,
) {
  return {
    caseId: ids.caseId,
    chapter,
    caseTitle,
    dateFiled: '2025-01-15',
    dxtrId: ids.csCaseId,
    officeName: 'Manhattan',
    officeCode: 'USTP_CAMS_Region_2_Office_081',
    courtId: '0208',
    courtName: 'U.S. Bankruptcy Court Southern District of New York',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'NEW YORK',
    debtor: {
      name: debtorName,
      address1: '100 Test Street',
      cityStateZipCountry: 'New York, NY 10001',
    },
  };
}

export async function generate(ctx: SeedContext): Promise<SeedOperation[]> {
  const ids = await ctx.generateCaseId('081');

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
          CS_SHORT_TITLE: 'Seed Chapter 7 Case',
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
          ...buildCaseSummary(ids, '7', 'Seed Chapter 7 Case', 'Alice Seedcase'),
          caseNumber: ids.caseNumber.split('-')[1],
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
