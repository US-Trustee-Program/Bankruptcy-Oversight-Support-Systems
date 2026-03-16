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
  // Retrieve current sync state from runtime state repository
  const runtimeStateRepo = factory.getRuntimeStateRepository(context);
  const syncState = await runtimeStateRepo.read('DELETED_CASES_SYNC_STATE');

  const lastChangeDate = syncState?.lastChangeDate ?? '2018-01-01';
  context.logger.debug(
    MODULE_NAME,
    `Starting deleted cases detection from date: ${lastChangeDate}`,
  );

  // Query ACMS gateway for deleted cases since last sync
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

  // Create CaseDeletedEvent for each deleted case
  const events: CaseDeletedEvent[] = caseIds.map((caseId) => ({
    type: 'CASE_DELETED',
    caseId,
    deletedDate: latestDeletedCaseDate,
  }));

  // Update runtime state with the latest deleted case date
  const updatedSyncState: DeletedCasesSyncState = {
    ...syncState,
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
