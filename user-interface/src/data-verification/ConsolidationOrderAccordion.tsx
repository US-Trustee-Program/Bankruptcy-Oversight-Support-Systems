import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails } from '@/data-verification/DataVerificationScreen';
import { CaseTable, CaseTableImperative } from './CaseTable';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { ConsolidationCaseTable } from './ConsolidationCasesTable';
import './TransferOrderAccordion.scss';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderCase,
} from '@common/cams/orders';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import SearchableSelect, { SearchableSelectOption } from '@/lib/components/SearchableSelect';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { getOfficeList } from './dataVerificationHelper';
import { OfficeDetails } from '@common/cams/courts';
import Input from '@/lib/components/uswds/Input';
import {
  ConsolidationOrderModal,
  ConfirmationModalImperative,
  ConfirmActionResults,
} from '@/data-verification/ConsolidationOrderModal';
import useFeatureFlags, { CONSOLIDATIONS_ADD_CASE_ENABLED } from '@/lib/hooks/UseFeatureFlags';
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
  const caseTable = useRef<CaseTableImperative>(null);

  const [order, setOrder] = useState<ConsolidationOrder>(props.order);
  const [selectedCases, setSelectedCases] = useState<Array<ConsolidationOrderCase>>([]);
  const [isAssignmentLoaded, setIsAssignmentLoaded] = useState<boolean>(false);
  const courtSelectionRef = useRef<InputRef>(null);
  const caseIdRef = useRef<InputRef>(null);
  const confirmationModalRef = useRef<ConfirmationModalImperative>(null);
  const approveButtonRef = useRef<ButtonRef>(null);
  const featureFlags = useFeatureFlags();

  const api = useApi();

  useEffect(() => {
    if (selectedCases.length == 0) {
      approveButtonRef.current?.disableButton(true);
    } else {
      approveButtonRef.current?.disableButton(false);
    }
  }, [selectedCases]);

  function handleIncludeCase(bCase: ConsolidationOrderCase) {
    if (selectedCases.includes(bCase)) {
      setSelectedCases(selectedCases.filter((aCase) => bCase !== aCase));
    } else {
      setSelectedCases([...selectedCases, bCase]);
    }
  }

  function handleAddNewCaseDivisionCode(_newValue: SearchableSelectOption): void {
    throw new Error('Function not implemented.');
  }

  function handleAddNewCaseNumber(_ev: ChangeEvent<HTMLInputElement>): void {
    throw new Error('Function not implemented.');
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
          // The case assignments are not critical to perform the consolidation. Catch any error
          // and silently return an empty list so the page doesn't crash.
        }
      }
      // Ensure the loaded assignments are stored in state on the order and not overridden
      // should the parent data consolidation screen refresh the accordion.
      setOrder({ ...order });
      setIsAssignmentLoaded(true);
    }
  }

  function clearInputs(): void {
    caseTable.current?.clearSelection();
    approveButtonRef.current?.disableButton(true);
    setSelectedCases([]);
  }

  function confirmAction({ status, leadCaseId, consolidationType }: ConfirmActionResults): void {
    if (status === 'approved') {
      const data: ConsolidationOrderActionApproval = {
        ...order,
        consolidationType,
        approvedCases: selectedCases
          .map((bCase) => bCase.caseId)
          .filter((caseId) => caseId !== leadCaseId),
        leadCase: order.childCases.find((bCase) => bCase.caseId === leadCaseId)!,
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
                    slim={true}
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

            {featureFlags[CONSOLIDATIONS_ADD_CASE_ENABLED] && (
              <>
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
                            onChange={handleAddNewCaseDivisionCode}
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
                            onChange={handleAddNewCaseNumber}
                            aria-label="New case ID"
                            ref={caseIdRef}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid-col-1"></div>
                </div>
              </>
            )}

            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-5">
                <Button
                  id={`accordion-reject-button-${order.id}`}
                  onClick={() =>
                    confirmationModalRef.current?.show({
                      status: 'rejected',
                      cases: order.childCases.map((c) => c),
                    })
                  }
                  disabled={true}
                  //Disabled until we get to story CAMS-301
                  uswdsStyle={UswdsButtonStyle.Secondary}
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
              courts={officesList}
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
      </>
    </Accordion>
  );
}
