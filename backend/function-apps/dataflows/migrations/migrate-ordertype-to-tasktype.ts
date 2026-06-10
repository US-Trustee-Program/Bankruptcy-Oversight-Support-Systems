import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import Factory from '../../../lib/factory';
import { ConsolidationOrder, Order } from '@common/cams/orders';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import QueryBuilder from '../../../lib/query/query-builder';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

const { using } = QueryBuilder;

const MODULE_NAME = 'MIGRATE-ORDERTYPE-TO-TASKTYPE';

// Legacy types that include the old 'orderType' DB field name targeted by this migration.
// Note: 'orderType' is the MongoDB field name; the TypeScript domain type uses 'taskType'.
type LegacyOrder = Order & { orderType?: string };
type LegacyConsolidation = ConsolidationOrder & { orderType?: string };
type LegacyVerification = TrusteeMatchVerification & { orderType?: string };

const START_FUNCTION = buildFunctionName(MODULE_NAME, 'start');
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: STORAGE_QUEUE_CONNECTION,
});

/**
 * Migrates documents in Cosmos DB by renaming the 'orderType' field to 'taskType'.
 * This is a one-time data migration to align the database schema with the code.
 *
 * IMPORTANT: This migration targets three collections:
 * 1. 'orders' collection - all transfer order documents with an 'orderType' field
 * 2. 'consolidations' collection - all consolidation order documents with an 'orderType' field
 * 3. 'trustee-match-verification' collection - all verification documents with an 'orderType' field
 */
async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    logger.info(MODULE_NAME, 'Starting migration of orderType to taskType...');

    const updateOperation = {
      $rename: { orderType: 'taskType' },
    };

    // PART 1: Migrate orders collection
    const ordersRepo = Factory.getOrdersRepository(context);
    const orderDoc = using<LegacyOrder>();
    const ordersQuery = orderDoc('orderType').exists();
    const ordersResult = await ordersRepo.updateManyByQuery(ordersQuery, updateOperation);

    logger.info(
      MODULE_NAME,
      `Orders migration complete. Matched ${ordersResult.matchedCount} document(s), modified ${ordersResult.modifiedCount} order document(s).`,
    );

    if (ordersResult.modifiedCount !== ordersResult.matchedCount) {
      logger.warn(
        MODULE_NAME,
        `Warning: Matched ${ordersResult.matchedCount} orders but only modified ${ordersResult.modifiedCount}. Some documents may have already been migrated or were not modifiable.`,
      );
    }

    // PART 2: Migrate consolidations collection
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(context);
    const consolidationDoc = using<LegacyConsolidation>();
    const consolidationsQuery = consolidationDoc('orderType').exists();
    const consolidationsResult = await consolidationsRepo.updateManyByQuery(
      consolidationsQuery,
      updateOperation,
    );

    logger.info(
      MODULE_NAME,
      `Consolidations migration complete. Matched ${consolidationsResult.matchedCount} document(s), modified ${consolidationsResult.modifiedCount} consolidation document(s).`,
    );

    if (consolidationsResult.modifiedCount !== consolidationsResult.matchedCount) {
      logger.warn(
        MODULE_NAME,
        `Warning: Matched ${consolidationsResult.matchedCount} consolidations but only modified ${consolidationsResult.modifiedCount}. Some documents may have already been migrated or were not modifiable.`,
      );
    }

    // PART 3: Migrate trustee-match-verification collection
    const verificationRepo = Factory.getTrusteeMatchVerificationRepository(context);
    const verificationDoc = using<LegacyVerification>();
    const verificationsQuery = verificationDoc('orderType').exists();
    const verificationsResult = await verificationRepo.updateManyByQuery(
      verificationsQuery,
      updateOperation,
    );

    logger.info(
      MODULE_NAME,
      `Trustee match verification migration complete. Matched ${verificationsResult.matchedCount} document(s), modified ${verificationsResult.modifiedCount} verification document(s).`,
    );

    if (verificationsResult.modifiedCount !== verificationsResult.matchedCount) {
      logger.warn(
        MODULE_NAME,
        `Warning: Matched ${verificationsResult.matchedCount} verifications but only modified ${verificationsResult.modifiedCount}. Some documents may have already been migrated or were not modifiable.`,
      );
    }

    const totalModified =
      ordersResult.modifiedCount +
      consolidationsResult.modifiedCount +
      verificationsResult.modifiedCount;

    logger.info(
      MODULE_NAME,
      `Total migration complete. Orders: ${ordersResult.modifiedCount}, Consolidations: ${consolidationsResult.modifiedCount}, Verifications: ${verificationsResult.modifiedCount}`,
    );

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'start', logger, {
      documentsWritten: totalModified,
      documentsFailed: 0,
      success: true,
      details: {
        ordersModified: String(ordersResult.modifiedCount),
        consolidationsModified: String(consolidationsResult.modifiedCount),
        verificationsModified: String(verificationsResult.modifiedCount),
      },
    });
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      'Failed to rename field from orderType to taskType.',
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'start', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: error.message,
    });
    logger.camsError(error);
    invocationContext.extraOutputs.set(HARD_STOP, [
      {
        message: 'Migration of orderType to taskType failed',
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

const MigrateOrderTypeToTaskType = { MODULE_NAME, setup };
export default MigrateOrderTypeToTaskType;
