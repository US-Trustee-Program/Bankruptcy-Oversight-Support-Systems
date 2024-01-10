import './TransferOrderAccordion.scss';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import api from '@/lib/models/api';
import { OfficeDetails, Order, OrderTransfer } from '@/lib/type-declarations/chapter-15';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import SearchableSelect, { SearchableSelectOption } from '@/lib/components/SearchableSelect';

export function getOrderTransferFromOrder(order: Order): OrderTransfer {
  const { id, caseId, status, newCaseId, sequenceNumber } = order;
  return {
    id,
    caseId,
    newCaseId,
    status,
    sequenceNumber,
  };
}

interface TransferOrderAccordionProps {
  order: Order;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (order: Order) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
}

export function TransferOrderAccordion(props: TransferOrderAccordionProps) {
  const { order, statusType, orderType, officesList, expandedId, onExpand } = props;

  const regionSelectionRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<InputRef>(null);
  const caseIdRef = useRef<InputRef>(null);
  const approveButtonRef = useRef<ButtonRef>(null);

  // const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [orderTransfer, setOrderTransfer] = useState<OrderTransfer>(
    getOrderTransferFromOrder(order),
  );

  // function handleRegionSelection(ev: React.ChangeEvent<HTMLSelectElement>) {
  //   setSelectedRegionId(ev.target.value ? ev.target.value : null);
  // }

  function handleCourtSelection(selection: SearchableSelectOption) {
    const updated = { ...orderTransfer };
    const office = officesList.find((o) => o.divisionCode === selection?.key);
    updated.newRegionId = office?.regionId;
    updated.newRegionName = office?.regionName;
    updated.newCourtName = office?.courtName;
    updated.newCourtDivisionName = office?.courtDivisionName;
    updated.newDivisionCode = office?.divisionCode;
    if (updated.newCaseId && updated.newCourtDivisionName) {
      approveButtonRef.current?.disableButton(false);
    } else {
      approveButtonRef.current?.disableButton(true);
    }
    setOrderTransfer(updated);
  }

  function handleCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const allowedCharsPattern = /[0-9]/g;

    const filteredInput = ev.target.value.match(allowedCharsPattern) ?? [];
    if (filteredInput.length > 7) {
      filteredInput.splice(7);
    }
    if (filteredInput.length > 2) {
      filteredInput.splice(2, 0, '-');
    }

    const joinedInput = filteredInput?.join('') || '';
    caseIdRef.current?.setValue(joinedInput);

    const caseIdPattern = /^\d{2}-\d{5}$/;
    const newCaseId = caseIdPattern.test(joinedInput) ? joinedInput : undefined;

    if (!newCaseId) return;

    const updated = { ...orderTransfer };
    updated.newCaseId = newCaseId;
    if (updated.newCaseId && updated.newCourtDivisionName) {
      approveButtonRef.current?.disableButton(false);
    } else {
      approveButtonRef.current?.disableButton(true);
    }
    setOrderTransfer(updated);
  }

  function approveOrder(): void {
    if (
      !(orderTransfer.newCaseId && orderTransfer.newCourtDivisionName && orderTransfer.newCourtName)
    ) {
      return;
    }

    orderTransfer.status = 'approved';
    orderTransfer.newCaseId = orderTransfer.newDivisionCode + '-' + orderTransfer.newCaseId;

    api
      .patch(`/orders/${orderTransfer.id}`, orderTransfer)
      .then(() => {
        // TODO: Need to alert the user there was a success.
        props.onOrderUpdate({ ...order, ...orderTransfer });
      })
      .catch((e) => {
        // TODO: Need to alert the user there was a failure.
        console.error('The order update failed', e);
      });
  }

  function cancelUpdate(): void {
    setOrderTransfer(getOrderTransferFromOrder(order));
    // setSelectedRegionId(null);
    regionSelectionRef.current?.clearValue();
    courtSelectionRef.current?.clearValue();
    caseIdRef.current?.resetValue();
    approveButtonRef.current?.disableButton(true);
  }

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      expandedId={expandedId}
      onExpand={onExpand}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div className="grid-col-1 case-id text-no-wrap">{getCaseNumber(order.caseId)}</div>
        <div className="grid-col-4 case-title text-no-wrap">{order.caseTitle}</div>
        <div className="grid-col-1 order-date text-no-wrap">{formatDate(order.orderDate)}</div>
        <div className="grid-col-2"></div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span>{orderType.get(order.orderType)}</span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span className={order.status}>{statusType.get(order.status)}</span>
        </div>
      </section>
      <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-1"></div>
          <div className="order-legal-statement grid-col-10">
            <Link to="#">
              {order.documentNumber && (
                <span className="document-number">#{order.documentNumber} - </span>
              )}
              {formatDate(order.orderDate)} - {order.summaryText}
            </Link>
            <p className="measure-6">{order.fullText}</p>
            {order.documents && <DocketEntryDocumentList documents={order.documents} />}
          </div>
          <div className="grid-col-1"></div>
        </div>
        {order.status === 'approved' && (
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="transfer-text grid-col-10">
              Transferred
              <span className="transfer-highlight__span">{getCaseNumber(order.caseId)}</span>
              from
              <span className="transfer-highlight__span">
                {order.courtName} ({order.courtDivisionName})
              </span>
              to case ID
              <span className="transfer-highlight__span">{getCaseNumber(order.newCaseId)}</span>
              and court
              <span className="transfer-highlight__span">
                {order.newCourtName} ({order.newCourtDivisionName})
              </span>
            </div>
            <div className="grid-col-1"></div>
          </div>
        )}
        {order.status !== 'approved' && (
          <section className="order-form" data-testid={`order-form-${order.id}`}>
            <div className="court-selection grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="transfer-from-to__div grid-col-10">
                <div className="transfer-text">
                  Transfer
                  <span className="transfer-highlight__span">{getCaseNumber(order.caseId)}</span>
                  from
                  <span className="transfer-highlight__span">
                    {order.courtName} ({order.courtDivisionName})
                  </span>
                  to
                </div>
                <div className="form-row">
                  {/* <div className="select-container region-select-container">
                    <label>New Region</label>
                    <div className="usa-combo-box">
                      <Select
                        className="usa-select new-region__select"
                        id={`region-selection-${order.id}`}
                        data-testid={`region-selection-${order.id}`}
                        onChange={handleRegionSelection}
                        aria-label="New region options"
                        ref={regionSelectionRef}
                        value={orderTransfer.newRegionId}
                      >
                        {Array.from(regionsMap, ([regionId, regionName]) => (
                          <option value={regionId} key={regionId}>
                            {regionName} ({regionId})
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div> */}
                  {/* <div className="select-container court-select-container">
                    <label>New Court</label>
                    <div className="usa-combo-box">
                      <Select
                        className="usa-select new-court__select"
                        id={`court-selection-${order.id}`}
                        data-testid={`court-selection-${order.id}`}
                        onChange={handleCourtSelection}
                        aria-label="New court options"
                        ref={courtSelectionRef}
                        value={orderTransfer.newDivisionCode}
                        disabled={!selectedRegionId}
                      >
                        {officesList
                          .filter((office) => {
                            if (selectedRegionId) {
                              return office.regionId === selectedRegionId;
                            }
                            return false;
                          })
                          .map((court, index) => (
                            <option value={court.divisionCode} key={index}>
                              {court.courtName} ({court.courtDivisionName})
                            </option>
                          ))}
                      </Select>
                    </div>
                  </div> */}

                  <div className="select-container court-select-container">
                    <label>New Court</label>
                    <div className="usa-combo-box">
                      <SearchableSelect
                        id={`court-selection-${order.id}`}
                        className="new-court__select"
                        data-testid={`court-selection-${order.id}`}
                        closeMenuOnSelect={true}
                        label="Filter by Summary"
                        aria-label="New court options"
                        ref={courtSelectionRef}
                        onChange={handleCourtSelection}
                        options={officesList.map((court) => {
                          return {
                            value: court.divisionCode,
                            label: `${court.courtName} ${court.courtDivisionName}`,
                          };
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid-col-1"></div>
            </div>
            {orderTransfer.newRegionId && orderTransfer.newCourtDivisionName && (
              <div className="preview-results grid-row grid-gap-lg">
                <div className="grid-col-1"></div>
                <div className="grid-col-10">
                  <span data-testid={`preview-description-${order.id}`}>
                    <CaseSelection
                      fromCourt={{
                        region: order.regionId,
                        courtDivisionName: order.courtDivisionName,
                      }}
                      toCourt={{
                        region: orderTransfer.newRegionId,
                        courtDivisionName: orderTransfer.newCourtDivisionName,
                      }}
                    ></CaseSelection>
                  </span>
                </div>
                <div className="grid-col-1"></div>
              </div>
            )}
            <div className="case-selection grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-4">
                <label>New Case</label>
                <div>
                  <Input
                    id={`new-case-input-${order.id}`}
                    data-testid={`new-case-input-${order.id}`}
                    className="usa-input"
                    value={orderTransfer.newCaseId || ''}
                    onChange={handleCaseInputChange}
                    aria-label="New case ID"
                    ref={caseIdRef}
                  />
                </div>
              </div>
              <div className="grid-col-6"></div>
              <div className="grid-col-1"></div>
            </div>
            <div className="button-bar grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-6"></div>
              <div className="grid-col-2">
                <Button onClick={cancelUpdate} uswdsStyle={UswdsButtonStyle.Outline}>
                  Cancel
                </Button>
              </div>
              <div className="grid-col-2">
                <Button onClick={approveOrder} disabled={true} ref={approveButtonRef}>
                  Approve
                </Button>
              </div>
              <div className="grid-col-1"></div>
            </div>
          </section>
        )}
      </section>
    </Accordion>
  );
}

interface CaseSelectionAttributes {
  courtDivisionName: string;
  region: string;
}

interface CaseSelectionProps {
  fromCourt: CaseSelectionAttributes;
  toCourt: CaseSelectionAttributes;
}

function CaseSelection(props: CaseSelectionProps) {
  const { fromCourt, toCourt }: CaseSelectionProps = props;

  return (
    <>
      USTP Office: transfer from
      <span className="from-location transfer-highlight__span">
        {fromCourt.region} - {fromCourt.courtDivisionName}
      </span>
      to
      <span className="to-location transfer-highlight__span">
        {toCourt.region} - {toCourt.courtDivisionName}
      </span>
    </>
  );
}
