import { StaffRepository } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getStaffRepository } from '../../factory';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { AttorneyUser, Staff } from '../../../../common/src/cams/users';

const MODULE_NAME = 'ATTORNEYS-USE-CASE';

export default class AttorneysList {
  staffRepository: StaffRepository;

  constructor() {
    this.staffRepository = getStaffRepository();
  }

  async getAttorneyList(applicationContext: ApplicationContext): Promise<Array<AttorneyUser>> {
    const assignmentsUseCase = new CaseAssignmentUseCase(applicationContext);
    const attorneyStaff = await this.staffRepository.getAttorneyStaff(applicationContext);

    const attorneys: AttorneyUser[] = [];

    for (const staff of attorneyStaff) {
      const attorney = this.convertStaffToAttorneyUser(staff);
      try {
        attorney.caseLoad = await assignmentsUseCase.getCaseLoad(attorney.id);
      } catch (e) {
        applicationContext.logger.error(MODULE_NAME, 'Unable to retrieve attorney case load.', e);
        // Leave attorney.caseLoad as undefined
      }
      attorneys.push(attorney);
    }

    return attorneys;
  }

  private convertStaffToAttorneyUser(staff: Staff): AttorneyUser {
    return {
      id: staff.id,
      name: staff.name,
      roles: staff.roles,
      offices: [], // Will be populated if needed in future
    };
  }
}
