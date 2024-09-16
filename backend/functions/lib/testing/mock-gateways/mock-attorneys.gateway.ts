import { TRIAL_ATTORNEYS } from '../../../../../common/src/cams/test-utilities/attorneys.mock';
import { AttorneyUser } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { AttorneyGatewayInterface } from '../../use-cases/attorney.gateway.interface';

async function getAttorneysByUstpOffice(
  applicationContext: ApplicationContext,
): Promise<Array<AttorneyUser>> {
  const officeCode = applicationContext.request.params['officeCode'];
  const attorneys = TRIAL_ATTORNEYS.filter((att) => att.offices['officeCode'].includes(officeCode));
  return attorneys;
}
async function getAttorneys(_applicationContext: ApplicationContext): Promise<Array<AttorneyUser>> {
  return TRIAL_ATTORNEYS;
}
const MockAttorneysGateway: AttorneyGatewayInterface = {
  getAttorneys,
  getAttorneysByUstpOffice,
};

export default MockAttorneysGateway;
