/**
 * TODO: CAMS-376 - Remove this entire file after database backfill is complete
 *
 * Mock Dataset for Development/Manual Testing
 *
 * Provides comprehensive test cases with properly populated phoneticTokens
 * for testing phonetic search functionality in development.
 *
 * To enable: Set MOCK_PHONETIC_SEARCH_DATA=true in your .env file
 *
 * This is a TEMPORARY workaround because existing cases in the database
 * don't have phoneticTokens populated. Once we run a migration to backfill
 * phoneticTokens for all cases, this file should be deleted.
 */

import { SyncedCase } from '@common/cams/cases';
import { generatePhoneticTokensWithNicknames } from '../../../use-cases/cases/phonetic-utils';

/**
 * Helper to create a mock case with phonetic tokens
 */
function createCase(
  caseId: string,
  debtorName: string,
  chapter: string,
  courtDivisionCode: string = '081',
  closedDate?: string,
  jointDebtorName?: string,
): SyncedCase {
  const syncedCase: SyncedCase = {
    caseId,
    caseTitle: debtorName,
    chapter,
    courtDivisionCode,
    courtName: 'United States Bankruptcy Court',
    courtId: 'nyeb',
    courtDivisionName: 'New York Eastern',
    regionId: '02',
    regionName: 'New York',
    dateFiled: '2024-01-01',
    closedDate,
    debtor: {
      name: debtorName,
      address1: '123 Main St',
      cityStateZipCountry: 'New York, NY 10001',
      phoneticTokens: generatePhoneticTokensWithNicknames(debtorName),
    },
    documentType: 'SYNCED_CASE',
  } as SyncedCase;

  if (jointDebtorName) {
    syncedCase.jointDebtor = {
      name: jointDebtorName,
      address1: '123 Main St',
      cityStateZipCountry: 'New York, NY 10001',
      phoneticTokens: generatePhoneticTokensWithNicknames(jointDebtorName),
    };
  }

  return syncedCase;
}

/**
 * Comprehensive mock dataset for phonetic search testing
 *
 * Categories:
 * - Jon/John phonetic matches
 * - Mike/Michael nickname matches
 * - Bob/Robert nickname matches
 * - Jane cases (false positive edge cases)
 * - Various chapters (7, 11, 12, 13, 15)
 * - Open and closed cases
 * - Different court divisions
 *
 * Total: 56 cases covering all edge cases
 */
