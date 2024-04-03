import './ConsolidationOrderModal.scss';
import { OfficeDetails } from '@common/cams/courts';
import { ConsolidationOrderCase, ConsolidationType, OrderStatus } from '@common/cams/orders';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { InputRef, RadioRef } from '@/lib/type-declarations/input-fields';
import useFeatureFlags, { CONSOLIDATIONS_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import SearchableSelect from '@/lib/components/SearchableSelect';
import { getOfficeList, validateCaseNumberInput } from '@/data-verification/dataVerificationHelper';
import Input from '@/lib/components/uswds/Input';
import Modal from '@/lib/components/uswds/modal/Modal';
import Radio from '@/lib/components/uswds/Radio';
import { consolidationType as consolidationTypeMap } from '@/lib/utils/labels';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseAssignment } from '@common/cams/assignments';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useApi } from '@/lib/hooks/UseApi';
import useWindowSize from '@/lib/hooks/UseWindowSize';

export const CASE_NUMBER_LENGTH = 8;

export type ConfirmActionResults = {
  status: OrderStatus;
  rejectionReason?: string;
  leadCaseId?: string;
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

export async function getCaseAssignments(caseId: string): Promise<Array<CaseAssignment>> {
  try {
    const api = useApi();
    const response = await api.get(`/case-assignments/${caseId}`);
    return response.body as CaseAssignment[];
  } catch {
    // TODO: If this API call fails because the case ID cannot be found then this is an invalid case.
    // TODO: For all other failures we cannot infer the case is valid to continue as the lead case.
    return [];
  }
}

export async function fetchLeadCaseAttorneys(leadCaseId: string): Promise<Array<string>> {
  const assignments = await getCaseAssignments(leadCaseId);
  const attorneys = assignments.map((assignment) => assignment.name);
  return attorneys;
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

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState<ConfirmationSteps>('pick-lead-case');
  const [reason] = useState<string>('');
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    heading: '',
  });
  const [consolidationType, setConsolidationType] = useState<ConsolidationType | null>(null);
  const [cases, setCases] = useState<ConsolidationOrderCase[]>([]);
  const [leadCaseDivisionCode, setLeadCaseDivisionCode] = useState<string>('');
  const [leadCaseNumber, setLeadCaseNumber] = useState<string>('');
  const [leadCaseAttorneys, setLeadCaseAttorneys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [consolidatedCasesDivHeight, setConsolidatedCasesDivHeight] = useState<string>('');
  const [modalHeight, setModalHeight] = useState<number>(0);
  const leadCaseNumberRef = useRef<InputRef>(null);
  const leadCaseDivisionRef = useRef<InputRef>(null);
  const administrativeConsolidationRef = useRef<RadioRef>(null);
  const substantiveConsolidationRef = useRef<RadioRef>(null);
  const featureFlags = useFeatureFlags();
  const windowSize = useWindowSize();

  const confirmStep2 = async () => {
    onConfirm({
      status: options.status,
      rejectionReason: reasonRef.current?.value,
      leadCaseId: `${leadCaseDivisionCode}-${leadCaseNumber}`,
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

  useEffect(() => {
    const hasRequiredFields =
      !!consolidationType && !!leadCaseDivisionCode && leadCaseNumber.length === CASE_NUMBER_LENGTH;

    const leadCaseId = `${leadCaseDivisionCode}-${leadCaseNumber}`;
    if (hasRequiredFields) {
      setIsLoading(true);
      fetchLeadCaseAttorneys(leadCaseId).then((attorneys) => {
        setLeadCaseAttorneys(attorneys);
        modalRef.current?.buttons?.current?.disableSubmitButton(false);
        setIsLoading(false);
      });
    }
    modalRef.current?.buttons?.current?.disableSubmitButton(true);
  }, [consolidationType, leadCaseNumber]);

  useEffect(() => {
    // get height of modal top section above scrolling div
    const modalWindowPadding = 100;
    const outerModalMargin = 200;

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
        const finalSize = windowSize.height! - overallHeightOfModal;
        setConsolidatedCasesDivHeight(`${finalSize}px`);
        setModalHeight(modalContent.clientHeight);
      }
    }
  }, [windowSize]);

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
          {isLoading && (
            <LoadingSpinner
              id="loading-indicator-consolidation-order-modal"
              caption="Loading case assignments..."
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
          className="modal-case-list-container"
          style={{ maxHeight: consolidatedCasesDivHeight }}
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
          <span className="text-bold oxford-comma">{addOxfordCommas(leadCaseAttorneys)}</span>.
        </div>
      </div>
    );
  }

  return (
    <Modal
      ref={modalRef}
      modalId={id}
      className={`confirm-modal consolidation-order-modal`}
      dataMisc={modalHeight}
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
