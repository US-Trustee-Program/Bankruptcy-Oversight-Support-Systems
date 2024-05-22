import { ApplicationContext } from '../../adapters/types/basic';
import { CaseManagement } from '../../use-cases/case-management';
import { ResponseBody } from '../../../../../common/src/api/response';
import { CaseBasics } from '../../../../../common/src/cams/cases';
import { CasesSearchPredicate, setPaginationDefaults } from '../../../../../common/src/api/search';
import { CamsHttpRequest } from '../../adapters/types/http';

const MODULE_NAME = 'CASES-CONTROLLER';

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

  public async getCases() {
    this.applicationContext.logger.info(MODULE_NAME, 'Getting all cases');
    return await this.caseManagement.getCases(this.applicationContext);
  }

  public async searchCases(request: CamsHttpRequest): Promise<ResponseBody<CaseBasics[]>> {
    type CasesSearchQueryString = Omit<CasesSearchPredicate, 'divisionCodes'> & {
      divisionCodes: string;
    };

    const queryString = request.query as unknown as CasesSearchQueryString;
    const { divisionCodes, ...otherProps } = queryString;
    const predicate: CasesSearchPredicate = setPaginationDefaults({
      ...otherProps,
      divisionCodes: divisionCodes?.split(','),
    });

    const cases = await this.caseManagement.searchCases(this.applicationContext, predicate);
    const next = new URL(request.url);
    next.searchParams.set('limit', predicate.limit.toString());
    next.searchParams.set('offset', (predicate.offset + predicate.limit).toString());
    return {
      meta: {
        isPaginated: true,
        count: cases.length,
        self: request.url,
        next: next.href,
      },
      isSuccess: true,
      data: cases,
    };
  }
}
