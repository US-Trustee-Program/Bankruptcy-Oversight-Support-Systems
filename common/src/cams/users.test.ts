import MockData from './test-utilities/mock-data';
import { REGION_02_GROUP_NY, REGION_02_GROUP_SE } from './test-utilities/mock-user';
import { getCourtDivisionCodes, getGroupDesignators } from './users';

describe('users helper function-apps tests', () => {
  describe('getCourtDivisionCodes tests', () => {
    test('should get division codes from a user with offices', () => {
      const user = MockData.getCamsUser({
        offices: [REGION_02_GROUP_NY, REGION_02_GROUP_SE],
      });
      const expectedDivisionCodes = ['081', '087', '812', '813', '710', '720', '730', '740', '750'];
      const divisionCodes = getCourtDivisionCodes(user);
      expect(divisionCodes).toEqual(expectedDivisionCodes);
    });

    test('should get empty division codes array', () => {
      const user = MockData.getCamsUser({ offices: undefined });
      expect(getCourtDivisionCodes(user)).toEqual([]);
    });
  });

  describe('getGroupDesignators tests', () => {
    test('should get group designators from a user with offices', () => {
      const user = MockData.getCamsUser({
        offices: [REGION_02_GROUP_NY, REGION_02_GROUP_SE],
      });
      const expectedGroupDesignators = ['NY', 'SE', 'AK'];
      const divisionCodes = getGroupDesignators(user);
      expect(divisionCodes).toEqual(expectedGroupDesignators);
    });

    test('should get empty group designators array', () => {
      const user = MockData.getCamsUser({ offices: undefined });
      expect(getGroupDesignators(user)).toEqual([]);
    });
  });
});
