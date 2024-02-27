import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails } from '@/data-verification/DataVerificationScreen';
import { CaseTableImperative } from './CaseTable';
import { ChangeEvent, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ConsolidatedCasesTable } from './ConsolidatedCasesTable';
import './TransferOrderAccordion.scss';
import { ConsolidationOrder, ConsolidationOrderCase, OrderStatus } from '@common/cams/orders';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import Modal from '@/lib/components/uswds/modal/Modal';
import SearchableSelect, { SearchableSelectOption } from '@/lib/components/SearchableSelect';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { getOfficeList } from './dataVerificationHelper';
import { OfficeDetails } from '@common/cams/courts';
import Input from '@/lib/components/uswds/Input';

export interface ConsolidationOrderAccordionProps {
  order: ConsolidationOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: ConsolidationOrder) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
}

export function ConsolidationOrderAccordion(props: ConsolidationOrderAccordionProps) {
  const { order, statusType, orderType, officesList, expandedId, onExpand } = props;
  const caseTable = useRef<CaseTableImperative>(null);
  const [selectedCases, setSelectedCases] = useState<Array<ConsolidationOrderCase>>([]);
  const courtSelectionRef = useRef<InputRef>(null);
  const caseIdRef = useRef<InputRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);

  function handleIncludeCase(bCase: ConsolidationOrderCase) {
    if (selectedCases.includes(bCase)) {
      setSelectedCases(selectedCases.filter((aCase) => bCase !== aCase));
    } else {
      setSelectedCases([...selectedCases, bCase]);
    }
  }

  function clearIncludedCases() {
    setSelectedCases([]);
    caseTable.current?.clearSelection();
  }

  function handleCourtSelection(newValue: SearchableSelectOption): void {
    //Adding to the list of possible consolidations
    //const updatedSelection = updateCaseToAdd(selection, orderTransfer, officesList);
    //TODO: Handle when a case is selected
    console.log(newValue);
  }

  function handleCaseInputChange(ev: ChangeEvent<HTMLInputElement>): void {
    // TODO: Implement input
    console.log(ev);
    throw new Error('Function not implemented.');
  }

  function cancelUpdate(): void {
    courtSelectionRef.current?.clearValue();
    caseIdRef.current?.resetValue();
    clearIncludedCases();
    approveButtonRef.current?.disableButton(true);
  }

  function confirmAction(status: OrderStatus, reason?: string): void {
    //TODO: Confirmation action moving us to the confirmation modal for the Consolidation Order
    if (status === 'rejected') {
      console.log('Cases selected', selectedCases);
      console.log(reason);
      //approveOrderRejection(reason);
    } else if (status === 'approved') {
      //confirmOrderApproval();
    }
  }

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={clearIncludedCases}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div className="grid-col-6 text-no-wrap" aria-label={`Court district ${order.courtName}`}>
          {order.courtName}
        </div>
        <div
          className="grid-col-2 text-no-wrap"
          title="Event date"
          aria-label={`Event date ${formatDate(order.orderDate)}`}
        >
          {formatDate(order.orderDate)}
        </div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span aria-label={`Event type ${orderType.get(order.orderType)}`}>
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span
            className={order.status}
            aria-label={`Event status ${statusType.get(order.status)}`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
      </section>
      <section
        className="accordion-content order-form"
        data-testid={`accordion-content-${order.id}`}
      >
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-1"></div>

          <div>
            <ConsolidatedCasesTable
              id={`${order.id}-case-list`}
              data-testid={`${order.id}-case-list`}
              cases={order.childCases}
              onSelect={handleIncludeCase}
              ref={caseTable}
            ></ConsolidatedCasesTable>
          </div>
          <div className="grid-col-1"></div>
        </div>

        <div className="grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="grid-col-10">
            <h3>Add Case</h3>
          </div>
          <div className="grid-col-1"></div>
        </div>

        <div className="court-selection grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="grid-col-10">
            <div className="form-row">
              <div className="select-container court-select-container">
                <label htmlFor={`court-selection-${order.id}`}>Court</label>
                <div
                  className="usa-combo-box"
                  data-testid={`court-selection-usa-combo-box-${order.id}`}
                >
                  <SearchableSelect
                    id={`court-selection-${order.id}`}
                    data-testid={`court-selection-${order.id}`}
                    className="new-court__select"
                    closeMenuOnSelect={true}
                    label="Select new court"
                    ref={courtSelectionRef}
                    onChange={handleCourtSelection}
                    //getOfficeList might need pulled into its own file
                    options={getOfficeList(officesList)}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid-col-1"></div>
        </div>

        <div className="case-selection grid-row grid-gap-lg">
          <div className="grid-col-1"></div>

          <div className="grid-col-10">
            <div className="form-row">
              <div>
                <label htmlFor={`new-case-input-${order.id}`}>Case Number</label>
                <div>
                  <Input
                    id={`new-case-input-${order.id}`}
                    data-testid={`new-case-input-${order.id}`}
                    className="usa-input"
                    value=""
                    onChange={handleCaseInputChange}
                    aria-label="New case ID"
                    ref={caseIdRef}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid-col-1"></div>
        </div>

        <div className="button-bar grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="grid-col-2">
            <Button
              id={`accordion-reject-button-${order.id}`}
              onClick={() =>
                confirmationModalRef.current?.show({
                  status: 'rejected',
                  caseIds: order.childCases.map((c) => c.caseId),
                })
              }
              uswdsStyle={UswdsButtonStyle.Secondary}
            >
              Reject
            </Button>
          </div>
          <div className="grid-col-6"></div>
          <div className="grid-col-2 text-no-wrap">
            <Button
              id={`accordion-cancel-button-${order.id}`}
              onClick={cancelUpdate}
              uswdsStyle={UswdsButtonStyle.Outline}
            >
              Cancel
            </Button>
            <Button
              id={`accordion-approve-button-${order.id}`}
              onClick={() => confirmationModalRef.current?.show({ status: 'approved' })}
              disabled={true}
              ref={approveButtonRef}
            >
              Approve
            </Button>
          </div>
          <div className="grid-col-1"></div>
        </div>
        <ConfirmationModal
          ref={confirmationModalRef}
          id={`confirmation-modal-${order.id}`}
          courts={officesList}
          onCancel={cancelUpdate}
          onConfirm={confirmAction}
        ></ConfirmationModal>
      </section>
    </Accordion>
  );
}

