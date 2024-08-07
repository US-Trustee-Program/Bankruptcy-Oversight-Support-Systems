import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import { ResponseBody, buildResponseBodySuccess } from '../../../../../common/src/api/response';
import { CamsHttpRequest } from '../../adapters/types/http';

const MODULE_NAME = 'OFFICES-CONTROLLER';

type GetOfficesResponse = ResponseBody<Array<OfficeDetails>>;

export class OfficesController {
  private readonly useCase: OfficesUseCase;
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.useCase = new OfficesUseCase();
  }
  public async getOffices(request: CamsHttpRequest): Promise<GetOfficesResponse> {
    try {
      const offices = await this.useCase.getOffices(this.applicationContext);
      return buildResponseBodySuccess<OfficeDetails[]>(offices, {
        isPaginated: false,
        self: request.url,
      });
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
