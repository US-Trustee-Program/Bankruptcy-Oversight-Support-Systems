import { getOfficeList, validateCaseNumberInput } from '@/data-verification/dataVerificationHelper';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import SearchableSelect from '@/lib/components/SearchableSelect';
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
import './ConsolidationOrderModal.scss';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

export type ConfirmActionResults = {
  status: OrderStatus;
  rejectionReason?: string;
  leadCaseSummary: CaseSummary;
  consolidationType: ConsolidationType;
};

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

export async function fetchLeadCaseAttorneys(leadCaseId: string) {
  const caseAssignments: CaseAssignment[] = await getCaseAssignments(leadCaseId);
  return caseAssignments.map((assignment) => assignment.name);
}

export function addOxfordCommas(attorneys: string[]) {
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
  const { id, onConfirm, onCancel }: ConsolidationOrderModalProps = props;

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

  const confirmStep2 = async () => {
    onConfirm({
      status: options.status,
      rejectionReason: reasonRef.current?.value,
      leadCaseSummary: leadCaseSummary!,
      // onConfirm should never be called unless the button is enabled.
      // The button should never be enabled unless a consolidationType is selected
      consolidationType: consolidationType!,
    });
  };

  const confirmStep1 = async () => {
    setStep('confirm');
    setOptions({
      ...options,
      heading: 'Consolidate Cases',
    });
  };

  const actionButtonGroup: SubmitCancelBtnProps = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: step === 'pick-lead-case' ? 'Continue' : 'Verify',
      onClick: step === 'pick-lead-case' ? confirmStep1 : confirmStep2,
      className: options.status === 'rejected' ? 'usa-button--secondary' : '',
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
    modalRef.current?.buttons?.current?.disableSubmitButton(true);
    setOptions({
      status: options.status,
      heading:
        options.status === 'approved'
          ? 'Additional Consolidation Information'
          : 'Reject Case Consolidation?',
    });
    setCases(options.cases);

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
          fetchLeadCaseAttorneys(leadCaseId).then((attorneys) => {
            setLeadCaseSummary(caseSummary);
            setLeadCaseAttorneys(attorneys);
            setIsLoading(false);
            modalRef.current?.buttons?.current?.disableSubmitButton(false);
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
  }, [consolidationType, leadCaseNumber]);

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
        <div data-testid={`confirm-modal-${id}-caseIds`}>
          {cases.map((bCase) => getCaseNumber(bCase.caseId)).join(', ')}
        </div>
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
    );
  }

  function showApprovedContentStep1() {
    return (
      <div>
        {featureFlags[CONSOLIDATIONS_ENABLED] && (
          <div className="consolidation-type-container">
            <div className="consolidation-type-radio">
              <label htmlFor={'consolidation-type'} className="usa-label">
                Consolidation Type
              </label>
              <Radio
                id={`radio-administrative-${id}`}
                name="consolidation-type"
                value="administrative"
                onChange={handleSelectConsolidationType}
                ref={administrativeConsolidationRef}
                label={consolidationTypeMap.get('administrative')!}
              />
            </div>
            <div>
              <Radio
                id={`radio-substantive-${id}`}
                name="consolidation-type"
                value="substantive"
                onChange={handleSelectConsolidationType}
                ref={substantiveConsolidationRef}
                label={consolidationTypeMap.get('substantive')!}
              />
            </div>
          </div>
        )}
        <div className="lead-case-court-container">
          <label htmlFor={'lead-case-court'} className="usa-label">
            Lead Case Court
          </label>
          <SearchableSelect
            id={'lead-case-court'}
            options={getOfficeList(props.courts)}
            onChange={(ev) => {
              setLeadCaseDivisionCode(ev?.value || '');
            }}
            ref={leadCaseDivisionRef}
          ></SearchableSelect>
        </div>
        <div className="lead-case-number-containter">
          <label htmlFor={`lead-case-input-${props.id}`} className="usa-label">
            Lead Case Number
          </label>
          <Input
            id={`lead-case-input-${props.id}`}
            data-testid={`lead-case-input-${props.id}`}
            className="usa-input"
            onChange={handleLeadCaseInputChange}
            aria-label="Lead case number"
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
        <div className="modal-case-list-container" style={{ maxHeight: childCasesDivHeight }}>
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
          <span className="text-bold oxford-comma">{addOxfordCommas(leadCaseAttorneys)}</span>.
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
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

export const ConsolidationOrderModal = forwardRef(ConsolidationOrderModalComponent);
