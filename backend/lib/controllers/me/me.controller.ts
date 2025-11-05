import { CamsSession } from '../../../../common/src/cams/session';
import { ApplicationContext } from '../../use-cases/application.types';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CamsController } from '../controller';

const MODULE_NAME = 'ME-CONTROLLER';

export class MeController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CamsSession>> {
    try {
      return httpSuccess({
        body: {
          data: context.session,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
