import { ApplicationContext } from '../../adapters/types/basic';
import AttorneysList from '../../use-cases/attorneys';
import { AttorneyUser } from '../../../../common/src/cams/users';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';

const MODULE_NAME = 'ATTORNEYS-CONTROLLER';

export class AttorneysController implements CamsController {
  private readonly useCase: AttorneysList;

  constructor() {
    this.useCase = new AttorneysList();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<AttorneyUser[]>> {
    context.logger.info(MODULE_NAME, 'Getting Attorneys list.');
    try {
      const data = await this.useCase.getAttorneyList(context);
      const success = httpSuccess({ body: { data } });
      return success;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
