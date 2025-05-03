import { ApplicationContext } from '../../../backend/lib/adapters/types/basic';
import {
  getConsolidationOrdersRepository,
  getOrdersRepository,
} from '../../../backend/lib/factory';
import ExportAndLoadCase from '../../../backend/lib/use-cases/dataflows/export-and-load-case';
import { ConsolidationOrder, TransferOrder } from '../../../common/src/cams/orders';
import { CaseSyncEvent } from '../../../common/src/queue/dataflow-types';

export async function insertConsolidationOrders(
  appContext: ApplicationContext,
  consolidations: ConsolidationOrder[],
) {
  const consolidationRepo = getConsolidationOrdersRepository(appContext);
  await consolidationRepo.createMany(consolidations);
  console.log('Created Consolidation Orders....   ', consolidations);
  consolidationRepo.release();
}

export async function insertTransferOrders(
  appContext: ApplicationContext,
  transfers: TransferOrder[],
) {
  const transfersRepo = getOrdersRepository(appContext);
  await transfersRepo.createMany(transfers);
  console.log('Created Transfer Orders....   ', transfers);
  transfersRepo.release();
}

export async function syncCases(context: ApplicationContext, caseIds: string[]) {
  const events: CaseSyncEvent[] = caseIds.map((caseId) => {
    return { caseId, type: 'CASE_CHANGED' };
  });
  return await ExportAndLoadCase.exportAndLoad(context, events);
}
