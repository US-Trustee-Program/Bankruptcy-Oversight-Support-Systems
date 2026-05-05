import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { CamsRole } from '@common/cams/roles';
import { Pagination } from '@common/api/pagination';
import { UriString } from '@common/api/common';
import { TrusteeCasesUseCase } from '../../use-cases/trustees/trustee-cases';

const MODULE_NAME = 'TRUSTEE-CASES-CONTROLLER';

export class TrusteeCasesController {
  async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit> {
    try {
      if (!context.featureFlags['trustee-case-tab']) {
        return { statusCode: 404 };
      }

      if (!context.session?.user?.roles?.includes(CamsRole.TrusteeAdmin)) {
        throw new UnauthorizedError(MODULE_NAME);
      }

      const trusteeId = context.request.params['trusteeId'];
      if (!trusteeId) {
        throw new BadRequestError(MODULE_NAME, { message: 'Trustee ID is required' });
      }

      const limit = parseInt(context.request.query['limit'] ?? '25', 10);
      const offset = parseInt(context.request.query['offset'] ?? '0', 10);

      const useCase = new TrusteeCasesUseCase();
      const { data, metadata } = await useCase.getCasesForTrustee(context, trusteeId, {
        limit,
        offset,
      });
      const total = metadata?.total ?? 0;

      const pagination: Pagination = {
        count: data.length,
        limit,
        currentPage: data.length === 0 ? 0 : offset / limit + 1,
        totalPages: Math.ceil(total / limit),
        totalCount: total,
      };

      if (offset + limit < total) {
        const next = new URL(context.request.url);
        next.searchParams.set('limit', limit.toString());
        next.searchParams.set('offset', (offset + limit).toString());
        pagination.next = next.href as UriString;
      }

      if (offset > 0) {
        const previous = new URL(context.request.url);
        previous.searchParams.set('limit', limit.toString());
        previous.searchParams.set('offset', (offset - limit).toString());
        pagination.previous = previous.href as UriString;
      }

      return httpSuccess({
        body: {
          meta: { self: context.request.url },
          pagination,
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
