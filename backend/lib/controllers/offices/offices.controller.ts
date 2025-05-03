import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { OfficesUseCase } from '../../use-cases/offices/offices';
import { CamsController, CamsTimerController } from '../controller';

const MODULE_NAME = 'OFFICES-CONTROLLER';

export class OfficesController implements CamsController, CamsTimerController {
  private readonly useCase: OfficesUseCase;

  constructor() {
    this.useCase = new OfficesUseCase();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CamsUserReference[] | UstpOfficeDetails[]>> {
    try {
      const { params } = context.request;
      let data;
      if (params.officeCode && params.subResource === 'attorneys') {
        data = await this.useCase.getOfficeAttorneys(context, params.officeCode);
      } else if (params.officeCode && params.subResource === 'assignees') {
        data = await this.useCase.getOfficeAssignees(context, params.officeCode);
      } else if (params.officeCode && params.subResource) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Sub resource ${params.subResource} is not supported.`,
        });
      } else {
        data = await this.useCase.getOffices(context);
      }
      return httpSuccess({
        body: {
          data,
          meta: {
            self: context.request.url,
          },
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  public async handleTimer(context: ApplicationContext): Promise<void> {
    try {
      await this.useCase.syncOfficeStaff(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
