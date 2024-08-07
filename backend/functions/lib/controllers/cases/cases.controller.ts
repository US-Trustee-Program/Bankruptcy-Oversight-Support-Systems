import { ApplicationContext } from '../../adapters/types/basic';
import CaseManagement from '../../use-cases/case-management';
import { ResponseBody, ResponseMetaData } from '../../../../../common/src/api/response';
import { CaseBasics } from '../../../../../common/src/cams/cases';
import { CasesSearchPredicate, setPaginationDefaults } from '../../../../../common/src/api/search';
import { CamsHttpRequest } from '../../adapters/types/http';

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
    return this.caseManagement.getCaseDetail(this.applicationContext, requestQueryFilters.caseId);
  }

  public async getCasesByUserSessionOffices(
    request: CamsHttpRequest,
  ): Promise<ResponseBody<CaseBasics[]>> {
    type CasesSearchQueryString = Omit<CasesSearchPredicate, 'chapters'> & {
      chapters: string;
    };

    const queryString = request.query as unknown as CasesSearchQueryString;
    const { chapters, ...otherProps } = queryString;

    const divisionCodes = this.applicationContext.session.user.offices.map(
      (office) => office.courtDivisionCode,
    );

    const predicate: CasesSearchPredicate = setPaginationDefaults({
      ...otherProps,
      divisionCodes,
      chapters: chapters?.split(','),
    });

    return this.searchCases(predicate, request.url);
  }

  public async searchAllCases(request: CamsHttpRequest): Promise<ResponseBody<CaseBasics[]>> {
    type CasesSearchQueryString = Omit<CasesSearchPredicate, 'divisionCodes, chapters'> & {
      divisionCodes: string;
      chapters: string;
    };

    const queryString = request.query as unknown as CasesSearchQueryString;
    const { divisionCodes, chapters, ...otherProps } = queryString;
    const predicate: CasesSearchPredicate = setPaginationDefaults({
      ...otherProps,
      divisionCodes: divisionCodes?.split(','),
      chapters: chapters?.split(','),
    });

    return this.searchCases(predicate, request.url);
  }

  async searchCases(
    predicate: CasesSearchPredicate,
    url: string,
  ): Promise<ResponseBody<CaseBasics[]>> {
    const cases = await this.caseManagement.searchCases(this.applicationContext, predicate);

    const meta: ResponseMetaData = {
      isPaginated: true,
      count: cases.length,
      self: url,
      limit: predicate.limit,
      currentPage: getCurrentPage(cases.length, predicate),
    };
    if (cases.length > predicate.limit) {
      const next = new URL(url);
      next.searchParams.set('limit', predicate.limit.toString());
      next.searchParams.set('offset', (predicate.offset + predicate.limit).toString());
      meta.next = next.href;
      cases.pop();
      meta.count = cases.length;
    }
    if (predicate.offset > 0) {
      const previous = new URL(url);
      previous.searchParams.set('limit', predicate.limit.toString());
      previous.searchParams.set('offset', (predicate.offset - predicate.limit).toString());
      meta.previous = previous.href;
    }
    return {
      meta,
      isSuccess: true,
      data: cases,
    };
  }
}
