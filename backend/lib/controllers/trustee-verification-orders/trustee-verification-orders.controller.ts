import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import factory from '../../factory';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';

const MODULE_NAME = 'TRUSTEE-VERIFICATION-ORDERS-CONTROLLER';

export class TrusteeVerificationOrdersController {
  constructor(private readonly context: ApplicationContext) {}

  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeMatchVerification[]>> {
    try {
      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const data = await repo.search();
      return httpSuccess({
        body: {
          meta: { self: context.request.url },
          data,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
