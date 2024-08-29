import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CaseHistory } from '../../../../../common/src/cams/history';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-HISTORY-CONTROLLER';

export class CaseHistoryController {
  private readonly useCase: CaseHistoryUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseHistoryUseCase(applicationContext);
  }

  public async getCaseHistory(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseHistory[]>> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(context, context.request.params.caseId);
      return {
        body: {
          meta: {
            self: context.request.url,
          },
          data: caseHistory,
        },
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
