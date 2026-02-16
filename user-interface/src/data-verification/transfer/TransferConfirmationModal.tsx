import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { OrderStatus } from '@common/cams/orders';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/caseNumber';

export interface TransferConfirmationModalProps {
  id: string;
  fromCaseId: string;
  toCaseId?: string;
  fromDivisionName: string;
  toDivisionName?: string;
  fromCourtName: string;
  toCourtName?: string;
  onCancel?: () => void;
  onConfirm: (status: OrderStatus, reason?: string) => void;
}

type ShowOptionParams = {
  status: OrderStatus;
};

type ShowOptions = {
  status: OrderStatus;
  title: string;
};

export type TransferConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

function TransferConfirmationModal_(
  props: TransferConfirmationModalProps,
  ConfirmationModalRef: React.Ref<TransferConfirmationModalImperative>,
) {
  const {
    id,
    fromCaseId,
    toCaseId,
    fromDivisionName,
    toDivisionName,
    fromCourtName,
    toCourtName,
    onConfirm,
    onCancel,
  }: TransferConfirmationModalProps = props;

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason] = useState<string>('');
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    title: '',
  });

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
  }

  const actionButtonGroup = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: options.title,
      onClick: () => {
        onConfirm(options.status, reasonRef.current?.value);
      },
      className: options.status === 'rejected' ? 'usa-button--secondary' : '',
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

  function show(options: ShowOptionParams) {
    const title = options.status === 'approved' ? 'Verify' : 'Reject';

    setOptions({
      status: options.status,
      title,
    });

    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide();
    }
  }

  useImperativeHandle(ConfirmationModalRef, () => ({
    show,
    hide,
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={`confirm-modal-${id}`}
      className="confirm-modal"
      heading={`${options.title} case transfer?`}
      data-testid={`confirm-modal-${id}`}
      onClose={clearReason}
      content={
        <>
          This will {options.status === 'approved' ? 'verify' : 'stop'} the transfer of case{' '}
          <strong>{getCaseNumber(fromCaseId)}</strong> in{' '}
          <strong>
            {fromCourtName} ({fromDivisionName})
          </strong>
          {toCaseId && (
            <>
              {' '}
              to case <strong>{getCaseNumber(toCaseId)}</strong>
            </>
          )}
          {toCourtName && (
            <>
              {' '}
              in{' '}
              <strong>
                {toCourtName} ({toDivisionName})
              </strong>
            </>
          )}
          {'.'}
          {options.status === 'rejected' && (
            <div>
              <label htmlFor={`rejection-reason-${id}`} className="usa-label">
                Reason for rejection
              </label>
              <div>
                <textarea
                  id={`rejection-reason-${id}`}
                  data-testid={`rejection-reason-input-${id}`}
                  ref={reasonRef}
                  className="rejection-reason-input usa-textarea"
                  defaultValue={reason}
                ></textarea>
              </div>
            </div>
          )}
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

const TransferConfirmationModal = forwardRef(TransferConfirmationModal_);
export default TransferConfirmationModal;
