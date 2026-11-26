import { describe, expect, test } from 'vitest';
import { CamsRole } from '@common/cams/roles';
import MockApi2 from './mock-api2';

// The fake API keeps a simplified copy of the server's grant rules. These tests keep it from
// accepting grants the server rejects, and keep its permissions the same shape as the server's.
describe('MockApi2.grantPermission', () => {
  const grant = {
    userId: 'mock-cams-user-gray-baker',
    role: CamsRole.DataVerifier,
    reason: 'Fake API check',
  };

  test('should reject a region-wide grant in a region that does not exist', async () => {
    await expect(
      MockApi2.grantPermission({ ...grant, regionId: '99', officeCode: 'all' }),
    ).rejects.toThrow('The region does not exist.');
  });

  test('should return a permission with the email and grant time, like the server', async () => {
    const before = new Date().toISOString();

    const { data } = await MockApi2.grantPermission({ ...grant, regionId: '2', officeCode: 'all' });

    expect(data.permission).toEqual(
      expect.objectContaining({ email: 'gray.baker@example.com', regionId: '2', officeCode: null }),
    );
    expect(data.permission.assignedAt >= before).toBe(true);
  });
});

describe('MockApi2.removePermission', () => {
  const userId = 'mock-cams-user-gray-baker';

  async function grayBakersPermissions() {
    const { data } = await MockApi2.getCamsUsers({ name: 'Gray Baker', limit: 20, offset: 0 });
    return data[0].permissions;
  }

  test("should remove the permission with that id from the user's active permissions", async () => {
    const { data } = await MockApi2.grantPermission({
      userId,
      role: CamsRole.TrialAttorney,
      regionId: '2',
      officeCode: 'all',
    });
    expect(await grayBakersPermissions()).toContainEqual(data.permission);

    await MockApi2.removePermission({ userId, permissionId: data.permission.id });

    expect(await grayBakersPermissions()).not.toContainEqual(
      expect.objectContaining({ id: data.permission.id }),
    );
  });

  test('should change nothing when the user does not hold a permission with that id', async () => {
    await MockApi2.grantPermission({
      userId,
      role: CamsRole.Auditor,
      regionId: 'all',
      officeCode: 'all',
    });
    const before = await grayBakersPermissions();

    await MockApi2.removePermission({ userId, permissionId: 'no-such-permission' });

    expect(await grayBakersPermissions()).toEqual(before);
  });
});
