import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import Api2 from '@/lib/models/api2';
import { CamsRoleLabels } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import { isUnscopedRole, scopeLabel, UserRoleAssignment } from '@common/cams/user-access';

export type RemovePermissionModalRef = {
  show: (user: CamsUserReference, permission: UserRoleAssignment) => void;
};

export type RemovePermissionModalProps = {
  modalId: string;
  offices: UstpOfficeDetails[];
  onSuccess: (userId: string) => void;
};

/**
 * "This will remove Sarah Williams's Trial Attorney permissions for Region 2 - Manhattan." Super User
 * has no scope, so it has no "for ..." clause. Scope wording comes from scopeLabel, shared with the
 * Add Permission picker and the grant alerts.
 */
function removalMessage(
  user: CamsUserReference,
  permission: UserRoleAssignment,
  officeNames: Map<string, string>,
) {
  const removal = `This will remove ${user.name}'s ${CamsRoleLabels[permission.role]} permissions`;
  if (isUnscopedRole(permission.role)) return `${removal}.`;
  const officeName = permission.officeCode ? officeNames.get(permission.officeCode) : undefined;
  return `${removal} for ${scopeLabel(permission, officeName)}.`;
}

export const RemovePermissionModal = forwardRef<
  RemovePermissionModalRef,
  RemovePermissionModalProps
>(function RemovePermissionModal({ modalId, offices, onSuccess }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const globalAlert = useGlobalAlert();
  const [user, setUser] = useState<CamsUserReference | null>(null);
  const [permission, setPermission] = useState<UserRoleAssignment | null>(null);
  // The id of the permission being removed. A removal can finish after the modal was closed and
  // reopened for another permission; it must not close that one, or enable or disable its button.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const shownId = useRef<string | null>(null);

  const officeNames = useMemo(
    () => new Map(offices.map((office) => [office.officeCode, office.officeName])),
    [offices],
  );

  useImperativeHandle(ref, () => ({
    show(userToChange: CamsUserReference, toRemove: UserRoleAssignment) {
      shownId.current = toRemove.id;
      setUser(userToChange);
      setPermission(toRemove);
      modalRef.current?.show({});
    },
  }));

  async function handleRemove(owner: CamsUserReference, toRemove: UserRoleAssignment) {
    setRemovingId(toRemove.id);
    const hideIfStillShown = () => {
      if (shownId.current === toRemove.id) modalRef.current?.hide();
    };
    try {
      await Api2.removePermission({ userId: owner.id, permissionId: toRemove.id });
      hideIfStillShown();
      globalAlert?.success(`Permission successfully removed from ${owner.name}.`);
      onSuccess(owner.id);
    } catch {
      hideIfStillShown();
      globalAlert?.error(`Unable to remove permission from ${owner.name}.`);
    } finally {
      setRemovingId((current) => (current === toRemove.id ? null : current));
    }
  }

  const message = user && permission ? removalMessage(user, permission, officeNames) : '';

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading={`Remove Permission for ${user?.name ?? ''}`}
      content={<p>{message}</p>}
      actionButtonGroup={{
        modalId,
        modalRef,
        submitButton: {
          label: 'Remove Permission',
          uswdsStyle: UswdsButtonStyle.Secondary,
          onClick: user && permission ? () => handleRemove(user, permission) : undefined,
          closeOnClick: false,
          disabled: removingId === permission?.id,
        },
        cancelButton: { label: 'Cancel' },
      }}
    />
  );
});
