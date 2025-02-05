import { createAuditRecord } from '../../../../common/src/cams/auditable';
import { SyncedCase } from '../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getCasesGateway, getCasesRepository } from '../../factory';
import { CaseSyncEvent } from './dataflow-types';

const MODULE_NAME = 'EXPORT_AND_LOAD';

async function exportCase(context: ApplicationContext, event: CaseSyncEvent) {
  try {
    const gateway = getCasesGateway(context);
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
    const casesRepo = getCasesRepository(context);
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
  exportCase,
  loadCase,
};

export default ExportAndLoadCase;
