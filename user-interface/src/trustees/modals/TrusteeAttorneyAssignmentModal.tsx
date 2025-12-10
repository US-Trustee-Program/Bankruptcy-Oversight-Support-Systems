import React, { forwardRef, useRef, useState, useCallback, useEffect } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { AttorneyUser } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox from '@/lib/components/combobox/ComboBox';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import './TrusteeAttorneyAssignmentModal.scss';

interface TrusteeAttorneyAssignmentModalProps {
  modalId: string;
  trusteeId: string;
  attorneys: AttorneyUser[];
  currentAssignment?: TrusteeOversightAssignment;
  onAssignment: (isAssigned: boolean) => void;
}

export interface TrusteeAttorneyAssignmentModalRef extends ModalRefType {
  show: () => void;
  hide: () => void;
}

const TrusteeAttorneyAssignmentModal = forwardRef<
  TrusteeAttorneyAssignmentModalRef,
  TrusteeAttorneyAssignmentModalProps
>((props, ref) => {
  const { attorneys, currentAssignment, modalId, trusteeId, onAssignment } = props;
  const [selectedAttorney, setSelectedAttorney] = useState<AttorneyUser | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const modalRef = useRef<ModalRefType>(null);
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  useEffect(() => {
    if (currentAssignment) {
      const attorney = attorneys.find((a) => a.id === currentAssignment.user.id);
      setSelectedAttorney(attorney ?? null);
    } else {
      setSelectedAttorney(null);
    }
  }, [currentAssignment, attorneys]);

  React.useImperativeHandle(ref, () => ({
    show: () => {
      modalRef.current?.show({});
    },
    hide: () => {
      modalRef.current?.hide({});
    },
  }));

  const handleAssignAttorney = useCallback(async () => {
    if (selectedAttorney) {
      if (currentAssignment && currentAssignment.user.id === selectedAttorney.id) {
        modalRef.current?.hide({});
        return;
      }

      setIsAssigning(true);
      try {
        await api.createTrusteeOversightAssignment(
          trusteeId,
          selectedAttorney.id,
          OversightRole.OversightAttorney,
        );
        onAssignment(true);
        globalAlert?.success('Attorney assigned successfully');
        modalRef.current?.hide({});
      } catch (err) {
        globalAlert?.error(err instanceof Error ? err.message : 'Failed to assign attorney');
      } finally {
        setIsAssigning(false);
      }
    }
  }, [selectedAttorney, currentAssignment, onAssignment, trusteeId, api, globalAlert]);

  const modalContent = (
    <div
      className="trustee-attorney-assignment-modal-content"
      data-testid="attorney-assignment-modal-content"
    >
      <div className="attorney-selection-section">
        <ComboBox
          id="attorney-search"
          name="attorney-search"
          label="Search for attorney to assign to this Trustee"
          options={attorneys.map((attorney) => ({
            value: attorney.id,
            label: attorney.name,
          }))}
          selections={
            selectedAttorney ? [{ value: selectedAttorney.id, label: selectedAttorney.name }] : []
          }
          onUpdateSelection={(selectedOptions) => {
            const selectedOption = selectedOptions[0];
            if (selectedOption) {
              const attorney = attorneys.find((a) => a.id === selectedOption.value);
              setSelectedAttorney(attorney ?? null);
            } else {
              setSelectedAttorney(null);
            }
          }}
          placeholder="Search for an attorney..."
        />
      </div>
    </div>
  );

  const isEditMode = !!currentAssignment;
  const actionButtonGroup = {
    modalId: modalId,
    modalRef: modalRef,
    submitButton: {
      label: isEditMode ? 'Edit Attorney' : 'Add Attorney',
      disabled: !selectedAttorney || isAssigning,
      onClick: handleAssignAttorney,
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
      heading={isEditMode ? 'Edit Attorney' : 'Add Attorney'}
      content={modalContent}
      actionButtonGroup={actionButtonGroup}
    />
  );
});

TrusteeAttorneyAssignmentModal.displayName = 'TrusteeAttorneyAssignmentModal';

export default TrusteeAttorneyAssignmentModal;