export const mockPhoneticSearchCases: SyncedCase[] = [
  // ===== Jon/John Phonetic Matches (Chapter 7) =====
  createCase('24-00001', 'Jon Smith', '7', '081'),
  createCase('24-00002', 'John Smith', '7', '081'),
  createCase('24-00003', 'Jonathan Williams', '7', '081'),
  createCase('24-00004', 'John Davis', '7', '081'),
  createCase('24-00005', 'Jon Martinez', '7', '081'),
  createCase('24-00006', 'Jon Paul Garcia', '7', '081'),

  // ===== Mike/Michael Nickname Matches (Chapter 11) =====
  createCase('24-00010', 'Michael Johnson', '11', '081'),
  createCase('24-00011', 'Mike Johnson', '11', '081'),
  createCase('24-00012', 'Michael Brown', '11', '081'),
  createCase('24-00013', 'Mike Williams', '11', '081'),
  createCase('24-00014', 'Michael Anderson', '11', '081'),
  createCase('24-00015', 'Mikey Thompson', '11', '081'),

  // ===== Bob/Robert Nickname Matches (Chapter 13) =====
  createCase('24-00020', 'Robert Taylor', '13', '081'),
  createCase('24-00021', 'Bob Taylor', '13', '081'),
  createCase('24-00022', 'Robert Thompson', '13', '081'),
  createCase('24-00023', 'Bob Garcia', '13', '081'),
  createCase('24-00024', 'Bobby Martinez', '13', '081'),
  createCase('24-00025', 'Robert Lee Wilson', '13', '081'),

  // ===== Jane Cases - Should NOT match Jon (Chapter 7) =====
  createCase('24-00030', 'Jane Doe', '7', '081'),
  createCase('24-00031', 'Jane Smith', '7', '081'),
  createCase('24-00032', 'Janet Jackson', '7', '081'),
  createCase('24-00033', 'Jane Wilson', '7', '081'),
  createCase('24-00034', 'Jane Marie Rodriguez', '7', '081'),

  // ===== William/Bill Nickname Matches (Chapter 15) =====
  createCase('24-00040', 'William Brown', '15', '081'),
  createCase('24-00041', 'Bill Brown', '15', '081'),
  createCase('24-00042', 'Billy Anderson', '15', '081'),

  // ===== James/Jim Nickname Matches (Chapter 7) =====
  createCase('24-00045', 'James Miller', '7', '081'),
  createCase('24-00046', 'Jim Miller', '7', '081'),
  createCase('24-00047', 'Jimmy Davis', '7', '081'),

  // ===== Richard/Rick/Dick Nickname Matches (Chapter 11) =====
  createCase('24-00050', 'Richard Davis', '11', '081'),
  createCase('24-00051', 'Rick Davis', '11', '081'),
  createCase('24-00052', 'Dick Wilson', '11', '081'),
  createCase('24-00053', 'Ricky Thompson', '11', '081'),

  // ===== Closed Cases (For testing Include Closed filter) =====
  createCase('24-00060', 'John Closed', '7', '081', '2024-06-01'),
  createCase('24-00061', 'Mike Closed', '11', '081', '2024-06-01'),
  createCase('24-00062', 'Bob Closed', '13', '081', '2024-06-01'),
  createCase('24-00063', 'Jane Closed', '7', '081', '2024-06-01'),

  // ===== Chapter 12 Cases (Family Farmer/Fisherman) =====
  createCase('24-00070', 'John Farmer', '12', '081'),
  createCase('24-00071', 'Michael Ranch', '12', '081'),
  createCase('24-00072', 'Robert Agriculture', '12', '081'),

  // ===== Different Court Divisions =====
  createCase('24-00080', 'John Manhattan', '7', '081'), // Manhattan
  createCase('24-00081', 'Michael Brooklyn', '11', '082'), // Brooklyn
  createCase('24-00082', 'Robert Queens', '13', '083'), // Queens
  createCase('24-00083', 'Jon Bronx', '15', '084'), // Bronx

  // ===== Names with Special Characters =====
  createCase('24-00090', "Jon O'Brien", '7', '081'),
  createCase('24-00091', "Michael O'Connor", '11', '081'),
  createCase('24-00092', 'Robert Smith-Jones', '13', '081'),
  createCase('24-00093', 'José García', '7', '081'),

  // ===== Joint Debtor Cases =====
  createCase('24-00100', 'John Primary', '7', '081', undefined, 'Jane Primary'),
  createCase('24-00101', 'Michael Lead', '11', '081', undefined, 'Michelle Lead'),
  createCase('24-00102', 'Robert Main', '13', '081', undefined, 'Barbara Main'),

  // ===== Single Name Edge Cases =====
  createCase('24-00110', 'Jon', '7', '081'),
  createCase('24-00111', 'John', '7', '081'),
  createCase('24-00112', 'Jane', '7', '081'),
  createCase('24-00113', 'Mike', '11', '081'),
  createCase('24-00114', 'Michael', '11', '081'),
  createCase('24-00115', 'Bob', '13', '081'),
  createCase('24-00116', 'Robert', '13', '081'),
];

/**
 * Check if mock data should be used
 */
export function shouldUseMockData(): boolean {
  return process.env.MOCK_PHONETIC_SEARCH_DATA === 'true';
}

/**
 * Get mock cases for development testing
 */
export function getMockPhoneticSearchCases(): SyncedCase[] {
  console.log(
    '[DEV MOCK] Returning',
    mockPhoneticSearchCases.length,
    'mock cases for phonetic search testing',
  );
  return mockPhoneticSearchCases;
}
