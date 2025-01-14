import LocalStorageGateway, {
  OFFICE_MAPPING_PATH,
  ROLE_MAPPING_PATH,
} from './local-storage-gateway';
import { CamsRole } from '../../../../../common/src/cams/roles';

describe('map get', () => {
  test('should return appropriate string for valid path', () => {
    expect(LocalStorageGateway.get(OFFICE_MAPPING_PATH)).toEqual(expect.any(String));
  });

  test('should return null for invalid path', () => {
    expect(LocalStorageGateway.get('INVALID_PATH')).toBeNull();
  });

  test('should include case assignment manager role', () => {
    const roleMap = LocalStorageGateway.get(ROLE_MAPPING_PATH);
    expect(roleMap).toContain(CamsRole.CaseAssignmentManager);
  });

  test('should include trial attorney role', () => {
    const roleMap = LocalStorageGateway.get(ROLE_MAPPING_PATH);
    expect(roleMap).toContain(CamsRole.TrialAttorney);
  });

  test('should include data verification role', () => {
    const roleMap = LocalStorageGateway.get(ROLE_MAPPING_PATH);
    expect(roleMap).toContain(CamsRole.DataVerifier);
  });

  test('should return a key (user group name) calling getAugmentableUserRoleKey', () => {
    const key = LocalStorageGateway.getAugmentableUserRoleGroupName();
    expect(key).toEqual('USTP CAMS Augmentable User');
  });
});
