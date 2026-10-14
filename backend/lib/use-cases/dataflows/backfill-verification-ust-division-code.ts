import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { MaybeData } from './queue-types';

const MODULE_NAME = 'BACKFILL-VERIFICATION-UST-DIVISION-CODE-USE-CASE';

type BackfillVerification = TrusteeMatchVerification & { _id: string };

type CursorPageResult = {
  verifications: BackfillVerification[];
  lastId: string | null;
  hasMore: boolean;
};

type BackfillResult = {
  id: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
};

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
      skippedCount: number;
      failedResults: BackfillResult[];
      nextCursor: { lastId: string | null } | null;
    };

async function getPageNeedingBackfill(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<MaybeData<CursorPageResult>> {
  try {
    const repo = factory.getTrusteeMatchVerificationRepository(context);
    const results = await repo.findVerificationsMissingUstDivisionCode(lastId, limit + 1);

    const hasMore = results.length > limit;
    const verifications = results.slice(0, limit) as BackfillVerification[];
    const newLastId = verifications.length > 0 ? verifications[verifications.length - 1]._id : null;

    return { data: { verifications, lastId: newLastId, hasMore } };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of verifications needing ustDivisionCode backfill (lastId: ${lastId}).`,
      ),
    };
  }
}

/**
 * Copies each verification's division identity from its own SYNCED_CASE rather than deriving it
 * from caseId. The ACMS prefix in caseId is exactly what cannot distinguish Winchester from
 * Chattanooga, so re-deriving from it would reproduce the bug this backfill exists to fix.
 *
 * That makes BACKFILL-UST-DIVISION-CODE a prerequisite: a case that has not been backfilled yet
 * has no ustDivisionCode to copy, and its verifications are skipped rather than stamped with a
 * guess. Re-running after the case backfill completes picks them up, since the page query
 * selects on the field still being absent.
 */
async function backfillUstDivisionCodes(
  context: ApplicationContext,
  verifications: BackfillVerification[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];
  const repo = factory.getTrusteeMatchVerificationRepository(context);
  const casesRepo = factory.getCasesRepository(context);

  for (const verification of verifications) {
    try {
      const syncedCase = await casesRepo.getCaseOrMovedCase(verification.caseId);
      const ustDivisionCode = syncedCase?.ustDivisionCode;

      if (!ustDivisionCode) {
        context.logger.info(
          MODULE_NAME,
          `No ustDivisionCode on the synced case for ${verification.caseId} — skipping ` +
            `verification ${verification._id}. Re-run after BACKFILL-UST-DIVISION-CODE completes.`,
        );
        results.push({ id: verification._id, success: true, skipped: true });
        continue;
      }

      await repo.updateVerificationUstDivisionCode(verification._id, ustDivisionCode);
      results.push({ id: verification._id, success: true });
    } catch (originalError) {
      results.push({
        id: verification._id,
        success: false,
        error: originalError instanceof Error ? originalError.message : String(originalError),
      });
    }
  }

  return { data: results };
}

async function processBackfillPage(
  context: ApplicationContext,
  lastId: string | null,
  pageSize: number,
): Promise<ProcessBackfillPageResult> {
  const pageResult = await getPageNeedingBackfill(context, lastId, pageSize);
  if (pageResult.error || !pageResult.data) {
    return {
      status: 'error',
      error:
        (pageResult.error as CamsError) ??
        getCamsError(new Error('Unexpected missing data in page result'), MODULE_NAME),
    };
  }

  const { verifications, lastId: newLastId, hasMore } = pageResult.data;

  if (verifications.length === 0) {
    return { status: 'empty' };
  }

  const backfillResult = await backfillUstDivisionCodes(context, verifications);
  if (backfillResult.error) {
    return { status: 'error', error: backfillResult.error as CamsError };
  }

  const results = backfillResult.data ?? [];
  const successCount = results.filter((r) => r.success && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failedResults = results.filter((r) => !r.success);

  // Skipped verifications keep the field absent, so they stay selected by the page query. The
  // cursor still has to advance past them or the run would re-read the same page forever.
  return {
    status: 'ok',
    processedCount: results.length,
    successCount,
    skippedCount,
    failedResults,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

const BackfillVerificationUstDivisionCodeUseCase = {
  getPageNeedingBackfill,
  backfillUstDivisionCodes,
  processBackfillPage,
};

export default BackfillVerificationUstDivisionCodeUseCase;
