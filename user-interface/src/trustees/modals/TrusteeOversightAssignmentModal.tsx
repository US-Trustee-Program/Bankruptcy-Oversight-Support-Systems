import React, { forwardRef, useRef, useState, useCallback } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { CamsUserReference } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import './TrusteeOversightAssignmentModal.scss';

interface TrusteeOversightAssignmentModalProps {
  modalId: string;
  trusteeId: string;
  role: OversightRole;
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
  const [staff, setStaff] = useState<CamsUserReference[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<CamsUserReference | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<TrusteeOversightAssignment | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const modalRef = useRef<ModalRefType>(null);
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  const roleLabel =
    props.role === OversightRole.OversightAttorney
      ? 'attorney'
      : props.role === OversightRole.OversightAuditor
        ? 'auditor'
        : 'staff member';

  // Handle external ref
  React.useImperativeHandle(ref, () => ({
    show: (assignment?: TrusteeOversightAssignment) => {
      setCurrentAssignment(assignment ?? null);
      setSelectedStaff(null); // Reset selection
      modalRef.current?.show({});
      loadStaff();
    },
    hide: () => {
      modalRef.current?.hide({});
      setSelectedStaff(null);
      setCurrentAssignment(null);
    },
  }));

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getOversightStaff();
      const { attorneys = [], auditors = [] } = response.data ?? {};

      const staffList =
        props.role === OversightRole.OversightAttorney
          ? attorneys
          : props.role === OversightRole.OversightAuditor
            ? auditors
            : [];

      setStaff(staffList);

      if (currentAssignment) {
        const currentStaffMember = staffList.find(
          (member) => member.id === currentAssignment.user.id,
        );
        if (currentStaffMember) {
          setSelectedStaff(currentStaffMember);
        }
      }
    } catch {
      setError(`Failed to load ${roleLabel}s`);
    } finally {
      setIsLoading(false);
    }
  }, [api, currentAssignment, props.role, roleLabel]);

  const handleAssignStaff = useCallback(async () => {
    if (selectedStaff) {
      if (currentAssignment && currentAssignment.user.id === selectedStaff.id) {
        modalRef.current?.hide({});
        return;
      }

      setIsAssigning(true);
      try {
        await api.createTrusteeOversightAssignment(props.trusteeId, selectedStaff.id, props.role);
        props.onAssignment(true);
        globalAlert?.success(
          `${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} assigned successfully`,
        );
        modalRef.current?.hide({});
      } catch (err) {
        globalAlert?.error(err instanceof Error ? err.message : `Failed to assign ${roleLabel}`);
      } finally {
        setIsAssigning(false);
      }
    }
  }, [
    selectedStaff,
    currentAssignment,
    props.trusteeId,
    props.role,
    props.onAssignment,
    api,
    globalAlert,
    roleLabel,
  ]);

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
            label={`Search for ${roleLabel} name to assign to this Trustee`}
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
    modalId: props.modalId,
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
      modalId={props.modalId}
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
