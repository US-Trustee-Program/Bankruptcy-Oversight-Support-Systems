import { ApplicationContext } from '../../adapters/types/basic';
import AttorneysList from '../../use-cases/attorneys';
import { buildResponseBodySuccess, ResponseBody } from '../../../../../common/src/api/response';
import { CamsHttpRequest } from '../../adapters/types/http';
import { AttorneyUser } from '../../../../../common/src/cams/users';
import { CamsHttpResponse } from '../../adapters/utils/http-response';

const MODULE_NAME = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public async getAttorneyList(
    request: CamsHttpRequest,
  ): Promise<CamsHttpResponse<ResponseBody<AttorneyUser[]>>> {
    this.applicationContext.logger.info(MODULE_NAME, 'Getting Attorneys list.');
    const attorneysList = new AttorneysList();
    const attorneys = await attorneysList.getAttorneyList(this.applicationContext);
    const body = buildResponseBodySuccess<AttorneyUser[]>(attorneys, {
      isPaginated: false,
      self: request.url,
    });
    return {
      body,
    };
  }
}
