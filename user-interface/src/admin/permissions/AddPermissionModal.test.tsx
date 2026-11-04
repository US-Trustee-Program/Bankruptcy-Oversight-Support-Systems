import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { AddPermissionModal, AddPermissionModalRef } from './AddPermissionModal';

const MODAL_ID = 'add-permission-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;
const ROLE_ID = `${MODAL_ID}-role`;
const OFFICE_ID = `${MODAL_ID}-office`;
const REASON_ID = `textarea-${MODAL_ID}-reason`;

const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const BUFFALO = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Buffalo')!;
const SEATTLE = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_18_Office_Seattle')!;

const SARAH = { id: 'okta-sarah', name: 'Sarah Williams' };
const REASON = 'New hire - Trial Attorney for Manhattan.';

// Offices in the order the modal should list them: region number, then office name.
const OFFICES_IN_ORDER = [BUFFALO, MANHATTAN, SEATTLE];
const MANHATTAN_INDEX = OFFICES_IN_ORDER.indexOf(MANHATTAN);
const ROLE_LABELS_IN_ORDER = [
  'Auditor',
  'Case Assignment Manager',
  'Data Verifier',
  'Lead Trial Attorney',
  'Paralegal',
  'Trial Attorney',
  'Trustee Admin',
];
const TRIAL_ATTORNEY_INDEX = ROLE_LABELS_IN_ORDER.indexOf('Trial Attorney');
const SAVE_FAILED = 'Unable to save permission. Please try again';
const roleInput = () => document.querySelector(`#${ROLE_ID}-combo-box-input`);
const officeInput = () => document.querySelector(`#${OFFICE_ID}-combo-box-input`);
const reasonInput = () => document.querySelector(`#${REASON_ID}`);

