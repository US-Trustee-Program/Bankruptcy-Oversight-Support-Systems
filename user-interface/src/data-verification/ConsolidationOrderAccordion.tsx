import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { CaseTable } from './transfer/CaseTable';
import { useEffect, useRef, useState } from 'react';
import { ConsolidationCaseTable, OrderTableImperative } from './ConsolidationCasesTable';
import './TransferOrderAccordion.scss';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
  ConsolidationType,
} from '@common/cams/orders';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { filterCourtByDivision, OfficeDetails } from '@common/cams/courts';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConfirmActionResults,
} from '@/data-verification/ConsolidationOrderModal';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseNumber } from '@/lib/components/CaseNumber';
import './ConsolidationOrderAccordion.scss';
import { useApi } from '@/lib/hooks/UseApi';
import { CaseAssignmentResponseData } from '@/lib/type-declarations/chapter-15';
import { Consolidation } from '@common/cams/events';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import Radio from '@/lib/components/uswds/Radio';
import Checkbox from '@/lib/components/uswds/Checkbox';
import CamsSelect from '@/lib/components/CamsSelect';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { RadioRef } from '@/lib/type-declarations/input-fields';

export interface ConsolidationOrderAccordionProps {
  order: ConsolidationOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (
    alertDetails: AlertDetails,
    orders?: ConsolidationOrder[],
    deletedOrder?: ConsolidationOrder,
  ) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
  hidden?: boolean;
}

