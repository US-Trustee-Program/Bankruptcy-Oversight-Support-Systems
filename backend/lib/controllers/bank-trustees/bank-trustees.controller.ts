import { ApplicationContext } from '../../adapters/types/basic';
import { BanksUseCase } from '../../use-cases/banks/banks';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { calculatePagination } from '../pagination';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeSummary } from '@common/cams/trustees';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

const MODULE_NAME = 'BANK-TRUSTEES-CONTROLLER';

export class BankTrusteesController implements CamsController {
  private readonly useCase: BanksUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BanksUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<TrusteeSummary[]>> {
    try {
      this.requireSuperUser(context);
      const { bankId } = context.request.params;
      const parsedLimit = parseInt(context.request.query.limit as string);
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_SEARCH_LIMIT;
      const parsedOffset = parseInt(context.request.query.offset as string);
      const offset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : DEFAULT_SEARCH_OFFSET;

      const result = await this.useCase.getTrusteesByBank(bankId, limit, offset);
      const totalCount = result.metadata?.total ?? 0;

      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          pagination: calculatePagination(result.data.length, totalCount, limit, offset),
          data: result.data,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
