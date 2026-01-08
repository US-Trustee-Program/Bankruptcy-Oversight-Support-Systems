import { ApplicationContext } from '../../adapters/types/basic';
import CaseManagement from '../../use-cases/cases/case-management';
import { ResponseBody } from '@common/api/response';
import { CaseDetail, SyncedCase } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsHttpRequest } from '../../adapters/types/http';
import { Pagination } from '@common/api/pagination';
import { httpSuccess } from '../../adapters/utils/http-response';
import { ResourceActions } from '@common/cams/actions';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';

const MODULE_NAME = 'CASES-CONTROLLER';

function calculateCurrentPage(caseLength: number, predicate: CasesSearchPredicate) {
  return caseLength === 0 ? 0 : predicate.offset / predicate.limit + 1;
}

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
      limit: predicate.limit,
      currentPage: calculateCurrentPage(cases.data.length, predicate),
      totalPages: Math.ceil(cases.metadata.total / predicate.limit),
      totalCount: cases.metadata.total,
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
      meta: {
        self: url,
      },
      pagination,
      data: cases.data,
    };
  }
}
