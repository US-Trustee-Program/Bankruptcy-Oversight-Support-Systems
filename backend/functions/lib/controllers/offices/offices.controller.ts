import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'OFFICES-CONTROLLER';

export class OfficesController implements CamsController {
  private readonly useCase: OfficesUseCase;

  constructor() {
    this.useCase = new OfficesUseCase();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<OfficeDetails[] | CamsUserReference[]>> {
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
