import { createAuditRecord } from '@common/cams/auditable';
import { DxtrCase, SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { CasesRepository } from '../gateways.types';

const MODULE_NAME = 'EXPORT-AND-LOAD';

/**
 * Add search tokens (bigrams + phonetic codes) to a case's debtor and joint debtor names.
 * Bigrams are lowercase 2-char n-grams for substring matching.
 * Phonetic codes are uppercase Soundex + Metaphone for variant spelling matching.
 * @param bCase The case to add search tokens to
 * @returns A new case object with search tokens added (immutable)
 */
function addPhoneticTokens(bCase: DxtrCase): DxtrCase {
  const result: DxtrCase = { ...bCase };

  if (bCase.debtor?.name) {
    result.debtor = { ...bCase.debtor, phoneticTokens: generateSearchTokens(bCase.debtor.name) };
  }

  if (bCase.jointDebtor?.name) {
    result.jointDebtor = {
      ...bCase.jointDebtor,
      phoneticTokens: generateSearchTokens(bCase.jointDebtor.name),
    };
  }

  return result;
}

/**
 * Detect and handle division change for a case.
 * Division change occurs when a case with the same dxtrId and courtId
 * already exists but has a different caseId.
 *
 * @param context Application context for logging
 * @param event Case sync event to potentially update with division change info
 * @param syncedCase The synced case data to check
 * @param repo Cases repository for querying existing cases
 * @returns Promise<boolean> - true if division change was handled, false otherwise
 */
async function detectAndHandleDivisionChange(
  context: ApplicationContext,
  event: CaseSyncEvent,
  syncedCase: SyncedCase,
  repo: CasesRepository,
): Promise<boolean> {
  try {
    const existing = await repo.findSyncedCaseByDxtrId(syncedCase.dxtrId, syncedCase.courtId);

    if (existing && existing.caseId !== syncedCase.caseId) {
      // Division change detected - sync new case
      await repo.syncDxtrCase(createAuditRecord<SyncedCase>(syncedCase));

      event.divisionChange = {
        orphanedCaseId: existing.caseId,
        currentCaseId: syncedCase.caseId,
      };

      context.logger.info(
        MODULE_NAME,
        `Division change detected: dxtrId=${syncedCase.dxtrId} courtId=${syncedCase.courtId} orphaned=${existing.caseId} current=${syncedCase.caseId}`,
      );

      return true; // Division change handled
    }

    return false; // No division change
  } catch (detectionError) {
    context.logger.error(
      MODULE_NAME,
      `Division change detection failed for case ${event.caseId} dxtrId=${syncedCase.dxtrId}: ${detectionError}`,
    );
    return false; // Detection failed, caller will do normal sync
  }
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
      const syncedCase: SyncedCase = { ...caseWithPhoneticTokens, documentType: 'SYNCED_CASE' };

      const divisionChangeHandled = await detectAndHandleDivisionChange(
        context,
        event,
        syncedCase,
        repo,
      );

      if (!divisionChangeHandled) {
        await repo.syncDxtrCase(createAuditRecord<SyncedCase>(syncedCase));
      }
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
