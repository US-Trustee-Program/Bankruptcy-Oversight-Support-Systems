import { ApplicationContext } from '../../adapters/types/basic';
import AttorneysList from '../../use-cases/attorneys';
import { AttorneyUser } from '../../../../../common/src/cams/users';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';

const MODULE_NAME = 'ATTORNEYS-CONTROLLER';

async function getAttorneyList(
  context: ApplicationContext,
): Promise<CamsHttpResponseInit<AttorneyUser[]>> {
  context.logger.info(MODULE_NAME, 'Getting Attorneys list.');
  const attorneysList = new AttorneysList();
  const data = await attorneysList.getAttorneyList(context);
  const success = httpSuccess({ body: { data } });
  return success;
}

export const AttorneysController = {
  getAttorneyList,
};

export default AttorneysController;
