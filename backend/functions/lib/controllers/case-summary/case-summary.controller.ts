import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseDetail } from '../../../../../common/src/cams/cases';
import CaseManagement from '../../use-cases/case-management';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';

const MODULE_NAME = 'CASE-SUMMARY-CONTROLLER';

type GetCaseSummaryRequest = {
  caseId: string;
};

export class CaseSummaryController {
  private readonly useCase: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseManagement(applicationContext);
  }

  public async getCaseSummary(
    context: ApplicationContext,
    request: GetCaseSummaryRequest,
  ): Promise<CamsHttpResponseInit<CaseDetail>> {
    try {
      const caseSummary = await this.useCase.getCaseSummary(context, request.caseId);
      return {
        body: { data: caseSummary },
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
