import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import useWindowSize from '@/lib/hooks/UseWindowSize';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { consolidationTypeMap } from '@/lib/utils/labels';
import { CaseAssignment } from '@common/cams/assignments';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './ConsolidationOrderModal.scss';
import { OfficeDetails } from '@common/cams/courts';

export type ConfirmActionPendingResults = {
  status: 'pending';
};

export type ConfirmActionRejectionResults = {
  status: 'rejected';
  rejectionReason?: string;
};

export type ConfirmActionApprovalResults = {
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
  courts?: OfficeDetails[];
}

type ShowOptionParams = {
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

//export async function getCaseAssignments(caseId: string) {
//  return useGenericApi().get<Array<CaseAssignment>>(`/case-assignments/${caseId}`);
//}
//
//export async function getCaseAssociations(caseId: string) {
//  return useGenericApi().get<Array<Consolidation>>(`/cases/${caseId}/associated`);
//}
//
//export function getUniqueDivisionCodeOrUndefined(cases: CaseSummary[]) {
//  const divisionCodeSet = cases.reduce((set, bCase) => {
//    set.add(bCase.courtDivisionCode);
//    return set;
//  }, new Set<string>());
//  return divisionCodeSet.size === 1 ? Array.from<string>(divisionCodeSet)[0] : undefined;
//}

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
  const { id, onConfirm, onCancel } = props;

  const [cases, setCases] = useState<ConsolidationOrderCase[]>([]);
  const [childCasesDivHeight, setChildCasesDivHeight] = useState<string>('');
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
      // modalRef.current?.buttons?.current?.disableSubmitButton(false);
      setConsolidationType(options.consolidationType);
      setLeadCase(options.leadCase);
      setOptions({
        status: options.status,
        heading: 'Approve Case Consolidation',
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
    if (reasonRef.current) reasonRef.current.value = '';
    //   setConsolidationType(null);
    //=   administrativeConsolidationRef.current?.checked(false);
    //=   substantiveConsolidationRef.current?.checked(false);
    //   leadCaseDivisionRef.current?.clearValue();
    //   setLeadCaseNumber('');
    //   leadCaseNumberRef.current?.clearValue();
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
          <label>Reason for rejection</label>
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
          This will confirm the{' '}
          <span className="text-bold">{consolidationTypeMap.get(consolidationType!)}</span> of
        </div>
        <div
          data-testid="modal-case-list-container"
          className="modal-case-list-container"
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
        <div className="modal-assignments-list">
          with <span className="text-bold">{getCaseNumber(leadCase?.caseId)}</span> as the Lead
          Case. All cases will be assigned to{' '}
          <span className="text-bold">
            {formatListForDisplay(getAssigneeNames(leadCase?.attorneyAssignments ?? []))}
          </span>
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
        // reset();
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

export const ConsolidationOrderModal = forwardRef(ConsolidationOrderModalComponent);
