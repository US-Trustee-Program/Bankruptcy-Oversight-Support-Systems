import { CaseDocket } from '../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { getCaseDocketUseCase } from '../../factory';
import { CaseDocketUseCase } from '../../use-cases/case-docket/case-docket';
import { CamsController } from '../controller';

const MODULE_NAME = 'CASE-DOCKET-CONTROLLER';

export class CaseDocketController implements CamsController {
  private readonly useCase: CaseDocketUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = getCaseDocketUseCase(applicationContext);
  }
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseDocket>> {
    try {
      const caseDocket = await this.useCase.getCaseDocket(context);
      return httpSuccess({
        body: {
          data: caseDocket,
          meta: {
            self: context.request.url,
          },
        },
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
