import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseAssignmentHistory } from '../../adapters/types/case.assignment';
import { CamsResponse } from '../controller-types';

const MODULE_NAME = 'CASE-HISTORY-CONTROLLER';

type GetCaseHistoryRequest = {
  caseId: string;
};

type GetCaseHistoryResponse = CamsResponse<Array<CaseAssignmentHistory>>;

export class CaseHistoryController {
  private readonly useCase: CaseHistoryUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseHistoryUseCase(applicationContext);
  }

  public async getCaseHistory(
    context: ApplicationContext,
    request: GetCaseHistoryRequest,
  ): Promise<GetCaseHistoryResponse> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(context, request.caseId);
      return {
        success: true,
        body: caseHistory,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
