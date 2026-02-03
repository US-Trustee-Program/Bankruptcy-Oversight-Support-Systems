/**
 * Mock Case Dataset for Phonetic Search Testing
 *
 * Provides comprehensive test cases with properly populated phoneticTokens
 * to test all phonetic search edge cases:
 * - Jon/John (phonetic match)
 * - Mike/Michael (nickname match)
 * - Bob/Robert (nickname match)
 * - Jon/Jane (false positive to avoid)
 * - Different chapters (7, 11, 12, 13, 15)
 */

import { SyncedCase } from '@common/cams/cases';
import { generatePhoneticTokens } from '../../../backend/lib/adapters/utils/phonetic-helper';

/**
 * Helper to create a mock case with phonetic tokens
 */
function createCase(
  caseId: string,
  debtorName: string,
  chapter: string,
  courtDivisionCode: string = '081',
  closedDate?: string,
): SyncedCase {
  return {
    caseId,
    caseTitle: debtorName,
    chapter,
    courtDivisionCode,
    courtName: 'Test Court',
    courtId: 'test',
    courtDivisionName: 'Test Division',
    regionId: '02',
    regionName: 'New York',
    dateFiled: '2024-01-01',
    closedDate,
    debtor: {
      name: debtorName,
      address1: '123 Main St',
      cityStateZipCountry: 'New York, NY 10001',
      phoneticTokens: generatePhoneticTokens(debtorName),
    },
    documentType: 'SYNCED_CASE',
  } as SyncedCase;
}

/**
 * Comprehensive phonetic search test dataset
 *
 * Categories:
 * 1. Jon/John phonetic matches
 * 2. Mike/Michael nickname matches
 * 3. Bob/Robert nickname matches
 * 4. Jane cases (false positives to avoid)
 * 5. Various chapters (7, 11, 12, 13, 15)
 * 6. Open and closed cases
 */
export const phoneticSearchTestCases: SyncedCase[] = [
  // ===== Jon/John Phonetic Matches =====
  createCase('24-00001', 'Jon Smith', '7'),
  createCase('24-00002', 'John Smith', '7'),
  createCase('24-00003', 'Jonathan Williams', '11'),
  createCase('24-00004', 'John Davis', '13'),
  createCase('24-00005', 'Jon Martinez', '15'),

  // ===== Mike/Michael Nickname Matches =====
  createCase('24-00010', 'Michael Johnson', '7'),
  createCase('24-00011', 'Mike Johnson', '11'),
  createCase('24-00012', 'Michael Brown', '13'),
  createCase('24-00013', 'Mike Williams', '15'),
  createCase('24-00014', 'Michael Anderson', '7'),

  // ===== Bob/Robert Nickname Matches =====
  createCase('24-00020', 'Robert Taylor', '7'),
  createCase('24-00021', 'Bob Taylor', '11'),
  createCase('24-00022', 'Robert Thompson', '13'),
  createCase('24-00023', 'Bob Garcia', '15'),
  createCase('24-00024', 'Bobby Martinez', '7'),

  // ===== Jane Cases (False Positives to Filter Out) =====
  createCase('24-00030', 'Jane Doe', '7'),
  createCase('24-00031', 'Jane Smith', '11'),
  createCase('24-00032', 'Janet Jackson', '13'),
  createCase('24-00033', 'Jane Wilson', '15'),

  // ===== Other Common Names =====
  createCase('24-00040', 'William Brown', '7'),
  createCase('24-00041', 'Bill Brown', '11'),
  createCase('24-00042', 'James Miller', '13'),
  createCase('24-00043', 'Jim Miller', '15'),
  createCase('24-00044', 'Richard Davis', '7'),
  createCase('24-00045', 'Rick Davis', '11'),
  createCase('24-00046', 'Dick Wilson', '13'),

  // ===== Closed Cases (For Include Closed filter testing) =====
  createCase('24-00050', 'John Closed', '7', '081', '2024-06-01'),
  createCase('24-00051', 'Mike Closed', '11', '081', '2024-06-01'),
  createCase('24-00052', 'Bob Closed', '13', '081', '2024-06-01'),

  // ===== Different Court Divisions =====
  createCase('24-00060', 'John Manhattan', '7', '081'), // Manhattan
  createCase('24-00061', 'Michael Brooklyn', '11', '082'), // Brooklyn
  createCase('24-00062', 'Robert Queens', '13', '083'), // Queens
  createCase('24-00063', 'Jon Bronx', '15', '084'), // Bronx

  // ===== Chapter 12 Cases (For Chapter filter testing) =====
  createCase('24-00070', 'John Farmer', '12'),
  createCase('24-00071', 'Michael Ranch', '12'),
  createCase('24-00072', 'Robert Agriculture', '12'),

  // ===== Multi-word Names =====
  createCase('24-00080', 'Jon Paul Smith', '7'),
  createCase('24-00081', 'John Michael Davis', '11'),
  createCase('24-00082', 'Michael Jon Williams', '13'),

  // ===== Names with Special Characters =====
  createCase('24-00090', "Jon O'Brien", '7'),
  createCase('24-00091', "Michael O'Connor", '11'),
  createCase('24-00092', 'Robert Smith-Jones', '13'),

  // ===== Edge Cases =====
  createCase('24-00100', 'Jon', '7'), // Single name
  createCase('24-00101', 'John', '11'), // Single name
  createCase('24-00102', 'Jane', '13'), // Single name (false positive)
  createCase('24-00103', 'Mike', '15'), // Single name
  createCase('24-00104', 'Michael', '7'), // Single name
  createCase('24-00105', 'Bob', '11'), // Single name
  createCase('24-00106', 'Robert', '13'), // Single name
];

