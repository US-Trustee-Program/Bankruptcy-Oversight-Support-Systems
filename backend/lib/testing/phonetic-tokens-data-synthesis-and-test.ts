/**
 * Phonetic Tokens - Data Synthesis and Integration Test
 *
 * This script:
 * 1. Connects to CAMS MongoDB database using real connection strings from .env
 * 2. Synthesizes test data (10 test cases with various debtor name scenarios)
 * 3. Tests backfill use case to populate phonetic tokens
 * 4. Tests search functionality with phonetic matching
 * 5. Validates results
 * 6. Cleans up test data
 *
 * IMPORTANT: This script requires DATABASE_MOCK='false' to connect to the real MongoDB database.
 *
 * Prerequisites:
 * - Ensure backend/.env contains valid MONGO_* connection variables
 * - VPN connection required if accessing remote database
 * - Database user must have INSERT/DELETE permissions on cases collection
 *
 * Usage:
 *   cd backend
 *   DATABASE_MOCK='false' npx tsx lib/testing/phonetic-tokens-data-synthesis-and-test.ts
 *
 * Note: Uses tsx instead of ts-node for better TypeScript path mapping support.
 */

import { config as dotenvConfig } from 'dotenv';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { LoggerImpl } from '../adapters/services/logger.service';
import factory from '../factory';
import { ApplicationContext } from '../adapters/types/basic';
import { CasesRepository } from '../use-cases/gateways.types';
import BackfillPhoneticTokens from '../use-cases/dataflows/backfill-phonetic-tokens';
import { generateSearchTokens } from '../adapters/utils/phonetic-helper';
import { CasesSearchPredicate } from '../../../common/src/api/search';
import { CaseSummary } from '../../../common/src/cams/cases';
import QueryBuilder from '../query/query-builder';

// Load environment variables
dotenvConfig();

const MODULE_NAME = 'PHONETIC-TOKENS-TEST';

// Test case IDs - using high numbers to avoid conflicts with production data
const TEST_CASES = {
  TC1_JON_NO_TOKENS: 'TC-PHON-001', // Jon Snow - needs backfill
  TC2_JOHN_NO_TOKENS: 'TC-PHON-002', // John Doe - needs backfill (phonetic match with Jon)
  TC3_MIKE_NO_TOKENS: 'TC-PHON-003', // Mike Smith - needs backfill
  TC4_MICHAEL_NO_TOKENS: 'TC-PHON-004', // Michael Johnson - needs backfill (nickname match with Mike)
  TC5_JOINT_DEBTOR: 'TC-PHON-005', // Bob and Robert as joint debtors (nickname match)
  TC6_SPECIAL_CHARS: 'TC-PHON-006', // O'Brien - special characters
  TC7_MULTI_WORD: 'TC-PHON-007', // Mary Jane Watson - multi-word name
  TC8_SHORT_NAME: 'TC-PHON-008', // Li Wu - short names
  TC9_ALREADY_HAS_TOKENS: 'TC-PHON-009', // Already has tokens (should skip backfill)
  TC10_CONTROL_NO_MATCH: 'TC-PHON-010', // Richard Parker - no phonetic match with test queries
  TC11_ANDY_YANG: 'TC-PHON-011', // Andy Yang - "andy" is NOT a stop word
  TC12_ANDERSON_MALONE: 'TC-PHON-012', // Anderson Malone - contains "and" but NOT a stop word
  TC13_KING_AND_JAMES: 'TC-PHON-013', // King and James - "and" IS a stop word (should be filtered)
  TC14_SMITH_OR_CO: 'TC-PHON-014', // Smith or Co - "or" and "co" are stop words (should be filtered)
};

const TEST_COURT_ID = '081'; // New York Southern
const TEST_DIVISION_CODE = '081';

// Utility to create application context without HTTP request
async function createTestApplicationContext(): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();
  const logger = new LoggerImpl('phonetic-tokens-test');

  return {
    config,
    featureFlags: {
      'phonetic-search-enabled': true, // Enable phonetic search for tests
    },
    logger,
    invocationId: 'phonetic-tokens-test',
    request: undefined,
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined,
  };
}

