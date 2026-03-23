import './TrusteeMatchRejectionModal.scss';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
interface TrusteeMatchRejectionModalProps {
  id: string;
  onConfirm: (reason: string) => void;
  onCancel?: () => void;
}

export type TrusteeMatchRejectionModalImperative = {
  show: () => void;
  hide: () => void;
};

function TrusteeMatchRejectionModal_(
  props: TrusteeMatchRejectionModalProps,
  ref: React.Ref<TrusteeMatchRejectionModalImperative>,
) {
  const { id, onConfirm, onCancel } = props;
  const modalRef = useRef<ModalRefType>(null);
  const [reason, setReason] = useState('');

  function show() {
    setReason('');
    modalRef.current?.show({});
  }

  function hide() {
    modalRef.current?.hide();
  }

  useImperativeHandle(ref, () => ({ show, hide }));

  const actionButtonGroup = {
    modalId: `trustee-rejection-modal-${id}`,
    modalRef,
    submitButton: {
      label: 'Reject Trustee Confirmation Task',
      onClick: () => {
        hide();
        onConfirm(reason);
      },
      className: 'usa-button--secondary',
      disabled: reason.trim().length === 0,
    },
    cancelButton: {
      label: 'Cancel',
      onClick: () => {
        if (onCancel) onCancel();
        setReason('');
        hide();
      },
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={`trustee-rejection-modal-${id}`}
      className="confirm-modal trustee-rejection-modal"
      heading="Reject Trustee Confirmation Task"
      data-testid={`trustee-rejection-modal-${id}`}
      onClose={() => setReason('')}
      content={
        <>
          <p>Are you sure you want to reject this task to confirm a trustee?</p>
          <div>
            <label htmlFor={`rejection-reason-${id}`} className="usa-label">
              Reason for rejection{' '}
              <abbr title="required" className="usa-hint--required">
                *
              </abbr>
            </label>
            <div>
              <textarea
                id={`rejection-reason-${id}`}
                data-testid={`rejection-reason-input-${id}`}
                value={reason}
                className="rejection-reason-input usa-textarea"
                onChange={(e) => setReason(e.target.value)}
              ></textarea>
            </div>
          </div>
        </>
      }
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const TrusteeMatchRejectionModal = forwardRef(TrusteeMatchRejectionModal_);
export default TrusteeMatchRejectionModal;
