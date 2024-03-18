import './ConsolidationOrderModal.scss';
import { OfficeDetails } from '@common/cams/courts';
import { OrderStatus } from '@common/cams/orders';
import { AttorneyInfo } from '@/lib/type-declarations/attorneys';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { InputRef } from '@/lib/type-declarations/input-fields';
import useFeatureFlags, {
  CONSOLIDATIONS_ENABLED,
  CONSOLIDATIONS_ASSIGN_ATTORNEYS_ENABLED,
} from '@/lib/hooks/UseFeatureFlags';
import SearchableSelect from '@/lib/components/SearchableSelect';
import { getOfficeList, validateCaseNumberInput } from '@/data-verification/dataVerificationHelper';
import Input from '@/lib/components/uswds/Input';
import { getFullName } from '@common/name-helper';
import Modal from '@/lib/components/uswds/modal/Modal';

export type ConfirmActionResults = {
  status: OrderStatus;
  rejectionReason?: string;
  leadCaseId?: string;
  consolidationType: string;
};

export interface ConsolidationOrderModalProps {
  id: string;
  courts: OfficeDetails[];
  onCancel: () => void;
  onConfirm: (results: ConfirmActionResults) => void;
}

type ShowOptionParams = {
  status: OrderStatus;
  caseIds: string[];
  attorneys: AttorneyInfo[];
};

type ShowOptions = {
  status: OrderStatus;
  heading: string;
  attorneys: AttorneyInfo[];
};

export type ConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

function ConsolidationOrderModalComponent(
  props: ConsolidationOrderModalProps,
  ConfirmationModalRef: React.Ref<ConfirmationModalImperative>,
) {
  const { id, onConfirm, onCancel }: ConsolidationOrderModalProps = props;

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason] = useState<string>('');
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    heading: '',
    attorneys: [],
  });
  const [consolidationType, setConsolidationType] = useState<string>('');
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [leadCaseDivisionCode, setLeadCaseDivisionCode] = useState<string>('');
  const [leadCaseNumber, setLeadCaseNumber] = useState<string>('');
  const leadCaseIdRef = useRef<InputRef>(null);
  const featureFlags = useFeatureFlags();

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
  }

  const actionButtonGroup = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: 'Approve',
      onClick: () => {
        onConfirm({
          status: options.status,
          rejectionReason: reasonRef.current?.value,
          leadCaseId: `${leadCaseDivisionCode}-${leadCaseNumber}`,
          consolidationType,
        });
      },
      className: options.status === 'rejected' ? 'usa-button--secondary' : '',
    },
    cancelButton: {
      label: 'Go back',
      onClick: () => {
        clearReason();
        hide();
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
      attorneys: options.attorneys,
    });
    setCaseIds(options.caseIds);

    if (modalRef.current?.show) {
      modalRef.current?.show({});
    }
  }

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide({});
    }
  }

  function handleSelectConsolidationType(ev: React.ChangeEvent<HTMLInputElement>) {
    setConsolidationType(ev.target.value);
  }

  function handleLeadCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const { caseNumber, joinedInput } = validateCaseNumberInput(ev);
    leadCaseIdRef.current?.setValue(joinedInput);
    if (caseNumber) {
      setLeadCaseNumber(caseNumber);
      modalRef.current?.buttons?.current?.disableSubmitButton(false);
    } else {
      modalRef.current?.buttons?.current?.disableSubmitButton(true);
    }
  }

  useImperativeHandle(ConfirmationModalRef, () => ({
    show,
    hide,
  }));

  function showRejectedContent() {
    return (
      <div>
        <div data-testid={`confirm-modal-${id}-caseIds`}>{caseIds.join(', ')}</div>
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
              <input
                data-testid={`radio-administrative-${id}`}
                type="radio"
                name="consolidationType"
                value="administrative"
                onChange={handleSelectConsolidationType}
              />
              <label htmlFor={`radio-administrative-${id}`}>Joint Administration</label>
            </div>
            <div>
              <input
                data-testid={`radio-substantive-${id}`}
                type="radio"
                name="consolidationType"
                value="substantive"
                onChange={handleSelectConsolidationType}
              />
              <label htmlFor={`radio-substantive-${id}`}>Substantive Consolidation</label>
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
            value={leadCaseNumber}
            onChange={handleLeadCaseInputChange}
            aria-label="Lead case number"
            ref={leadCaseIdRef}
          />
        </div>
        {featureFlags[CONSOLIDATIONS_ASSIGN_ATTORNEYS_ENABLED] && (
          <div id="lead-case-court-container">
            <label htmlFor={'lead-attorney'} className="usa-label">
              All cases will be assigned to
            </label>
            <SearchableSelect
              id={'lead-attorney'}
              options={options.attorneys.map((attorney) => {
                const fullName = getFullName(attorney);
                return {
                  value: fullName,
                  label: fullName,
                };
              })}
            ></SearchableSelect>
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal
      ref={modalRef}
      modalId={id}
      className="confirm-modal consolidation-order-modal"
      heading={`${options.heading}`}
      data-testid={`confirm-modal-${id}`}
      onClose={clearReason}
      content={
        <>
          {options.status === 'rejected' && showRejectedContent()}
          {options.status === 'approved' && showApprovedContentStep1()}
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

export const ConsolidationOrderModal = forwardRef(ConsolidationOrderModalComponent);
