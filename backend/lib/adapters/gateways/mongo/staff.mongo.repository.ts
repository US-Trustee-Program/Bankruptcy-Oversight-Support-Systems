import { StaffRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { CamsUserReference, Staff } from '../../../../../common/src/cams/users';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../../factory';
import { getCamsUserReference } from '../../../../../common/src/cams/session';
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
    role: CamsRole,
  ): Promise<Staff[]> {
    const repo = getOfficesRepository(applicationContext);
    const results = await repo.search({ role });
    const uniqueResults = new Map<string, CamsUserReference>();
    for (const staff of results) {
      const camsUser = getCamsUserReference(staff);
      if (!uniqueResults.has(camsUser.id)) {
        uniqueResults.set(camsUser.id, camsUser);
      }
    }
    return Array.from(uniqueResults.values());
  }

  async getAttorneyStaff(applicationContext: ApplicationContext): Promise<Staff[]> {
    return this.getStaffByRole(applicationContext, CamsRole.TrialAttorney);
  }
}
