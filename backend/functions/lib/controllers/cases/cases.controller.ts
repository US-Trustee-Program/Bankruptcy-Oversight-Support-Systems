import { ApplicationContext } from '../../adapters/types/basic';
import CaseManagement from '../../use-cases/case-management';
import { ResponseBody } from '../../../../../common/src/api/response';
import { CaseBasics, CaseDetail } from '../../../../../common/src/cams/cases';
import { CasesSearchPredicate } from '../../../../../common/src/api/search';
import { CamsHttpRequest } from '../../adapters/types/http';
import { Pagination } from '../../../../../common/src/api/pagination';
import { httpSuccess } from '../../adapters/utils/http-response';
import { ResourceActions } from '../../../../../common/src/cams/actions';

const _MODULE_NAME = 'CASES-CONTROLLER';

function getCurrentPage(caseLength: number, predicate: CasesSearchPredicate) {
  return caseLength === 0 ? 0 : predicate.offset / predicate.limit + 1;
}

export class CasesController {
  private readonly applicationContext: ApplicationContext;
  private readonly caseManagement: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.caseManagement = new CaseManagement(this.applicationContext);
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    const data = await this.caseManagement.getCaseDetail(
      this.applicationContext,
      requestQueryFilters.caseId,
    );
    return httpSuccess<ResourceActions<CaseDetail>>({ body: { data } });
  }

  public async searchCases(request: CamsHttpRequest) {
    const predicate = request.body as CasesSearchPredicate;
    const body = await this.paginateSearchCases(predicate, request.url);
    return httpSuccess<ResourceActions<CaseBasics>[]>({ body });
  }

  async paginateSearchCases(
    predicate: CasesSearchPredicate,
    url: string,
  ): Promise<ResponseBody<ResourceActions<CaseBasics>[]>> {
    const cases = await this.caseManagement.searchCases(this.applicationContext, predicate);

    const pagination: Pagination = {
      count: cases.length,
      limit: predicate.limit,
      currentPage: getCurrentPage(cases.length, predicate),
    };
    if (cases.length > predicate.limit) {
      const next = new URL(url);
      next.searchParams.set('limit', predicate.limit.toString());
      next.searchParams.set('offset', (predicate.offset + predicate.limit).toString());
      pagination.next = next.href;
      cases.pop();
      pagination.count = cases.length;
    }
    if (predicate.offset > 0) {
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
      data: cases,
    };
  }
}
