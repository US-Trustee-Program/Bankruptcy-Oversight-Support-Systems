import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails } from '@/data-verification/DataVerificationScreen';
import { CaseTable } from './CaseTable';
import { useEffect, useRef, useState } from 'react';
import { ConsolidationCaseTable, OrderTableImperative } from './ConsolidationCasesTable';
import './TransferOrderAccordion.scss';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  ConsolidationOrderCase,
} from '@common/cams/orders';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { filterCourtByDivision, OfficeDetails } from '@common/cams/courts';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConfirmActionResults,
} from '@/data-verification/ConsolidationOrderModal';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { CaseNumber } from '@/lib/components/CaseNumber';
import './ConsolidationOrderAccordion.scss';
import { useApi } from '@/lib/hooks/UseApi';
import { CaseAssignmentResponseData } from '@/lib/type-declarations/chapter-15';

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

  const [order, setOrder] = useState<ConsolidationOrder>(props.order);
  const [selectedCases, setSelectedCases] = useState<Array<ConsolidationOrderCase>>([]);
  const [isAssignmentLoaded, setIsAssignmentLoaded] = useState<boolean>(false);
  const [filteredOfficesList] = useState<OfficeDetails[] | null>(
    filterCourtByDivision(props.order.courtDivisionCode, officesList),
  );
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const rejectButtonRef = useRef<ButtonRef>(null);

  const api = useApi();

  function handleIncludeCase(bCase: ConsolidationOrderCase) {
    console.log(`Adding ${bCase.caseId} to selectedCases`, selectedCases.length);
    if (selectedCases.includes(bCase)) {
      setSelectedCases(selectedCases.filter((aCase) => bCase !== aCase));
    } else {
      console.log('selectedCases was empty');
      setSelectedCases([...selectedCases, bCase]);
      console.log(selectedCases);
    }
  }

  function toggleAllCheckBoxes() {
    if (selectedCases.length > 0) {
      setSelectedCases([]);
      caseTable.current?.clearSelection();
    } else {
      const caseList = caseTable.current?.selectAll();
      if (caseList) {
        setSelectedCases(caseList);
      } else {
        setSelectedCases([]);
      }
    }
  }

  function setOrderWithAssignments(order: ConsolidationOrder) {
    setOrder({ ...order });
  }
  async function handleOnExpand() {
    if (props.onExpand) {
      props.onExpand(`order-list-${order.id}`);
    }
    if (!isAssignmentLoaded) {
      for (const bCase of order.childCases) {
        try {
          const assignmentsResponse = await api.get(`/case-assignments/${bCase.caseId}`);
          bCase.attorneyAssignments = (assignmentsResponse as CaseAssignmentResponseData).body;
        } catch {
          // The child case assignments are not critical to perform the consolidation. Catch any error
          // and don't set the attorney assignment for this specific case.
        }
      }
      setOrderWithAssignments(order);
      setIsAssignmentLoaded(true);
    }
  }

  function clearInputs(): void {
    caseTable.current?.clearSelection();
    disableButtons(true);
    setSelectedCases([]);
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
    if (action.status === 'approved') {
      const data: ConsolidationOrderActionApproval = {
        ...order,
        consolidationType: action.consolidationType,
        approvedCases: selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => caseId !== action.leadCaseSummary.caseId),
        leadCase: action.leadCaseSummary,
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

  function disableButtons(disable: boolean) {
    approveButtonRef.current?.disableButton(disable);
    rejectButtonRef.current?.disableButton(disable);
  }

  useEffect(() => {
    disableButtons(selectedCases.length === 0);
  }, [selectedCases]);

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
              <div className="grid-col-10">
                <div className="measure-6 instructional-text">
                  <Alert
                    inline={true}
                    show={true}
                    message="Mark the cases to include in a consolidation. When finished, click Continue to
                    choose the consolidation type, pick a lead case, and assign the cases to a staff
                    member."
                    type={UswdsAlertStyle.Info}
                    role="status"
                    className="instructional-text"
                    id="consolidation-instructional-text"
                  />
                </div>
              </div>
              <div className="grid-col-1"></div>
            </div>
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-10">
                <div>
                  <h3>Cases</h3>
                  <Button uswdsStyle={UswdsButtonStyle.Outline} onClick={toggleAllCheckBoxes}>
                    Include/Exclude All
                  </Button>
                </div>
                <ConsolidationCaseTable
                  id={`${order.id}-case-list`}
                  data-testid={`${order.id}-case-list`}
                  cases={order.childCases}
                  onSelect={handleIncludeCase}
                  isAssignmentLoaded={isAssignmentLoaded}
                  ref={caseTable}
                ></ConsolidationCaseTable>
              </div>
              <div className="grid-col-1"></div>
            </div>

            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-5">
                <Button
                  id={`accordion-reject-button-${order.id}`}
                  onClick={() =>
                    confirmationModalRef.current?.show({
                      status: 'rejected',
                      cases: selectedCases,
                    })
                  }
                  uswdsStyle={UswdsButtonStyle.Secondary}
                  ref={rejectButtonRef}
                >
                  Reject
                </Button>
              </div>
              <div className="grid-col-5 text-no-wrap float-right">
                <Button
                  id={`accordion-cancel-button-${order.id}`}
                  onClick={clearInputs}
                  uswdsStyle={UswdsButtonStyle.Outline}
                >
                  Cancel
                </Button>
                <Button
                  id={`accordion-approve-button-${order.id}`}
                  onClick={() =>
                    confirmationModalRef.current?.show({
                      status: 'approved',
                      cases: selectedCases,
                    })
                  }
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
              courts={filteredOfficesList ?? props.officesList}
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
                  isAssignmentLoaded={isAssignmentLoaded}
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
