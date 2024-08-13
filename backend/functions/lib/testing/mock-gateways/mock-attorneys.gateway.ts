import { ATTORNEYS } from '../../../../../common/src/cams/test-utilities/attorneys.mock';
import { AttorneyUser } from '../../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { AttorneyGatewayInterface } from '../../use-cases/attorney.gateway.interface';

async function getAttorneys(
  _applicationContext: ApplicationContext,
  _attorneyOptions: { officeId?: string },
): Promise<Array<AttorneyUser>> {
  return ATTORNEYS;
}

const MockAttorneysGateway: AttorneyGatewayInterface = {
  getAttorneys,
};

export default MockAttorneysGateway;
