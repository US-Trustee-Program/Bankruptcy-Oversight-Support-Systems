import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { UstpOfficeDetails } from '../../../../../common/src/cams/offices';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController, CamsTimerController } from '../controller';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'OFFICES-CONTROLLER';

export class OfficesController implements CamsController, CamsTimerController {
  private readonly useCase: OfficesUseCase;

  constructor() {
    this.useCase = new OfficesUseCase();
  }

  public async handleTimer(context: ApplicationContext): Promise<void> {
    try {
      await this.useCase.syncOfficeStaff(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<UstpOfficeDetails[] | CamsUserReference[]>> {
    try {
      const params = context.request.params;
      let data;
      if (params?.officeCode && params?.subResource === 'attorneys') {
        data = await this.useCase.getOfficeAttorneys(context, params.officeCode);
      } else if (params?.officeCode && params?.subResource) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Sub resource ${params?.subResource} is not supported.`,
        });
      } else {
        data = await this.useCase.getOffices(context);
      }
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
