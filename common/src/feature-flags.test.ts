import { UstpOfficeDetails } from './cams/offices';
import MockData from './cams/test-utilities/mock-data';
import { buildLaunchDarklyContext, testFeatureFlags } from './feature-flags';

describe('feature flag tests', () => {
  test('all testFeatureFlags are enabled for testing', () => {
    const values = Object.values(testFeatureFlags);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === true)).toBe(true);
  });
});

describe('buildLaunchDarklyContext', () => {
  test('maps a full CamsUser to a LaunchDarklyContext', () => {
    const office = (officeCode: string, groupDesignators: string[]): UstpOfficeDetails => ({
      officeCode,
      officeName: officeCode,
      idpGroupName: officeCode,
      regionId: '1',
      regionName: 'Region 1',
      groups: groupDesignators.map((groupDesignator) => ({ groupDesignator, divisions: [] })),
    });
    const offices = [office('OFFICE_A', ['A', 'B']), office('OFFICE_C', ['C'])];
    const user = MockData.getCamsUser({
      email: 'jane.doe@example.com',
      roles: [],
      offices,
    });

    const context = buildLaunchDarklyContext(user);

    expect(context).toEqual({
      kind: 'user',
      key: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      officeGroupDesignators: ['A', 'B', 'C'],
    });
  });

  test('maps a minimal CamsUser with no email, offices, or roles', () => {
    const user = MockData.getCamsUser({ email: undefined, offices: undefined, roles: undefined });

    const context = buildLaunchDarklyContext(user);

    expect(context).toEqual({
      kind: 'user',
      key: user.id,
      name: user.name,
      email: undefined,
      roles: undefined,
      officeGroupDesignators: [],
    });
  });
});
