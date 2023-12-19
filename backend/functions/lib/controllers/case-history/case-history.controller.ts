import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CaseAssignmentHistory } from '../../adapters/types/case.assignment';

const MODULE_NAME = 'CASE-HISTORY-CONTROLLER';

interface SuccessMonad {
  success: true;
  body: unknown;
}

interface ErrorMonad {
  success: false;
  message: string;
  errors: Array<string>;
}

type Monad = SuccessMonad | ErrorMonad;

type GetCaseHistoryRequest = {
  caseId: string;
};

type GetCaseHistoryResponse = Monad & {
  body: CaseAssignmentHistory[];
};

export class CaseHistoryController {
  private readonly useCase: CaseHistoryUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseHistoryUseCase(applicationContext);
  }

  public async getCaseHistory(request: GetCaseHistoryRequest): Promise<GetCaseHistoryResponse> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(request.caseId);
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
