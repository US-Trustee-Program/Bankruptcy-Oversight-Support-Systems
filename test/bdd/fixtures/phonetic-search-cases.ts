/**
 * Mock Case Dataset for Phonetic Search Testing
 *
 * Provides comprehensive test cases with properly populated phoneticTokens
 * to test all phonetic search edge cases including:
 *
 * **Core Phonetic/Nickname Matching:**
 * - Jon/John (phonetic match)
 * - Mike/Michael (nickname match)
 * - Bob/Robert (nickname match)
 * - Jon/Jane (false positive to avoid)
 *
 * **Phonetic Variations (Previously Lost with Soundex):**
 * - Gail/Gayle, Cathy/Kathy/Katherine, Stephen/Stephan/Steven
 * - Kristin/Kristen/Kirsten/Kirstin, Shawn/Sean, Sara/Sarah
 *
 * **International Names:**
 * - Spanish/Latino: José, María, García, Hernández, etc.
 * - Eastern European: Kowalski, Novak, Ivanova, Petrovic, etc.
 * - East Asian: Li Wei, Wang Fang, Kim Min-jun, Tanaka Yuki, Nguyen Van Anh, etc.
 * - Arabic/Middle Eastern: Mohammed, Hassan, Fatima, Abdullah, etc.
 *
 * **Edge Cases:**
 * - Names with stop words (and, or, in): "Mary And Joseph Smith"
 * - Very short names (2 characters): Wu, Li, Yi, Bo, Ed, Al, etc.
 * - Names with numbers: John Smith III, 7-Eleven Corporation, etc.
 * - Complex multi-cultural: José O'Brien-Martinez, Li Wei-Johnson, etc.
 * - Unusual formatting: All caps, mixed case, extra spaces, multiple hyphens, etc.
 *
 * **Test Organization:**
 * - Different chapters (7, 11, 12, 13, 15)
 * - Multiple court divisions
 * - Open and closed cases
 */

import { SyncedCase } from '@common/cams/cases';
import { generateSearchTokens } from '../../../backend/lib/adapters/utils/phonetic-helper';
import { randomUUID } from 'crypto';

const SYSTEM_USER_REFERENCE = { id: 'SYSTEM', name: 'SYSTEM' };

/**
 * Helper to create a mock case with phonetic tokens
 * Uses the same token generation as export-and-load (bigrams + Soundex + Metaphone)
 *
 * Note: Uses courtDivisionCode '081' (Manhattan) so cases appear in user's division filter
 * Test cases use caseNumber pattern "99-XXXXX" for safe cleanup (won't conflict with real cases)
 */
