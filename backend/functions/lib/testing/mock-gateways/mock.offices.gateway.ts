import { OfficeDetails } from '../../../../../common/src/cams/courts';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { USTP_OFFICE_NAME_MAP } from '../../adapters/gateways/dxtr/dxtr.constants';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { OfficesGatewayInterface } from '../../use-cases/offices/offices.gateway.interface';

const MODULE_NAME = 'MOCK-OFFICES-GATEWAY';

export class MockOfficesGateway implements OfficesGatewayInterface {
  getOfficeName(id: string): string {
    if (USTP_OFFICE_NAME_MAP.has(id)) return USTP_OFFICE_NAME_MAP.get(id);
    throw new CamsError(MODULE_NAME, {
      message: 'Cannot find office by ID',
      data: { id },
    });
  }

  getOffices(_applicationContext: ApplicationContext): Promise<OfficeDetails[]> {
    return Promise.resolve(MockData.getOffices());
  }

  async getOfficeByCourtIdAndOfficeCode(
    _applicationContext: ApplicationContext,
    courtId: string,
    officeCode: string,
  ): Promise<OfficeDetails> {
    return MockData.getOfficeByCourtIdAndOfficeCode(courtId, officeCode);
  }
}