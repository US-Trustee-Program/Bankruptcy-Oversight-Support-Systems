import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDetail } from '../../../../../common/src/cams/cases';
import CaseManagement from '../../use-cases/case-management';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import { CamsHttpRequest } from '../../adapters/types/http';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-SUMMARY-CONTROLLER';

export class CaseSummaryController {
  private readonly useCase: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseManagement(applicationContext);
  }

  public async getCaseSummary(
    context: ApplicationContext,
    request: CamsHttpRequest,
  ): Promise<CamsHttpResponseInit<CaseDetail>> {
    try {
      const caseSummary = await this.useCase.getCaseSummary(context, request.params.caseId);
      return {
        body: {
          meta: {
            self: request.url,
          },
          data: caseSummary,
        },
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
