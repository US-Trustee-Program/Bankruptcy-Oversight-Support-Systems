import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsHttpRequest } from '../../adapters/types/http';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'OFFICES-CONTROLLER';

export class OfficesController {
  private readonly useCase: OfficesUseCase;
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.useCase = new OfficesUseCase();
  }

  public async getOffices(
    request: CamsHttpRequest,
  ): Promise<CamsHttpResponseInit<OfficeDetails[]>> {
    try {
      const offices = await this.useCase.getOffices(this.applicationContext);
      return {
        body: {
          meta: {
            self: request.url,
          },
          data: offices,
        },
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
