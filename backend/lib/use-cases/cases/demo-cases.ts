import { SyncedCase } from '@common/cams/cases';
import { generatePhoneticTokens } from './phonetic-utils';

/**
 * Demo cases designed to showcase all search capabilities:
 * - Nickname matching (Mike/Michael, Bill/William, Bob/Robert)
 * - Phonetic matching (Jon/John/Jonathan, Smith/Smyth)
 * - False positive filtering (Jane Doe should NOT match Jon Doe)
 * - Partial word matching (john sm, mik joh, etc.)
 * - Full name searches (Jon Doe finds Jon Doe, John Doe, Jonathan Doe)
 */

function createDemoCase(
  caseId: string,
  debtorName: string,
  chapter: '7' | '15',
  jointDebtorName?: string,
): SyncedCase {
  const baseCase: SyncedCase = {
    caseId,
    chapter,
    caseTitle: debtorName,
    dateFiled: '2024-01-15',
    courtId: '081',
    courtName: 'Manhattan',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    regionId: '02',
    regionName: 'NEW YORK',
    officeName: 'Manhattan',
    officeCode: 'USTP_SDNY',
    groupDesignator: 'MA',
    debtor: {
      name: debtorName,
      phoneticTokens: generatePhoneticTokens(debtorName),
    },
    documentType: 'SYNCED_CASE',
  };

  if (jointDebtorName) {
    baseCase.jointDebtor = {
      name: jointDebtorName,
      phoneticTokens: generatePhoneticTokens(jointDebtorName),
    };
  }

  return baseCase;
}

/**
 * Demo cases covering all search scenarios
 */
