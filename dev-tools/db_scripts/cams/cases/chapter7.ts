/**
 * Scenario: chapter7
 * Entity: cases
 * Database: cams (Cosmos DB via MongoDB driver)
 *
 * Seeds a synced case that exists in DXTR for testing case detail pages.
 * IMPORTANT: This caseId (091-99-87899) exists in dev DXTR as Chapter 11.
 * The backend will query DXTR for full case details when viewing.
 * Used by: case search, case detail, case list, staff assignment routes.
 */

import type { CaseDetail } from '@common/cams/cases.js';

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
    id: '091-99-87899',
    documentType: 'SYNCED_CASE',
    dxtrId: 'seed-dxtr-091-99-87899',
    caseId: '091-99-87899',
    caseNumber: '99-87899',
    chapter: '11',
    caseTitle: 'Kassulke Group',
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
      name: 'Kassulke Group',
      address1: '123 Business Plaza',
      address2: undefined,
      address3: undefined,
      cityStateZipCountry: 'Brooklyn, NY 11201',
      taxId: '12-3456789',
      ssn: undefined,
    },
    updatedOn: '1999-01-01T10:00:00.000Z',
    updatedBy: { id: 'SEED', name: 'Test Data Seeder' },
  },
];
