import { OfficesGatewayInterface } from '../../../use-cases/offices/offices.gateway.interface';
import { USTP_OFFICE_NAME_MAP } from './dxtr.constants';
import { CamsError } from '../../../common-errors/cams-error';
import { ApplicationContext } from '../../types/basic';
import { OfficeDetails } from '../../../use-cases/offices/offices.model';
import { OFFICES } from '../../../../../../common/src/cams/test-utilities/offices.mock';

const MODULE_NAME = 'MOCK-OFFICES-GATEWAY';

export class MockOfficesGateway implements OfficesGatewayInterface {
  getOffice(id: string): string {
    if (USTP_OFFICE_NAME_MAP.has(id)) return USTP_OFFICE_NAME_MAP.get(id);
    throw new CamsError(MODULE_NAME, {
      message: 'Cannot find office by ID',
      data: { id },
    });
  }

  getOffices(_applicationContext: ApplicationContext): Promise<OfficeDetails[]> {
    return Promise.resolve(OFFICES);
  }
}
