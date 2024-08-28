import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { ResponseBody, buildResponseBody } from '../../../../../common/src/api/response';
import { CamsHttpRequest } from '../../adapters/types/http';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';

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
  ): Promise<CamsHttpResponseInit<ResponseBody<OfficeDetails[]>>> {
    try {
      const offices = await this.useCase.getOffices(this.applicationContext);
      const result = buildResponseBody<OfficeDetails[]>(offices, {
        isPaginated: false,
        self: request.url,
      });
      return {
        body: result,
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
