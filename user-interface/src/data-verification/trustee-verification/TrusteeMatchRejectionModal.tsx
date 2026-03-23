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
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [hasReason, setHasReason] = useState(false);

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
    setHasReason(false);
  }

  function show() {
    clearReason();
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
        const reason = reasonRef.current?.value ?? '';
        hide();
        onConfirm(reason);
      },
      className: 'usa-button--secondary',
      disabled: !hasReason,
    },
    cancelButton: {
      label: 'Cancel',
      onClick: () => {
        if (onCancel) onCancel();
        clearReason();
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
      onClose={clearReason}
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
                ref={reasonRef}
                className="rejection-reason-input usa-textarea"
                onChange={(e) => setHasReason(e.target.value.trim().length > 0)}
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
