/**
 * Scenario: chapter11
 * Entity: cases
 * Database: cams (Cosmos DB via MongoDB driver)
 *
 * Seeds a synced case that exists in DXTR for testing case detail pages.
 * IMPORTANT: This caseId (091-99-86706) exists in dev DXTR as Chapter 11.
 * The backend will query DXTR for full case details when viewing.
 * Used by: case search, case detail, case list, staff assignment routes.
 */

import type { CaseDetail } from '@common/cams/cases.js';
import MockData from '@common/cams/test-utilities/mock-data.js';

export const db = 'cams' as const;
export const collectionOrTable = 'cases';

export const data: Array<
  CaseDetail & {
    id: string;
    documentType: string;
    updatedOn: string;
    updatedBy: { id: string; name: string };
  }
> = [
  {
    id: '091-99-86706',
    documentType: 'SYNCED_CASE',
    dxtrId: 'seed-dxtr-091-99-86706',
    caseId: '091-99-86706',
    caseNumber: '99-86706',
    chapter: '11',
    caseTitle: 'Joan Jules Robel II',
    dateFiled: '1999-01-01',
    officeName: 'Manhattan',
    officeCode: 'USTP_CAMS_Region_2_Office_091',
    courtId: '0913',
    courtName: 'U.S. Bankruptcy Court Eastern District of New York',
    courtDivisionCode: '091',
    courtDivisionName: 'Brooklyn',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'NEW YORK',
    consolidation: [],
    debtor: {
      name: 'Joan Jules Robel II',
      address1: '456 Business Blvd',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Brooklyn, NY 11201',
      taxId: MockData.randomEin(),
      ssn: undefined,
    },
    updatedOn: '1999-01-01T10:00:00.000Z',
    updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
  },
];
