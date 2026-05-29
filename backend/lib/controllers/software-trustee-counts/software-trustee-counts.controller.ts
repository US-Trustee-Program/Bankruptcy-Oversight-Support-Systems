import { ApplicationContext } from '../../adapters/types/basic';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'SOFTWARE-TRUSTEE-COUNTS-CONTROLLER';

export class SoftwareTrusteeCountsController implements CamsController {
  private readonly useCase: BankruptcySoftwareUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BankruptcySoftwareUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<Record<string, number>>> {
    try {
      this.requireSuperUser(context);
      const { softwareId } = context.request.params;

      const software = await this.useCase.getSoftware(softwareId);
      const bankIds = (software.associatedBanks ?? []).map((b) => b.bankId);

      const counts = await this.useCase.getTrusteeCountsByBanks(softwareId, bankIds);

      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data: counts,
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
