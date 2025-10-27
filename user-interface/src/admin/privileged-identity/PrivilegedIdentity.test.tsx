import { render, screen, waitFor } from '@testing-library/react';
import { PrivilegedIdentity, sortUserList, toComboOption } from './PrivilegedIdentity';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';

import { CamsUserReference, PrivilegedIdentityUser } from '@common/cams/users';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { RoleAndOfficeGroupNames } from '@common/cams/privileged-identity';

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
  const { env } = process;
  let mockUserList: CamsUserReference[];
  let mockGroups: RoleAndOfficeGroupNames;
  let officeListItemId: string;
  let roleListItemId: string;
  let mockUserRecord: PrivilegedIdentityUser;
  let userEvent: CamsUserEvent;

  const officeListComboBoxContainer = `#office-list .input-container`;
  const roleListComboBoxContainer = `#role-list .input-container`;
  const dateInputId = 'privileged-expiration-date';
  const mockDate1 = `${new Date().getFullYear() + 1}-01-01`;

  async function expectComboBoxToBeDisabled(selector: string) {
    expect(document.querySelector(selector)).toHaveClass('disabled');
  }

  async function expectComboBoxToBeEnabled(selector: string) {
    expect(document.querySelector(selector)).not.toHaveClass('disabled');
  }

  async function expectFormToBeDisabled() {
    await expectComboBoxToBeDisabled(`${officeListComboBoxContainer}`);
    await expectComboBoxToBeDisabled(`${roleListComboBoxContainer}`);
    await expectItemToBeDisabled(`#${dateInputId}`);
    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
    await expectItemToBeDisabled(`#cancel-button`);
  }

  async function expectFormToBeEnabled() {
    await expectComboBoxToBeEnabled(`${officeListComboBoxContainer}`);
    await expectComboBoxToBeEnabled(`${roleListComboBoxContainer}`);
    await expectItemToBeEnabled(`#${dateInputId}`);
    await expectItemToBeEnabled(`#cancel-button`);
  }

  beforeEach(async () => {
    process.env = {
      ...env,
      CAMS_USE_FAKE_API: 'true',
    };

    userEvent = TestingUtilities.setupUserEvent();
    mockUserList = MockData.buildArray(MockData.getCamsUserReference, 5);
    mockGroups = {
      offices: ['USTP CAMS Office A', 'USTP CAMS Office B', 'USTP CAMS Office C'],
      roles: ['USTP CAMS Role A', 'USTP CAMS Role B', 'USTP CAMS Role C'],
    };
    officeListItemId = `office-list-option-item-${mockGroups.offices.length - 1}`;
    roleListItemId = `role-list-option-item-${mockGroups.roles.length - 1}`;

    mockUserRecord = {
      id: mockUserList[0].id,
      documentType: 'PRIVILEGED_IDENTITY_USER',
      name: mockUserList[0].name,
      claims: {
        groups: [mockGroups.offices[0], mockGroups.roles[0]],
      },
      expires: mockDate1,
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

  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
    });

    await expectFormToBeDisabled();

    expect(screen.queryByTestId(officeListItemId)).not.toBeInTheDocument();
    expect(screen.queryByTestId(roleListItemId)).not.toBeInTheDocument();

    const userItem = screen.getByTestId('user-list-option-item-4');
    expect(userItem).toBeInTheDocument();

    await userEvent.click(userItem);

    await expectFormToBeEnabled();

    await expectItemToBeDisabled(`#delete-button`);
    await expectItemToBeDisabled(`#save-button`);
  });

  test('should load screen with expected user list, office list, and role list', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
    });

    await expectComboBoxToBeDisabled(`${officeListComboBoxContainer}`);

    const userItem = screen.getByTestId('user-list-option-item-4');
    expect(userItem).toBeInTheDocument();

    await userEvent.click(userItem);

    await waitFor(() => {
      expectComboBoxToBeEnabled(`${officeListComboBoxContainer}`);
    });

    expect(screen.getByTestId(officeListItemId)).toBeInTheDocument();

    expect(screen.getByTestId(roleListItemId)).toBeInTheDocument();

    expect(screen.getByTestId('privileged-expiration-date')).toBeInTheDocument();
  });

  test('should enable cancel button after selecting a user and save button after filling everything out. Delete should always be disabled for a new entry.', async () => {
    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
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
    // NOTE For some reason (known issue) a date input element cannot be changed by typing a date
    // in the format that the UI expects. The date may only be changed using a change event, and
    // the format must be in YYYY-DD-MM format.
    await userEvent.type(dateInput!, mockDate1);

    await expectItemToBeEnabled(`#cancel-button`);
    await expectItemToBeEnabled(`#save-button`);
    await expectItemToBeDisabled(`#delete-button`);
  });

  test('should enable delete button if user record was previously saved. Save button should be disabled until something is changed.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
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
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
    });

    await expectFormToBeDisabled();

    const userItem = screen.getByTestId('user-list-option-item-0');
    expect(userItem).not.toHaveClass('selected');
    await userEvent.click(userItem);
    expect(userItem).toHaveClass('selected');

    await expectFormToBeEnabled();

    const cancelButton = document.querySelector('#cancel-button');
    await userEvent.click(cancelButton!);

    await expectFormToBeDisabled();
    expect(userItem).not.toHaveClass('selected');
  });

  test('should save record when clicking save.', async () => {
    vi.spyOn(Api2, 'getPrivilegedIdentityUser').mockResolvedValue({ data: mockUserRecord });
    const putSpy = vi.spyOn(Api2, 'putPrivilegedIdentityUser').mockResolvedValue();
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    expectComboBoxToBeEnabled(`${roleListComboBoxContainer}`);

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
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
    });

    const userItem = screen.getByTestId('user-list-option-item-0');
    await userEvent.click(userItem);

    await expectComboBoxToBeEnabled(`${roleListComboBoxContainer}`);

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
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
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
    const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();

    renderWithoutProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner-caption')).not.toBeInTheDocument();
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
