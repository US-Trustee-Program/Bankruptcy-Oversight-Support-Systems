import { CamsSession } from '../../../../../common/src/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';

export class MeController implements CamsController {
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CamsSession>> {
    const response = httpSuccess({
      body: {
        data: context.session,
      },
    });
    return response;
  }
}
