import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { UserRoleAssignment } from '@common/cams/user-access';
import { MOCKED_USTP_OFFICE_DATA_MAP } from '@common/cams/test-utilities/offices.mock';
import { RemovePermissionModal, RemovePermissionModalRef } from './RemovePermissionModal';

const MODAL_ID = 'remove-permission-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;
const MANHATTAN = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_2_Office_Manhattan')!;
const SARAH = { id: 'okta-sarah', name: 'Sarah Williams' };

function permission(overrides: Partial<UserRoleAssignment> = {}): UserRoleAssignment {
  return {
    documentType: 'USER_ROLE_ASSIGNMENT',
    id: 'permission-1',
    userId: SARAH.id,
    userName: SARAH.name,
    role: CamsRole.TrialAttorney,
    regionId: MANHATTAN.regionId,
    officeCode: MANHATTAN.officeCode,
    assignedBy: 'super-1',
    assignedByName: 'Maria Garcia',
    assignedAt: '2026-11-20T15:00:00.000Z',
    active: true,
    activeKey: `TrialAttorney|${MANHATTAN.regionId}|${MANHATTAN.officeCode}`,
    ...overrides,
  };
}

describe('RemovePermissionModal', () => {
  let modalRef: React.RefObject<RemovePermissionModalRef | null>;
  let onSuccess: (userId: string) => void;
  let globalAlert: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalAlert = TestingUtilities.spyOnGlobalAlert();
    modalRef = React.createRef<RemovePermissionModalRef>();
    onSuccess = vi.fn();
    render(
      <RemovePermissionModal
        ref={modalRef}
        modalId={MODAL_ID}
        offices={[MANHATTAN]}
        onSuccess={onSuccess}
      />,
    );
  });

  async function openFor(toRemove: UserRoleAssignment) {
    act(() => modalRef.current?.show(SARAH, toRemove));
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible'));
  }

  test('should name the user and the office permission it will remove', async () => {
    await openFor(permission());

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveTextContent(
      'Remove Permission for Sarah Williams',
    );
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveTextContent(
      "This will remove Sarah Williams's Trial Attorney permissions for Region 2 - Manhattan.",
    );
  });

  test.each([
    {
      name: 'a whole region',
      overrides: { officeCode: null },
      text: "This will remove Sarah Williams's Trial Attorney permissions for Region 2 - All Offices.",
    },
    {
      name: 'every region',
      overrides: { regionId: null, officeCode: null },
      text: "This will remove Sarah Williams's Trial Attorney permissions for All Regions.",
    },
    {
      name: 'Super User, which has no scope',
      overrides: { role: CamsRole.SuperUser, regionId: null, officeCode: null },
      text: "This will remove Sarah Williams's Super User permissions.",
    },
  ])('should describe a permission for $name', async ({ overrides, text }) => {
    await openFor(permission(overrides));

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveTextContent(text);
  });

  test.each([
    { name: 'an office', overrides: {} },
    {
      name: 'Super User, which has no scope',
      overrides: {
        role: CamsRole.SuperUser,
        regionId: null,
        officeCode: null,
        id: 'permission-super',
      },
    },
  ])('should send the removal of that permission, by its id, for $name', async ({ overrides }) => {
    const removeSpy = vi.spyOn(Api2, 'removePermission').mockResolvedValue(undefined);
    const toRemove = permission(overrides);
    await openFor(toRemove);

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    expect(removeSpy).toHaveBeenCalledWith({ userId: SARAH.id, permissionId: toRemove.id });
  });

  test('should close, confirm the removal and report success when it succeeds', async () => {
    vi.spyOn(Api2, 'removePermission').mockResolvedValue(undefined);
    await openFor(permission());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    expect(globalAlert.success).toHaveBeenCalledWith(
      'Permission successfully removed from Sarah Williams.',
    );
    expect(onSuccess).toHaveBeenCalledWith(SARAH.id);
  });

  test('should close and explain the failure without reloading when the removal fails', async () => {
    vi.spyOn(Api2, 'removePermission').mockRejectedValue(new Error('500 Error - Server Error'));
    await openFor(permission());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    expect(globalAlert.error).toHaveBeenCalledWith(
      'Unable to remove permission from Sarah Williams.',
    );
    expect(globalAlert.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test('should disable Remove Permission while the removal is in progress, then enable it again', async () => {
    let finish: () => void = () => {};
    vi.spyOn(Api2, 'removePermission').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await openFor(permission());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    expect(screen.getByTestId(SUBMIT_BTN)).toBeDisabled();
    await act(async () => finish());
    expect(screen.getByTestId(SUBMIT_BTN)).toBeEnabled();
  });

  test('should leave the modal open for another permission when an earlier removal finishes', async () => {
    let finish: () => void = () => {};
    vi.spyOn(Api2, 'removePermission').mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await openFor(permission());
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));
    await userEvent.click(screen.getByTestId(CANCEL_BTN));
    const regionWide = permission({ id: 'permission-2', officeCode: null });
    await openFor(regionWide);

    await act(async () => finish());

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveTextContent('Region 2 - All Offices');
    expect(screen.getByTestId(SUBMIT_BTN)).toBeEnabled();
  });

  test('should style Remove Permission as a destructive action', async () => {
    await openFor(permission());

    expect(screen.getByTestId(SUBMIT_BTN)).toHaveClass('usa-button--secondary');
  });

  test('should send nothing when the Super User cancels', async () => {
    const removeSpy = vi.spyOn(Api2, 'removePermission');
    await openFor(permission());

    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
