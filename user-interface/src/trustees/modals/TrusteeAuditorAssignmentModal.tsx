import React, { forwardRef, useRef, useState, useCallback } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Staff } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import './TrusteeAuditorAssignmentModal.scss';

interface TrusteeAuditorAssignmentModalProps {
  modalId: string;
  trusteeId: string;
  onAssignment: (isAssigned: boolean) => void;
}

export interface TrusteeAuditorAssignmentModalRef extends ModalRefType {
  show: (currentAssignment?: TrusteeOversightAssignment) => void;
  hide: () => void;
}

const TrusteeAuditorAssignmentModal = forwardRef<
  TrusteeAuditorAssignmentModalRef,
  TrusteeAuditorAssignmentModalProps
>((props, ref) => {
  const [auditors, setAuditors] = useState<Staff[]>([]);
  const [selectedAuditor, setSelectedAuditor] = useState<Staff | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<TrusteeOversightAssignment | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const modalRef = useRef<ModalRefType>(null);
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  // Handle external ref
  React.useImperativeHandle(ref, () => ({
    show: (assignment?: TrusteeOversightAssignment) => {
      setCurrentAssignment(assignment ?? null);
      setSelectedAuditor(null); // Reset selection
      modalRef.current?.show({});
      loadAuditors();
    },
    hide: () => {
      modalRef.current?.hide({});
      setSelectedAuditor(null);
      setCurrentAssignment(null);
    },
  }));

  const loadAuditors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getAuditors();
      const auditorList = response.data ?? [];
      setAuditors(auditorList);

      if (currentAssignment) {
        const currentAuditor = auditorList.find(
          (auditor: Staff) => auditor.id === currentAssignment.user.id,
        );
        if (currentAuditor) {
          setSelectedAuditor(currentAuditor);
        }
      }
    } catch {
      setError('Failed to load auditors');
    } finally {
      setIsLoading(false);
    }
  }, [api, currentAssignment]);

  const handleAssignAuditor = useCallback(async () => {
    if (selectedAuditor) {
      if (currentAssignment && currentAssignment.user.id === selectedAuditor.id) {
        modalRef.current?.hide({});
        return;
      }

      setIsAssigning(true);
      try {
        await api.createTrusteeOversightAssignment(props.trusteeId, selectedAuditor.id);
        props.onAssignment(true);
        globalAlert?.success('Auditor assigned successfully');
        modalRef.current?.hide({});
      } catch (err) {
        globalAlert?.error(err instanceof Error ? err.message : 'Failed to assign auditor');
      } finally {
        setIsAssigning(false);
      }
    }
  }, [selectedAuditor, currentAssignment, props.trusteeId, props.onAssignment, api, globalAlert]);

  const modalContent = (
    <div
      className="trustee-auditor-assignment-modal-content"
      data-testid="auditor-assignment-modal-content"
    >
      {isLoading && <LoadingSpinner caption="Loading auditors..." />}
      {error && <Alert type={UswdsAlertStyle.Error}>{error}</Alert>}
      {!isLoading && !error && (
        <div className="auditor-selection-section">
          <ComboBox
            id="auditor-search"
            name="auditor-search"
            label="Search for auditor name to assign to this Trustee"
            options={auditors.map((auditor) => ({
              value: auditor.id,
              label: auditor.name,
            }))}
            selections={
              selectedAuditor ? [{ value: selectedAuditor.id, label: selectedAuditor.name }] : []
            }
            onUpdateSelection={(selectedOptions) => {
              const selectedOption = selectedOptions[0];
              if (selectedOption) {
                const auditor = auditors.find((a) => a.id === selectedOption.value);
                setSelectedAuditor(auditor ?? null);
              } else {
                setSelectedAuditor(null);
              }
            }}
            placeholder="Search for an auditor..."
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
      label: isEditMode ? 'Edit Auditor' : 'Add Auditor',
      disabled: !selectedAuditor || isAssigning,
      onClick: handleAssignAuditor,
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
      heading={isEditMode ? 'Edit Auditor' : 'Add Auditor'}
      content={modalContent}
      actionButtonGroup={actionButtonGroup}
    />
  );
});

TrusteeAuditorAssignmentModal.displayName = 'TrusteeAuditorAssignmentModal';

export default TrusteeAuditorAssignmentModal;
