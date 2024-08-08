import { ATTORNEYS } from '../../../../../common/src/cams/test-utilities/attorneys.mock';
import { AttorneyListDbResult } from '../../adapters/types/attorneys';
import { ApplicationContext } from '../../adapters/types/basic';
import { AttorneyGatewayInterface } from '../../use-cases/attorney.gateway.interface';

async function getAttorneys(
  _applicationContext: ApplicationContext,
  _attorneyOptions: { officeId?: string },
): Promise<AttorneyListDbResult> {
  const responseBody = {
    success: true,
    message: 'attorney list',
    count: ATTORNEYS.length,
    body: {
      attorneyList: ATTORNEYS,
    },
  };
  return responseBody;
}

const MockAttorneysGateway: AttorneyGatewayInterface = {
  getAttorneys,
};

export default MockAttorneysGateway;
