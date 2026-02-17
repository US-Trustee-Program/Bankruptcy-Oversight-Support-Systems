import { app, InvocationContext, output } from '@azure/functions';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import Factory from '../../../lib/factory';
import { ConsolidationOrder } from '@common/cams/orders';
import QueryBuilder from '../../../lib/query/query-builder';
import { Document as MongoDocument } from 'mongodb';
import { CaseHistory } from '@common/cams/history';
import { completeDataflowTrace } from '../dataflow-telemetry.types';

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
  connection: STORAGE_QUEUE_CONNECTION,
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
  const trace = context.observability.startTrace(invocationContext.invocationId);

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
    // Process records programmatically in batches since CosmosDB doesn't support
    // aggregation pipelines with nested array field operations
    logger.info(MODULE_NAME, 'Starting audit records migration...');

    const casesRepo = Factory.getCasesRepository(context);

    // Fetch all AUDIT_CONSOLIDATION records using the new repository method
    const auditRecords = await casesRepo.getAllCaseHistory('AUDIT_CONSOLIDATION');
    logger.info(MODULE_NAME, `Found ${auditRecords.length} audit records to process`);

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;
    let totalModified = 0;

    for (let i = 0; i < auditRecords.length; i += BATCH_SIZE) {
      const batch = auditRecords.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(auditRecords.length / BATCH_SIZE);

      logger.info(
        MODULE_NAME,
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`,
      );

      let batchModified = 0;
      for (const record of batch) {
        let modified = false;
        const legacyRecord = record as CaseHistory & {
          before?: { childCases?: unknown; memberCases?: unknown };
          after?: { childCases?: unknown; memberCases?: unknown };
        };

        // Migrate before.childCases to before.memberCases
        if (
          legacyRecord.before &&
          'childCases' in legacyRecord.before &&
          legacyRecord.before.childCases
        ) {
          legacyRecord.before.memberCases = legacyRecord.before.childCases;
          delete legacyRecord.before.childCases;
          modified = true;
        }

        // Migrate after.childCases to after.memberCases
        if (
          legacyRecord.after &&
          'childCases' in legacyRecord.after &&
          legacyRecord.after.childCases
        ) {
          legacyRecord.after.memberCases = legacyRecord.after.childCases;
          delete legacyRecord.after.childCases;
          modified = true;
        }

        // Update the record if it was modified
        if (modified) {
          await casesRepo.updateCaseHistory(legacyRecord as CaseHistory);
          batchModified++;
        }
      }

      totalModified += batchModified;
      logger.info(
        MODULE_NAME,
        `Batch ${batchNumber}/${totalBatches} complete. Modified ${batchModified} records.`,
      );
    }

    logger.info(
      MODULE_NAME,
      `Audit records migration complete. Processed ${auditRecords.length} record(s), modified ${totalModified} audit record(s).`,
    );

    logger.info(
      MODULE_NAME,
      `Total migration complete. Orders: ${result.modifiedCount}, Audit records: ${totalModified}`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'start', logger, {
      documentsWritten: result.modifiedCount + totalModified,
      documentsFailed: 0,
      success: true,
      details: {
        ordersModified: String(result.modifiedCount),
        auditRecordsModified: String(totalModified),
      },
    });
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      'Failed to rename consolidation field from childCases to memberCases.',
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
