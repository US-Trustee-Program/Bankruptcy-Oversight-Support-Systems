import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import useWindowSize from '@/lib/hooks/UseWindowSize';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { consolidationTypeMap } from '@/lib/utils/labels';
import { CaseAssignment } from '@common/cams/assignments';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './ConsolidationOrderModal.scss';
import { CourtDivisionDetails } from '@common/cams/courts';

type ConfirmActionPendingResults = {
  status: 'pending';
};

type ConfirmActionRejectionResults = {
  status: 'rejected';
  rejectionReason?: string;
};

type ConfirmActionApprovalResults = {
  status: 'approved';
};

export type ConfirmActionResults =
  | ConfirmActionApprovalResults
  | ConfirmActionRejectionResults
  | ConfirmActionPendingResults;

export interface ConsolidationOrderModalProps {
  id: string;
  onCancel: () => void;
  onConfirm: (results: ConfirmActionResults) => void;
  courts?: CourtDivisionDetails[];
}

export type ShowOptionParams = {
  status: OrderStatus;
  cases: ConsolidationOrderCase[];
  leadCase: ConsolidationOrderCase;
  consolidationType?: ConsolidationType;
};

type ShowOptions = {
  status: OrderStatus;
  heading: string;
};

export type ConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

export function formatListForDisplay(attorneys: string[]) {
  if (attorneys.length === 0) {
    return '(unassigned)';
  } else if (attorneys.length < 3) {
    return attorneys.join(' and ');
  }
  return attorneys.slice(0, -1).join(', ') + ', and ' + attorneys[attorneys.length - 1];
}

function ConsolidationOrderModal_(
  props: ConsolidationOrderModalProps,
  ConfirmationModalRef: React.Ref<ConfirmationModalImperative>,
) {
  const { id, onConfirm, onCancel } = props;

  const [cases, setCases] = useState<ConsolidationOrderCase[]>([]);
  const [memberCasesDivHeight, setMemberCasesDivHeight] = useState<string>('');
  const [consolidationType, setConsolidationType] = useState<ConsolidationType>();
  const [leadCase, setLeadCase] = useState<ConsolidationOrderCase | null>(null);
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    heading: '',
  });
  const [reason] = useState<string>('');

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const windowSize = useWindowSize();

  async function reject() {
    onConfirm({
      status: 'rejected',
      rejectionReason: reasonRef.current?.value,
    });
  }

  async function confirm() {
    onConfirm({
      status: 'approved',
    });
  }

  const rejectActionButtonGroup: SubmitCancelBtnProps = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: 'Reject',
      onClick: reject,
      className: 'usa-button--secondary',
    },
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        reset();
        onCancel();
      },
    },
  };

  const approveActionButtonGroup: SubmitCancelBtnProps = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: 'Verify',
      onClick: confirm,
      closeOnClick: true,
      disabled: false,
    },
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        reset();
        onCancel();
      },
    },
  };

  function show(options: ShowOptionParams) {
    setCases(options.cases);
    if (options.status === 'approved' && options.leadCase && options.consolidationType) {
      setConsolidationType(options.consolidationType);
      setLeadCase(options.leadCase);
      setOptions({
        status: options.status,
        heading: 'Verify Case Consolidation',
      });
    } else if (options.status === 'rejected') {
      modalRef.current?.buttons?.current?.disableSubmitButton(false);
      setOptions({
        status: options.status,
        heading: 'Reject Case Consolidation?',
      });
    }

    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function reset() {
    if (reasonRef.current) {
      reasonRef.current.value = '';
    }
  }

  function resizeModal() {
    // get height of modal top section above scrolling div
    const modalWindowPadding = 100;
    const outerModalMargin = 220;
    const minMemberCasesDivHeight = 50;

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
        const finalSize = Math.max(
          windowSize.height! - overallHeightOfModal,
          minMemberCasesDivHeight,
        );
        setMemberCasesDivHeight(`${finalSize}px`);
      }
    }
  }

  function getAssigneeNames(assignees: CaseAssignment[]) {
    if (assignees?.length) {
      return assignees.map((assignee) => assignee.name);
    } else {
      return [];
    }
  }

  useEffect(() => {
    resizeModal();
  }, [windowSize]);

  useImperativeHandle(ConfirmationModalRef, () => ({
    show,
    hide: reset,
  }));

  function showRejectedContent() {
    return (
      <div>
        <div data-testid="modal-rejection-notice-container">
          The following cases will not be consolidated
        </div>
        <div
          data-testid="modal-case-list-container"
          className="modal-case-list-container"
          style={{ maxHeight: memberCasesDivHeight }}
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
            id={`rejection-reason-${id}`}
            data-testid={`rejection-reason-input-${id}`}
            ref={reasonRef}
            className="rejection-reason-input usa-textarea"
            defaultValue={reason}
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
          data-testid="modal-case-list-container"
          className="modal-case-list-container"
          style={{ maxHeight: memberCasesDivHeight }}
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
          className="modal-assignments-list"
          aria-label={
            `with ${getCaseNumber(leadCase?.caseId)} as the Lead Case. All cases will be ` +
            `assigned to ${formatListForDisplay(getAssigneeNames(leadCase?.attorneyAssignments ?? []))}.`
          }
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
      ref={modalRef}
      modalId={id}
      className={`confirm-modal consolidation-order-modal`}
      heading={`${options.heading}`}
      data-testid={`confirm-modal-${id}`}
      onClose={() => {
        onCancel();
      }}
      content={
        <>
          {options.status === 'rejected' && showRejectedContent()}
          {options.status === 'approved' && showApprovedContent()}
        </>
      }
      actionButtonGroup={
        options.status === 'approved' ? approveActionButtonGroup : rejectActionButtonGroup
      }
    ></Modal>
  );
}

const ConsolidationOrderModal = forwardRef(ConsolidationOrderModal_);
export default ConsolidationOrderModal;
