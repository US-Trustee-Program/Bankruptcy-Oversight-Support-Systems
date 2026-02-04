/**
 * Simple script to create test cases for stop word filtering validation
 *
 * Usage:
 *   cd backend
 *   DATABASE_MOCK='false' npx tsx lib/testing/create-stop-word-test-cases.ts
 */

import { config as dotenvConfig } from 'dotenv';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { LoggerImpl } from '../adapters/services/logger.service';
import factory from '../factory';
import { generateSearchTokens } from '../adapters/utils/phonetic-helper';

dotenvConfig();

const MODULE_NAME = 'CREATE-STOP-WORD-TEST-CASES';

async function main() {
  const config = new ApplicationConfiguration();
  const logger = new LoggerImpl(MODULE_NAME);

  const context = {
    config,
    featureFlags: {},
    logger,
    invocationId: 'test',
    request: undefined,
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: undefined,
  };

  const casesRepo = factory.getCasesRepository(context);

  logger.info(MODULE_NAME, '\n=== Creating Test Cases for Stop Word Validation ===\n');

  const testCases = [
    {
      caseId: '081-TEST-ANDY-001',
      debtorName: 'Andy Yang',
      chapter: '7',
    },
    {
      caseId: '081-TEST-ANDER-001',
      debtorName: 'Anderson Malone',
      chapter: '11',
    },
    {
      caseId: '081-TEST-KING-001',
      debtorName: 'King and James',
      chapter: '7',
    },
  ];

  for (const test of testCases) {
    try {
      const caseData = {
        documentType: 'SYNCED_CASE',
        caseId: test.caseId,
        caseTitle: test.debtorName,
        chapter: test.chapter,
        courtId: '081',
        courtName: 'SDNY',
        courtDivisionCode: '081',
        courtDivisionName: 'New York',
        debtor: {
          name: test.debtorName,
          address1: '123 Test Street',
          cityStateZipCountry: 'New York, NY 10001',
          phoneticTokens: generateSearchTokens(test.debtorName),
        },
        dateFiled: '2025-02-04',
        docketEntries: [],
        transfers: [],
        assignments: [],
        regionId: '02',
        _actions: [],
      };

      await casesRepo.syncDxtrCase(caseData);

      logger.info(MODULE_NAME, `✓ Created: ${test.caseId} - ${test.debtorName}`);
      logger.info(
        MODULE_NAME,
        `  Tokens (${caseData.debtor.phoneticTokens.length}): [${caseData.debtor.phoneticTokens.join(', ')}]`,
      );

      // Check for stop words
      const tokens = caseData.debtor.phoneticTokens;
      const hasAndTokens = tokens.some((t) => t === 'A530' || t === 'ANT');
      if (test.debtorName === 'King and James') {
        logger.info(MODULE_NAME, `  "and" filtered: ${!hasAndTokens ? '✓ YES' : '✗ NO'}`);
      }
      logger.info(MODULE_NAME, '');
    } catch (error) {
      logger.error(MODULE_NAME, `Failed to create ${test.caseId}: ${error.message}`);
    }
  }

  logger.info(MODULE_NAME, '=== Test Cases Created! ===');
  logger.info(MODULE_NAME, '\nYou can now search for:');
  logger.info(MODULE_NAME, '  - "andy" → should find "Andy Yang" ✓');
  logger.info(MODULE_NAME, '  - "andy" → should NOT find "King and James" ✓');
  logger.info(MODULE_NAME, '  - "anderson" → should find "Anderson Malone" ✓');
  logger.info(MODULE_NAME, '\nTo delete these test cases later, run:');
  logger.info(
    MODULE_NAME,
    "  DATABASE_MOCK='false' npx tsx lib/testing/delete-stop-word-test-cases.ts\n",
  );

  casesRepo.release();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
