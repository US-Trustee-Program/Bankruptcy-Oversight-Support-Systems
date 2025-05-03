import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { OrderStatus } from '@common/cams/orders';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export type TransferConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

export interface TransferConfirmationModalProps {
  fromCaseId: string;
  fromCourtName: string;
  fromDivisionName: string;
  id: string;
  onCancel?: () => void;
  onConfirm: (status: OrderStatus, reason?: string) => void;
  toCaseId?: string;
  toCourtName?: string;
  toDivisionName?: string;
}

type ShowOptionParams = {
  status: OrderStatus;
};

type ShowOptions = {
  status: OrderStatus;
  title: string;
};

function TransferConfirmationModalComponent(
  props: TransferConfirmationModalProps,
  ConfirmationModalRef: React.Ref<TransferConfirmationModalImperative>,
) {
  const {
    fromCaseId,
    fromCourtName,
    fromDivisionName,
    id,
    onCancel,
    onConfirm,
    toCaseId,
    toCourtName,
    toDivisionName,
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
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        if (onCancel) onCancel();
        clearReason();
        hide();
      },
    },
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      className: options.status === 'rejected' ? 'usa-button--secondary' : '',
      label: options.title,
      onClick: () => {
        onConfirm(options.status, reasonRef.current?.value);
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
      modalRef.current?.hide({});
    }
  }

  useImperativeHandle(ConfirmationModalRef, () => ({
    hide,
    show,
  }));

  return (
    <Modal
      actionButtonGroup={actionButtonGroup}
      className="confirm-modal"
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
              <label className="usa-label" htmlFor={`rejection-reason-${id}`}>
                Reason for rejection
              </label>
              <div>
                <textarea
                  className="rejection-reason-input usa-textarea"
                  data-testid={`rejection-reason-input-${id}`}
                  defaultValue={reason}
                  id={`rejection-reason-${id}`}
                  ref={reasonRef}
                ></textarea>
              </div>
            </div>
          )}
        </>
      }
      data-testid={`confirm-modal-${id}`}
      heading={`${options.title} case transfer?`}
      modalId={`confirm-modal-${id}`}
      onClose={clearReason}
      ref={modalRef}
    ></Modal>
  );
}

export const TransferConfirmationModal = forwardRef(TransferConfirmationModalComponent);
