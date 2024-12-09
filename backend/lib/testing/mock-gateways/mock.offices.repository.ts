import { TRIAL_ATTORNEYS } from '../../../../common/src/cams/test-utilities/attorneys.mock';

export const MockOfficesRepository = {
  release: () => {},
  putOfficeStaff: (_officeCode, _user) => Promise.resolve(),
  getOfficeAttorneys: () => {
    return Promise.resolve(TRIAL_ATTORNEYS);
  },
};