// Create a test case document
function createTestCase(
  caseId: string,
  debtorName: string,
  chapter: string,
  jointDebtorName?: string,
  includeTokens: boolean = false,
): Record<string, unknown> {
  const baseCase = {
    documentType: 'SYNCED_CASE',
    caseId: `${TEST_DIVISION_CODE}-${caseId}`,
    caseTitle: `${debtorName} ${chapter === '11' ? 'Inc' : ''}`,
    chapter,
    courtId: TEST_COURT_ID,
    courtName: 'SDNY',
    courtDivisionCode: TEST_DIVISION_CODE,
    courtDivisionName: 'New York',
    debtor: {
      name: debtorName,
      address1: '123 Test Street',
      cityStateZipCountry: 'New York, NY 10001',
      ssn: `999-99-${caseId.slice(-4).padStart(4, '0')}`,
      taxId: `XX-XXXXX${caseId.slice(-2)}`,
    },
    dateFiled: '2025-01-15',
    docketEntries: [],
    transfers: [],
    assignments: [],
    regionId: '02',
    _actions: [],
  };

  // Add phonetic tokens if requested
  if (includeTokens) {
    baseCase.debtor.phoneticTokens = generateSearchTokens(debtorName);
  }

  // Add joint debtor if provided
  if (jointDebtorName) {
    baseCase.jointDebtor = {
      name: jointDebtorName,
      address1: '123 Test Street',
      cityStateZipCountry: 'New York, NY 10001',
    };
    if (includeTokens) {
      baseCase.jointDebtor.phoneticTokens = generateSearchTokens(jointDebtorName);
    }
  }

  return baseCase;
}

// Stage all test data
async function stageTestData(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<void> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'STAGING TEST DATA');
  context.logger.info(MODULE_NAME, '========================================');

  const testCases = [
    // TC1: Jon Snow - needs backfill, will match phonetically with "John"
    createTestCase(TEST_CASES.TC1_JON_NO_TOKENS, 'Jon Snow', '7'),

    // TC2: John Doe - needs backfill, phonetic match with "Jon"
    createTestCase(TEST_CASES.TC2_JOHN_NO_TOKENS, 'John Doe', '11'),

    // TC3: Mike Smith - needs backfill, will match with "Michael" via nickname
    createTestCase(TEST_CASES.TC3_MIKE_NO_TOKENS, 'Mike Smith', '13'),

    // TC4: Michael Johnson - needs backfill, nickname match with "Mike"
    createTestCase(TEST_CASES.TC4_MICHAEL_NO_TOKENS, 'Michael Johnson', '7'),

    // TC5: Bob and Robert - joint debtor scenario with nickname match
    createTestCase(TEST_CASES.TC5_JOINT_DEBTOR, 'Bob Williams', '11', 'Robert Wilson'),

    // TC6: O'Brien - special characters
    createTestCase(TEST_CASES.TC6_SPECIAL_CHARS, "Patrick O'Brien", '7'),

    // TC7: Mary Jane Watson - multi-word name
    createTestCase(TEST_CASES.TC7_MULTI_WORD, 'Mary Jane Watson', '13'),

    // TC8: Li Wu - short names (2 chars)
    createTestCase(TEST_CASES.TC8_SHORT_NAME, 'Li Wu', '7'),

    // TC9: Already has tokens - should be skipped by backfill
    createTestCase(TEST_CASES.TC9_ALREADY_HAS_TOKENS, 'Susan Davis', '11', undefined, true),

    // TC10: Control - Richard Parker (no phonetic match with test queries)
    createTestCase(TEST_CASES.TC10_CONTROL_NO_MATCH, 'Richard Parker', '7'),

    // TC11: Andy Yang - "andy" is NOT a stop word, should have tokens
    createTestCase(TEST_CASES.TC11_ANDY_YANG, 'Andy Yang', '7'),

    // TC12: Anderson Malone - contains "and" but NOT a stop word, should have tokens
    createTestCase(TEST_CASES.TC12_ANDERSON_MALONE, 'Anderson Malone', '11'),

    // TC13: King and James - "and" IS a stop word, should be filtered out
    createTestCase(TEST_CASES.TC13_KING_AND_JAMES, 'King and James', '7'),

    // TC14: Smith or Co - "or" and "co" are stop words, should be filtered out
    createTestCase(TEST_CASES.TC14_SMITH_OR_CO, 'Smith or Co', '11'),
  ];

  // Insert all test cases
  for (const testCase of testCases) {
    await casesRepo.syncDxtrCase(testCase);
    context.logger.info(
      MODULE_NAME,
      `Created test case: ${testCase.caseId} - ${testCase.debtor.name}`,
    );
  }

  context.logger.info(MODULE_NAME, '✓ Test data staged successfully!');
  context.logger.info(MODULE_NAME, '');
}

