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
