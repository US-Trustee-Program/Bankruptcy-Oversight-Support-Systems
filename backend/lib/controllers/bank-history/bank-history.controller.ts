import { ApplicationContext } from '../../adapters/types/basic';
import { BanksUseCase } from '../../use-cases/banks/banks';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { BankAuditHistory } from '@common/cams/banks';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'BANK-HISTORY-CONTROLLER';

export class BankHistoryController implements CamsController {
  private readonly useCase: BanksUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BanksUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<BankAuditHistory[]>> {
    try {
      this.requireSuperUser(context);
      const { bankId } = context.request.params;
      const history = await this.useCase.getBankHistory(bankId);
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

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