// Verify test data exists
async function verifyTestData(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'VERIFYING TEST DATA');
  context.logger.info(MODULE_NAME, '========================================');

  try {
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);

    // Count how many test cases exist
    let foundCount = 0;
    for (const caseId of testCaseIds) {
      try {
        const caseDetail = await casesRepo.getSyncedCase(caseId);
        if (caseDetail) {
          foundCount++;
        }
      } catch (_error) {
        // Case doesn't exist
      }
    }

    context.logger.info(MODULE_NAME, `Found ${foundCount} test cases`);

    if (foundCount !== 14) {
      context.logger.error(MODULE_NAME, `Expected 14 test cases, found ${foundCount}`);
      return false;
    }

    context.logger.info(MODULE_NAME, '✓ Test data verified!');
    context.logger.info(MODULE_NAME, '');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `Verification failed: ${errorMessage}`);
    return false;
  }
}

// Test: Count cases needing backfill
async function testCountCasesNeedingBackfill(context: ApplicationContext): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 1: Count Cases Needing Backfill');
  context.logger.info(MODULE_NAME, 'Expected: At least 13 cases (all except TC9)');
  context.logger.info(MODULE_NAME, '========================================');

  try {
    const count = await BackfillPhoneticTokens.countCasesNeedingBackfill(context);

    context.logger.info(MODULE_NAME, `Found ${count} total cases needing backfill`);

    // We expect at least 13 of our test cases (all except TC9 which already has tokens)
    // There may be additional production cases that need backfill
    if (count >= 13) {
      context.logger.info(MODULE_NAME, '✓ TEST 1 PASSED: Found cases needing backfill');
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(MODULE_NAME, `✗ TEST 1 FAILED: Expected at least 13, got ${count}`);
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `✗ TEST 1 FAILED: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Test: Backfill phonetic tokens
async function testBackfillTokens(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 2: Backfill Phonetic Tokens');
  context.logger.info(MODULE_NAME, 'Expected: Tokens generated for cases without them');
  context.logger.info(MODULE_NAME, '========================================');

  try {
    // Get first page of cases needing backfill (should include our test cases)
    const casesNeedingBackfill = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfill(
      context,
      0,
      100,
    );

    // Filter to only our test cases
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);
    const ourTestCases = casesNeedingBackfill.filter((c) => testCaseIds.includes(c.caseId));

    context.logger.info(
      MODULE_NAME,
      `Found ${ourTestCases.length} of our test cases in backfill queue`,
    );

    // Perform backfill on our test cases
    await BackfillPhoneticTokens.backfillTokensForCases(context, ourTestCases);

    // Verify tokens were added
    let tokensAddedCount = 0;
    for (const testCase of ourTestCases) {
      const updatedCase = await casesRepo.getSyncedCase(testCase.caseId);
      if (updatedCase?.debtor?.phoneticTokens && updatedCase.debtor.phoneticTokens.length > 0) {
        tokensAddedCount++;
        context.logger.info(
          MODULE_NAME,
          `  ✓ ${testCase.caseId}: Added ${updatedCase.debtor.phoneticTokens.length} tokens`,
        );
      }
    }

    if (tokensAddedCount === ourTestCases.length) {
      context.logger.info(MODULE_NAME, '✓ TEST 2 PASSED: All cases have phonetic tokens');
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(
        MODULE_NAME,
        `✗ TEST 2 FAILED: Expected ${ourTestCases.length} cases with tokens, got ${tokensAddedCount}`,
      );
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    context.logger.error(MODULE_NAME, `✗ TEST 2 FAILED: ${errorMessage}`);
    if (errorStack) {
      context.logger.error(MODULE_NAME, errorStack);
    }
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Test: Phonetic search - Jon/John match
async function testPhoneticSearchJonJohn(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 3: Phonetic Search - Jon/John Match');
  context.logger.info(
    MODULE_NAME,
    'Expected: Both "Jon Snow" and "John Doe" found when searching "Jon"',
  );
  context.logger.info(MODULE_NAME, '========================================');

  try {
    const predicate: CasesSearchPredicate = {
      debtorName: 'Jon',
    };

    const searchResults = await casesRepo.searchCasesWithPhoneticTokens(predicate);

    // Filter to only our test cases
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);
    const ourResults = searchResults.filter((c: CaseSummary) => testCaseIds.includes(c.caseId));

    context.logger.info(MODULE_NAME, `Found ${ourResults.length} test case matches:`);
    ourResults.forEach((c: CaseSummary) => {
      context.logger.info(
        MODULE_NAME,
        `  - ${c.caseId}: ${c.debtor?.name} (score: ${c.matchScore})`,
      );
    });

    // Check if we found both Jon and John
    const hasJonSnow = ourResults.some((c: CaseSummary) =>
      c.caseId.includes(TEST_CASES.TC1_JON_NO_TOKENS),
    );
    const hasJohnDoe = ourResults.some((c: CaseSummary) =>
      c.caseId.includes(TEST_CASES.TC2_JOHN_NO_TOKENS),
    );

    if (hasJonSnow && hasJohnDoe) {
      context.logger.info(MODULE_NAME, '✓ TEST 3 PASSED: Phonetic search found Jon/John match');
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(MODULE_NAME, '✗ TEST 3 FAILED: Did not find expected matches');
      context.logger.error(MODULE_NAME, `  Jon Snow found: ${hasJonSnow}`);
      context.logger.error(MODULE_NAME, `  John Doe found: ${hasJohnDoe}`);
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `✗ TEST 3 FAILED: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Test: Nickname search - Mike/Michael match
async function testNicknameSearchMikeMichael(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 4: Nickname Search - Mike/Michael Match');
  context.logger.info(
    MODULE_NAME,
    'Expected: Both "Mike Smith" and "Michael Johnson" found when searching "Mike"',
  );
  context.logger.info(MODULE_NAME, '========================================');

  try {
    const predicate: CasesSearchPredicate = {
      debtorName: 'Mike',
    };

    const searchResults = await casesRepo.searchCasesWithPhoneticTokens(predicate);

    // Filter to only our test cases
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);
    const ourResults = searchResults.filter((c: CaseSummary) => testCaseIds.includes(c.caseId));

    context.logger.info(MODULE_NAME, `Found ${ourResults.length} test case matches:`);
    ourResults.forEach((c: CaseSummary) => {
      context.logger.info(
        MODULE_NAME,
        `  - ${c.caseId}: ${c.debtor?.name} (score: ${c.matchScore})`,
      );
    });

    // Check if we found both Mike and Michael
    const hasMikeSmith = ourResults.some((c: CaseSummary) =>
      c.caseId.includes(TEST_CASES.TC3_MIKE_NO_TOKENS),
    );
    const hasMichaelJohnson = ourResults.some((c: CaseSummary) =>
      c.caseId.includes(TEST_CASES.TC4_MICHAEL_NO_TOKENS),
    );

    if (hasMikeSmith && hasMichaelJohnson) {
      context.logger.info(MODULE_NAME, '✓ TEST 4 PASSED: Nickname search found Mike/Michael match');
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(MODULE_NAME, '✗ TEST 4 FAILED: Did not find expected matches');
      context.logger.error(MODULE_NAME, `  Mike Smith found: ${hasMikeSmith}`);
      context.logger.error(MODULE_NAME, `  Michael Johnson found: ${hasMichaelJohnson}`);
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `✗ TEST 4 FAILED: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Test: Joint debtor search
async function testJointDebtorSearch(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 5: Joint Debtor Search');
  context.logger.info(MODULE_NAME, 'Expected: Case found when searching for joint debtor "Robert"');
  context.logger.info(MODULE_NAME, '========================================');

  try {
    const predicate: CasesSearchPredicate = {
      debtorName: 'Robert',
    };

    const searchResults = await casesRepo.searchCasesWithPhoneticTokens(predicate);

    // Filter to only our test cases
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);
    const ourResults = searchResults.filter((c: CaseSummary) => testCaseIds.includes(c.caseId));

    context.logger.info(MODULE_NAME, `Found ${ourResults.length} test case matches:`);
    ourResults.forEach((c: CaseSummary) => {
      const jointDebtor =
        (c as CaseSummary & { jointDebtor?: { name?: string } }).jointDebtor?.name || 'none';
      context.logger.info(
        MODULE_NAME,
        `  - ${c.caseId}: ${c.debtor?.name} + ${jointDebtor} (score: ${c.matchScore})`,
      );
    });

    // Check if we found the Bob/Robert joint debtor case
    const hasJointDebtorCase = ourResults.some((c: CaseSummary) =>
      c.caseId.includes(TEST_CASES.TC5_JOINT_DEBTOR),
    );

    if (hasJointDebtorCase) {
      context.logger.info(MODULE_NAME, '✓ TEST 5 PASSED: Found joint debtor in search results');
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(MODULE_NAME, '✗ TEST 5 FAILED: Joint debtor case not found');
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `✗ TEST 5 FAILED: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Test: Special characters handling
async function testSpecialCharactersSearch(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 6: Special Characters Handling');
  context.logger.info(
    MODULE_NAME,
    'Expected: "O\'Brien" found when searching "OBrien" or "O\'Brien"',
  );
  context.logger.info(MODULE_NAME, '========================================');

  try {
    // Test search without apostrophe
    const predicate: CasesSearchPredicate = {
      debtorName: 'OBrien',
    };

    const searchResults = await casesRepo.searchCasesWithPhoneticTokens(predicate);

    // Filter to only our test cases
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);
    const ourResults = searchResults.filter((c: CaseSummary) => testCaseIds.includes(c.caseId));

    context.logger.info(MODULE_NAME, `Found ${ourResults.length} test case matches:`);
    ourResults.forEach((c: CaseSummary) => {
      context.logger.info(
        MODULE_NAME,
        `  - ${c.caseId}: ${c.debtor?.name} (score: ${c.matchScore})`,
      );
    });

    // Check if we found O'Brien
    const hasOBrien = ourResults.some((c: CaseSummary) =>
      c.caseId.includes(TEST_CASES.TC6_SPECIAL_CHARS),
    );

    if (hasOBrien) {
      context.logger.info(MODULE_NAME, '✓ TEST 6 PASSED: Special characters handled correctly');
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(MODULE_NAME, '✗ TEST 6 FAILED: Special character case not found');
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `✗ TEST 6 FAILED: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Test: Stop word filtering
async function testStopWordFiltering(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<boolean> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'TEST 7: Stop Word Filtering');
  context.logger.info(MODULE_NAME, 'Expected: Stop words "and", "or", "co" excluded from tokens');
  context.logger.info(MODULE_NAME, '========================================');

  try {
    // Check TC11: Andy Yang - "andy" should have tokens (NOT a stop word)
    const tc11 = await casesRepo.getSyncedCase(
      `${TEST_DIVISION_CODE}-${TEST_CASES.TC11_ANDY_YANG}`,
    );
    const andyTokens = tc11?.debtor?.phoneticTokens || [];
    const hasAndyTokens = andyTokens.length > 0;
    const andyHasPhonetic = andyTokens.some((t) => /^[A-Z0-9]+$/.test(t) && t.length > 1); // Check for phonetic codes
    context.logger.info(
      MODULE_NAME,
      `  TC11 (Andy Yang): ${andyTokens.length} tokens, has phonetic: ${andyHasPhonetic}`,
    );

    // Check TC12: Anderson Malone - "anderson" and "malone" should have tokens
    const tc12 = await casesRepo.getSyncedCase(
      `${TEST_DIVISION_CODE}-${TEST_CASES.TC12_ANDERSON_MALONE}`,
    );
    const andersonTokens = tc12?.debtor?.phoneticTokens || [];
    const hasAndersonTokens = andersonTokens.length > 0;
    const andersonHasPhonetic = andersonTokens.some((t) => /^[A-Z0-9]+$/.test(t) && t.length > 1);
    context.logger.info(
      MODULE_NAME,
      `  TC12 (Anderson Malone): ${andersonTokens.length} tokens, has phonetic: ${andersonHasPhonetic}`,
    );

    // Check TC13: King and James - should have tokens for "king" and "james" but NOT "and"
    const tc13 = await casesRepo.getSyncedCase(
      `${TEST_DIVISION_CODE}-${TEST_CASES.TC13_KING_AND_JAMES}`,
    );
    const kingJamesTokens = tc13?.debtor?.phoneticTokens || [];
    // "and" phonetic codes would be A530 (Soundex) and ANT (Metaphone)
    const hasAndTokens = kingJamesTokens.some((t) => t === 'A530' || t === 'ANT' || t === 'A500');
    const hasKingTokens = kingJamesTokens.some(
      (t) => t === 'K520' || t === 'KNK' || t.includes('ki'),
    );
    const hasJamesTokens = kingJamesTokens.some(
      (t) => t === 'J520' || t === 'JMS' || t.includes('ja'),
    );
    context.logger.info(MODULE_NAME, `  TC13 (King and James): ${kingJamesTokens.length} tokens`);
    context.logger.info(MODULE_NAME, `    - Has "and" tokens: ${hasAndTokens} (should be false)`);
    context.logger.info(MODULE_NAME, `    - Has "king" tokens: ${hasKingTokens} (should be true)`);
    context.logger.info(
      MODULE_NAME,
      `    - Has "james" tokens: ${hasJamesTokens} (should be true)`,
    );

    // Check TC14: Smith or Co - should have tokens for "smith" but NOT "or" or "co"
    const tc14 = await casesRepo.getSyncedCase(
      `${TEST_DIVISION_CODE}-${TEST_CASES.TC14_SMITH_OR_CO}`,
    );
    const smithOrCoTokens = tc14?.debtor?.phoneticTokens || [];
    // "or" would be O600 (Soundex) and OR (Metaphone), "co" would be C000 and K
    const hasOrCoTokens = smithOrCoTokens.some(
      (t) => t === 'O600' || t === 'OR' || t === 'C000' || t === 'K',
    );
    const hasSmithTokens = smithOrCoTokens.some(
      (t) => t === 'S530' || t === 'SM0' || t.includes('sm'),
    );
    context.logger.info(MODULE_NAME, `  TC14 (Smith or Co): ${smithOrCoTokens.length} tokens`);
    context.logger.info(
      MODULE_NAME,
      `    - Has "or"/"co" tokens: ${hasOrCoTokens} (should be false)`,
    );
    context.logger.info(
      MODULE_NAME,
      `    - Has "smith" tokens: ${hasSmithTokens} (should be true)`,
    );

    // Validate results
    const allPassed =
      hasAndyTokens &&
      andyHasPhonetic &&
      hasAndersonTokens &&
      andersonHasPhonetic &&
      !hasAndTokens &&
      hasKingTokens &&
      hasJamesTokens &&
      !hasOrCoTokens &&
      hasSmithTokens;

    if (allPassed) {
      context.logger.info(
        MODULE_NAME,
        '✓ TEST 7 PASSED: Stop words correctly filtered from tokens',
      );
      context.logger.info(MODULE_NAME, '');
      return true;
    } else {
      context.logger.error(MODULE_NAME, '✗ TEST 7 FAILED: Stop word filtering issues detected');
      if (!hasAndyTokens || !andyHasPhonetic) {
        context.logger.error(MODULE_NAME, '  - Andy Yang should have tokens');
      }
      if (!hasAndersonTokens || !andersonHasPhonetic) {
        context.logger.error(MODULE_NAME, '  - Anderson Malone should have tokens');
      }
      if (hasAndTokens) {
        context.logger.error(MODULE_NAME, '  - "and" stop word should be filtered out');
      }
      if (!hasKingTokens || !hasJamesTokens) {
        context.logger.error(MODULE_NAME, '  - King and James should have tokens for both names');
      }
      if (hasOrCoTokens) {
        context.logger.error(MODULE_NAME, '  - "or" and "co" stop words should be filtered out');
      }
      if (!hasSmithTokens) {
        context.logger.error(MODULE_NAME, '  - Smith should have tokens');
      }
      context.logger.info(MODULE_NAME, '');
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `✗ TEST 7 FAILED: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
    return false;
  }
}

// Cleanup test data
async function _cleanupTestData(
  context: ApplicationContext,
  casesRepo: CasesRepository,
): Promise<void> {
  context.logger.info(MODULE_NAME, '========================================');
  context.logger.info(MODULE_NAME, 'CLEANING UP TEST DATA');
  context.logger.info(MODULE_NAME, '========================================');

  try {
    const testCaseIds = Object.values(TEST_CASES).map((id) => `${TEST_DIVISION_CODE}-${id}`);

    // Use the internal MongoDB collection to delete test cases
    // Since there's no delete method in the repository interface,
    // we need to access the MongoDB adapter directly
    const { and, using } = QueryBuilder;
    const doc = using<{ documentType: string; caseId: string }>();
    const query = and(
      doc('documentType').equals('SYNCED_CASE'),
      doc('caseId').contains(testCaseIds),
    );

    // Delete using the low-level query interface
    const deletedCount = await (
      casesRepo as { getAdapter: () => { deleteMany: (query: unknown) => Promise<number> } }
    )
      .getAdapter()
      .deleteMany(query);
    context.logger.info(MODULE_NAME, `Deleted ${deletedCount} test case(s)`);

    context.logger.info(MODULE_NAME, '✓ Test data cleaned up');
    context.logger.info(MODULE_NAME, '');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger.error(MODULE_NAME, `Cleanup error: ${errorMessage}`);
    context.logger.info(MODULE_NAME, '');
  }
}

// Main test runner
async function main() {
  const context = await createTestApplicationContext();
  const casesRepo = factory.getCasesRepository(context);

  context.logger.info(MODULE_NAME, '');
  context.logger.info(
    MODULE_NAME,
    '╔════════════════════════════════════════════════════════════╗',
  );
  context.logger.info(MODULE_NAME, '║     Phonetic Tokens - Data Synthesis & Test Suite         ║');
  context.logger.info(
    MODULE_NAME,
    '╚════════════════════════════════════════════════════════════╝',
  );
  context.logger.info(MODULE_NAME, '');

  const results = {
    dataStaging: false,
    dataVerification: false,
    countCasesNeedingBackfill: false,
    backfillTokens: false,
    phoneticSearchJonJohn: false,
    nicknameSearchMikeMichael: false,
    jointDebtorSearch: false,
    specialCharactersSearch: false,
    stopWordFiltering: false,
  };

  try {
    // Stage test data
    await stageTestData(context, casesRepo);
    results.dataStaging = true;

    // Verify test data
    results.dataVerification = await verifyTestData(context, casesRepo);
    if (!results.dataVerification) {
      throw new Error('Test data verification failed');
    }

    // Run tests
    results.countCasesNeedingBackfill = await testCountCasesNeedingBackfill(context);
    results.backfillTokens = await testBackfillTokens(context, casesRepo);
    results.phoneticSearchJonJohn = await testPhoneticSearchJonJohn(context, casesRepo);
    results.nicknameSearchMikeMichael = await testNicknameSearchMikeMichael(context, casesRepo);
    results.jointDebtorSearch = await testJointDebtorSearch(context, casesRepo);
    results.specialCharactersSearch = await testSpecialCharactersSearch(context, casesRepo);
    results.stopWordFiltering = await testStopWordFiltering(context, casesRepo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    context.logger.error(MODULE_NAME, `Test suite failed: ${errorMessage}`);
    if (errorStack) {
      context.logger.error(MODULE_NAME, errorStack);
    }
  } finally {
    // Always cleanup
    // COMMENTED OUT FOR MANUAL TESTING - uncomment to clean up
    // await _cleanupTestData(context, casesRepo);

    // Print summary
    context.logger.info(MODULE_NAME, '========================================');
    context.logger.info(MODULE_NAME, 'TEST SUMMARY');
    context.logger.info(MODULE_NAME, '========================================');
    context.logger.info(
      MODULE_NAME,
      `Data Staging:              ${results.dataStaging ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Data Verification:         ${results.dataVerification ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Count Cases Need Backfill: ${results.countCasesNeedingBackfill ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Backfill Tokens:           ${results.backfillTokens ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Phonetic Search (Jon):     ${results.phoneticSearchJonJohn ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Nickname Search (Mike):    ${results.nicknameSearchMikeMichael ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Joint Debtor Search:       ${results.jointDebtorSearch ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Special Characters:        ${results.specialCharactersSearch ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(
      MODULE_NAME,
      `Stop Word Filtering:       ${results.stopWordFiltering ? '✓ PASS' : '✗ FAIL'}`,
    );
    context.logger.info(MODULE_NAME, '========================================');

    const allPassed = Object.values(results).every((r) => r);
    if (allPassed) {
      context.logger.info(MODULE_NAME, '');
      context.logger.info(MODULE_NAME, '🎉 ALL TESTS PASSED! 🎉');
      context.logger.info(MODULE_NAME, '');
      process.exit(0);
    } else {
      context.logger.error(MODULE_NAME, '');
      context.logger.error(MODULE_NAME, '❌ SOME TESTS FAILED ❌');
      context.logger.error(MODULE_NAME, '');
      process.exit(1);
    }
  }
}

// Run the test suite
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
