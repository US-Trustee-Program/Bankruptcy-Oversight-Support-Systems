import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { getCaseDocketUseCase } from '../../factory';
import { CaseDocket } from '../../use-cases/case-docket/case-docket.model';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';

const MODULE_NAME = 'CASE-DOCKET-CONTROLLER';

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

type GetCaseDocketRequest = {
  caseId: string;
};

type GetCaseDocketResponse = Monad & {
  body: CaseDocket;
};

export class CaseDocketController {
  private readonly useCase: CaseDocketUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = getCaseDocketUseCase(applicationContext);
  }

  public async getCaseDocket(
    context: ApplicationContext,
    request: GetCaseDocketRequest,
  ): Promise<GetCaseDocketResponse> {
    try {
      const caseDocket = await this.useCase.getCaseDocket(context, request.caseId);
      return {
        success: true,
        body: caseDocket,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
