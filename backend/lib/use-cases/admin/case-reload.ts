import { ApplicationContext } from '../../adapters/types/basic';
import StorageQueueGateway from '../../adapters/gateways/storage-queue/storage-queue-gateway';
import { CaseSyncEvent } from '@common/queue/dataflow-types';

const MODULE_NAME = 'CASE-RELOAD-USE-CASE';

async function queueCaseReload(context: ApplicationContext, caseId: string): Promise<void> {
  const event: CaseSyncEvent = {
    type: 'CASE_CHANGED',
    caseId,
  };

  const queueGateway = StorageQueueGateway.using<CaseSyncEvent>(context, 'SYNC_CASES_PAGE');

  queueGateway.enqueue(event);

  context.logger.info(MODULE_NAME, 'Case reload queued', { caseId });
}

export default {
  queueCaseReload,
};
