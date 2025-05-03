import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import useWindowSize from '@/lib/hooks/UseWindowSize';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { consolidationTypeMap } from '@/lib/utils/labels';
import { CaseAssignment } from '@common/cams/assignments';
import { CourtDivisionDetails } from '@common/cams/courts';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';

import './ConsolidationOrderModal.scss';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type ConfirmActionApprovalResults = {
  status: 'approved';
};

export type ConfirmActionPendingResults = {
  status: 'pending';
};

export type ConfirmActionRejectionResults = {
  rejectionReason?: string;
  status: 'rejected';
};

export type ConfirmActionResults =
  | ConfirmActionApprovalResults
  | ConfirmActionPendingResults
  | ConfirmActionRejectionResults;

export type ConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

export interface ConsolidationOrderModalProps {
  courts?: CourtDivisionDetails[];
  id: string;
  onCancel: () => void;
  onConfirm: (results: ConfirmActionResults) => void;
}

export type ShowOptionParams = {
  cases: ConsolidationOrderCase[];
  consolidationType?: ConsolidationType;
  leadCase: ConsolidationOrderCase;
  status: OrderStatus;
};

type ShowOptions = {
  heading: string;
  status: OrderStatus;
};

export function formatListForDisplay(attorneys: string[]) {
  if (attorneys.length === 0) {
    return '(unassigned)';
  } else if (attorneys.length < 3) {
    return attorneys.join(' and ');
  }
  return attorneys.slice(0, -1).join(', ') + ', and ' + attorneys[attorneys.length - 1];
}