export function ConsolidationOrderAccordion(props: ConsolidationOrderAccordionProps) {
  const { hidden, statusType, orderType, officesList, expandedId } = props;
  const caseTable = useRef<OrderTableImperative>(null);

  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const rejectButtonRef = useRef<ButtonRef>(null);
  const jointAdministrationRef = useRef<RadioRef>(null);
  const substantiveRef = useRef<RadioRef>(null);

  const [order, setOrder] = useState<ConsolidationOrder>(props.order);
  const [selectedCases, setSelectedCases] = useState<Array<ConsolidationOrderCase>>([]);
  const [isDataEnhanced, setIsDataEnhanced] = useState<boolean>(false);
  const [filteredOfficesList] = useState<OfficeDetails[] | null>(
    filterCourtByDivision(props.order.courtDivisionCode, officesList),
  );
  const [leadCaseId, setLeadCaseId] = useState<string>('');
  const [leadCase, setLeadCase] = useState<ConsolidationOrderCase | null>(null);
  const [consolidationType, setConsolidationType] = useState<ConsolidationType | null>(null);

  const api = useApi();

  function handleIncludeCase(bCase: ConsolidationOrderCase) {
    let tempSelectedCases: ConsolidationOrderCase[];
    if (selectedCases.includes(bCase)) {
      tempSelectedCases = selectedCases.filter((aCase) => bCase !== aCase);
    } else {
      tempSelectedCases = [...selectedCases, bCase];
    }
    setSelectedCases(tempSelectedCases);
  }

  function updateAllSelections(caseList: ConsolidationOrderCase[]) {
    setSelectedCases(caseList);
  }

  function setOrderWithDataEnhancement(order: ConsolidationOrder) {
    setOrder({ ...order });
  }

  async function handleOnExpand() {
    if (props.onExpand) {
      props.onExpand(`order-list-${order.id}`);
    }
    if (!isDataEnhanced) {
      for (const bCase of order.childCases) {
        try {
          const assignmentsResponse = await api.get(`/case-assignments/${bCase.caseId}`);
          bCase.attorneyAssignments = (assignmentsResponse as CaseAssignmentResponseData).body;

          const associatedResponse = await api.get(`/cases/${bCase.caseId}/associated`);
          bCase.associations = associatedResponse.body as Consolidation[];
        } catch {
          // The child case assignments are not critical to perform the consolidation. Catch any error
          // and don't set the attorney assignment for this specific case.
        }
      }
      setOrderWithDataEnhancement(order);
      setIsDataEnhanced(true);
    }
  }

  function clearInputs(): void {
    caseTable.current?.clearAllCheckboxes();
    disableButtons();
    setSelectedCases([]);
    setLeadCase(null);
    // TODO
    // clear type radio input
    jointAdministrationRef.current?.check(false);
    substantiveRef.current?.check(false);
    // clear mark lead case button styling
  }

  function confirmAction(action: ConfirmActionResults): void {
    switch (action.status) {
      case 'approved':
        approveConsolidation(action);
        break;
      case 'rejected':
        rejectConsolidation(action);
        break;
    }
  }

  function approveConsolidation(action: ConfirmActionResults) {
    if (action.status === 'approved' && leadCase && consolidationType) {
      const data: ConsolidationOrderActionApproval = {
        ...order,
        consolidationType,
        approvedCases: selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => caseId !== leadCase.caseId),
        leadCase,
      };

      api
        .put('/consolidations/approve', data)
        .then((response) => {
          const newOrders = response.body as ConsolidationOrder[];
          const approvedOrder = newOrders.find((o) => o.status === 'approved')!;
          props.onOrderUpdate(
            {
              message: `Consolidation to lead case ${getCaseNumber(approvedOrder.leadCase?.caseId)} in ${
                approvedOrder.leadCase?.courtName
              } (${approvedOrder.leadCase?.courtDivisionName}) was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            order,
          );
        })
        .catch((reason) => {
          // TODO: make the error message more meaningful
          props.onOrderUpdate({ message: reason.message, type: UswdsAlertStyle.Error, timeOut: 8 });
        });
    }
  }

  function rejectConsolidation(action: ConfirmActionResults) {
    if (action.status === 'rejected') {
      const data: ConsolidationOrderActionRejection = {
        ...order,
        rejectedCases: selectedCases.map((bCase) => bCase.caseId),
        reason: action.rejectionReason,
      };

      api
        .put('/consolidations/reject', data)
        .then((response) => {
          const newOrders = response.body as ConsolidationOrder[];
          props.onOrderUpdate(
            {
              message: `Rejection of consolidation order was successful.`,
              type: UswdsAlertStyle.Success,
              timeOut: 8,
            },
            newOrders,
            order,
          );
        })
        .catch((reason) => {
          // TODO: make the error message more meaningful
          props.onOrderUpdate({ message: reason.message, type: UswdsAlertStyle.Error, timeOut: 8 });
        });
    }
  }

  function selectedCasesAreConsolidationCases() {
    return order.childCases.reduce((itDoes, bCase) => {
      if (!selectedCases.includes(bCase)) {
        return itDoes;
      }
      return itDoes || !!bCase.associations?.length;
    }, false);
  }

  function disableButtons() {
    rejectButtonRef.current?.disableButton(true);
    approveButtonRef.current?.disableButton(true);
  }

  function enableButtons() {
    rejectButtonRef.current?.disableButton(false);
    approveButtonRef.current?.disableButton(
      !isDataEnhanced || selectedCasesAreConsolidationCases(),
    );
  }

  function handleMarkLeadCase(bCase: ConsolidationOrderCase) {
    if (leadCaseId === bCase.caseId) {
      setLeadCaseId('');
      setLeadCase(null);
    } else {
      setLeadCaseId(bCase.caseId);
      setLeadCase(bCase);
    }
  }

  function handleSelectConsolidationType(value: string): void {
    setConsolidationType(value as ConsolidationType);
  }

  function handleApproveButtonClick() {
    confirmationModalRef.current?.show({
      status: 'approved',
      cases: selectedCases,
      leadCase: leadCase,
      consolidationType: consolidationType,
    });
  }

  useEffect(() => {
    if (selectedCases.length && leadCaseId !== '' && consolidationType !== null) {
      enableButtons();
    } else {
      disableButtons();
    }
  }, [selectedCases, leadCaseId, isDataEnhanced, consolidationType]);

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      expandedId={expandedId}
      onExpand={handleOnExpand}
      onCollapse={clearInputs}
      hidden={hidden}
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
          title="Order Filed"
          aria-label={`Order Filed ${formatDate(order.orderDate)}`}
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
      <>
        {order.status === 'pending' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${order.id}`}
          >
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <h3>Type</h3>
                <RadioGroup
                  className="consolidation-type-container"
                  label="Consolidation Type"
                  required={true}
                >
                  <Radio
                    id={`joint-admin-${order.id}`}
                    name="consolidation-type"
                    label="Joint Administration"
                    value="administrative"
                    className="text-no-wrap"
                    onChange={handleSelectConsolidationType}
                    ref={jointAdministrationRef}
                  />
                  <Radio
                    id={`substantive-${order.id}`}
                    name="consolidation-type"
                    label="Substantive"
                    value="substantive"
                    onChange={handleSelectConsolidationType}
                    ref={substantiveRef}
                  />
                </RadioGroup>
              </div>
              <div className="grid-col-8"></div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`${order.id}-case-list`}
                  data-testid={`${order.id}-case-list`}
                  cases={order.childCases}
                  onSelect={handleIncludeCase}
                  updateAllSelections={updateAllSelections}
                  isDataEnhanced={isDataEnhanced}
                  ref={caseTable}
                  onMarkLead={handleMarkLeadCase}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-3">
                <h3>Lead Case Not Listed</h3>
                <Checkbox
                  id={`lead-case-form-checkbox-toggle-${order.id}`}
                  className="checkbox-toggle"
                  // onChange={toggleAllCheckBoxes}
                  value="hello"
                  // ref={toggleCheckboxRef}
                  label="Select to enable lead case form."
                ></Checkbox>
                <div className="lead-case-court-container">
                  <CamsSelect
                    id={'lead-case-court'}
                    required={true}
                    options={getOfficeList(filteredOfficesList ?? props.officesList)}
                    // onChange={handleSelectLeadCaseCourt}
                    // ref={leadCaseDivisionRef}
                    label="Lead Case Court"
                    // value={getUniqueDivisionCodeOrUndefined()}
                    isSearchable={true}
                  />
                </div>
                <div className="lead-case-number-container">
                  <CaseNumberInput
                    id={`lead-case-input-${order.id}`}
                    data-testid={`lead-case-input-${order.id}`}
                    className="usa-input"
                    onChange={() => {}}
                    aria-label="Lead case number"
                    required={true}
                    label="Lead Case Number"
                    // ref={leadCaseNumberRef}
                  />
                  {/*{leadCaseNumberError ? (*/}
                  {/*  <Alert*/}
                  {/*    message={leadCaseNumberError}*/}
                  {/*    type={UswdsAlertStyle.Error}*/}
                  {/*    show={true}*/}
                  {/*    noIcon={true}*/}
                  {/*    slim={true}*/}
                  {/*    inline={true}*/}
                  {/*  ></Alert>*/}
                  {/*) : (*/}
                  {/*  <LoadingSpinner*/}
                  {/*    caption="Verifying lead case number..."*/}
                  {/*    height="40px"*/}
                  {/*    hidden={!isLoading}*/}
                  {/*  />*/}
                  {/*)}*/}
                </div>
              </div>
              <div className="grid-col-7"></div>
              <div className="grid-col-1"></div>
            </div>
            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10 text-no-wrap float-right">
                <Button
                  id={`accordion-cancel-button-${order.id}`}
                  onClick={clearInputs}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  className="unstyled-button"
                >
                  Clear
                </Button>
                <Button
                  id={`accordion-reject-button-${order.id}`}
                  onClick={() =>
                    confirmationModalRef.current?.show({
                      status: 'rejected',
                      cases: selectedCases,
                      leadCase: leadCase,
                    })
                  }
                  uswdsStyle={UswdsButtonStyle.Outline}
                  className="margin-right-2"
                  ref={rejectButtonRef}
                >
                  Reject
                </Button>
                <Button
                  id={`accordion-approve-button-${order.id}`}
                  onClick={handleApproveButtonClick}
                  disabled={true}
                  ref={approveButtonRef}
                >
                  Approve
                </Button>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <ConsolidationOrderModal
              ref={confirmationModalRef}
              id={`confirmation-modal-${order.id}`}
              onCancel={clearInputs}
              onConfirm={confirmAction}
            ></ConsolidationOrderModal>
          </section>
        )}
        {order.status === 'approved' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Consolidated the following cases to lead case{' '}
                <CaseNumber
                  data-testid={'lead-case-number'}
                  caseId={order.leadCase!.caseId}
                  renderAs="link"
                  openLinkIn="new-window"
                ></CaseNumber>{' '}
                {order.leadCase?.caseTitle}.
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <CaseTable
                  id={`order-${order.id}-child-cases`}
                  cases={order.childCases}
                ></CaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
        {order.status === 'rejected' && (
          <section
            className="accordion-content order-form"
            data-testid={`accordion-content-${order.id}`}
          >
            <div className="grid-row grid-gap-lg consolidation-text">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                Rejected the consolidation of the cases below
                {order.reason && order.reason.length && (
                  <>
                    {' '}
                    for the following reason:
                    <blockquote>{order.reason}</blockquote>
                  </>
                )}
                {!order.reason && <>.</>}
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <ConsolidationCaseTable
                  id={`${order.id}-case-list`}
                  data-testid={`${order.id}-case-list`}
                  cases={order.childCases}
                  isDataEnhanced={isDataEnhanced}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
      </>
    </Accordion>
  );
}
