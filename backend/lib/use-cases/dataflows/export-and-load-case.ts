import { createAuditRecord } from '@common/cams/auditable';
import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import Factory from '../../factory';
import { CaseSyncEvent } from '@common/queue/dataflow-types';

const MODULE_NAME = 'EXPORT-AND-LOAD';

async function exportAndLoad(
  context: ApplicationContext,
  events: CaseSyncEvent[],
): Promise<CaseSyncEvent[]> {
  const casesGateway = Factory.getCasesGateway(context);
  const repo = Factory.getCasesRepository(context);
  for (const event of events) {
    try {
      event.bCase = await casesGateway.getCaseDetail(context, event.caseId);
      await repo.syncDxtrCase(
        createAuditRecord<SyncedCase>({ ...event.bCase, documentType: 'SYNCED_CASE' }),
      );
    } catch (originalError) {
      event.error = getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to sync case ${event.caseId}.`,
      );
    }
  }
  return events;
}

async function exportCase(context: ApplicationContext, event: CaseSyncEvent) {
  try {
    const gateway = Factory.getCasesGateway(context);
    event.bCase = await gateway.getCaseDetail(context, event.caseId);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while exporting case ${event.caseId}.`,
    );
    context.logger.camsError(error);
    event.error = error;
  }

  return event;
}

async function loadCase(context: ApplicationContext, event: CaseSyncEvent) {
  try {
    const casesRepo = Factory.getCasesRepository(context);
    const synced = createAuditRecord<SyncedCase>({ ...event.bCase, documentType: 'SYNCED_CASE' });
    await casesRepo.syncDxtrCase(synced);
  } catch (originalError) {
    event.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: {
        message: `Failed to sync DXTR case ${event.caseId}.`,
        module: MODULE_NAME,
      },
    });
  }
  return event;
}

const ExportAndLoadCase = {
  exportAndLoad,
  exportCase,
  loadCase,
};

export default ExportAndLoadCase;
