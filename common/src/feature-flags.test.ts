import { UstpOfficeDetails } from './cams/offices';
import { getRegionIds, normalizeRegionId } from './cams/users';
import MockData from './cams/test-utilities/mock-data';
import { buildLaunchDarklyContext, resolveEnabledRegions, testFeatureFlags } from './feature-flags';

describe('feature flag tests', () => {
  test('all testFeatureFlags are enabled for testing', () => {
    const values = Object.values(testFeatureFlags);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === true)).toBe(true);
  });
});

describe('buildLaunchDarklyContext', () => {
  test('maps a full CamsUser to a LaunchDarklyContext', () => {
    const office = (
      officeCode: string,
      groupDesignators: string[],
      regionId = '1',
    ): UstpOfficeDetails => ({
      officeCode,
      officeName: officeCode,
      idpGroupName: officeCode,
      regionId,
      regionName: `Region ${regionId}`,
      groups: groupDesignators.map((groupDesignator) => ({ groupDesignator, divisions: [] })),
    });
    const offices = [
      office('OFFICE_A', ['A', 'B']),
      office('OFFICE_B', ['B2'], '2'),
      office('OFFICE_C', ['C'], '2'),
    ];
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
      officeGroupDesignators: ['A', 'B', 'B2', 'C'],
      regionIds: ['1', '2'],
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
      regionIds: [],
    });
  });
});

describe('getRegionIds', () => {
  test('returns an empty list when the user has no offices', () => {
    expect(getRegionIds(MockData.getCamsUser({ offices: undefined }))).toEqual([]);
  });

  test('normalizes padded office region ids and removes duplicates', () => {
    const office = MockData.getOffices()[0];
    const user = MockData.getCamsUser({
      offices: [
        { ...office, regionId: '02' },
        { ...office, regionId: '2' },
        { ...office, regionId: '11' },
      ],
    });
    expect(getRegionIds(user)).toEqual(['2', '11']);
  });
});

describe('normalizeRegionId', () => {
  test.each([
    ['1', '1'],
    ['04', '4'],
    ['004', '4'],
    ['21', '21'],
    ['x', 'x'],
  ])('%s becomes %s', (input, expected) => {
    expect(normalizeRegionId(input)).toEqual(expected);
  });
});

describe('resolveEnabledRegions', () => {
  const allRegionIds = ['1', '2', '3', '4'];
  const resolve = (flag: unknown) => [...resolveEnabledRegions(flag, allRegionIds)].sort();

  test.each([
    ['bare list', '1,2', ['1', '2']],
    ['plus form', '+1,+3', ['1', '3']],
    ['mixed bare and plus', '1,+2', ['1', '2']],
    ['exclude form on its own', '-1', []],
    ['bare then exclude', '1,2,-2', ['1']],
    ['star alone', '*', ['1', '2', '3', '4']],
    ['star with subtraction', '*,-2,-3', ['1', '4']],
    ['star with a subtraction of an unknown region', '*,-9', ['1', '2', '3', '4']],
    ['stripped garbage', ' 1 ; abc,2\n', ['1', '2']],
    ['leading zeros normalized', '01,+02', ['1', '2']],
    ['leading zeros normalized in exclusion', '*,-01', ['2', '3', '4']],
    [
      'digits left after stripping garbage merge into one id (pinned until ruled on)',
      '1 2',
      ['12'],
    ],
    ['empty tokens dropped', ',,1,,', ['1']],
    ['bad tokens contribute nothing', '+,-,1+2,x', []],
    ['empty string', '', []],
    ['only garbage', 'abc', []],
  ])('%s', (_name, flag, expected) => {
    expect(resolve(flag)).toEqual(expected);
  });

  test.each([[undefined], [null], [true], [5]])('non-string flag %s resolves to empty', (flag) => {
    expect(resolve(flag)).toEqual([]);
  });

  test('star normalizes padded ids in the list passed in', () => {
    expect([...resolveEnabledRegions('*,-4', ['01', '04'])].sort()).toEqual(['1']);
  });

  test('star expands to whatever list is passed in at call time', () => {
    expect([...resolveEnabledRegions('*', ['7', '9'])].sort()).toEqual(['7', '9']);
  });

  test('order of tokens does not matter for exclusion', () => {
    expect(resolve('-2,1,2')).toEqual(['1']);
  });
});
