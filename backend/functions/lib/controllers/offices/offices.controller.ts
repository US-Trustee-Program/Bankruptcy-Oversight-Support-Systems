import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';

const MODULE_NAME = 'OFFICES-CONTROLLER';

export class OfficesController implements CamsController {
  private readonly useCase: OfficesUseCase;
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.useCase = new OfficesUseCase();
  }
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<OfficeDetails[]>> {
    try {
      const offices = await this.useCase.getOffices(context);
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data: offices,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
