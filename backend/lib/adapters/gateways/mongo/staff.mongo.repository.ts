import { StaffRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { Staff } from '../../../../../common/src/cams/users';
import {
  CamsRoleType,
  OversightRole,
  OversightRoleType,
} from '../../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../../factory';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'STAFF-MONGO-REPOSITORY';
const COLLECTION_NAME = 'staff';

export class StaffMongoRepository extends BaseMongoRepository implements StaffRepository {
  private static referenceCount: number = 0;
  private static instance: StaffMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!StaffMongoRepository.instance) {
      StaffMongoRepository.instance = new StaffMongoRepository(context);
    }
    StaffMongoRepository.referenceCount++;
    return StaffMongoRepository.instance;
  }

  public static dropInstance() {
    if (StaffMongoRepository.referenceCount > 0) {
      StaffMongoRepository.referenceCount--;
    }
    if (StaffMongoRepository.referenceCount < 1) {
      StaffMongoRepository.instance?.client.close().then();
      StaffMongoRepository.instance = null;
    }
  }

  public release() {
    StaffMongoRepository.dropInstance();
  }

  private async getStaffByRole(
    applicationContext: ApplicationContext,
    role: CamsRoleType | OversightRoleType,
  ): Promise<Staff[]> {
    const repo = getOfficesRepository(applicationContext);
    const results = await repo.search({ role });
    const uniqueResults = new Map<string, Staff>();
    for (const staff of results) {
      if (!uniqueResults.has(staff.id)) {
        const staffMember: Staff = {
          id: staff.id,
          name: staff.name,
          roles: staff.roles,
        };
        uniqueResults.set(staff.id, staffMember);
      }
    }
    return Array.from(uniqueResults.values());
  }

  async getOversightStaff(applicationContext: ApplicationContext): Promise<Staff[]> {
    const allStaff = new Map<string, Staff>();
    const oversightRoles = Object.values(OversightRole);

    for (const role of oversightRoles) {
      const staffForRole = await this.getStaffByRole(applicationContext, role);
      for (const staff of staffForRole) {
        if (!allStaff.has(staff.id)) {
          allStaff.set(staff.id, staff);
        }
      }
    }

    return Array.from(allStaff.values());
  }
}
