import { StaffRepository } from '../../use-cases/gateways.types';
import { ApplicationContext } from '../types/basic';
import { CamsUserReference, Staff } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../factory';
import { getCamsUserReference } from '../../../../common/src/cams/session';

export class OfficesStaffRepository implements StaffRepository {
  async getAttorneyStaff(applicationContext: ApplicationContext): Promise<Staff[]> {
    const repo = getOfficesRepository(applicationContext);
    const results = await repo.search({ role: CamsRole.TrialAttorney });
    const uniqueResults = new Map<string, CamsUserReference>();
    for (const staff of results) {
      const camsUser = getCamsUserReference(staff);
      if (!uniqueResults.has(camsUser.id)) {
        uniqueResults.set(camsUser.id, camsUser);
      }
    }
    return Array.from(uniqueResults.values());
  }
}
