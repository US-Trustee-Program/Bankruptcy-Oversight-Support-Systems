/**
 * Delete test cases created for stop word filtering validation
 *
 * Usage:
 *   cd backend
 *   DATABASE_MOCK='false' npx tsx lib/testing/delete-stop-word-test-cases.ts
 */

import { config as dotenvConfig } from 'dotenv';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { LoggerImpl } from '../adapters/services/logger.service';
import factory from '../factory';
import QueryBuilder from '../query/query-builder';

dotenvConfig();

const MODULE_NAME = 'DELETE-STOP-WORD-TEST-CASES';

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

  logger.info(MODULE_NAME, '\n=== Deleting Stop Word Test Cases ===\n');

  const testCaseIds = ['081-TEST-ANDY-001', '081-TEST-ANDER-001', '081-TEST-KING-001'];

  try {
    const { and, using } = QueryBuilder;
    const doc = using<{ documentType: string; caseId: string }>();
    const query = and(
      doc('documentType').equals('SYNCED_CASE'),
      doc('caseId').contains(testCaseIds),
    );

    const deletedCount = await (
      casesRepo as { getAdapter: () => { deleteMany: (query: unknown) => Promise<number> } }
    )
      .getAdapter()
      .deleteMany(query);
    logger.info(MODULE_NAME, `✓ Deleted ${deletedCount} test case(s)`);
  } catch (error) {
    logger.error(MODULE_NAME, `Failed to delete test cases: ${error.message}`);
  }

  logger.info(MODULE_NAME, '\n=== Cleanup Complete ===\n');

  casesRepo.release();
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