function ConsolidationOrderModalComponent(
  props: ConsolidationOrderModalProps,
  ConfirmationModalRef: React.Ref<ConfirmationModalImperative>,
) {
  const { id, onCancel, onConfirm } = props;

  const [cases, setCases] = useState<ConsolidationOrderCase[]>([]);
  const [childCasesDivHeight, setChildCasesDivHeight] = useState<string>('');
  const [consolidationType, setConsolidationType] = useState<ConsolidationType>();
  const [leadCase, setLeadCase] = useState<ConsolidationOrderCase | null>(null);
  const [options, setOptions] = useState<ShowOptions>({
    heading: '',
    status: 'pending',
  });
  const [reason] = useState<string>('');

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const windowSize = useWindowSize();

  async function reject() {
    onConfirm({
      rejectionReason: reasonRef.current?.value,
      status: 'rejected',
    });
  }

  async function confirm() {
    onConfirm({
      status: 'approved',
    });
  }

  const rejectActionButtonGroup: SubmitCancelBtnProps = {
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        reset();
        onCancel();
      },
    },
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      className: 'usa-button--secondary',
      label: 'Reject',
      onClick: reject,
    },
  };

  const approveActionButtonGroup: SubmitCancelBtnProps = {
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        reset();
        onCancel();
      },
    },
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      closeOnClick: true,
      disabled: false,
      label: 'Verify',
      onClick: confirm,
    },
  };

  function show(options: ShowOptionParams) {
    setCases(options.cases);
    if (options.status === 'approved' && options.leadCase && options.consolidationType) {
      setConsolidationType(options.consolidationType);
      setLeadCase(options.leadCase);
      setOptions({
        heading: 'Verify Case Consolidation',
        status: options.status,
      });
    } else if (options.status === 'rejected') {
      modalRef.current?.buttons?.current?.disableSubmitButton(false);
      setOptions({
        heading: 'Reject Case Consolidation?',
        status: options.status,
      });
    }

    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function reset() {
    if (reasonRef.current) reasonRef.current.value = '';
  }

  function resizeModal() {
    // get height of modal top section above scrolling div
    const modalWindowPadding = 100;
    const outerModalMargin = 220;
    const minChildCasesDivHeight = 50;

    const modalContent = document.querySelector(`#${id}`);
    if (modalContent) {
      const consolidationTypeDiv = modalContent.querySelector(`.modal-consolidation-type`);
      const assignmentsListDiv = modalContent.querySelector(`.modal-assignments-list`);
      const button = modalContent.querySelector(`#${id}-submit-button`);

      if (consolidationTypeDiv && assignmentsListDiv && button) {
        const overallHeightOfModal =
          outerModalMargin +
          modalWindowPadding +
          consolidationTypeDiv.clientHeight +
          assignmentsListDiv.clientHeight +
          button.clientHeight;
        let finalSize = windowSize.height! - overallHeightOfModal;
        if (finalSize < minChildCasesDivHeight) finalSize = minChildCasesDivHeight;
        setChildCasesDivHeight(`${finalSize}px`);
      }
    }
  }

  function getAssigneeNames(assignees: CaseAssignment[]) {
    if (assignees?.length) return assignees.map((assignee) => assignee.name);
    else return [];
  }

  useEffect(() => {
    resizeModal();
  }, [windowSize]);

  useImperativeHandle(ConfirmationModalRef, () => ({
    hide: reset,
    show,
  }));

  function showRejectedContent() {
    return (
      <div>
        <div data-testid="modal-rejection-notice-container">
          The following cases will not be consolidated
        </div>
        <div
          className="modal-case-list-container"
          data-testid="modal-case-list-container"
          style={{ maxHeight: childCasesDivHeight }}
        >
          <ul className="usa-list--unstyled modal-case-list">
            {cases.map((bCase) => (
              <li key={bCase.caseId}>
                {getCaseNumber(bCase.caseId)} {bCase.caseTitle}
              </li>
            ))}
          </ul>
        </div>
        <div data-testid="modal-rejection-reason-container">
          <label htmlFor={`rejection-reason-${id}`}>Reason for rejection</label>
          <textarea
            className="rejection-reason-input usa-textarea"
            data-testid={`rejection-reason-input-${id}`}
            defaultValue={reason}
            id={`rejection-reason-${id}`}
            ref={reasonRef}
          ></textarea>
        </div>
      </div>
    );
  }

  function showApprovedContent() {
    return (
      <div>
        <div className="modal-consolidation-type">
          This will confirm the <strong>{consolidationTypeMap.get(consolidationType!)}</strong> of
          the following cases.
        </div>
        <div
          className="modal-case-list-container"
          data-testid="modal-case-list-container"
          style={{ maxHeight: childCasesDivHeight }}
        >
          <ul className="usa-list--unstyled modal-case-list">
            {cases.map((bCase) => (
              <li key={bCase.caseId}>
                {getCaseNumber(bCase.caseId)} {bCase.caseTitle}
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-label={
            `with ${getCaseNumber(leadCase?.caseId)} as the Lead Case. All cases will be ` +
            `assigned to ${formatListForDisplay(getAssigneeNames(leadCase?.attorneyAssignments ?? []))}.`
          }
          className="modal-assignments-list"
        >
          with <strong>{getCaseNumber(leadCase?.caseId)}</strong> as the Lead Case. All cases will
          be assigned to{' '}
          <strong>
            {formatListForDisplay(getAssigneeNames(leadCase?.attorneyAssignments ?? []))}
          </strong>
          .
        </div>
      </div>
    );
  }

  return (
    <Modal
      actionButtonGroup={
        options.status === 'approved' ? approveActionButtonGroup : rejectActionButtonGroup
      }
      className={`confirm-modal consolidation-order-modal`}
      content={
        <>
          {options.status === 'rejected' && showRejectedContent()}
          {options.status === 'approved' && showApprovedContent()}
        </>
      }
      data-testid={`confirm-modal-${id}`}
      heading={`${options.heading}`}
      modalId={id}
      onClose={() => {
        // reset();
        onCancel();
      }}
      ref={modalRef}
    ></Modal>
  );
}

export const ConsolidationOrderModal = forwardRef(ConsolidationOrderModalComponent);
