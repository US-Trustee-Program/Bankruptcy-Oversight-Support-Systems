import { ApplicationContext } from '../../adapters/types/basic';
import { DeletedCasesSyncState } from '../gateways.types';
import factory from '../../factory';

const MODULE_NAME = 'DETECT-DELETED-CASES';

export type CaseDeletedEvent = {
  type: 'CASE_DELETED';
  caseId: string;
  deletedDate: string;
};

async function getDeletedCaseEvents(context: ApplicationContext): Promise<CaseDeletedEvent[]> {
  const runtimeStateRepo = factory.getRuntimeStateRepository<DeletedCasesSyncState>(context);
  let syncState: DeletedCasesSyncState | null = null;

  try {
    syncState = await runtimeStateRepo.read('DELETED_CASES_SYNC_STATE');
  } catch (_error) {
    syncState = null;
  }

  const lastChangeDate = syncState?.lastChangeDate ?? '2018-01-01';
  context.logger.debug(
    MODULE_NAME,
    `Starting deleted cases detection from date: ${lastChangeDate}`,
  );

  const acmsGateway = factory.getAcmsGateway(context);
  const { caseIds, latestDeletedCaseDate } = await acmsGateway.getDeletedCaseIds(
    context,
    lastChangeDate,
  );

  context.logger.info(
    MODULE_NAME,
    `Found ${caseIds.length} deleted cases with latest change date: ${latestDeletedCaseDate}`,
  );
  context.logger.debug(MODULE_NAME, `Deleted case IDs: ${JSON.stringify(caseIds)}`);

  const events: CaseDeletedEvent[] = caseIds.map((caseId) => ({
    type: 'CASE_DELETED',
    caseId,
    deletedDate: latestDeletedCaseDate,
  }));

  const updatedSyncState: DeletedCasesSyncState = {
    id: syncState?.id ?? 'DELETED_CASES_SYNC_STATE',
    documentType: 'DELETED_CASES_SYNC_STATE',
    lastChangeDate: latestDeletedCaseDate,
  };
  await runtimeStateRepo.upsert(updatedSyncState);

  context.logger.debug(
    MODULE_NAME,
    `Updated sync state with latest change date: ${latestDeletedCaseDate}`,
  );

  return events;
}

const DetectDeletedCases = {
  getDeletedCaseEvents,
};

export default DetectDeletedCases;
