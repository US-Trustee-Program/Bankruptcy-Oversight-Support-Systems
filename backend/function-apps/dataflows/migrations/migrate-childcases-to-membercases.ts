import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import Factory from '../../../lib/factory';
import { ConsolidationOrder } from '@common/cams/orders';
import QueryBuilder from '../../../lib/query/query-builder';
import { Document as MongoDocument } from 'mongodb';
import { CaseHistory } from '@common/cams/history';

const { and, using } = QueryBuilder;

const MODULE_NAME = 'MIGRATE-CHILDCASES-TO-MEMBERCASES';

// Type that includes the legacy 'childCases' field for migration purposes
type LegacyConsolidationOrder = ConsolidationOrder & {
  childCases?: ConsolidationOrder['memberCases'];
};

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
 * IMPORTANT: This migration targets two collections:
 * 1. 'consolidations' collection - documents with orderType='consolidation' and 'childCases' field
 * 2. 'cases' collection - AUDIT_CONSOLIDATION history records with 'childCases' in before/after fields
 */
async function start(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  try {
    logger.info(MODULE_NAME, 'Starting migration of childCases to memberCases...');

    // PART 1: Migrate consolidation orders
    const consolidationsRepo = Factory.getConsolidationOrdersRepository(context);

    const doc = using<LegacyConsolidationOrder>();

    // Build a specific query to target ONLY consolidation order documents
    // This ensures we don't accidentally modify unrelated documents
    const migrationQuery = and(
      doc('orderType').equals('consolidation'), // Must be a consolidation order
      doc('childCases').exists(), // Must have the old field name
    );

    // Perform the field rename using MongoDB's $rename operator
    // This renames the field from 'childCases' to 'memberCases' for all matching documents
    const updateOperation: MongoDocument = {
      $rename: { childCases: 'memberCases' },
    };
    const result = await consolidationsRepo.updateManyByQuery(migrationQuery, updateOperation);

    logger.info(
      MODULE_NAME,
      `Consolidation orders migration complete. Matched ${result.matchedCount} document(s), modified ${result.modifiedCount} consolidation order document(s).`,
    );

    if (result.modifiedCount !== result.matchedCount) {
      logger.warn(
        MODULE_NAME,
        `Warning: Matched ${result.matchedCount} documents but only modified ${result.modifiedCount}. Some documents may have already been migrated or were not modifiable.`,
      );
    }

    // PART 2: Migrate case history audit records
    const casesRepo = Factory.getCasesRepository(context);

    // Query for ALL AUDIT_CONSOLIDATION records
    // We'll use conditional logic in the update to only modify records with childCases
    const auditDoc = using<CaseHistory>();
    const beforeQuery = auditDoc('documentType').equals('AUDIT_CONSOLIDATION');

    // Use $set to copy and $unset to remove (since $rename can't traverse arrays)
    // If childCases exists, copy it to memberCases; otherwise keep memberCases as-is
    const beforeUpdateOperation: MongoDocument = [
      {
        $set: {
          'before.memberCases': { $ifNull: ['$before.childCases', '$before.memberCases'] },
        },
      },
      {
        $unset: 'before.childCases',
      },
    ];

    const beforeResult = await casesRepo.updateManyByQuery(beforeQuery, beforeUpdateOperation);

    logger.info(
      MODULE_NAME,
      `Audit records (before.childCases) migration complete. Matched ${beforeResult.matchedCount} document(s), modified ${beforeResult.modifiedCount} audit record(s).`,
    );

    // Update records with after.childCases (same query as before)
    const afterQuery = auditDoc('documentType').equals('AUDIT_CONSOLIDATION');

    const afterUpdateOperation: MongoDocument = [
      {
        $set: {
          'after.memberCases': { $ifNull: ['$after.childCases', '$after.memberCases'] },
        },
      },
      {
        $unset: 'after.childCases',
      },
    ];

    const afterResult = await casesRepo.updateManyByQuery(afterQuery, afterUpdateOperation);

    logger.info(
      MODULE_NAME,
      `Audit records (after.childCases) migration complete. Matched ${afterResult.matchedCount} document(s), modified ${afterResult.modifiedCount} audit record(s).`,
    );

    const totalAuditModified = beforeResult.modifiedCount + afterResult.modifiedCount;

    logger.info(
      MODULE_NAME,
      `Total migration complete. Orders: ${result.modifiedCount}, Audit records: ${totalAuditModified}`,
    );
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