describe('AddPermissionModal', () => {
  let modalRef: React.RefObject<AddPermissionModalRef | null>;
  let onSuccess: () => void;
  let globalAlert: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalAlert = TestingUtilities.spyOnGlobalAlert();
    modalRef = React.createRef<AddPermissionModalRef>();
    onSuccess = vi.fn();
    render(
      <AddPermissionModal
        ref={modalRef}
        modalId={MODAL_ID}
        offices={[SEATTLE, MANHATTAN, BUFFALO]}
        onSuccess={onSuccess}
      />,
    );
  });

  async function openFor(user = SARAH) {
    act(() => modalRef.current?.show(user));
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible'));
  }

  function optionLabels(comboBoxId: string) {
    return Array.from(
      document.querySelectorAll(
        `#${comboBoxId}-item-list-container [data-testid^="${comboBoxId}-option-item-"]`,
      ),
      (item) => item.textContent,
    );
  }

  async function fillIn({ role = true, office = true, reason = REASON as string | null } = {}) {
    if (role) await TestingUtilities.toggleComboBoxItemSelection(ROLE_ID, TRIAL_ATTORNEY_INDEX);
    if (office) {
      await TestingUtilities.toggleComboBoxItemSelection(OFFICE_ID, MANHATTAN_INDEX);
      // ComboBox returns focus to its input in a requestAnimationFrame after a selection. Until
      // then focus sits on the clicked option, whose keydown handler consumes Escape.
      await waitFor(() => expect(officeInput()).toHaveFocus());
    }
    if (reason !== null) {
      fireEvent.change(document.querySelector(`#${REASON_ID}`)!, { target: { value: reason } });
    }
  }

  const submitButton = () => screen.getByTestId(SUBMIT_BTN);

  test('should be titled for the user it was opened for', async () => {
    await openFor();

    expect(screen.getByRole('heading', { name: 'Add Permission to Sarah Williams' })).toBeVisible();
  });

  test('should offer role labels without Super User or Privileged Identity User', async () => {
    await openFor();

    expect(optionLabels(ROLE_ID)).toEqual(ROLE_LABELS_IN_ORDER);
  });

  test('should offer single offices as "<region> - <office name>", ordered by region then name', async () => {
    await openFor();

    expect(optionLabels(OFFICE_ID)).toEqual(
      OFFICES_IN_ORDER.map((office) => `${office.regionId} - ${office.officeName}`),
    );
    expect(optionLabels(OFFICE_ID)).not.toContain('All');
  });

  test('should have a required reason of at most 1000 characters', async () => {
    await openFor();

    const reason = document.querySelector(`#${REASON_ID}`)!;
    expect(reason.tagName).toBe('TEXTAREA');
    expect(reason).toHaveAttribute('maxlength', '1000');
    expect(reason).toBeRequired();
  });

  test.each([
    {
      case: 'no role',
      fields: { role: false },
      complete: () => TestingUtilities.toggleComboBoxItemSelection(ROLE_ID, TRIAL_ATTORNEY_INDEX),
    },
    {
      case: 'no region and office',
      fields: { office: false },
      complete: () => TestingUtilities.toggleComboBoxItemSelection(OFFICE_ID, MANHATTAN_INDEX),
    },
    {
      case: 'no reason',
      fields: { reason: null },
      complete: async () => fireEvent.change(reasonInput()!, { target: { value: REASON } }),
    },
    {
      case: 'a whitespace-only reason',
      fields: { reason: '   ' },
      complete: async () => fireEvent.change(reasonInput()!, { target: { value: REASON } }),
    },
  ])('should keep Save disabled with $case until it is filled in', async ({ fields, complete }) => {
    await openFor();

    await fillIn(fields);
    expect(submitButton()).toBeDisabled();

    await complete();
    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  test('should say which fields are required', async () => {
    await openFor();

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveTextContent('indicates a required field');
  });

  test('should enable Save once every field is filled in', async () => {
    await openFor();

    await fillIn();

    expect(submitButton()).toBeEnabled();
  });

  test('should save the grant, close, announce success and tell the caller', async () => {
    const postSpy = vi
      .spyOn(Api2, 'postRoleAssignment')
      .mockResolvedValue({ data: {} as UserRoleAssignment });
    await openFor();
    await fillIn({ reason: `  ${REASON}  ` });

    await userEvent.click(submitButton());

    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    expect(postSpy).toHaveBeenCalledWith({
      userId: SARAH.id,
      role: CamsRole.TrialAttorney,
      officeCode: MANHATTAN.officeCode,
      reason: REASON,
    });
    expect(globalAlert.success).toHaveBeenCalledWith(
      'New permission successfully added to Sarah Williams.',
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test('should show progress and disable Save while saving', async () => {
    let finish: () => void = () => {};
    vi.spyOn(Api2, 'postRoleAssignment').mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ data: {} as UserRoleAssignment });
      }),
    );
    await openFor();
    await fillIn();

    await userEvent.click(submitButton());

    expect(document.querySelector(`#${MODAL_ID}-saving`)).toHaveTextContent('Adding permission...');
    expect(screen.getByTestId(`${MODAL_ID}-status`)).toHaveTextContent('Adding permission...');
    expect(submitButton()).toBeDisabled();
    await act(async () => finish());
    await waitFor(() =>
      expect(document.querySelector(`#${MODAL_ID}-saving`)).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId(`${MODAL_ID}-status`)).toHaveTextContent('');
  });

  test('should keep the modal open with the entries and explain a failed save', async () => {
    vi.spyOn(Api2, 'postRoleAssignment').mockRejectedValue(new Error('500'));
    await openFor();
    await fillIn();

    await userEvent.click(submitButton());

    const error = await screen.findByText(SAVE_FAILED);
    expect(error.closest('[role="alert"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(`#${MODAL_ID}-error-container`)).toHaveFocus(),
    );
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(reasonInput()).toHaveValue(REASON);
    expect(roleInput()).toHaveValue('Trial Attorney');
    expect(officeInput()).toHaveValue('2 - Manhattan');
    expect(globalAlert.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test.each([
    { how: 'Cancel', close: () => userEvent.click(screen.getByTestId(CANCEL_BTN)) },
    {
      how: 'the close button',
      close: () => userEvent.click(screen.getByTestId(`modal-x-button-${MODAL_ID}`)),
    },
    { how: 'Escape', close: () => userEvent.keyboard('{Escape}') },
  ])('should close without saving on $how', async ({ close }) => {
    const postSpy = vi.spyOn(Api2, 'postRoleAssignment');
    await openFor();
    await fillIn();

    await close();

    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    expect(postSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('should clear the error when retrying and close once the retry succeeds', async () => {
    let finishRetry: () => void = () => {};
    vi.spyOn(Api2, 'postRoleAssignment')
      .mockRejectedValueOnce(new Error('500'))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishRetry = () => resolve({ data: {} as UserRoleAssignment });
        }),
      );
    await openFor();
    await fillIn();
    await userEvent.click(submitButton());
    await screen.findByText(SAVE_FAILED);
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await userEvent.click(submitButton());

    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
    await act(async () => finishRetry());
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    expect(globalAlert.success).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test('should start empty each time it is opened', async () => {
    vi.spyOn(Api2, 'postRoleAssignment').mockRejectedValue(new Error('500'));
    await openFor();
    await fillIn();
    await userEvent.click(submitButton());
    await screen.findByText(SAVE_FAILED);
    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    await openFor({ id: 'okta-alex', name: 'Alex Brown' });

    expect(screen.getByRole('heading', { name: 'Add Permission to Alex Brown' })).toBeVisible();
    expect(reasonInput()).toHaveValue('');
    expect(roleInput()).toHaveValue('');
    expect(officeInput()).toHaveValue('');
    expect(
      screen.queryByText('Unable to save permission. Please try again'),
    ).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  test('should report a failure as a global error when the modal was closed during the save', async () => {
    let fail: () => void = () => {};
    vi.spyOn(Api2, 'postRoleAssignment').mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = () => reject(new Error('500'));
      }),
    );
    await openFor();
    await fillIn();
    await userEvent.click(submitButton());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    await act(async () => fail());

    expect(globalAlert.error).toHaveBeenCalledWith(
      'Unable to save permission for Sarah Williams. Please try again.',
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
