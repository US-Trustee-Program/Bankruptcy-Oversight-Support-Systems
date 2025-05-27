import { ApplicationContext } from '../../adapters/types/basic';

const MODULE_NAME = 'MIGRATE-ORDER-IDS-USE-CASE';

async function migrateOrderIds(context: ApplicationContext) {
  // TODO: transfer order ids?
  // TODO: consolidation order ids!
  // TODO: consolidation status==pending <jobid>/pending/0
  // TODO: consolidation status==approved <jobid>/approved/0
  // TODO: consolidation status==rejected <jobid>/rejected/0
  context.logger.info(MODULE_NAME, 'Migrated order ids.', {});
}

const MigrateOrderIdsUseCase = {
  migrateOrderIds,
};

export default MigrateOrderIdsUseCase;
