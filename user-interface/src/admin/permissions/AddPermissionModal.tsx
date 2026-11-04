import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import TextArea from '@/lib/components/uswds/TextArea';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import Api2 from '@/lib/models/api2';
import { CamsRole, CamsRoleLabels, CamsRoles, CamsRoleType } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import { ROLE_ASSIGNMENT_REASON_MAX_LENGTH } from '@common/cams/user-access';

export type AddPermissionModalRef = {
  show: (user: CamsUserReference) => void;
};

export type AddPermissionModalProps = {
  modalId: string;
  offices: UstpOfficeDetails[];
  onSuccess: () => void;
};

const SAVE_FAILED_MESSAGE = 'Unable to save permission. Please try again';

// Super User grants arrive in a later slice.
const ROLE_OPTIONS: ComboOption[] = CamsRoles.filter((role) => role !== CamsRole.SuperUser)
  .map((role) => ({ value: role, label: CamsRoleLabels[role] }))
  .sort((a, b) => a.label.localeCompare(b.label));

function toOfficeOptions(offices: UstpOfficeDetails[]): ComboOption[] {
  return [...offices]
    .sort(
      (a, b) =>
        a.regionId.localeCompare(b.regionId, undefined, { numeric: true }) ||
        a.officeName.localeCompare(b.officeName),
    )
    .map((office) => ({
      value: office.officeCode,
      label: `${office.regionId} - ${office.officeName}`,
    }));
}

export const AddPermissionModal = forwardRef<AddPermissionModalRef, AddPermissionModalProps>(
  function AddPermissionModal({ modalId, offices, onSuccess }, ref) {
    const modalRef = useRef<ModalRefType>(null);
    const roleRef = useRef<ComboBoxRef>(null);
    const officeRef = useRef<ComboBoxRef>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    // Tracks whether the modal is still open when a save finishes; it can be closed mid-save.
    const isOpenRef = useRef(false);
    const globalAlert = useGlobalAlert();

    const [user, setUser] = useState<CamsUserReference | null>(null);
    const [role, setRole] = useState<CamsRoleType | null>(null);
    const [officeCode, setOfficeCode] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);

    const officeOptions = useMemo(() => toOfficeOptions(offices), [offices]);
    const isComplete = !!role && !!officeCode && reason.trim().length > 0;

    // Save is disabled while it saves, which strands focus; move it to the explanation instead.
    useEffect(() => {
      if (saveFailed) errorRef.current?.focus();
    }, [saveFailed]);

    function resetForm() {
      roleRef.current?.clearSelections();
      officeRef.current?.clearSelections();
      setRole(null);
      setOfficeCode(null);
      setReason('');
      setIsSaving(false);
      setSaveFailed(false);
    }

    useImperativeHandle(ref, () => ({
      show(userToGrant: CamsUserReference) {
        resetForm();
        setUser(userToGrant);
        isOpenRef.current = true;
        modalRef.current?.show({});
      },
    }));

    async function handleSave() {
      if (!user || !role || !officeCode) return;
      setIsSaving(true);
      setSaveFailed(false);
      try {
        await Api2.postRoleAssignment({
          userId: user.id,
          role,
          officeCode,
          reason: reason.trim(),
        });
        isOpenRef.current = false;
        modalRef.current?.hide();
        globalAlert?.success(`New permission successfully added to ${user.name}.`);
        onSuccess();
      } catch (error) {
        getAppInsights()?.appInsights?.trackException({ exception: error as Error });
        if (isOpenRef.current) {
          setSaveFailed(true);
        } else {
          globalAlert?.error(`Unable to save permission for ${user.name}. Please try again.`);
        }
      } finally {
        setIsSaving(false);
      }
    }

    const actionButtonGroup = {
      modalId,
      modalRef,
      submitButton: {
        label: 'Save',
        onClick: handleSave,
        closeOnClick: false,
        disabled: !isComplete || isSaving,
      },
      cancelButton: {
        label: 'Cancel',
      },
    };

    return (
      <Modal
        ref={modalRef}
        modalId={modalId}
        heading={`Add Permission to ${user?.name ?? ''}`}
        actionButtonGroup={actionButtonGroup}
        onClose={() => {
          isOpenRef.current = false;
        }}
        footerContent={
          <>
            {isSaving && (
              <LoadingSpinner
                id={`${modalId}-saving`}
                caption="Adding permission..."
                aria-hidden="true"
              />
            )}
            {/* Present before saving starts, so screen readers announce the change. */}
            <div className="usa-sr-only" role="status" data-testid={`${modalId}-status`}>
              {isSaving ? 'Adding permission...' : ''}
            </div>
          </>
        }
        content={
          <div>
            <FormRequirementsNotice />
            <div id={`${modalId}-error-container`} ref={errorRef} tabIndex={-1}>
              {saveFailed && (
                <Alert
                  id={`${modalId}-error`}
                  message={SAVE_FAILED_MESSAGE}
                  type={UswdsAlertStyle.Error}
                  role="alert"
                  show={true}
                  inline={true}
                  slim={true}
                />
              )}
            </div>
            <ComboBox
              id={`${modalId}-role`}
              ref={roleRef}
              label="Role"
              required
              options={ROLE_OPTIONS}
              multiSelect={false}
              onUpdateSelection={(selections) =>
                setRole((selections[0]?.value as CamsRoleType) ?? null)
              }
            />
            <ComboBox
              id={`${modalId}-office`}
              ref={officeRef}
              label="Region and Office"
              required
              options={officeOptions}
              multiSelect={false}
              onUpdateSelection={(selections) => setOfficeCode(selections[0]?.value ?? null)}
            />
            <TextArea
              id={`${modalId}-reason`}
              label="Reason"
              required
              maxLength={ROLE_ASSIGNMENT_REASON_MAX_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        }
      />
    );
  },
);
