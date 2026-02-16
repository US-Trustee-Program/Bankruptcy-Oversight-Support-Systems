import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeData } from './queue-types';

const MODULE_NAME = 'RESYNC-REMAINING-CASES-USE-CASE';

type CursorPageResult = {
  caseIds: string[];
  lastId: string | null;
  hasMore: boolean;
};

async function getPageOfRemainingCasesByCursor(
  context: ApplicationContext,
  cutoffDate: string,
  lastId: string | null,
  limit: number,
): Promise<MaybeData<CursorPageResult>> {
  try {
    const repo = factory.getCasesRepository(context);
    const results = await repo.getCaseIdsRemainingToSync(cutoffDate, lastId, limit + 1);

    const hasMore = results.length > limit;
    const cases = results.slice(0, limit);
    const newLastId = cases.length > 0 ? cases[cases.length - 1]._id : null;

    return {
      data: {
        caseIds: cases.map((c) => c.caseId),
        lastId: newLastId,
        hasMore,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of remaining cases by cursor (lastId: ${lastId}, limit: ${limit}).`,
      ),
    };
  }
}

const ResyncRemainingCases = {
  getPageOfRemainingCasesByCursor,
};

export default ResyncRemainingCases;
