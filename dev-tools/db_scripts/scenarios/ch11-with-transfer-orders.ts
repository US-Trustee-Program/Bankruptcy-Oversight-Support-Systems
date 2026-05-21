/**
 * Scenario: ch11-with-transfer-orders
 * Database: dxtr + cams
 *
 * Creates a Chapter 11 case in the Manhattan division with two transfer orders:
 * one in pending status (with a suggested destination case number) and one in
 * approved status (with a fully-populated newCase record pointing to Chicago).
 * Used to exercise the transfer orders review queue, the pending orders panel,
 * and the approved orders history on the case detail page.
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

  const caseSummary = buildCaseSummary(ids, '11', 'Seed Chapter 11 Case', 'Robert Seedcase');

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
          CS_SHORT_TITLE: 'Seed Chapter 11 Case',
          CS_CHAPTER: '11',
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
          PY_FIRST_NAME: 'Robert',
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
          ...caseSummary,
          caseNumber: ids.caseNumber.split('-')[1],
          consolidation: [],
          updatedOn: '2025-01-15T00:00:00.000Z',
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
          ...caseSummary,
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
            caseId: '521-25-90099',
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
          ...caseSummary,
        },
      ],
    },
  ];
}
