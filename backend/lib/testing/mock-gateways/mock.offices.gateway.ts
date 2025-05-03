import { MOCKED_USTP_OFFICES_ARRAY, UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { USTP_OFFICE_NAME_MAP } from '../../adapters/gateways/dxtr/dxtr.constants';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { OfficesGateway } from '../../use-cases/offices/offices.types';

const MODULE_NAME = 'MOCK-OFFICES-GATEWAY';

export class MockOfficesGateway implements OfficesGateway {
  getOfficeName(id: string): string {
    if (USTP_OFFICE_NAME_MAP.has(id)) return USTP_OFFICE_NAME_MAP.get(id);
    throw new CamsError(MODULE_NAME, {
      data: { id },
      message: 'Cannot find office by ID',
    });
  }

  getOffices(_applicationContext: ApplicationContext): Promise<UstpOfficeDetails[]> {
    return Promise.resolve(MOCKED_USTP_OFFICES_ARRAY);
  }
}
