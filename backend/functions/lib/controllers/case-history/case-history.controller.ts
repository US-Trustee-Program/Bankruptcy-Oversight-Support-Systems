import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseHistory } from '../../../../../common/src/cams/history';
import { ResponseBody } from '../../../../../common/src/api/response';

const MODULE_NAME = 'CASE-HISTORY-CONTROLLER';

type GetCaseHistoryRequest = {
  caseId: string;
};

export class CaseHistoryController {
  private readonly useCase: CaseHistoryUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseHistoryUseCase(applicationContext);
  }

  public async getCaseHistory(
    context: ApplicationContext,
    request: GetCaseHistoryRequest,
  ): Promise<ResponseBody<CaseHistory[]>> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(context, request.caseId);
      return {
        meta: {
          isPaginated: false,
          self: context.req.url,
        },
        isSuccess: true,
        data: caseHistory,
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