/**
 * Get cases matching specific criteria for targeted tests
 */
export const phoneticSearchTestSets = {
  // Jon/John phonetic matches
  jonJohnCases: phoneticSearchTestCases.filter(
    (c) =>
      c.debtor?.name.toLowerCase().includes('jon') &&
      !c.debtor?.name.toLowerCase().includes('jane'),
  ),

  // Mike/Michael nickname matches
  mikeMichaelCases: phoneticSearchTestCases.filter((c) =>
    c.debtor?.name.toLowerCase().match(/\b(mike|michael)\b/),
  ),

  // Bob/Robert nickname matches
  bobRobertCases: phoneticSearchTestCases.filter((c) =>
    c.debtor?.name.toLowerCase().match(/\b(bob|robert|bobby)\b/),
  ),

  // Jane cases (should NOT match Jon searches)
  janeCases: phoneticSearchTestCases.filter((c) => c.debtor?.name.toLowerCase().includes('jane')),

  // Open cases only
  openCases: phoneticSearchTestCases.filter((c) => !c.closedDate),

  // Closed cases only
  closedCases: phoneticSearchTestCases.filter((c) => !!c.closedDate),

  // Chapter 7 only
  chapter7Cases: phoneticSearchTestCases.filter((c) => c.chapter === '7'),

  // Chapter 11 only
  chapter11Cases: phoneticSearchTestCases.filter((c) => c.chapter === '11'),

  // Chapter 12 only
  chapter12Cases: phoneticSearchTestCases.filter((c) => c.chapter === '12'),

  // Manhattan court division only
  manhattanCases: phoneticSearchTestCases.filter((c) => c.courtDivisionCode === '081'),
};

/**
 * Helper to log phonetic tokens for debugging
 */
export function logPhoneticTokens(cases: SyncedCase[]) {
  console.log('\\n=== Phonetic Tokens Debug ===');
  cases.forEach((c) => {
    console.log(`${c.caseId}: ${c.debtor?.name} -> [${c.debtor?.phoneticTokens?.join(', ')}]`);
  });
  console.log('============================\\n');
}

/**
 * Expected results for common search queries (using 0.75 threshold)
 */
export const expectedSearchResults = {
  // Searching for "Jon" should match Jon, John, Jonathan
  // but NOT Jane (even though they have same phonetic tokens, Jaro-Winkler filters it out at 0.75 threshold)
  jon: {
    shouldMatch: ['Jon Smith', 'John Smith', 'Jonathan Williams', 'John Davis', 'Jon Martinez'],
    shouldNotMatch: ['Jane Doe', 'Jane Smith'],
  },

  // Searching for "Mike" should match Mike and Michael
  mike: {
    shouldMatch: [
      'Michael Johnson',
      'Mike Johnson',
      'Michael Brown',
      'Mike Williams',
      'Michael Anderson',
    ],
    shouldNotMatch: ['Jane Doe', 'Jon Smith'],
  },

  // Searching for "Bob" should match Bob, Robert, Bobby
  bob: {
    shouldMatch: ['Robert Taylor', 'Bob Taylor', 'Robert Thompson', 'Bob Garcia', 'Bobby Martinez'],
    shouldNotMatch: ['Jane Doe', 'Jon Smith', 'Mike Johnson'],
  },

  // Searching for "Jane" should NOT match Jon/John
  jane: {
    shouldMatch: ['Jane Doe', 'Jane Smith', 'Janet Jackson', 'Jane Wilson'],
    shouldNotMatch: ['Jon Smith', 'John Smith'],
  },
};
