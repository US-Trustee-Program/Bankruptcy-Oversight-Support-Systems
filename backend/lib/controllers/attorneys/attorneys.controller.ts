import { AttorneyUser } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import AttorneysList from '../../use-cases/attorneys/attorneys';
import { CamsController } from '../controller';

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
