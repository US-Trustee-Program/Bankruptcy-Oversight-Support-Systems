import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

export type InactivationWarningModalRef = {
  show: (trusteeCount: number) => void;
  hide: () => void;
};

type InactivationWarningModalProps = {
  modalId: string;
  entityLabel: string;
  onProceed: () => void;
  onCancel: () => void;
};

export const InactivationWarningModal = forwardRef<
  InactivationWarningModalRef,
  InactivationWarningModalProps
>(function InactivationWarningModal({ modalId, entityLabel, onProceed, onCancel }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const [trusteeCount, setTrusteeCount] = useState(0);

  useImperativeHandle(ref, () => ({
    show(count: number) {
      setTrusteeCount(count);
      modalRef.current?.show({});
    },
    hide() {
      modalRef.current?.hide();
    },
  }));

  function handleProceed() {
    modalRef.current?.hide();
    onProceed();
  }

  function handleCancel() {
    modalRef.current?.hide();
    onCancel();
  }

  const trusteeText =
    trusteeCount === 1
      ? '1 trustee is currently using this'
      : `${trusteeCount} trustees are currently using this`;

  const actionButtonGroup = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Proceed Anyway',
      onClick: handleProceed,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Cancel',
      onClick: handleCancel,
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading="Are you sure you want to inactivate?"
      actionButtonGroup={actionButtonGroup}
      content={
        <div>
          <p data-testid="warning-message">
            {trusteeText} {entityLabel}.
          </p>
          <p>You can still proceed, but those trustees will retain this association.</p>
        </div>
      }
    />
  );
});
