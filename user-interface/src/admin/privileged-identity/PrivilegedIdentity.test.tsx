import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PrivilegedIdentity, sortUserList, toComboOption } from './PrivilegedIdentity';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import userEvent from '@testing-library/user-event';
import { CamsUserReference, PrivilegedIdentityUser } from '@common/cams/users';
import testingUtilities from '@/lib/testing/testing-utilities';

async function expectItemToBeDisabled(selector: string) {
  let item;
  await waitFor(() => {
    item = document.querySelector(selector);
    expect(item).toBeInTheDocument();
  });
  expect(item!).toBeDisabled();
}

async function expectItemToBeEnabled(selector: string) {
  let item;
  await waitFor(() => {
    item = document.querySelector(selector);
    expect(item).toBeInTheDocument();
  });
  expect(item!).not.toBeDisabled();
}

describe('Privileged Identity screen tests', () => {
  const env = process.env;
  const mockUserList = MockData.buildArray(MockData.getCamsUserReference, 5);
  const mockGroups = MockData.getRoleAndOfficeGroupNames();
  const officeListComboBoxInput = `office-list-combo-box-input`;
  const roleListComboBoxInput = `role-list-combo-box-input`;
  const officeListItemId = `office-list-option-item-${mockGroups.offices.length - 1}`;
  const roleListItemId = `role-list-option-item-${mockGroups.roles.length - 1}`;
  const dateInputId = 'privileged-expiration-date';
  const mockDate1 = `${new Date().getFullYear() + 1}-01-01`;

  const mockUserRecord: PrivilegedIdentityUser = {
    id: mockUserList[0].id,
    documentType: 'PRIVILEGED_IDENTITY_USER',
    name: mockUserList[0].name,
    claims: {
      groups: [mockGroups.offices[0], mockGroups.roles[0]],
    },
    expires: mockDate1,
  };

  async function expectFormToBeDisabled() {
    await expectItemToBeDisabled(`#${officeListComboBoxInput}`);
    await expectItemToBeDisabled(`#${roleListComboBoxInput}`);
    await expectItemToBeDisabled(`#${dateInputId}`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeDisabled(`#cancel-button`);
  }

  async function expectFormToBeEnabled() {
    await expectItemToBeEnabled(`#${officeListComboBoxInput}`);
    await expectItemToBeEnabled(`#${roleListComboBoxInput}`);
    await expectItemToBeEnabled(`#${dateInputId}`);
    await expectItemToBeEnabled(`#cancel-button`);
  }

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

  test('Should sort user', async () => {
    const userA: CamsUserReference = {
      id: '1',
      name: 'user A',
    };
    const userZ: CamsUserReference = {
      id: '1',
      name: 'user Z',
    };

    expect(sortUserList(userA, userZ)).toEqual(-1);
    expect(sortUserList(userZ, userA)).toEqual(1);
    expect(sortUserList(userA, userA)).toEqual(0);
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

    await expectFormToBeDisabled();

    expect(screen.queryByTestId(officeListItemId)).not.toBeInTheDocument();
    expect(screen.queryByTestId(roleListItemId)).not.toBeInTheDocument();

    await userEvent.click(userItem);

    await waitFor(async () => {
      await expectFormToBeEnabled();
    });

    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
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
    fireEvent.change(dateInput!, { target: { value: mockDate1 } });

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeEnabled(`#save-button`);
    await expectItemToBeDisabled(`#delete-button`);
  });

  test('should enable delete button if user record was previously saved. Save button should be disabled until something is changed.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    await expectItemToBeDisabled(`#cancel-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeDisabled(`#delete-button`);

    const userItem = screen.getByTestId('user-list-option-item-0');
    expect(userItem).toBeInTheDocument();
    await userEvent.click(userItem);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeEnabled(`#delete-button`);

    const roleListItem = screen.getByTestId(roleListItemId);
    await userEvent.click(roleListItem);

    await expectItemToBeEnabled(`#save-button`);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeEnabled(`#delete-button`);

    await userEvent.click(roleListItem);

    await expectItemToBeDisabled(`#save-button`);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeEnabled(`#delete-button`);
  });

  test('should clear form when clicking cancel button.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    await expectFormToBeDisabled();
    expect(document.querySelector('#pill-user-list')).not.toBeInTheDocument();

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    await expectFormToBeEnabled();
    expect(document.querySelector('#pill-user-list')).toBeInTheDocument();

    const cancelButton = document.querySelector('#cancel-button');
    await userEvent.click(cancelButton!);

    await expectFormToBeDisabled();
    expect(document.querySelector('#pill-user-list')).not.toBeInTheDocument();
  });

  test('should save record when clicking save.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });
    const putSpy = vi.spyOn(Api2, 'putPrivilegedIdentityUser').mockResolvedValue();
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    await expectItemToBeEnabled(`#${roleListComboBoxInput}`);

    const roleListItem = screen.getByTestId(roleListItemId);
    await userEvent.click(roleListItem);

    await expectItemToBeEnabled(`#save-button`);

    const saveButton = document.querySelector('#save-button');
    await userEvent.click(saveButton!);

    expect(putSpy).toHaveBeenCalled();
    expect(globalAlertSpy.success).toHaveBeenCalled();
  });

  test('should display warning alert if save fails.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });
    const putSpy = vi.spyOn(Api2, 'putPrivilegedIdentityUser').mockRejectedValue(new Error());
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    await expectItemToBeEnabled(`#${roleListComboBoxInput}`);

    const roleListItem = screen.getByTestId(roleListItemId);
    await userEvent.click(roleListItem);

    await expectItemToBeEnabled(`#save-button`);

    const saveButton = document.querySelector('#save-button');
    await userEvent.click(saveButton!);

    expect(putSpy).toHaveBeenCalled();
    expect(globalAlertSpy.warning).toHaveBeenCalled();
  });

  test('should delete record when clicking delete.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });
    const deleteSpy = vi.spyOn(Api2, 'deletePrivilegedIdentityUser').mockResolvedValue();
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    const deleteButton = document.querySelector('#delete-button');
    expect(deleteButton!).toBeEnabled();
    await userEvent.click(deleteButton!);

    expect(deleteSpy).toHaveBeenCalled();
    expect(globalAlertSpy.success).toHaveBeenCalled();
  });

  test('should display warning alert if delete fails.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });
    const deleteSpy = vi.spyOn(Api2, 'deletePrivilegedIdentityUser').mockRejectedValue(new Error());
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    const deleteButton = document.querySelector('#delete-button');
    expect(deleteButton!).toBeEnabled();
    await userEvent.click(deleteButton!);

    expect(deleteSpy).toHaveBeenCalled();
    expect(globalAlertSpy.warning).toHaveBeenCalled();
  });
});
