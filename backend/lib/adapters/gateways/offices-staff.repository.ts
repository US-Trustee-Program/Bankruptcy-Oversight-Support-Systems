import { StaffRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { CamsUserReference, Staff } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../factory';

export class OfficesStaffRepository implements StaffRepository {
  async getAttorneyStaff(applicationContext: ApplicationContext): Promise<Staff[]> {
    const repo = getOfficesRepository(applicationContext);
    const results = await repo.search({ role: CamsRole.TrialAttorney });
    const uniqueResults = new Map<string, CamsUserReference>();
    results.forEach((staff: Staff) => {
      const { id, name, ..._ignore } = staff;
      if (!uniqueResults.has(id)) {
        uniqueResults.set(id, { id, name });
      }
    });
    return Array.from(uniqueResults.values());
  }
}
