import { Pagination } from '../../../../common/src/api/pagination';
import { ResponseBody } from '../../../../common/src/api/response';
import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { ResourceActions } from '../../../../common/src/cams/actions';
import { CaseDetail, SyncedCase } from '../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpRequest } from '../../adapters/types/http';
import { httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import CaseManagement from '../../use-cases/cases/case-management';
import { CamsController } from '../controller';

const MODULE_NAME = 'CASES-CONTROLLER';

type SearchOptions = {
  includeAssignments?: string;
};

export class CasesController implements CamsController {
  private readonly applicationContext: ApplicationContext;
  private readonly caseManagement: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.caseManagement = new CaseManagement(this.applicationContext);
  }

  public async handleRequest(context: ApplicationContext) {
    let data: ResponseBody<ResourceActions<CaseDetail> | ResourceActions<SyncedCase>[]>;
    try {
      if (context.request.method === 'GET' && context.request.params.caseId) {
        data = await this.getCaseDetails({ caseId: context.request.params.caseId });
      } else {
        data = await this.searchCases(context.request);
      }
      return httpSuccess({ body: data });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  async paginateSearchCases(
    predicate: CasesSearchPredicate,
    url: string,
    includeAssignments: boolean,
  ): Promise<ResponseBody<ResourceActions<SyncedCase>[]>> {
    const cases = await this.caseManagement.searchCases(
      this.applicationContext,
      predicate,
      includeAssignments,
    );

    const pagination: Pagination = {
      count: cases.data.length,
      currentPage: calculateCurrentPage(cases.data.length, predicate),
      limit: predicate.limit,
      totalCount: cases.metadata.total,
      totalPages: Math.ceil(cases.metadata.total / predicate.limit),
    };

    if (pagination.currentPage < pagination.totalPages) {
      const next = new URL(url);
      next.searchParams.set('limit', predicate.limit.toString());
      next.searchParams.set('offset', (predicate.offset + predicate.limit).toString());
      pagination.next = next.href;
      pagination.count = cases.data.length;
    }

    if (pagination.currentPage > 1) {
      const previous = new URL(url);
      previous.searchParams.set('limit', predicate.limit.toString());
      previous.searchParams.set('offset', (predicate.offset - predicate.limit).toString());
      pagination.previous = previous.href;
    }

    return {
      data: cases.data,
      meta: {
        self: url,
      },
      pagination,
    };
  }

  private async getCaseDetails(requestQueryFilters: { caseId: string }) {
    const data = await this.caseManagement.getCaseDetail(
      this.applicationContext,
      requestQueryFilters.caseId,
    );
    return { data };
  }

  private async searchCases(request: CamsHttpRequest) {
    const predicate = request.body as CasesSearchPredicate;
    const options = request.query as SearchOptions;
    const includeAssignments = options?.includeAssignments === 'true';
    const body = await this.paginateSearchCases(predicate, request.url, !!includeAssignments);
    return body;
  }
}

function calculateCurrentPage(caseLength: number, predicate: CasesSearchPredicate) {
  return caseLength === 0 ? 0 : predicate.offset / predicate.limit + 1;
}
