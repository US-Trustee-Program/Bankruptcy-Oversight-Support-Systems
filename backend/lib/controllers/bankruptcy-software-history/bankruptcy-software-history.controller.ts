import { ApplicationContext } from '../../adapters/types/basic';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { BankruptcySoftwareAuditHistory } from '@common/cams/bankruptcy-software';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-HISTORY-CONTROLLER';

export class BankruptcySoftwareHistoryController implements CamsController {
  private readonly useCase: BankruptcySoftwareUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BankruptcySoftwareUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareAuditHistory[]>> {
    try {
      this.requireSuperUser(context);
      const { softwareId } = context.request.params;
      const history = await this.useCase.getSoftwareHistory(softwareId);
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
