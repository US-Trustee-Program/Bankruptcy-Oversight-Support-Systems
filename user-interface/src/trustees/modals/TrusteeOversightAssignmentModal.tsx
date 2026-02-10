import React, { forwardRef, useRef, useState, useCallback } from 'react';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Staff } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import './TrusteeOversightAssignmentModal.scss';

const ROLE_LABELS: Record<OversightRoleType, string> = {
  [CamsRole.OversightAttorney]: 'attorney',
  [CamsRole.OversightAuditor]: 'auditor',
  [CamsRole.OversightParalegal]: 'paralegal',
};

interface TrusteeOversightAssignmentModalProps {
  modalId: string;
  trusteeId: string;
  role: OversightRoleType;
  onAssignment: (isAssigned: boolean) => void;
}

export interface TrusteeOversightAssignmentModalRef extends ModalRefType {
  show: (currentAssignment?: TrusteeOversightAssignment) => void;
  hide: () => void;
}

const TrusteeOversightAssignmentModal = forwardRef<
  TrusteeOversightAssignmentModalRef,
  TrusteeOversightAssignmentModalProps
>((props, ref) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<TrusteeOversightAssignment | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const { modalId, trusteeId, role, onAssignment } = props;

  const modalRef = useRef<ModalRefType>(null);

  const globalAlert = useGlobalAlert();

  const roleLabel = ROLE_LABELS[role] ?? 'staff member';

  const loadStaff = useCallback(
    async (assignment?: TrusteeOversightAssignment | null) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await Api2.getOversightStaff();
        const staffByRole = response.data ?? {};

        const staffList = staffByRole[role] ?? [];

        setStaff(staffList);

        if (assignment) {
          const currentStaffMember = staffList.find((member) => member.id === assignment.user.id);
          if (currentStaffMember) {
            setSelectedStaff(currentStaffMember);
          }
        }
      } catch {
        setError(`Failed to load ${roleLabel}s`);
      } finally {
        setIsLoading(false);
      }
    },
    [role, roleLabel],
  );

  // Handle external ref
  React.useImperativeHandle(
    ref,
    () => ({
      show: (assignment?: TrusteeOversightAssignment) => {
        setCurrentAssignment(assignment ?? null);
        setSelectedStaff(null); // Reset selection
        modalRef.current?.show({});
        loadStaff(assignment);
      },
      hide: () => {
        modalRef.current?.hide();
        setSelectedStaff(null);
        setCurrentAssignment(null);
      },
    }),
    [loadStaff],
  );

  const handleAssignStaff = useCallback(async () => {
    if (selectedStaff) {
      if (currentAssignment && currentAssignment.user.id === selectedStaff.id) {
        modalRef.current?.hide();
        return;
      }

      setIsAssigning(true);
      try {
        await Api2.createTrusteeOversightAssignment(trusteeId, selectedStaff.id, role);
        onAssignment(true);
        globalAlert?.success(
          `${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} assigned successfully`,
        );
        modalRef.current?.hide();
      } catch (err) {
        globalAlert?.error(err instanceof Error ? err.message : `Failed to assign ${roleLabel}`);
      } finally {
        setIsAssigning(false);
      }
    }
  }, [selectedStaff, currentAssignment, trusteeId, role, onAssignment, globalAlert, roleLabel]);

  const modalContent = (
    <div
      className="trustee-oversight-assignment-modal-content"
      data-testid="oversight-assignment-modal-content"
    >
      {isLoading && <LoadingSpinner caption={`Loading ${roleLabel}s...`} />}
      {error && <Alert type={UswdsAlertStyle.Error}>{error}</Alert>}
      {!isLoading && !error && (
        <div className="staff-selection-section">
          <ComboBox
            id="staff-search"
            name="staff-search"
            label={`Search for ${roleLabel} to assign to this Trustee`}
            options={staff.map((member) => ({
              value: member.id,
              label: member.name,
            }))}
            selections={
              selectedStaff ? [{ value: selectedStaff.id, label: selectedStaff.name }] : []
            }
            onUpdateSelection={(selectedOptions) => {
              const selectedOption = selectedOptions[0];
              if (selectedOption) {
                const staffMember = staff.find((s) => s.id === selectedOption.value);
                setSelectedStaff(staffMember ?? null);
              } else {
                setSelectedStaff(null);
              }
            }}
            placeholder={`Search for a ${roleLabel}...`}
            required
          />
        </div>
      )}
    </div>
  );

  const isEditMode = !!currentAssignment;
  const actionButtonGroup = {
    modalId: modalId,
    modalRef: modalRef,
    submitButton: {
      label: isEditMode
        ? `Edit ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}`
        : `Add ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}`,
      disabled: !selectedStaff || isAssigning,
      onClick: handleAssignStaff,
      closeOnClick: false,
      uswdsStyle: UswdsButtonStyle.Default,
    },
    cancelButton: {
      label: 'Cancel',
      uswdsStyle: UswdsButtonStyle.Unstyled,
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      className="trustee-oversight-assignment-modal"
      heading={
        isEditMode
          ? `Edit ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}`
          : `Add ${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}`
      }
      content={modalContent}
      actionButtonGroup={actionButtonGroup}
    />
  );
});

TrusteeOversightAssignmentModal.displayName = 'TrusteeOversightAssignmentModal';

export default TrusteeOversightAssignmentModal;
