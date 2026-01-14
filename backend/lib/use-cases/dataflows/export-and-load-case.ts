import { createAuditRecord } from '@common/cams/auditable';
import { DxtrCase, SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getCasesGateway, getCasesRepository } from '../../factory';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import { generatePhoneticTokens } from '../cases/phonetic-utils';

const MODULE_NAME = 'EXPORT-AND-LOAD';

/**
 * Adds phonetic tokens to debtor and jointDebtor names
 */
function addPhoneticTokens(bCase: DxtrCase): DxtrCase {
  const caseWithTokens = { ...bCase };

  // Generate phonetic tokens for debtor name
  if (caseWithTokens.debtor?.name) {
    caseWithTokens.debtor = {
      ...caseWithTokens.debtor,
      phoneticTokens: generatePhoneticTokens(caseWithTokens.debtor.name),
    };
  }

  // Generate phonetic tokens for joint debtor name
  if (caseWithTokens.jointDebtor?.name) {
    caseWithTokens.jointDebtor = {
      ...caseWithTokens.jointDebtor,
      phoneticTokens: generatePhoneticTokens(caseWithTokens.jointDebtor.name),
    };
  }

  return caseWithTokens;
}

async function exportAndLoad(
  context: ApplicationContext,
  events: CaseSyncEvent[],
): Promise<CaseSyncEvent[]> {
  const casesGateway = getCasesGateway(context);
  const repo = getCasesRepository(context);
  for (const event of events) {
    try {
      event.bCase = await casesGateway.getCaseDetail(context, event.caseId);
      const caseWithTokens = addPhoneticTokens(event.bCase);
      await repo.syncDxtrCase(
        createAuditRecord<SyncedCase>({ ...caseWithTokens, documentType: 'SYNCED_CASE' }),
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
    const caseWithTokens = addPhoneticTokens(event.bCase);
    const synced = createAuditRecord<SyncedCase>({
      ...caseWithTokens,
      documentType: 'SYNCED_CASE',
    });
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
