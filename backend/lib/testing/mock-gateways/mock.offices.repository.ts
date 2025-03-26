import { TRIAL_ATTORNEYS } from '../../../../common/src/cams/test-utilities/attorneys.mock';
import { CamsUserReference, Staff } from '../../../../common/src/cams/users';
import { CaseAssignment } from '../../../../common/src/cams/assignments';

export const MockOfficesRepository = {
  release: () => {},
  putOrExtendOfficeStaff: (_officeCode: string, _staff: Staff, _expires: string) =>
    Promise.resolve(),
  putOfficeStaff: (_officeCode: string, user: CamsUserReference, _ttl?: number) =>
    Promise.resolve({ id: user.id, modifiedCount: 1, upsertedCount: 1 }),
  findAndDeleteStaff: (_officeCode: string, _id: string) => Promise.resolve(),
  getOfficeAttorneys: () => {
    return Promise.resolve(TRIAL_ATTORNEYS);
  },
  getOfficeAssignments(_officeCode: string): Promise<CaseAssignment[]> {
    // TODO: make this do something better
    return Promise.resolve([]);
    // return Promise.resolve(TRIAL_ATTORNEYS);
  },
};
