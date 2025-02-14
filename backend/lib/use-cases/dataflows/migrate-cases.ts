import { createAuditRecord } from '../../../../common/src/cams/auditable';
import { SyncedCase } from '../../../../common/src/cams/cases';
import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import Factory from '../../factory';
import { MaybeCaseSyncEvents, MaybeData, MaybeVoid } from './queue-types';

const MODULE_NAME = 'MIGRATE_CASES_USE_CASE';

async function exportAndLoadPage(
  context: ApplicationContext,
  events: CaseSyncEvent[],
): Promise<CaseSyncEvent[]> {
  const factory = Factory.getCasesGateway(context);
  const repo = Factory.getCasesRepository(context);
  for (const event of events) {
    try {
      event.bCase = await factory.getCaseDetail(context, event.caseId);
      await repo.syncDxtrCase(
        createAuditRecord<SyncedCase>({ ...event.bCase, documentType: 'SYNCED_CASE' }),
      );
    } catch (error) {
      event.error = error;
    }
  }
  return events;
}

/**
 * createMigrationTable
 *
 * @param context
 */
async function loadMigrationTable(context: ApplicationContext): Promise<MaybeData<number>> {
  try {
    // TEMPORARILY DELETE EVERYTHING FROM COSMOS WHILE WE ARE "EXPERIMENTING".
    // const repo = Factory.getCasesRepository(context);
    // await repo.deleteSyncedCases();

    const gateway = Factory.getAcmsGateway(context);
    await gateway.loadMigrationTable(context);
    const count = await gateway.getMigrationCaseCount(context);
    return { data: count };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to populate migration table.'),
    };
  }
}

/**
 * getPageOfCaseIds
 *
 * @param offset
 * @param limit
 */
async function getPageOfCaseEvents(
  context: ApplicationContext,
  start: number,
  end: number,
): Promise<MaybeCaseSyncEvents> {
  try {
    const gateway = Factory.getAcmsGateway(context);
    const caseIds = await gateway.getMigrationCaseIds(context, start, end);
    return {
      events: caseIds.map((caseId) => {
        return {
          type: 'MIGRATION',
          caseId,
        };
      }),
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to get case IDs to migrate from the ACMS gateway.',
      ),
    };
  }
}

/**
 * emptyMigrationTable
 *
 * @param context
 */
async function emptyMigrationTable(context: ApplicationContext): Promise<MaybeVoid> {
  try {
    const gateway = Factory.getAcmsGateway(context);
    await gateway.emptyMigrationTable(context);
    return { success: true };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to empty migration table.'),
    };
  }
}

const MigrateCases = {
  exportAndLoadPage,
  loadMigrationTable,
  getPageOfCaseEvents,
  emptyMigrationTable,
};

export default MigrateCases;
