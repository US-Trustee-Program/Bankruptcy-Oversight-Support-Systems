import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { computeTaskDate } from '@common/cams/data-verification';
import { MaybeData } from './queue-types';

const MODULE_NAME = 'BACKFILL-TRUSTEE-VERIFICATION-TASK-DATE-USE-CASE';

type BackfillVerification = TrusteeMatchVerification & { _id: string };

type CursorPageResult = {
  verifications: BackfillVerification[];
  lastId: string | null;
  hasMore: boolean;
};

type BackfillResult = {
  id: string;
  success: boolean;
  error?: string;
};

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
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
    const results = await repo.findVerificationsMissingTaskDate(lastId, limit + 1);

    const hasMore = results.length > limit;
    const verifications = results.slice(0, limit) as BackfillVerification[];
    const newLastId = verifications.length > 0 ? verifications[verifications.length - 1]._id : null;

    return { data: { verifications, lastId: newLastId, hasMore } };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of verifications needing taskDate backfill (lastId: ${lastId}).`,
      ),
    };
  }
}

async function backfillTaskDates(
  context: ApplicationContext,
  verifications: BackfillVerification[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];
  const repo = factory.getTrusteeMatchVerificationRepository(context);

  for (const verification of verifications) {
    try {
      const taskDate = computeTaskDate(verification);
      if (!taskDate) {
        context.logger.warn(
          MODULE_NAME,
          `Unable to compute taskDate for verification ${verification._id} — skipping.`,
        );
        results.push({ id: verification._id, success: true });
        continue;
      }
      await repo.updateVerificationTaskDate(verification._id, taskDate);
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

  const backfillResult = await backfillTaskDates(context, verifications);
  if (backfillResult.error) {
    return { status: 'error', error: backfillResult.error as CamsError };
  }

  const results = backfillResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  return {
    status: 'ok',
    processedCount: results.length,
    successCount,
    failedResults,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

const BackfillTrusteeVerificationTaskDateUseCase = {
  getPageNeedingBackfill,
  backfillTaskDates,
  processBackfillPage,
};

export default BackfillTrusteeVerificationTaskDateUseCase;
