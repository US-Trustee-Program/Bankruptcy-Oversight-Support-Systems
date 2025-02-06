import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import Factory from '../../factory';
import { MaybeCaseIds, MaybeVoid } from './dataflow-types';

const MODULE_NAME = 'MIGRATE_CASES_USE_CASE';

/**
 * createMigrationTable
 *
 * @param context
 */
async function createMigrationTable(context: ApplicationContext): Promise<MaybeVoid> {
  try {
    const gateway = Factory.getAcmsGateway(context);
    await gateway.createMigrationTable(context);
    return { success: true };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to create and populate temporary migration table.',
      ),
    };
  }
}

/**
 * getPageOfCaseIds
 *
 * @param offset
 * @param limit
 */
async function getPageOfCaseIds(
  context: ApplicationContext,
  start: number,
  end: number,
): Promise<MaybeCaseIds> {
  try {
    const gateway = Factory.getAcmsGateway(context);
    const caseIds = await gateway.getMigrationCaseIds(context, start, end);
    return { caseIds };
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
 * dropMigrationTable
 *
 * @param context
 */
async function dropMigrationTable(context: ApplicationContext): Promise<MaybeVoid> {
  try {
    const gateway = Factory.getAcmsGateway(context);
    await gateway.createMigrationTable(context);
    return { success: true };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to drop temporary migration table.'),
    };
  }
}

const MigrateCases = {
  createMigrationTable,
  getPageOfCaseIds,
  dropMigrationTable,
};

export default MigrateCases;
