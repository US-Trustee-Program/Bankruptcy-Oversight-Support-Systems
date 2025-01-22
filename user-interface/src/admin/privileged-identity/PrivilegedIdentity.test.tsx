import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrivilegedIdentity, toComboOption } from './PrivilegedIdentity';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import userEvent from '@testing-library/user-event';

async function expectItemToBeDisabled(selector: string) {
  const item = document.querySelector(selector);
  await waitFor(() => {
    expect(item).toBeInTheDocument();
  });
  expect(item).toBeDisabled();
}

async function expectItemToBeEnabled(selector: string) {
  const item = document.querySelector(selector);
  await waitFor(() => {
    expect(item).toBeInTheDocument();
  });
  expect(item).not.toBeDisabled();
}

describe('Privileged Identity screen tests', () => {
  const env = process.env;
  const mockGroups = MockData.getRoleAndOfficeGroupNames();
  const officeListComboBoxInput = `office-list-combo-box-input`;
  const roleListComboBoxInput = `role-list-combo-box-input`;
  const officeListItemId = `office-list-option-item-${mockGroups.offices.length - 1}`;
  const roleListItemId = `role-list-option-item-${mockGroups.roles.length - 1}`;
  const dateInputId = 'privileged-expiration-date';

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env = {
      ...env,
      CAMS_PA11Y: 'true',
    };
    const mockFeatureFlags = {
      'privileged-identity-management': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);

    vi.spyOn(Api2, 'getRoleAndOfficeGroupNames').mockResolvedValue({
      data: mockGroups,
    });
    vi.spyOn(Api2, 'getPrivilegedIdentityUsers').mockResolvedValue({
      data: MockData.buildArray(MockData.getCamsUserReference, 5),
    });
  });

  function renderWithoutProps() {
    render(<PrivilegedIdentity />);
  }

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

  test('should initially load screen with form disabled until a user is selected', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-4');
    expect(userItem).toBeInTheDocument();

    await expectItemToBeDisabled(`#${officeListComboBoxInput}`);
    await expectItemToBeDisabled(`#${roleListComboBoxInput}`);
    await expectItemToBeDisabled(`#${dateInputId}`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeDisabled(`#cancel-button`);

    expect(screen.queryByTestId(officeListItemId)).not.toBeInTheDocument();
    expect(screen.queryByTestId(roleListItemId)).not.toBeInTheDocument();

    await userEvent.click(userItem);

    await waitFor(async () => {
      await expectItemToBeEnabled(`#${officeListComboBoxInput}`);
    });

    await expectItemToBeEnabled(`#${roleListComboBoxInput}`);
    await expectItemToBeEnabled(`#${dateInputId}`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeEnabled(`#cancel-button`);
  });

  test('should load screen with expected user list, office list, and role list', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-4');
    expect(userItem).toBeInTheDocument();

    await expectItemToBeDisabled(`#${officeListComboBoxInput}`);

    await userEvent.click(userItem);

    await waitFor(async () => {
      await expectItemToBeEnabled(`#${officeListComboBoxInput}`);
    });

    expect(screen.getByTestId(officeListItemId)).toBeInTheDocument();

    expect(screen.getByTestId(roleListItemId)).toBeInTheDocument();

    expect(screen.getByTestId('privileged-expiration-date')).toBeInTheDocument();
  });

  test('should enable cancel button after selecting a user and save button after filling everything out. Delete should always be disabled for a new entry.', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-4');
    expect(userItem).toBeInTheDocument();

    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeDisabled(`#cancel-button`);

    await userEvent.click(userItem);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);

    const officeListItem = screen.getByTestId(officeListItemId);
    await userEvent.click(officeListItem);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);

    const roleListItem = screen.getByTestId(roleListItemId);
    await userEvent.click(roleListItem);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);

    const dateInput = document.querySelector(`#${dateInputId}`);
    // NOTE For some reason (known issue) a date input element can not be changed by typing a date
    // in the formation that the UI expects. The date may only be changed using a change event and
    // the format must be in YYYY-DD-MM format.
    fireEvent.change(dateInput!, { target: { value: `${new Date().getFullYear() + 1}-01-01` } });

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeEnabled(`#save-button`);
    await expectItemToBeDisabled(`#delete-button`);
  });

  test('should', async () => {});
});