function createCase(
  caseId: string,
  debtorName: string,
  chapter: string,
  courtDivisionCode: string = '081', // Use real division so cases appear in search
  closedDate?: string,
): SyncedCase {
  // caseNumber is the case ID (e.g., "99-00001" for test cases)
  const caseNumber = caseId;

  // caseId must follow the pattern: {courtDivisionCode}-{caseNumber}
  // Example: "081-99-00001" where 081 is Manhattan court division
  const fullCaseId = `${courtDivisionCode}-${caseNumber}`;

  const caseData = {
    id: randomUUID(),
    caseId: fullCaseId,
    caseNumber,
    caseTitle: debtorName,
    dateFiled: '2024-01-01',
    dxtrId: '0',
    chapter,
    courtId: '0999',
    courtName: 'Test Court',
    courtDivisionCode,
    courtDivisionName: 'Test Division',
    judgeName: 'Test Judge',
    regionId: '02',
    regionName: 'NEW YORK',
    petitionCode: 'VP',
    petitionLabel: 'Voluntary',
    debtorTypeCode: 'IC',
    debtorTypeLabel: 'Individual Consumer',
    debtor: {
      name: debtorName,
      address1: '123 Main St',
      address2: null,
      address3: null,
      cityStateZipCountry: 'New York, NY 10001',
      taxId: null,
      ssn: null,
      phoneticTokens: generateSearchTokens(debtorName),
    },
    debtorAttorney: {
      name: 'Test Attorney',
      address1: '456 Law Street',
      address2: null,
      address3: null,
      cityStateZipCountry: 'New York, NY 10001',
      phone: '555-1234',
      email: 'attorney@test.com',
      office: 'Test Law Firm',
    },
    documentType: 'SYNCED_CASE',
    updatedOn: new Date().toISOString(),
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  // Only add closedDate if it's actually provided (don't add null/undefined)
  if (closedDate) {
    caseData.closedDate = closedDate;
  }

  return caseData as SyncedCase;
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
  createCase('00-00001', 'Jon Smith', '7'),
  createCase('00-00002', 'John Smith', '7'),
  createCase('00-00003', 'Jonathan Williams', '11'),
  createCase('00-00004', 'John Davis', '13'),
  createCase('00-00005', 'Jon Martinez', '15'),

  // ===== Mike/Michael Nickname Matches =====
  createCase('00-00010', 'Michael Johnson', '7'),
  createCase('00-00011', 'Mike Johnson', '11'),
  createCase('00-00012', 'Michael Brown', '13'),
  createCase('00-00013', 'Mike Williams', '15'),
  createCase('00-00014', 'Michael Anderson', '7'),

  // ===== Bob/Robert Nickname Matches =====
  createCase('00-00020', 'Robert Taylor', '7'),
  createCase('00-00021', 'Bob Taylor', '11'),
  createCase('00-00022', 'Robert Thompson', '13'),
  createCase('00-00023', 'Bob Garcia', '15'),
  createCase('00-00024', 'Bobby Martinez', '7'),

  // ===== Jane Cases (False Positives to Filter Out) =====
  createCase('00-00030', 'Jane Doe', '7'),
  createCase('00-00031', 'Jane Smith', '11'),
  createCase('00-00032', 'Janet Jackson', '13'),
  createCase('00-00033', 'Jane Wilson', '15'),

  // ===== Other Common Names =====
  createCase('00-00040', 'William Brown', '7'),
  createCase('00-00041', 'Bill Brown', '11'),
  createCase('00-00042', 'James Miller', '13'),
  createCase('00-00043', 'Jim Miller', '15'),
  createCase('00-00044', 'Richard Davis', '7'),
  createCase('00-00045', 'Rick Davis', '11'),
  createCase('00-00046', 'Dick Wilson', '13'),

  // ===== Closed Cases (For Include Closed filter testing) =====
  createCase('00-00050', 'John Closed', '7', '081', '2024-06-01'),
  createCase('00-00051', 'Mike Closed', '11', '081', '2024-06-01'),
  createCase('00-00052', 'Bob Closed', '13', '081', '2024-06-01'),

  // ===== Different Court Divisions =====
  createCase('00-00060', 'John Manhattan', '7', '081'), // Manhattan
  createCase('00-00061', 'Michael Brooklyn', '11', '082'), // Brooklyn
  createCase('00-00062', 'Robert Queens', '13', '083'), // Queens
  createCase('00-00063', 'Jon Bronx', '15', '084'), // Bronx

  // ===== Chapter 12 Cases (For Chapter filter testing) =====
  createCase('00-00070', 'John Farmer', '12'),
  createCase('00-00071', 'Michael Ranch', '12'),
  createCase('00-00072', 'Robert Agriculture', '12'),

  // ===== Multi-word Names =====
  createCase('00-00080', 'Jon Paul Smith', '7'),
  createCase('00-00081', 'John Michael Davis', '11'),
  createCase('00-00082', 'Michael Jon Williams', '13'),

  // ===== Names with Special Characters =====
  createCase('00-00090', "Jon O'Brien", '7'),
  createCase('00-00091', "Michael O'Connor", '11'),
  createCase('00-00092', 'Robert Smith-Jones', '13'),

  // ===== Edge Cases =====
  createCase('00-00100', 'Jon', '7'), // Single name
  createCase('00-00101', 'John', '11'), // Single name
  createCase('00-00102', 'Jane', '13'), // Single name (false positive)
  createCase('00-00103', 'Mike', '15'), // Single name
  createCase('00-00104', 'Michael', '7'), // Single name
  createCase('00-00105', 'Bob', '11'), // Single name
  createCase('00-00106', 'Robert', '13'), // Single name

  // ===== Phonetic Variation Matches (Previously Lost with Soundex) =====
  createCase('00-00110', 'Gail Anderson', '7'), // Gail/Gayle phonetic match
  createCase('00-00111', 'Gayle Thompson', '11'), // Gail/Gayle phonetic match
  createCase('00-00112', 'Cathy Williams', '13'), // Cathy/Kathy phonetic match
  createCase('00-00113', 'Kathy Martinez', '15'), // Cathy/Kathy phonetic match
  createCase('00-00114', 'Katherine Smith', '7'), // Cathy/Kathy/Katherine
  createCase('00-00115', 'Stephan Brown', '11'), // Stephen/Stephan/Steven phonetic match
  createCase('00-00116', 'Stephen Garcia', '13'), // Stephen/Stephan/Steven phonetic match
  createCase('00-00117', 'Steven Wilson', '15'), // Stephen/Stephan/Steven phonetic match
  createCase('00-00118', 'Kristin Davis', '7'), // Kristin/Kristen/Kirsten/Kirstin
  createCase('00-00119', 'Kristen Lee', '11'), // Kristin/Kristen/Kirsten/Kirstin
  createCase('00-00120', 'Kirsten Johnson', '13'), // Kristin/Kristen/Kirsten/Kirstin
  createCase('00-00121', 'Kirstin Miller', '15'), // Kristin/Kristen/Kirsten/Kirstin
  createCase('00-00122', 'Shawn Taylor', '7'), // Shawn/Sean phonetic match
  createCase('00-00123', 'Sean Anderson', '11'), // Shawn/Sean phonetic match
  createCase('00-00124', 'Sara Thomas', '13'), // Sara/Sarah phonetic match
  createCase('00-00125', 'Sarah Moore', '15'), // Sara/Sarah phonetic match

  // ===== Spanish/Latino Names =====
  createCase('00-00200', 'José García Rodriguez', '7'),
  createCase('00-00201', 'Maria Hernández Lopez', '11'),
  createCase('00-00202', 'Juan Carlos Martinez', '13'),
  createCase('00-00203', 'Carmen Ramirez', '15'),
  createCase('00-00204', 'Miguel Angel Perez', '7'),
  createCase('00-00205', 'Rosa Maria Gonzalez', '11'),
  createCase('00-00206', 'Francisco Javier Sanchez', '13'),
  createCase('00-00207', 'Ana Sofia Torres', '15'),
  createCase('00-00208', 'Luis Fernando Rivera', '7'),
  createCase('00-00209', 'Elena Gutierrez', '11'),
  createCase('00-00210', 'Diego Alejandro Diaz', '13'),
  createCase('00-00211', 'Gabriela Morales', '15'),
  createCase('00-00212', 'Ricardo Vargas', '7'),
  createCase('00-00213', 'Lucia Castillo', '11'),
  createCase('00-00214', 'Pablo Jimenez', '13'),
  createCase('00-00215', 'Isabel Flores', '15'),

  // ===== Eastern European Names =====
  createCase('00-00300', 'Aleksander Kowalski', '7'),
  createCase('00-00301', 'Anna Nowak', '11'),
  createCase('00-00302', 'Jan Wojciech Wisnewski', '13'),
  createCase('00-00303', 'Katarzyna Lewandowska', '15'),
  createCase('00-00304', 'Petr Novak', '7'),
  createCase('00-00305', 'Elena Ivanova', '11'),
  createCase('00-00306', 'Dmitri Kuznetsov', '13'),
  createCase('00-00307', 'Olga Sokolova', '15'),
  createCase('00-00308', 'Andrei Popov', '7'),
  createCase('00-00309', 'Natalia Volkov', '11'),
  createCase('00-00310', 'Zoran Jovanovic', '13'),
  createCase('00-00311', 'Svetlana Petrovic', '15'),
  createCase('00-00312', 'Miklos Nagy', '7'),
  createCase('00-00313', 'Eva Horvath', '11'),
  createCase('00-00314', 'Josef Schmidt', '13'),
  createCase('00-00315', 'Anja Mueller', '15'),

  // ===== East Asian Names =====
  createCase('00-00400', 'Li Wei', '7'),
  createCase('00-00401', 'Wang Fang', '11'),
  createCase('00-00402', 'Zhang Wei', '13'),
  createCase('00-00403', 'Liu Yang', '15'),
  createCase('00-00404', 'Chen Jing', '7'),
  createCase('00-00405', 'Yang Li', '11'),
  createCase('00-00406', 'Huang Wei', '13'),
  createCase('00-00407', 'Zhao Ming', '15'),
  createCase('00-00408', 'Kim Min-jun', '7'),
  createCase('00-00409', 'Park Ji-woo', '11'),
  createCase('00-00410', 'Lee Seo-yeon', '13'),
  createCase('00-00411', 'Choi Ji-hoon', '15'),
  createCase('00-00412', 'Tanaka Yuki', '7'),
  createCase('00-00413', 'Sato Haruto', '11'),
  createCase('00-00414', 'Suzuki Aoi', '13'),
  createCase('00-00415', 'Takahashi Ren', '15'),
  createCase('00-00416', 'Nguyen Van Anh', '7'),
  createCase('00-00417', 'Tran Thi Mai', '11'),
  createCase('00-00418', 'Pham Van Minh', '13'),
  createCase('00-00419', 'Le Thi Hoa', '15'),

  // ===== Arabic/Middle Eastern Names =====
  createCase('00-00500', 'Mohammed Ahmed Abdullah', '7'),
  createCase('00-00501', 'Fatima Hassan Ali', '11'),
  createCase('00-00502', 'Ahmad Ibrahim Khalil', '13'),
  createCase('00-00503', 'Aisha Muhammed Hussein', '15'),
  createCase('00-00504', 'Ali Hassan Mahmoud', '7'),
  createCase('00-00505', 'Khadija Omar Said', '11'),
  createCase('00-00506', 'Omar Abdullah Rahman', '13'),
  createCase('00-00507', 'Layla Ahmet Farah', '15'),
  createCase('00-00508', 'Hassan Ali Nasser', '7'),
  createCase('00-00509', 'Amina Ibrahim Saleh', '11'),
  createCase('00-00510', 'Yusuf Muhammad Kareem', '13'),
  createCase('00-00511', 'Zahra Hasan Karim', '15'),
  createCase('00-00512', 'Abdullah Umar Hamza', '7'),
  createCase('00-00513', 'Maryam Ahmad Zainab', '11'),
  createCase('00-00514', 'Bilal Hassan Tariq', '13'),
  createCase('00-00515', 'Noor Ali Faisal', '15'),

  // ===== Names with Stop Words =====
  createCase('00-00600', 'Mary And Joseph Smith', '7'),
  createCase('00-00601', 'John Or Jane Corporation', '11'),
  createCase('00-00602', 'Mike In The Middle LLC', '13'),
  createCase('00-00603', 'Robert Of The Valley Inc', '15'),
  createCase('00-00604', 'Sarah And The Associates', '7'),
  createCase('00-00605', 'David Or Associates LLC', '11'),
  createCase('00-00606', 'Partners In Business Corp', '13'),
  createCase('00-00607', 'Friends And Family Trust', '15'),
  createCase('00-00608', 'Brothers Or Sisters Inc', '7'),
  createCase('00-00609', 'Parent And Child Services', '11'),

  // ===== Very Short Names (2 characters) =====
  createCase('00-00700', 'Wu', '7'),
  createCase('00-00701', 'Li', '11'),
  createCase('00-00702', 'Yi', '13'),
  createCase('00-00703', 'Ng', '15'),
  createCase('00-00704', 'Wu Li', '7'),
  createCase('00-00705', 'Li Yi', '11'),
  createCase('00-00706', 'Yi Ng', '13'),
  createCase('00-00707', 'Bo Smith', '15'),
  createCase('00-00708', 'Ty Johnson', '7'),
  createCase('00-00709', 'Jo Williams', '11'),
  createCase('00-00710', 'Ed Davis', '13'),
  createCase('00-00711', 'Al Martinez', '15'),
  createCase('00-00712', 'Cy Brown', '7'),

  // ===== Names with Numbers =====
  createCase('00-00800', 'John Smith III', '7'),
  createCase('00-00801', 'Robert Johnson Jr 2nd', '11'),
  createCase('00-00802', 'Michael Williams IV', '13'),
  createCase('00-00803', 'David Brown V', '15'),
  createCase('00-00804', 'James Davis Sr 1st', '7'),
  createCase('00-00805', 'William Miller III', '11'),
  createCase('00-00806', 'Richard Wilson Jr 2nd', '13'),
  createCase('00-00807', 'Thomas Moore IV', '15'),
  createCase('00-00808', '3M Company', '7'),
  createCase('00-00809', '7-Eleven Corporation', '11'),
  createCase('00-00810', '24 Hour Fitness Inc', '13'),
  createCase('00-00811', '99 Cents Store LLC', '15'),
  createCase('00-00812', '1st National Bank', '7'),
  createCase('00-00813', '2nd Avenue Partners', '11'),

  // ===== Complex Multi-Cultural Names =====
  createCase('00-00900', "José O'Brien-Martinez", '7'),
  createCase('00-00901', 'Li Wei-Johnson', '11'),
  createCase('00-00902', 'Anna Kowalski-Smith', '13'),
  createCase('00-00903', 'Mohammed Al-Hassan', '15'),
  createCase('00-00904', 'Maria De La Cruz', '7'),
  createCase('00-00905', 'Jean-Pierre Dubois', '11'),
  createCase('00-00906', 'Carlos Von Schmidt', '13'),
  createCase('00-00907', 'Fatima Bin Abdullah', '15'),
  createCase('00-00908', 'Kim Lee-Park', '7'),
  createCase('00-00909', 'Hassan Abu-Baker', '11'),

  // ===== Mixed Case and Unusual Formatting =====
  createCase('00-01000', 'John SMITH', '7'), // All caps
  createCase('00-01001', 'John smith', '11'), // All lowercase
  createCase('00-01002', 'John SmItH', '13'), // Mixed case
  createCase('00-01003', '  Michael   Johnson  ', '15'), // Extra spaces
  createCase('00-01004', 'Robert-Smith-Jones', '7'), // Multiple hyphens
  createCase('00-01005', "O'Brien O'Connor", '11'), // Multiple apostrophes
  createCase('00-01006', 'Van Der Berg', '13'), // Dutch prefix
  createCase('00-01007', 'De La Garza', '15'), // Spanish compound
  createCase('00-01008', 'Von Trapp', '7'), // German prefix
  createCase('00-01009', 'El-Amin', '11'), // Arabic prefix
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

  // ===== NEW EXPANDED TEST SETS =====

  // Phonetic variation cases (Gail/Gayle, Cathy/Kathy, etc.)
  phoneticVariationCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00110' && c.caseId <= '24-00125',
  ),

  // Spanish/Latino names
  spanishNameCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00200' && c.caseId <= '24-00215',
  ),

  // Eastern European names
  easternEuropeanCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00300' && c.caseId <= '24-00315',
  ),

  // East Asian names
  eastAsianCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00400' && c.caseId <= '24-00419',
  ),

  // Arabic/Middle Eastern names
  arabicNameCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00500' && c.caseId <= '24-00515',
  ),

  // Names with stop words (and, or, in)
  stopWordCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00600' && c.caseId <= '24-00609',
  ),

  // Very short names (2 characters)
  shortNameCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00700' && c.caseId <= '24-00712',
  ),

  // Names with numbers
  numberInNameCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00800' && c.caseId <= '24-00813',
  ),

  // Complex multi-cultural names
  multiCulturalCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-00900' && c.caseId <= '24-00909',
  ),

  // Mixed case and unusual formatting
  unusualFormattingCases: phoneticSearchTestCases.filter(
    (c) => c.caseId >= '24-01000' && c.caseId <= '24-01009',
  ),

  // All international names (combined)
  internationalCases: phoneticSearchTestCases.filter(
    (c) =>
      (c.caseId >= '24-00200' && c.caseId <= '24-00215') || // Spanish
      (c.caseId >= '24-00300' && c.caseId <= '24-00315') || // Eastern European
      (c.caseId >= '24-00400' && c.caseId <= '24-00419') || // East Asian
      (c.caseId >= '24-00500' && c.caseId <= '24-00515'), // Arabic
  ),

  // Edge case collections
  allEdgeCases: phoneticSearchTestCases.filter(
    (c) =>
      (c.caseId >= '24-00100' && c.caseId <= '24-00125') || // Original edge cases + phonetic variations
      (c.caseId >= '24-00600' && c.caseId <= '24-00609') || // Stop words
      (c.caseId >= '24-00700' && c.caseId <= '24-00712') || // Short names
      (c.caseId >= '24-00800' && c.caseId <= '24-00813') || // Numbers
      (c.caseId >= '24-01000' && c.caseId <= '24-01009'), // Unusual formatting
  ),
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
 * Expected results for common search queries
 */