export const DEMO_CASES: SyncedCase[] = [
  // Nickname matching scenarios (mix of Ch7 and Ch15)
  createDemoCase('081-24-00001', 'Michael Johnson', '7'),
  createDemoCase('081-24-00002', 'Mike Anderson', '15'),
  createDemoCase('081-24-00003', 'William Smith', '7'),
  createDemoCase('081-24-00004', 'Bill Thompson', '15'),
  createDemoCase('081-24-00005', 'Robert Brown', '7'),
  createDemoCase('081-24-00006', 'Bob Wilson', '15'),

  // Phonetic matching scenarios (misspellings)
  createDemoCase('081-24-00007', 'John Davis', '7'),
  createDemoCase('081-24-00008', 'Jon Miller', '15'),
  createDemoCase('081-24-00009', 'Jonathan Garcia', '7'),
  createDemoCase('081-24-00010', 'Smith Martinez', '15'),
  createDemoCase('081-24-00011', 'Smyth Rodriguez', '7'),

  // Jon/John/Jonathan with Doe last name (for "Jon Doe" searches)
  createDemoCase('081-24-00031', 'Jon Doe', '7'),
  createDemoCase('081-24-00032', 'John Doe', '15'),
  createDemoCase('081-24-00033', 'Jonathan Doe', '7'),

  // False positive test cases (should NOT match Jon)
  createDemoCase('081-24-00012', 'Jane Doe', '15'),
  createDemoCase('081-24-00013', 'Jane Wilson', '7'),

  // Partial word matching test cases
  createDemoCase('081-24-00014', 'John Smith', '7'),
  createDemoCase('081-24-00015', "Michael O'Brien", '15'),

  // Joint debtor scenarios
  createDemoCase('081-24-00016', 'James Harris', '7', 'Michael Harris'),
  createDemoCase('081-24-00017', 'Sarah Lee', '15', 'Bill Lee'),
  createDemoCase('081-24-00018', 'David Clark', '7', 'Jane Clark'),

  // Name order variations
  createDemoCase('081-24-00019', 'Smith John', '15'),
  createDemoCase('081-24-00020', 'Johnson Michael', '7'),

  // Complex names
  createDemoCase('081-24-00021', 'Michael Anthony Johnson', '15'),
  createDemoCase('081-24-00022', 'William Robert Smith Jr', '7'),
  createDemoCase('081-24-00023', 'Bob Alan Brown III', '15'),

  // Additional variety
  createDemoCase('081-24-00024', 'Christopher Taylor', '7'),
  createDemoCase('081-24-00025', 'Elizabeth Anderson', '15'),
  createDemoCase('081-24-00026', 'Richard Thomas', '7'),
  createDemoCase('081-24-00027', 'Patricia Moore', '15'),
  createDemoCase('081-24-00028', 'Charles Jackson', '7'),
  createDemoCase('081-24-00029', 'Jennifer White', '15'),
  createDemoCase('081-24-00030', 'Daniel Harris', '7'),

  // ===== Numeric suffix edge cases =====
  // Same name with and without suffix (to test if searches work both ways)
  createDemoCase('081-24-00034', 'Robert Johnson', '7'),
  createDemoCase('081-24-00035', 'Robert Johnson Jr', '15'),
  createDemoCase('081-24-00036', 'Robert Johnson Sr', '7'),

  // Various numeric suffixes
  createDemoCase('081-24-00037', 'James Williams II', '15'),
  createDemoCase('081-24-00038', 'James Williams III', '7'),
  createDemoCase('081-24-00039', 'James Williams IV', '15'),

  // Common professional suffixes
  createDemoCase('081-24-00040', 'Thomas Anderson Esq', '7'),
  createDemoCase('081-24-00041', 'Michael Davis MD', '15'),

  // Ordinal suffixes
  createDemoCase('081-24-00042', 'John Miller 3rd', '7'),
  createDemoCase('081-24-00043', 'William Brown 2nd', '15'),

  // Business names with numbers (corporate debtors)
  createDemoCase('081-24-00044', '2nd Street Properties LLC', '7'),
  createDemoCase('081-24-00045', '123 Corporation', '15'),
  createDemoCase('081-24-00046', 'ABC Holdings 2', '7'),
  createDemoCase('081-24-00047', '21st Century Ventures Inc', '15'),
  createDemoCase('081-24-00048', 'First National Bank', '7'),

  // Mixed: names with multiple suffixes or complex patterns
  createDemoCase('081-24-00049', 'William Smith Jr Esq', '15'),
  createDemoCase('081-24-00050', 'Dr Michael Johnson III', '7'),

  // ===== SPANISH NAMES (Romanized ASCII) =====
  // Demonstrates phonetic matching for Spanish names
  createDemoCase('081-24-00051', 'Jose Garcia', '7'),
  createDemoCase('081-24-00052', 'Jorge Lopez', '15'),
  createDemoCase('081-24-00053', 'Juan Rodriguez', '7'),
  createDemoCase('081-24-00054', 'Maria Martinez', '15'),
  createDemoCase('081-24-00055', 'Carlos Hernandez', '7'),
  createDemoCase('081-24-00056', 'Ana Gonzalez', '15'),
  createDemoCase('081-24-00057', 'Luis Fernandez', '7'),
  createDemoCase('081-24-00058', 'Carmen Ramirez', '15'),

  // Spanish name variants (to test phonetic matching)
  createDemoCase('081-24-00059', 'Joseph Garcia', '7'), // Jose variant
  createDemoCase('081-24-00060', 'Rodriquez Martinez', '15'), // Common typo
  createDemoCase('081-24-00061', 'Martines Gonzalez', '7'), // Missing z

  // ===== ARABIC NAMES (Romanized ASCII) =====
  // Demonstrates variant matching for Arabic romanizations
  createDemoCase('081-24-00062', 'Muhammad Ali', '7'),
  createDemoCase('081-24-00063', 'Mohammed Hassan', '15'),
  createDemoCase('081-24-00064', 'Mohammad Khan', '7'),
  createDemoCase('081-24-00065', 'Ahmed Ibrahim', '15'),
  createDemoCase('081-24-00066', 'Ahmad Rahman', '7'),
  createDemoCase('081-24-00067', 'Hussein Abdullah', '15'),
  createDemoCase('081-24-00068', 'Husain Khalil', '7'),
  createDemoCase('081-24-00069', 'Omar Mahmoud', '15'),
  createDemoCase('081-24-00070', 'Ali Yousef', '7'),
  createDemoCase('081-24-00071', 'Hassan Saleh', '15'),

  // ===== ASIAN NAMES (Romanized ASCII) =====
  // Chinese names
  createDemoCase('081-24-00072', 'Li Wang', '7'),
  createDemoCase('081-24-00073', 'Wang Chen', '15'),
  createDemoCase('081-24-00074', 'Zhang Wei', '7'),
  createDemoCase('081-24-00075', 'Liu Yang', '15'),
  createDemoCase('081-24-00076', 'Chen Ming', '7'),

  // Chinese name variants
  createDemoCase('081-24-00077', 'Wong Chen', '15'), // Cantonese variant of Wang
  createDemoCase('081-24-00078', 'Chang Wei', '7'), // Wade-Giles variant of Zhang

  // Korean names
  createDemoCase('081-24-00079', 'Kim Lee', '15'),
  createDemoCase('081-24-00080', 'Lee Park', '7'),
  createDemoCase('081-24-00081', 'Park Min', '15'),
  createDemoCase('081-24-00082', 'Choi Jung', '7'),

  // Vietnamese names
  createDemoCase('081-24-00083', 'Nguyen Tran', '15'),
  createDemoCase('081-24-00084', 'Tran Le', '7'),
  createDemoCase('081-24-00085', 'Le Pham', '15'),

  // Japanese names
  createDemoCase('081-24-00086', 'Tanaka Suzuki', '7'),
  createDemoCase('081-24-00087', 'Yamamoto Sato', '15'),
  createDemoCase('081-24-00088', 'Takahashi Ito', '7'),
];

/**
 * Demo search scenarios with expected results
 */
