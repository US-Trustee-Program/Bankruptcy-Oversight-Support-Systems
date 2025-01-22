import { render, screen } from '@testing-library/react';
import { PrivilegedIdentity, toComboOption } from './PrivilegedIdentity';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import MockApi2 from '@/lib/testing/mock-api2';
import MockData from '@common/cams/test-utilities/mock-data';

describe('Privileged Identity screen tests', () => {
  function renderWithoutProps() {
    render(<PrivilegedIdentity />);
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    const mockFeatureFlags = {
      'privileged-identity-management': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('should return a ComboOption for given groupName', async () => {
    const groupName = 'USTP CAMS test string';
    const expectedComboOption = {
      value: groupName,
      label: 'test string',
    };
    expect(toComboOption(groupName)).toEqual(expectedComboOption);
  });

  test('should show alert if feature flag is not set', async () => {
    const mockFeatureFlags = {
      'privileged-identity-management': false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);

    renderWithoutProps();
    expect(
      screen.getByTestId('alert-container-privileged-identity-disabled-alert'),
    ).toBeInTheDocument();
  });

  test('should load screen with expected user list, office list, and role list', async () => {
    vi.spyOn(MockApi2, 'getPrivilegedIdentityUsers').mockResolvedValue({
      data: MockData.buildArray(MockData.getCamsUserReference, 5),
    });
    const mockGroups = MockData.getRoleAndOfficeGroupNames();
    vi.spyOn(MockApi2, 'getRoleAndOfficeGroupNames').mockResolvedValue({
      data: mockGroups,
    });

    renderWithoutProps();

    console.log(screen.debug(document));
  });

  test('should', async () => {});
  test('should', async () => {});
});
