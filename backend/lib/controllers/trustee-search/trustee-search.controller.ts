import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CamsRole } from '@common/cams/roles';
import { TrusteeSearchUseCase } from '../../use-cases/trustees/trustee-search.use-case';
import { TrusteeSearchResult } from '@common/cams/trustee-search';

const MODULE_NAME = 'TRUSTEE-SEARCH-CONTROLLER';

export class TrusteeSearchController {
  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeSearchResult[]>> {
    try {
      if (context.request.method !== 'GET') {
        throw new BadRequestError(MODULE_NAME, { message: 'Unsupported method.' });
      }

      if (!context.session.user.roles.includes(CamsRole.DataVerifier)) {
        throw new UnauthorizedError(MODULE_NAME);
      }

      const name = context.request.query['name'];
      if (!name) {
        throw new BadRequestError(MODULE_NAME, {
          message: 'Missing required query parameter: name',
        });
      }

      if (name.length < 2) {
        throw new BadRequestError(MODULE_NAME, {
          message: 'Name query must be at least 2 characters',
        });
      }

      const courtId = context.request.query['courtId'] || undefined;

      const useCase = new TrusteeSearchUseCase();
      const data = await useCase.searchTrustees(context, name, courtId);

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
