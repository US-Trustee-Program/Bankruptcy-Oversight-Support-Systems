import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import Factory from '../../../lib/factory';
import { ConsolidationOrder } from '@common/cams/orders';
import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';

const MODULE_NAME = 'MIGRATE-CHILDCASES-TO-MEMBERCASES';

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: 'AzureWebJobsStorage',
});

/**
 * Migrates consolidation documents in Cosmos DB from 'childCases' to 'memberCases'
 * This is a one-time data migration to align the database schema with the code.
 *
 * IMPORTANT: This migration specifically targets documents in the 'consolidations' collection
 * that have orderType='consolidation' and the old 'childCases' field.
 */
async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  try {
    logger.info(MODULE_NAME, 'Starting migration of childCases to memberCases...');

    // Get the raw MongoDB adapter to perform bulk operations
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(context);
    const adapter: MongoCollectionAdapter<ConsolidationOrder> = (
      consolidationsRepo as unknown as {
        getAdapter: () => MongoCollectionAdapter<ConsolidationOrder>;
      }
    ).getAdapter();

    // Build a specific query to target ONLY consolidation order documents
    // This ensures we don't accidentally modify unrelated documents
    const migrationQuery = {
      orderType: 'consolidation', // Must be a consolidation order
      childCases: { $exists: true }, // Must have the old field name
    };

    // Find all consolidation documents with the old 'childCases' field
    const documentsWithChildCases = await adapter.find(migrationQuery);

    const count = documentsWithChildCases.length;
    logger.info(
      MODULE_NAME,
      `Found ${count} consolidation order document(s) with 'childCases' field to migrate.`,
    );

    if (count === 0) {
      logger.info(MODULE_NAME, 'No documents to migrate. Migration complete.');
      return;
    }

    // Log a sample of what will be migrated (first document's consolidationId for verification)
    if (documentsWithChildCases.length > 0) {
      logger.info(
        MODULE_NAME,
        `Sample document to migrate - consolidationId: ${documentsWithChildCases[0].consolidationId}`,
      );
    }

    // Perform the field rename using MongoDB's $rename operator
    // This renames the field from 'childCases' to 'memberCases' for all matching documents
    const result = await adapter.updateMany(migrationQuery, {
      $rename: { childCases: 'memberCases' },
    });

    logger.info(
      MODULE_NAME,
      `Migration complete. Modified ${result.modifiedCount} consolidation order document(s) out of ${count} found.`,
    );

    if (result.modifiedCount !== count) {
      logger.warn(
        MODULE_NAME,
        `Warning: Found ${count} documents but only modified ${result.modifiedCount}. Some documents may have already been migrated or were not modifiable.`,
      );
    }
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      'Failed to rename consolidation field from childCases to memberCases.',
    );
    logger.camsError(error);
    invocationContext.extraOutputs.set(HARD_STOP, [
      {
        message: 'Migration of childCases to memberCases failed',
        error,
      },
    ]);
    throw error;
  }
}

function setup() {
  app.storageQueue(START_FUNCTION, {
    connection: START.connection,
    queueName: START.queueName,
    handler: start,
    extraOutputs: [HARD_STOP],
  });
}

const MigrateChildCasesToMemberCases = {
  MODULE_NAME,
  setup,
};

export default MigrateChildCasesToMemberCases;
