import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { OrphanedCaseMessage } from '@common/cams/dataflow-events';

const MODULE_NAME = 'HANDLE-MISSED-DIVISION-CHANGES';

export async function checkCaseForDivisionChange(
  context: ApplicationContext,
  caseId: string,
): Promise<OrphanedCaseMessage | null> {
  try {
    const repo = factory.getCasesRepository(context);
    const syncedCase = await repo.getSyncedCase(caseId);
    const existing = await repo.findSyncedCaseByDxtrId(syncedCase.dxtrId, syncedCase.courtId);

    if (!existing || existing.caseId === caseId) {
      return null;
    }

    return { orphanedCaseId: existing.caseId, currentCaseId: caseId };
  } catch (originalError) {
    if (isNotFoundError(originalError)) {
      context.logger.warn(
        MODULE_NAME,
        `Case ${caseId} was never synced. Skipping division change check.`,
      );
      return null;
    }

    throw getCamsError(originalError, MODULE_NAME, `Failed to check case ${caseId}`);
  }
}
