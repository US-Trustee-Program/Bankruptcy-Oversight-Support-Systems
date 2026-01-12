import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesUseCase } from '../../use-cases/trustees/trustees';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeHistory } from '@common/cams/trustees';

const MODULE_NAME = 'TRUSTEE-HISTORY-CONTROLLER';

export class TrusteeHistoryController implements CamsController {
  private readonly useCase: TrusteesUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new TrusteesUseCase(context);
  }
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeHistory[]>> {
    try {
      const { trusteeId } = context.request.params;
      const history = await this.useCase.listTrusteeHistory(context, trusteeId);
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data: history,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
