import { getOfficeList, validateCaseNumberInput } from '@/data-verification/dataVerificationHelper';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Input from '@/lib/components/uswds/Input';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import Radio from '@/lib/components/uswds/Radio';
import { useGenericApi } from '@/lib/hooks/UseApi';
import useFeatureFlags, { CONSOLIDATIONS_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import useWindowSize from '@/lib/hooks/UseWindowSize';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { consolidationType as consolidationTypeMap } from '@/lib/utils/labels';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseSummary } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './ConsolidationOrderModal.scss';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import CamsSelect, {
  CamsSelectOptionList,
  SearchableSelectOption,
} from '@/lib/components/CamsSelect';
import { FormRequirementsNotice } from '@/lib/components/uswds/FormRequirementsNotice';
import { Consolidation } from '@common/cams/events';

export type ConfirmActionPendingResults = {
  status: 'pending';
};

export type ConfirmActionRejectionResults = {
  status: 'rejected';
  rejectionReason?: string;
};

export type ConfirmActionApprovalResults = {
  status: 'approved';
  leadCaseSummary: CaseSummary;
  consolidationType: ConsolidationType;
};

export type ConfirmActionResults =
  | ConfirmActionApprovalResults
  | ConfirmActionRejectionResults
  | ConfirmActionPendingResults;

export interface ConsolidationOrderModalProps {
  id: string;
  courts: OfficeDetails[];
  onCancel: () => void;
  onConfirm: (results: ConfirmActionResults) => void;
}

type ConfirmationSteps = 'pick-lead-case' | 'confirm';

type ShowOptionParams = {
  status: OrderStatus;
  cases: ConsolidationOrderCase[];
};

type ShowOptions = {
  status: OrderStatus;
  heading: string;
};

export type ConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

export async function getCaseSummary(caseId: string) {
  return useGenericApi().get<CaseSummary>(`/cases/${caseId}/summary`);
}

export async function getCaseAssignments(caseId: string) {
  return useGenericApi().get<Array<CaseAssignment>>(`/case-assignments/${caseId}`);
}

export async function getCaseAssociations(caseId: string) {
  return useGenericApi().get<Array<Consolidation>>(`/cases/${caseId}/associated`);
}

export async function fetchLeadCaseAttorneys(leadCaseId: string) {
  const caseAssignments: CaseAssignment[] = await getCaseAssignments(leadCaseId);
  return caseAssignments.map((assignment) => assignment.name);
}

export function getUniqueDivisionCodeOrUndefined(cases: CaseSummary[]) {
  const divisionCodeSet = cases.reduce((set, bCase) => {
    set.add(bCase.courtDivisionCode);
    return set;
  }, new Set<string>());
  return divisionCodeSet.size === 1 ? Array.from<string>(divisionCodeSet)[0] : undefined;
}

