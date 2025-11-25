import { StaffRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getStaffRepository } from '../../factory';
import { Staff } from '../../../../common/src/cams/users';

export default class StaffUseCase {
  staffRepository: StaffRepository;

  constructor(context: ApplicationContext) {
    this.staffRepository = getStaffRepository(context);
  }

  async getOversightStaff(applicationContext: ApplicationContext): Promise<Array<Staff>> {
    return this.staffRepository.getOversightStaff(applicationContext);
  }
}
