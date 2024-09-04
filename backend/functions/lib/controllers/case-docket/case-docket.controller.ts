import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { getCaseDocketUseCase } from '../../factory';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CaseDocket } from '../../../../../common/src/cams/cases';

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
      const caseDocket = await this.useCase.getCaseDocket(context);
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data: caseDocket,
        },
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
