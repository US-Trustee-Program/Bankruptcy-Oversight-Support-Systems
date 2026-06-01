import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCasesUseCase } from '../../use-cases/trustee-cases/trustee-cases.use-case';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '@common/cams/roles';
import { calculatePagination } from '../pagination';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

const MODULE_NAME = 'TRUSTEE-CASES-CONTROLLER';

export class TrusteeCasesController implements CamsController {
  private readonly useCase: TrusteeCasesUseCase;

  constructor(_context: ApplicationContext) {
    this.useCase = new TrusteeCasesUseCase();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeCaseListItem[]>> {
    if (!context.featureFlags['trustee-management']) {
      return { statusCode: 404 };
    }

    // TODO: restore feature flag check: if (!context.featureFlags['trustee-case-list']) return { statusCode: 404 };

    if (!this.hasRequiredRole(context)) {
      throw getCamsError(
        new UnauthorizedError(MODULE_NAME, {
          message: 'User does not have permission to access trustee cases',
        }),
        MODULE_NAME,
      );
    }

    try {
      const trusteeId = context.request.params['trusteeId'];

      const parsedLimit = parseInt(context.request.query.limit as string);
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_SEARCH_LIMIT;
      const parsedOffset = parseInt(context.request.query.offset as string);
      const offset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : DEFAULT_SEARCH_OFFSET;

      const result = await this.useCase.getCasesForTrustee(context, trusteeId, limit, offset);
      const totalCount = result.metadata?.total ?? 0;

      return httpSuccess({
        body: {
          meta: { self: context.request.url },
          pagination: calculatePagination(result.data.length, totalCount, limit, offset),
          data: result.data,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private hasRequiredRole(context: ApplicationContext): boolean {
    const user = context.session?.user;
    if (!user?.roles) return false;
    return user.roles.includes(CamsRole.TrusteeAdmin);
  }
}
