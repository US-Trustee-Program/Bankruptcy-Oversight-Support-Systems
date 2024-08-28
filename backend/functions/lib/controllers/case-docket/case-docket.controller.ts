import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { getCaseDocketUseCase } from '../../factory';
import { CaseDocket } from '../../use-cases/case-docket/case-docket.model';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';

const MODULE_NAME = 'CASE-DOCKET-CONTROLLER';

export class CaseDocketController {
  private readonly useCase: CaseDocketUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = getCaseDocketUseCase(applicationContext);
  }

  public async getCaseDocket(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseDocket>> {
    try {
      const caseDocket = await this.useCase.getCaseDocket(context, context.request.params.caseId);
      return {
        body: {
          meta: {
            self: context.request.url,
          },
          data: caseDocket,
        },
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
