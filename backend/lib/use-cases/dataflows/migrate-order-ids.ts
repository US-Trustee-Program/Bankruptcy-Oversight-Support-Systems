// TODO: Delete this module once the consolidation order `consolidationId` values have been migrated.

import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';
import { MigrationConsolidationOrder } from '../gateways.types';
import { generateConsolidationId } from '../../../../common/src/cams/orders';

const mapSetParameters = (order: MigrationConsolidationOrder, idx: number) => {
  return {
    id: order.id,
    consolidationId: generateConsolidationId(order.jobId, order.status, idx),
  };
};

async function migrateConsolidationOrderIds(context: ApplicationContext) {
  const repo = Factory.getConsolidationOrdersMigrationMongoRepository(context);

  const allOrders = await repo.list();
  const jobIdOrdersMap = allOrders.reduce((acc, order) => {
    const jobId = String(order.jobId);
    if (acc.has(jobId)) {
      acc.get(jobId).push(order);
    } else {
      acc.set(jobId, [order]);
    }
    return acc;
  }, new Map<string, MigrationConsolidationOrder[]>());

  return [...jobIdOrdersMap.values()];
}

async function updateConsolidationIds(
  context: ApplicationContext,
  orders: MigrationConsolidationOrder[],
) {
  const repo = Factory.getConsolidationOrdersMigrationMongoRepository(context);

  const pending = orders.filter((order) => order.status === 'pending').map(mapSetParameters);
  const rejected = orders.filter((order) => order.status === 'rejected').map(mapSetParameters);
  const approved = orders.filter((order) => order.status === 'approved').map(mapSetParameters);
  for (const setParameters of [...pending, ...rejected, ...approved]) {
    await repo.set(setParameters);
  }
}

const MigrateOrderIdsUseCase = {
  migrateConsolidationOrderIds,
  updateConsolidationIds,
};

export default MigrateOrderIdsUseCase;