export const expectedSearchResults = {
  // Searching for "Jon" should match Jon, John, Jonathan
  // but NOT Jane (even though they have same phonetic tokens, word-level matching filters it out)
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

  // ===== PHONETIC VARIATION CASES =====

  // Searching for "Gail" should match "Gayle" (phonetic match)
  gail: {
    shouldMatch: ['Gail Anderson', 'Gayle Thompson'],
    shouldNotMatch: ['Jane Doe', 'Michael Johnson'],
  },

  // Searching for "Cathy" should match "Kathy" and "Katherine"
  cathy: {
    shouldMatch: ['Cathy Williams', 'Kathy Martinez', 'Katherine Smith'],
    shouldNotMatch: ['Jane Doe', 'Gail Anderson'],
  },

  // Searching for "Stephen" should match "Stephan" and "Steven"
  stephen: {
    shouldMatch: ['Stephan Brown', 'Stephen Garcia', 'Steven Wilson'],
    shouldNotMatch: ['Michael Johnson', 'Robert Taylor'],
  },

  // Searching for "Kristin" should match all spelling variations
  kristin: {
    shouldMatch: ['Kristin Davis', 'Kristen Lee', 'Kirsten Johnson', 'Kirstin Miller'],
    shouldNotMatch: ['Cathy Williams', 'Jane Doe'],
  },

  // ===== INTERNATIONAL NAME TESTS =====

  // Spanish names - searching for "Garcia" should find García
  garcia: {
    shouldMatch: ['José García Rodriguez'],
    shouldNotMatch: ['Michael Johnson', 'Li Wei'],
  },

  // Spanish names - searching for "José" should work
  jose: {
    shouldMatch: ['José García Rodriguez', "José O'Brien-Martinez"],
    shouldNotMatch: ['Michael Johnson', 'Mohammed Ahmed Abdullah'],
  },

  // Polish names
  kowalski: {
    shouldMatch: ['Aleksander Kowalski', 'Anna Kowalski-Smith'],
    shouldNotMatch: ['Li Wei', 'Mohammed Ahmed Abdullah'],
  },

  // Russian names
  ivanova: {
    shouldMatch: ['Elena Ivanova'],
    shouldNotMatch: ['Li Wei', 'José García Rodriguez'],
  },

  // Chinese names - searching for "Li" (very common, should match multiple)
  li: {
    shouldMatch: ['Li Wei', 'Li', 'Li Yi', 'Li Wei-Johnson'],
    shouldNotMatch: ['Wang Fang', 'José García Rodriguez'],
  },

  // Korean names
  kim: {
    shouldMatch: ['Kim Min-jun', 'Kim Lee-Park'],
    shouldNotMatch: ['Li Wei', 'Mohammed Ahmed Abdullah'],
  },

  // Arabic names - searching for "Mohammed"
  mohammed: {
    shouldMatch: [
      'Mohammed Ahmed Abdullah',
      'Aisha Mohammed Hussein',
      'Yusuf Mohammed Kareem',
      'Mohammed Al-Hassan',
    ],
    shouldNotMatch: ['José García Rodriguez', 'Li Wei'],
  },

  // Arabic names - searching for "Hassan"
  hassan: {
    shouldMatch: [
      'Fatima Hassan Ali',
      'Ali Hassan Mahmoud',
      'Hassan Ali Nasser',
      'Mohammed Al-Hassan',
      'Hassan Abu-Baker',
    ],
    shouldNotMatch: ['Li Wei', 'José García Rodriguez'],
  },

  // ===== EDGE CASE TESTS =====

  // Very short name - searching for "Wu"
  wu: {
    shouldMatch: ['Wu', 'Wu Li'],
    shouldNotMatch: ['Li Yi', 'Jo Williams'],
  },

  // Names with Roman numerals
  'John iii': {
    shouldMatch: ['John Smith III'],
    shouldNotMatch: ['John Smith', 'Michael Williams IV'],
  },

  // Company names with numbers
  '7-eleven': {
    shouldMatch: ['7-Eleven Corporation'],
    shouldNotMatch: ['3M Company', '99 Cents Store LLC'],
  },

  // Names with stop words
  'mary and joseph': {
    shouldMatch: ['Mary And Joseph Smith'],
    shouldNotMatch: ['John Or Jane Corporation', 'Mike In The Middle LLC'],
  },

  // Case insensitivity test
  John: {
    shouldMatch: ['John SMITH', 'John smith', 'John SmItH', 'John Smith'],
    shouldNotMatch: ['Jane Doe'],
  },
};
