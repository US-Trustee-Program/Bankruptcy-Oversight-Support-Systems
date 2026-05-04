import { createAuditRecord } from '@common/cams/auditable';
import { DxtrCase, SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { CaseSyncEvent, OrphanedCaseMessage } from '@common/cams/dataflow-events';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { CasesRepository } from '../gateways.types';

const MODULE_NAME = 'EXPORT-AND-LOAD';

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

async function detectDivisionChange(
  repo: CasesRepository,
  syncedCase: DxtrCase,
): Promise<OrphanedCaseMessage | null> {
  const existing = await repo.findSyncedCaseByDxtrId(syncedCase.dxtrId, syncedCase.courtId);

  if (!existing || existing.caseId === syncedCase.caseId) {
    return null;
  }

  return {
    orphanedCaseId: existing.caseId,
    currentCaseId: syncedCase.caseId,
  };
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
      const syncedCase = { ...caseWithPhoneticTokens, documentType: 'SYNCED_CASE' as const };

      try {
        const divisionChange = await detectDivisionChange(repo, syncedCase);
        if (divisionChange) {
          event.divisionChange = divisionChange;
          context.logger.info(
            MODULE_NAME,
            `Division change detected: dxtrId=${syncedCase.dxtrId} courtId=${syncedCase.courtId} orphaned=${divisionChange.orphanedCaseId} current=${divisionChange.currentCaseId}`,
          );
        }
      } catch (detectionError) {
        context.logger.error(
          MODULE_NAME,
          `Division change detection failed for case ${event.caseId} dxtrId=${syncedCase.dxtrId}: ${detectionError}`,
        );
      }

      await repo.syncDxtrCase(createAuditRecord<SyncedCase>(syncedCase));
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        try {
          const existing = await repo.getSyncedCase(event.caseId);
          const results = await casesGateway.searchCases(context, {
            dxtrId: existing.dxtrId,
            courtId: existing.courtId,
          });
          if (results.length > 1) {
            context.logger.warn(
              MODULE_NAME,
              `Ambiguous DXTR results for orphaned case ${event.caseId}: ${results.length} candidates`,
            );
          }
          if (results.length > 0 && results[0].caseId !== event.caseId) {
            event.divisionChange = {
              orphanedCaseId: event.caseId,
              currentCaseId: results[0].caseId,
            };
            continue;
          }
        } catch (_lookupError) {
          // fall through
        }
      }
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
    const caseWithPhoneticTokens = addPhoneticTokens(event.bCase);
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
