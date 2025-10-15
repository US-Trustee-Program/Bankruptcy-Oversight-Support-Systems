import React, { forwardRef, useRef, useState, useCallback } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { AttorneyUser } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import ComboBox from '@/lib/components/combobox/ComboBox';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import './TrusteeAttorneyAssignmentModal.scss';

interface TrusteeAttorneyAssignmentModalProps {
  modalId: string;
  trusteeId: string;
  onAssignmentCreated: (assignment: TrusteeOversightAssignment) => void;
}

export interface TrusteeAttorneyAssignmentModalRef extends ModalRefType {
  show: () => void;
  hide: () => void;
}

const TrusteeAttorneyAssignmentModal = forwardRef<
  TrusteeAttorneyAssignmentModalRef,
  TrusteeAttorneyAssignmentModalProps
>((props, ref) => {
  const [attorneys, setAttorneys] = useState<AttorneyUser[]>([]);
  const [selectedAttorney, setSelectedAttorney] = useState<AttorneyUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const modalRef = useRef<ModalRefType>(null);
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  // Handle external ref
  React.useImperativeHandle(ref, () => ({
    show: () => {
      modalRef.current?.show({});
      loadAttorneys();
    },
    hide: () => {
      modalRef.current?.hide({});
      setSelectedAttorney(null);
    },
  }));

  const loadAttorneys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getAttorneys();
      setAttorneys(response.data || []);
    } catch (_err) {
      setError('Failed to load attorneys');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  const handleAssignAttorney = useCallback(async () => {
    if (selectedAttorney) {
      setIsAssigning(true);
      try {
        const response = await api.createTrusteeOversightAssignment(
          props.trusteeId,
          selectedAttorney.id,
        );
        if (response && response.data) {
          props.onAssignmentCreated(response.data);
          globalAlert?.success('Attorney assigned successfully');
          modalRef.current?.hide({});
        }
      } catch (err) {
        globalAlert?.error(err instanceof Error ? err.message : 'Failed to assign attorney');
      } finally {
        setIsAssigning(false);
      }
    }
  }, [selectedAttorney, props.trusteeId, props.onAssignmentCreated, api, globalAlert]);

  const modalContent = (
    <div
      className="trustee-attorney-assignment-modal-content"
      data-testid="attorney-assignment-modal-content"
    >
      {isLoading ? (
        <LoadingSpinner caption="Loading attorneys..." />
      ) : error ? (
        <Alert type={UswdsAlertStyle.Error}>{error}</Alert>
      ) : (
        <>
          <div className="attorney-selection-section">
            <ComboBox
              id="attorney-search"
              name="attorney-search"
              label="Search for attorney name to assign to this Trustee"
              options={attorneys.map((attorney) => ({
                value: attorney.id,
                label: attorney.name,
              }))}
              onUpdateSelection={(selectedOptions) => {
                const selectedOption = selectedOptions[0];
                if (selectedOption) {
                  const attorney = attorneys.find((a) => a.id === selectedOption.value);
                  setSelectedAttorney(attorney || null);
                } else {
                  setSelectedAttorney(null);
                }
              }}
              placeholder="Search for an attorney..."
              required
            />
          </div>
        </>
      )}
    </div>
  );

  // Modal configuration
  const actionButtonGroup = {
    modalId: props.modalId,
    modalRef: modalRef,
    submitButton: {
      label: `Add Attorney`,
      disabled: !selectedAttorney || isAssigning,
      onClick: handleAssignAttorney,
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
      heading={`Add Attorney`}
      content={modalContent}
      actionButtonGroup={actionButtonGroup}
    />
  );
});

TrusteeAttorneyAssignmentModal.displayName = 'TrusteeAttorneyAssignmentModal';

export default TrusteeAttorneyAssignmentModal;
