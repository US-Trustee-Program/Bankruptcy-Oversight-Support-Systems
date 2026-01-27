import { createAuditRecord } from '@common/cams/auditable';
import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import { generatePhoneticTokens } from '../cases/phonetic-utils';

const MODULE_NAME = 'EXPORT-AND-LOAD';

/**
 * Add phonetic tokens to a case's debtor and joint debtor names
 * @param bCase The case to add phonetic tokens to
 * @returns A new case object with phonetic tokens added (immutable)
 */
function addPhoneticTokens(bCase: SyncedCase): SyncedCase {
  const result: SyncedCase = { ...bCase };

  if (bCase.debtor?.name) {
    result.debtor = { ...bCase.debtor, phoneticTokens: generatePhoneticTokens(bCase.debtor.name) };
  }

  if (bCase.jointDebtor?.name) {
    result.jointDebtor = {
      ...bCase.jointDebtor,
      phoneticTokens: generatePhoneticTokens(bCase.jointDebtor.name),
    };
  }

  return result;
}

async function exportAndLoad(
  context: ApplicationContext,
  events: CaseSyncEvent[],
): Promise<CaseSyncEvent[]> {
  const casesGateway = factory.getCasesGateway(context);
  const repo = factory.getCasesRepository(context);
  for (const event of events) {
    try {
      event.bCase = await casesGateway.getCaseDetail(context, event.caseId);
      const caseWithPhoneticTokens = addPhoneticTokens(event.bCase);
      await repo.syncDxtrCase(
        createAuditRecord<SyncedCase>({ ...caseWithPhoneticTokens, documentType: 'SYNCED_CASE' }),
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
    const gateway = factory.getCasesGateway(context);
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
    const casesRepo = factory.getCasesRepository(context);
    const caseWithPhoneticTokens = addPhoneticTokens({ ...event.bCase });
    const synced = createAuditRecord<SyncedCase>({
      ...caseWithPhoneticTokens,
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
