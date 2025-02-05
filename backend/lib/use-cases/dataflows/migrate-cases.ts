import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';

/**
 * createMigrationTable
 *
 * @param context
 */
async function createMigrationTable(context: ApplicationContext) {
  const gateway = Factory.getAcmsGateway(context);
  await gateway.createMigrationTable(context);
}

/**
 * getPageOfCaseIds
 *
 * @param offset
 * @param limit
 */
async function getPageOfCaseIds(context: ApplicationContext, start: number, end: number) {
  const gateway = Factory.getAcmsGateway(context);
  await gateway.getMigrationCaseIds(context, start, end);
}

/**
 * dropMigrationTable
 *
 * @param context
 */
async function dropMigrationTable(context: ApplicationContext) {
  const gateway = Factory.getAcmsGateway(context);
  await gateway.createMigrationTable(context);
}

const MigrateCases = {
  createMigrationTable,
  getPageOfCaseIds,
  dropMigrationTable,
};

export default MigrateCases;