export interface ConfirmationModalProps {
  id: string;
  courts: OfficeDetails[];
  onCancel: () => void;
  onConfirm: (status: OrderStatus, reason?: string, leadCaseId?: string) => void;
}

type ShowOptionParams = {
  status: OrderStatus;
  caseIds: string[];
};

type ShowOptions = {
  status: OrderStatus;
  heading: string;
};

export type ConfirmationModalImperative = ModalRefType & {
  show: (options: ShowOptionParams) => void;
};

function ConfirmationModalComponent(
  props: ConfirmationModalProps,
  ConfirmationModalRef: React.Ref<ConfirmationModalImperative>,
) {
  const { id, onConfirm, onCancel }: ConfirmationModalProps = props;

  const modalRef = useRef<ModalRefType>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason] = useState<string>('');
  const [options, setOptions] = useState<ShowOptions>({
    status: 'pending',
    heading: '',
  });
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [leadCaseNumber, setLeadCaseNumber] = useState<string>('');
  const leadCaseIdRef = useRef<InputRef>(null);

  // const courtSelectionOptions = props.courts.map((court) => {
  //   return {
  //     value: court.courtDivision,
  //     label: `${court.courtName} (${court.courtDivisionName})`,
  //   };
  // });

  function clearReason() {
    if (reasonRef.current) reasonRef.current.value = '';
  }

  const actionButtonGroup = {
    modalId: `confirmation-modal-${id}`,
    modalRef: modalRef,
    submitButton: {
      label: options.heading,
      onClick: () => {
        onConfirm(options.status, reasonRef.current?.value, leadCaseNumber);
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
    setOptions({
      status: options.status,
      heading:
        options.status === 'approved'
          ? 'Additional Consolidation Information'
          : 'Reject Case Consolidation?',
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

  function handleLeadCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setLeadCaseNumber(ev.target.value);
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
      heading={`${options.heading}`}
      data-testid={`confirm-modal-${id}`}
      onClose={clearReason}
      content={
        <>
          {options.status === 'rejected' && (
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
          )}
          {options.status === 'approved' && (
            <div>
              <div id="lead-case-court-container">
                <label htmlFor={'lead-case-court'} className="usa-label">
                  Lead Case Court
                </label>
                <SearchableSelect
                  id={'lead-case-court'}
                  options={getOfficeList(props.courts)}
                ></SearchableSelect>
              </div>
              <div id="lead-case-number-containter">
                <Input
                  id={`lead-case-input-${props.id}`}
                  data-testid={`lead-case-input-${props.id}`}
                  className="usa-input"
                  onChange={handleLeadCaseInputChange}
                  aria-label="Lead case number"
                  ref={leadCaseIdRef}
                />
              </div>
            </div>
          )}
        </>
      }
      actionButtonGroup={actionButtonGroup}
    ></Modal>
  );
}

export const ConfirmationModal = forwardRef(ConfirmationModalComponent);