export const DEMO_SEARCH_SCENARIOS = [
  {
    query: 'Mike',
    description: 'Nickname matching: Should find both "Michael Johnson" and "Mike Anderson"',
    expectedCaseIds: ['081-24-00001', '081-24-00002'],
  },
  {
    query: 'Bill Smith',
    description: 'Nickname matching: Should find "William Smith"',
    expectedCaseIds: ['081-24-00003'],
  },
  {
    query: 'Bob',
    description: 'Nickname matching: Should find both "Robert Brown" and "Bob Wilson"',
    expectedCaseIds: ['081-24-00005', '081-24-00006'],
  },
  {
    query: 'Jon',
    description:
      'Phonetic matching: Should find "John Davis", "Jon Miller", "Jonathan Garcia" but NOT "Jane Doe" or "Jane Wilson"',
    expectedCaseIds: ['081-24-00007', '081-24-00008', '081-24-00009'],
  },
  {
    query: 'Smith',
    description: 'Phonetic matching: Should find both "Smith Martinez" and "Smyth Rodriguez"',
    expectedCaseIds: [
      '081-24-00010',
      '081-24-00011',
      '081-24-00014',
      '081-24-00019',
      '081-24-00022',
    ],
  },
  {
    query: 'john sm',
    description: 'Partial word matching: Should find "John Smith"',
    expectedCaseIds: ['081-24-00014'],
  },
  {
    query: 'mik joh',
    description:
      'Partial word + nickname: Should find "Michael Johnson" and "Michael Anthony Johnson"',
    expectedCaseIds: ['081-24-00001', '081-24-00021'],
  },
  {
    query: 'Mike Harris',
    description: 'Joint debtor matching: Should find James Harris (joint debtor: Michael Harris)',
    expectedCaseIds: ['081-24-00016'],
  },
  {
    query: 'Jane',
    description: 'Should find Jane cases but NOT when searching for Jon',
    expectedCaseIds: ['081-24-00012', '081-24-00013', '081-24-00018'],
  },
  // Numeric suffix scenarios
  {
    query: 'Robert Johnson',
    description: 'Should find Robert Johnson (with and without suffixes)',
    expectedCaseIds: ['081-24-00034', '081-24-00035', '081-24-00036'],
  },
  {
    query: 'Robert Johnson Jr',
    description: 'Test suffix in search query - behavior depends on implementation',
    expectedCaseIds: ['081-24-00035'], // May also match others depending on suffix handling
  },
  {
    query: 'James Williams',
    description: 'Should find all James Williams cases (II, III, IV)',
    expectedCaseIds: ['081-24-00037', '081-24-00038', '081-24-00039'],
  },
  {
    query: 'John Miller 3rd',
    description: 'Ordinal suffix search',
    expectedCaseIds: ['081-24-00042'],
  },
  {
    query: '2nd Street',
    description: 'Business name with number',
    expectedCaseIds: ['081-24-00044'],
  },
  {
    query: 'Bill Smith',
    description: 'Nickname with suffix - should find "William Smith Jr Esq"',
    expectedCaseIds: ['081-24-00003', '081-24-00049'],
  },
  // Spanish name search scenarios
  {
    query: 'Jose',
    description: 'Spanish name: Should find "Jose Garcia" and "Joseph Garcia" (variant)',
    expectedCaseIds: ['081-24-00051', '081-24-00059'],
  },
  {
    query: 'Rodriguez',
    description: 'Spanish surname: Should find Rodriguez and Rodriquez (typo)',
    expectedCaseIds: ['081-24-00053', '081-24-00060'],
  },
  {
    query: 'Martinez',
    description: 'Spanish surname: Should find Martinez and Martines (missing z)',
    expectedCaseIds: ['081-24-00054', '081-24-00060', '081-24-00061'],
  },
  // Arabic name search scenarios
  {
    query: 'Muhammad',
    description: 'Arabic name variants: Should find Muhammad, Mohammed, Mohammad',
    expectedCaseIds: ['081-24-00062', '081-24-00063', '081-24-00064'],
  },
  {
    query: 'Mohammed',
    description: 'Arabic variant search: Should find all Muhammad variants',
    expectedCaseIds: ['081-24-00062', '081-24-00063', '081-24-00064'],
  },
  {
    query: 'Ahmed',
    description: 'Arabic name: Should find Ahmed and Ahmad (romanization variant)',
    expectedCaseIds: ['081-24-00065', '081-24-00066'],
  },
  {
    query: 'Hussein',
    description: 'Arabic name: Should find Hussein and Husain (romanization variant)',
    expectedCaseIds: ['081-24-00067', '081-24-00068'],
  },
  // Asian name search scenarios
  {
    query: 'Wang',
    description: 'Chinese surname: Should find Wang and Wong (Cantonese variant)',
    expectedCaseIds: ['081-24-00072', '081-24-00073', '081-24-00077'],
  },
  {
    query: 'Zhang',
    description: 'Chinese surname: Should find Zhang and Chang (Wade-Giles romanization)',
    expectedCaseIds: ['081-24-00074', '081-24-00078'],
  },
  {
    query: 'Kim',
    description: 'Korean surname: Should find Kim Lee',
    expectedCaseIds: ['081-24-00079'],
  },
  {
    query: 'Nguyen',
    description: 'Vietnamese surname: Most common Vietnamese surname',
    expectedCaseIds: ['081-24-00083'],
  },
];

export function getDemoCases(): SyncedCase[] {
  return DEMO_CASES;
}

export function getDemoSearchScenarios() {
  return DEMO_SEARCH_SCENARIOS;
}
