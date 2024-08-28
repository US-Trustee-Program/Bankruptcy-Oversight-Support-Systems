import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CaseHistory } from '../../../../../common/src/cams/history';
import { buildResponseBodySuccess } from '../../../../../common/src/api/response';
import { CamsHttpRequest } from '../../adapters/types/http';
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
    request: CamsHttpRequest,
  ): Promise<CamsHttpResponseInit<CaseHistory[]>> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(context, request.params.caseId);
      // TODO: figure out how CamsHttpResponse and ResponseBody are related
      const result = buildResponseBodySuccess<CaseHistory[]>(caseHistory, {
        isPaginated: false,
        self: request.url,
      });
      return {
        body: result,
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
