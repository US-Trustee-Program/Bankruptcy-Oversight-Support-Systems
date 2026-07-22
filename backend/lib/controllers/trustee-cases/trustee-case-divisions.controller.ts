import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeCasesUseCase } from '../../use-cases/trustee-cases/trustee-cases.use-case';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '@common/cams/roles';

const MODULE_NAME = 'TRUSTEE-CASE-DIVISIONS-CONTROLLER';

export class TrusteeCaseDivisionsController implements CamsController {
  private readonly useCase: TrusteeCasesUseCase;

  constructor(_context: ApplicationContext) {
    this.useCase = new TrusteeCasesUseCase();
  }

  public async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<string[]>> {
    if (!context.featureFlags['trustee-management']) {
      return { statusCode: 404 };
    }

    if (!context.featureFlags['trustee-case-list']) {
      return { statusCode: 404 };
    }

    if (!this.hasRequiredRole(context)) {
      throw getCamsError(
        new UnauthorizedError(MODULE_NAME, {
          message: 'User does not have permission to access trustee case divisions',
        }),
        MODULE_NAME,
      );
    }

    try {
      const trusteeId = context.request.params['trusteeId'];
      const divisionCodes = await this.useCase.getDistinctDivisionsForTrustee(context, trusteeId);

      return httpSuccess({
        body: {
          meta: { self: context.request.url },
          data: divisionCodes,
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
