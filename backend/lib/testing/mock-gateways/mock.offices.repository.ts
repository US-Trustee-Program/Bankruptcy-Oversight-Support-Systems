import { TRIAL_ATTORNEYS } from '../../../../common/src/cams/test-utilities/attorneys.mock';
import { CamsUserReference } from '../../../../common/src/cams/users';

export const MockOfficesRepository = {
  release: () => {},
  putOfficeStaff: (_officeCode: string, user: CamsUserReference, _ttl?: number) =>
    Promise.resolve({ id: user.id, modifiedCount: 1, upsertedCount: 1 }),
  findAndDeleteStaff: (_officeCode: string, _id: string) => Promise.resolve(),
  getOfficeAttorneys: () => {
    return Promise.resolve(TRIAL_ATTORNEYS);
  },
};
