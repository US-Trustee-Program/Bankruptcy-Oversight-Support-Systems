import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/caseNumber';

interface TrusteeMatchRejectionModalProps {
  id: string;
  caseId: string;
  onConfirm: (reason?: string) => void;
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
  const { id, caseId, onConfirm, onCancel } = props;
  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
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
      label: 'Reject',
      onClick: () => {
        onConfirm(reasonRef.current?.value || undefined);
      },
      className: 'usa-button--secondary',
    },
    cancelButton: {
      label: 'Go back',
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
      className="confirm-modal"
      heading="Reject trustee match?"
      data-testid={`trustee-rejection-modal-${id}`}
      onClose={clearReason}
      content={
        <>
          This will reject the trustee match for case <strong>{getCaseNumber(caseId)}</strong>.
          <div>
            <label htmlFor={`rejection-reason-${id}`} className="usa-label">
              Reason for rejection (optional)
            </label>
            <div>
              <textarea
                id={`rejection-reason-${id}`}
                data-testid={`rejection-reason-input-${id}`}
                ref={reasonRef}
                className="rejection-reason-input usa-textarea"
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
