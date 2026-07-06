import { createAuditRecord } from '@common/cams/auditable';
import { DxtrCase, SyncedCase, isCaseClosed } from '@common/cams/cases';
import { CaseDenormalizedFields } from '@common/cams/trustee-appointments';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { CaseSyncEvent, OrphanedCaseMessage } from '@common/cams/dataflow-events';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { CasesRepository, TrusteeCaseAppointmentsRepository } from '../gateways.types';

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

function detectDenormalizedFieldChanges(
  existingCase: DxtrCase | undefined,
  newCase: DxtrCase,
): CaseDenormalizedFields | null {
  if (!existingCase) return null;

  const fieldsToCheck: (keyof DxtrCase)[] = [
    'dateFiled',
    'chapter',
    'courtDivisionCode',
    'closedDate',
    'reopenedDate',
  ];
  const hasRelevantChange = fieldsToCheck.some((field) => existingCase[field] !== newCase[field]);

  if (!hasRelevantChange) return null;

  const newCaseStatus = isCaseClosed(newCase) ? 'CLOSED' : 'OPEN';
  return {
    dateFiled: newCase.dateFiled,
    caseStatus: newCaseStatus,
    chapter: newCase.chapter,
    courtDivisionCode: newCase.courtDivisionCode,
  };
}

async function updateAppointmentFieldsWithRetry(
  context: ApplicationContext,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
  caseId: string,
  fields: CaseDenormalizedFields,
): Promise<void> {
  try {
    await appointmentsRepo.updateCaseFields(caseId, fields);
  } catch (_firstError) {
    try {
      await appointmentsRepo.updateCaseFields(caseId, fields);
    } catch (secondError) {
      context.logger.warn(MODULE_NAME, `updateCaseFields failed for caseId: ${caseId}`, {
        error: secondError,
      });
      throw secondError;
    }
  }
}

async function exportAndLoad(
  context: ApplicationContext,
  events: CaseSyncEvent[],
): Promise<CaseSyncEvent[]> {
  const casesGateway = factory.getCasesGateway(context);
  const casesRepo = factory.getCasesRepository(context);
  const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);

  for (const event of events) {
    try {
      event.bCase = await casesGateway.getCaseDetail(context, event.caseId);
      const caseWithPhoneticTokens = addPhoneticTokens(event.bCase);
      const syncedCase = { ...caseWithPhoneticTokens, documentType: 'SYNCED_CASE' as const };

      try {
        const divisionChange = await detectDivisionChange(casesRepo, syncedCase);
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

      // Get existing case before sync to detect field changes
      let existingCase: DxtrCase | undefined;
      try {
        const existing = await casesRepo.getSyncedCase(event.caseId);
        existingCase = existing;
      } catch {
        // Case doesn't exist yet, that's ok
      }

      await casesRepo.syncDxtrCase(createAuditRecord<SyncedCase>(syncedCase));

      // After sync succeeds, check if denormalized fields changed and update appointments
      const fieldsToUpdate = detectDenormalizedFieldChanges(existingCase, event.bCase!);
      if (fieldsToUpdate) {
        await updateAppointmentFieldsWithRetry(
          context,
          appointmentsRepo,
          event.caseId,
          fieldsToUpdate,
        );
      }
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        try {
          const existing = await casesRepo.getSyncedCase(event.caseId);
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
        } catch (lookupError) {
          context.logger.warn(
            MODULE_NAME,
            `Division-change lookup failed for orphaned case ${event.caseId}: ${lookupError}`,
          );
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
