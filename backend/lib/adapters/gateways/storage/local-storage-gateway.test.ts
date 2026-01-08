import LocalStorageGateway, { ROLE_MAPPING_PATH } from './local-storage-gateway';
import { CamsRole } from '@common/cams/roles';

describe('map get', () => {
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

  test('should return a key (user group name) calling getPrivilegedIdentityUserRoleKey', () => {
    const key = LocalStorageGateway.getPrivilegedIdentityUserRoleGroupName();
    expect(key).toEqual('USTP CAMS Privileged Identity Management');
  });
});
