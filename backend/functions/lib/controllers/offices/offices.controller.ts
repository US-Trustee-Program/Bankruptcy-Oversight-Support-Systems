import { CamsResponse } from '../controller-types';
import { OfficesUseCase } from '../../use-cases/offices/offices';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { OfficeDetails } from '../../../../../common/src/cams/courts';

const MODULE_NAME = 'OFFICES-CONTROLLER';

type GetOfficesResponse = CamsResponse<Array<OfficeDetails>>;

export class OfficesController {
  private readonly useCase: OfficesUseCase;

  constructor() {
    this.useCase = new OfficesUseCase();
  }

  public async getOffices(applicationContext: ApplicationContext): Promise<GetOfficesResponse> {
    try {
      const offices = await this.useCase.getOffices(applicationContext);
      return {
        success: true,
        body: offices,
      };
    } catch (originalError) {
      throw originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
