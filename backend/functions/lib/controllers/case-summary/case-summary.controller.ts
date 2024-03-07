import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsResponse } from '../controller-types';
import { CaseDetail } from '../../../../../common/src/cams/cases';
import { CaseManagement } from '../../use-cases/case-management';

const MODULE_NAME = 'CASE-SUMMARY-CONTROLLER';

type GetCaseSummaryRequest = {
  caseId: string;
};

type GetCaseSummaryResponse = CamsResponse<CaseDetail>;

export class CaseSummaryController {
  private readonly useCase: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseManagement(applicationContext);
  }

  public async getCaseSummary(
    context: ApplicationContext,
    request: GetCaseSummaryRequest,
  ): Promise<GetCaseSummaryResponse> {
    try {
      const caseSummary = await this.useCase.getCaseSummary(context, request.caseId);
      return {
        success: true,
        body: caseSummary,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