export function formatListforDisplay(attorneys: string[]) {
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
  const [consolidationType, setConsolidationType] = useState<ConsolidationType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [leadCaseAttorneys, setLeadCaseAttorneys] = useState<string[]>([]);
  const [leadCaseDivisionCode, setLeadCaseDivisionCode] = useState<string>('');
  const [leadCaseNumber, setLeadCaseNumber] = useState<string>('');
  const [leadCaseNumberError, setLeadCaseNumberError] = useState<string>('');
  const [leadCaseSummary, setLeadCaseSummary] = useState<CaseSummary | null>(null);
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    heading: '',
  });
  const [reason] = useState<string>('');
  const [step, setStep] = useState<ConfirmationSteps>('pick-lead-case');

  const administrativeConsolidationRef = useRef<RadioRef>(null);
  const leadCaseDivisionRef = useRef<InputRef>(null);
  const leadCaseNumberRef = useRef<InputRef>(null);
  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const substantiveConsolidationRef = useRef<RadioRef>(null);

  const featureFlags = useFeatureFlags();
  const windowSize = useWindowSize();

  async function reject() {
    onConfirm({
      status: 'rejected',
      rejectionReason: reasonRef.current?.value,
    });
  }

  async function confirmStep2() {
    onConfirm({
      status: 'approved',
      leadCaseSummary: leadCaseSummary!,
      consolidationType: consolidationType!,
    });
  }

  async function confirmStep1() {
    setStep('confirm');
    setOptions({
      ...options,
      heading: 'Consolidate Cases',
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
      label: step === 'pick-lead-case' ? 'Continue' : 'Verify',
      onClick: step === 'pick-lead-case' ? confirmStep1 : confirmStep2,
      closeOnClick: step !== 'pick-lead-case',
      disabled: step === 'pick-lead-case',
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
    switch (options.status) {
      case 'approved':
        modalRef.current?.buttons?.current?.disableSubmitButton(true);
        setOptions({
          status: options.status,
          heading: 'Additional Consolidation Information',
        });
        break;

      case 'rejected':
        modalRef.current?.buttons?.current?.disableSubmitButton(false);
        setOptions({
          status: options.status,
          heading: 'Reject Case Consolidation?',
        });
        break;
    }
    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function reset() {
    if (reasonRef.current) reasonRef.current.value = '';
    setConsolidationType(null);
    administrativeConsolidationRef.current?.checked(false);
    substantiveConsolidationRef.current?.checked(false);
    setLeadCaseDivisionCode('');
    leadCaseDivisionRef.current?.clearValue();
    setLeadCaseNumber('');
    leadCaseNumberRef.current?.clearValue();
    setLeadCaseSummary(null);
    setLeadCaseNumberError('');
    setStep('pick-lead-case');
  }

  function handleSelectConsolidationType(ev: React.ChangeEvent<HTMLInputElement>) {
    setConsolidationType(ev.target.value as ConsolidationType);
  }

  async function handleLeadCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { caseNumber, joinedInput } = validateCaseNumberInput(ev);
    leadCaseNumberRef.current?.setValue(joinedInput);
    if (caseNumber) {
      setLeadCaseNumber(caseNumber);
    } else {
      setLeadCaseNumber('');
    }
  }

  function handleSelectLeadCaseCourt(ev: CamsSelectOptionList) {
    setLeadCaseDivisionCode((ev as SearchableSelectOption)?.value || '');
  }

  function resizeModal() {
    // get height of modal top section above scrolling div
    const modalWindowPadding = 100;
    const outerModalMargin = 220;
    const minChildCasesDivHeight = 50;

    const modalContent = document.querySelector(`#${id}`);
    if (modalContent) {
      const consolidationTypeDiv = modalContent.querySelector(`.modal-step2-consolidation-type`);
      const assignmentsListDiv = modalContent.querySelector(`.modal-step2-assignments-list`);
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

  function getCurrentLeadCaseId() {
    return leadCaseDivisionCode && leadCaseNumber
      ? `${leadCaseDivisionCode}-${leadCaseNumber}`
      : undefined;
  }

  function disableLeadCaseForm(disable: boolean) {
    leadCaseNumberRef.current?.disable(disable);
    leadCaseDivisionRef.current?.disable(disable);
  }

  useEffect(() => {
    const leadCaseId = getCurrentLeadCaseId();
    if (leadCaseId && !!consolidationType) {
      disableLeadCaseForm(true);
      setIsLoading(true);
      setLeadCaseNumberError('');
      getCaseSummary(leadCaseId)
        .then((caseSummary) => {
          getCaseAssociations(leadCaseId)
            .then((associations) => {
              // is the case a child case?
              const isConsolidationChildCase = associations
                .filter((reference) => reference.caseId === leadCaseId)
                .reduce((isIt, reference) => {
                  return isIt || reference.documentType === 'CONSOLIDATION_TO';
                }, false);
              if (isConsolidationChildCase) {
                const message = 'Case is a child case of another consolidation.';
                setLeadCaseNumberError(message);
                setIsLoading(false);
                disableLeadCaseForm(false);
                return;
              }
              fetchLeadCaseAttorneys(leadCaseId).then((attorneys) => {
                setLeadCaseSummary(caseSummary);
                setLeadCaseAttorneys(attorneys);
                setIsLoading(false);
                modalRef.current?.buttons?.current?.disableSubmitButton(false);
                disableLeadCaseForm(false);
              });
            })
            .catch((error) => {
              const message =
                'Cannot verify lead case is not part of another consolidation.' + error.message;
              setLeadCaseNumberError(message);
              setIsLoading(false);
              disableLeadCaseForm(false);
            });
        })
        .catch((error) => {
          // Brittle way to determine if we have encountred a 404...
          const isNotFound = (error.message as string).startsWith('404');
          const message = isNotFound ? 'Lead case not found.' : 'Cannot verify lead case number.';
          setLeadCaseNumberError(message);
          setIsLoading(false);
          disableLeadCaseForm(false);
        });
    }
    modalRef.current?.buttons?.current?.disableSubmitButton(true);
  }, [consolidationType, leadCaseNumber, leadCaseDivisionCode]);

  useEffect(() => {
    if (step !== 'pick-lead-case') {
      resizeModal();
    }
  }, [windowSize, step]);

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

  function showApprovedContentStep1() {
    return (
      <div>
        <div className="header-text">
          <p>
            Specify the type of consolidation and the lead case to continue. You may optionally
            assign the consolidated cases to a staff member.
          </p>
          <FormRequirementsNotice />
        </div>
        {featureFlags[CONSOLIDATIONS_ENABLED] && (
          <RadioGroup
            className="consolidation-type-container"
            label="Consolidation Type"
            required={true}
          >
            <Radio
              id={`radio-administrative-${id}`}
              name="consolidation-type"
              value="administrative"
              onChange={handleSelectConsolidationType}
              ref={administrativeConsolidationRef}
              label={consolidationTypeMap.get('administrative')!}
              required={true}
            />
            <Radio
              id={`radio-substantive-${id}`}
              name="consolidation-type"
              value="substantive"
              onChange={handleSelectConsolidationType}
              ref={substantiveConsolidationRef}
              label={consolidationTypeMap.get('substantive')!}
              required={true}
            />
          </RadioGroup>
        )}
        <div className="lead-case-court-container">
          <CamsSelect
            id={'lead-case-court'}
            required={true}
            options={getOfficeList(props.courts)}
            onChange={handleSelectLeadCaseCourt}
            ref={leadCaseDivisionRef}
            label="Lead Case Court"
            value={getUniqueDivisionCodeOrUndefined(cases)}
            isSearchable={true}
          />
        </div>
        <div className="lead-case-number-containter">
          <Input
            id={`lead-case-input-${props.id}`}
            data-testid={`lead-case-input-${props.id}`}
            className="usa-input"
            onChange={handleLeadCaseInputChange}
            aria-label="Lead case number"
            required={true}
            label="Lead Case Number"
            ref={leadCaseNumberRef}
          />
          {leadCaseNumberError ? (
            <Alert
              message={leadCaseNumberError}
              type={UswdsAlertStyle.Error}
              show={true}
              noIcon={true}
              slim={true}
              inline={true}
            ></Alert>
          ) : (
            <LoadingSpinner
              caption="Verifying lead case number..."
              height="40px"
              hidden={!isLoading}
            />
          )}
        </div>
      </div>
    );
  }

  function showApprovedContentStep2() {
    return (
      <div>
        <div className="modal-step2-consolidation-type">
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
        <div className="modal-step2-assignments-list">
          with <span className="text-bold">{leadCaseNumber}</span> as the Lead Case. All cases will
          be assigned to{' '}
          <span className="text-bold">{formatListforDisplay(leadCaseAttorneys)}</span>.
        </div>
      </div>
    );
  }

  return (
    <Modal
      ref={modalRef}
      modalId={id}
      className={`confirm-modal consolidation-order-modal ${step}`}
      heading={`${options.heading}`}
      data-testid={`confirm-modal-${id}`}
      onClose={() => {
        reset();
        onCancel();
      }}
      content={
        <>
          {options.status === 'rejected' && showRejectedContent()}
          {options.status === 'approved' && step === 'pick-lead-case' && showApprovedContentStep1()}
          {options.status === 'approved' && step === 'confirm' && showApprovedContentStep2()}
        </>
      }
      actionButtonGroup={
        options.status === 'approved' ? approveActionButtonGroup : rejectActionButtonGroup
      }
    ></Modal>
  );
}

export const ConsolidationOrderModal = forwardRef(ConsolidationOrderModalComponent);
