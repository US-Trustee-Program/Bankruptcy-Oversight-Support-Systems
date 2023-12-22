import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { getCaseDocketUseCase } from '../../factory';
import { CaseDocket } from '../../use-cases/case-docket/case-docket.model';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsResponse } from '../controller-types';

const MODULE_NAME = 'CASE-DOCKET-CONTROLLER';

type GetCaseDocketRequest = {
  caseId: string;
};

type GetCaseDocketResponse = CamsResponse<CaseDocket>;

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
