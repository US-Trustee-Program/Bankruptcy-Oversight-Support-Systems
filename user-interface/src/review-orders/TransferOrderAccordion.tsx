import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Input from '@/lib/components/uswds/Input';
import Select, { SelectRef } from '@/lib/components/uswds/Select';
import api from '@/lib/models/api';
import { OfficeDetails, Order, OrderTransfer } from '@/lib/type-declarations/chapter-15';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

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

interface TransferOrderAccorionProps {
  order: Order;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  officesList: Array<OfficeDetails>;
  onOrderUpdate: (order: Order) => void;
}

export function TransferOrderAccordion(props: TransferOrderAccorionProps) {
  const { order, statusType, orderType, officesList } = props;

  const courtSelectionRef = useRef<SelectRef>(null);
  const caseIdRef = useRef<InputRef>(null);

  const [orderTransfer, setOrderTransfer] = useState<OrderTransfer>(
    getOrderTransferFromOrder(order),
  );

  function handleCourtSelection(ev: React.ChangeEvent<HTMLSelectElement>) {
    const office = officesList.find((o) => o.divisionCode === ev.target.value);
    // TODO: Need to add court IDS to the OrderTransfer
    orderTransfer.newRegionId = office?.region;
    orderTransfer.newCourtName = office?.courtName;
    orderTransfer.newCourtDivisionName = office?.courtDivisionName;
    setOrderTransfer(orderTransfer);
  }

  function handleCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    // TODO: Add filter to the input component to limit the format?
    // TODO: Validate the case ID is in format NN-NNNNN.
    orderTransfer.newCaseId = ev.target.value;
    setOrderTransfer(orderTransfer);
  }

  function approveOrder(): void {
    if (
      !(orderTransfer.newCaseId && orderTransfer.newCourtDivisionName && orderTransfer.newCourtName)
    ) {
      return;
    }

    orderTransfer.status = 'approved';
    // TODO: Need to make sure the division code prefix is added HERE.
    // orderSelection.newCaseId = ''

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
    courtSelectionRef.current?.clearValue();
    caseIdRef.current?.clearValue();
  }

  return (
    <Accordion key={order.id} id={`order-list-${order.id}`}>
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
        <section className="order-form" data-testid={`order-form-${order.id}`}>
          <div className="court-selection grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="transfer-from-to__div grid-col-10">
              <div className="transfer-text">
                Transfer
                <span className="transfer-highlight__span">{order.caseId}</span>
                from
                <span className="transfer-highlight__span">
                  {order.courtName} ({order.courtDivisionName})
                </span>
                to
              </div>
              <label>New Court</label>
              <div className="usa-combo-box">
                {/* <div className="ustp-icon-input">
                  <select
                    className={`usa-select usa-tooltip usa-select new-court__select`}
                    id={`court-selection-${order.id}`}
                    onChange={(ev) => handleCourtSelection(ev, order)}
                    data-testid={`court-selection-${idx}`}
                    aria-label={'New court options'}
                    value={
                      orderSelection.id === order.id
                        ? orderSelection.newCourtDivisionCode
                        : ''
                    }
                  >
                    <option value={''}></option>
                    {officesList.map((court, index) => (
                      <option value={court.divisionCode} key={index}>
                        {court.courtName} ({court.courtDivisionName})
                      </option>
                    ))}
                  </select>
                </div> */}

                <Select
                  className="usa-select new-court__select"
                  id={`court-selection-${order.id}`}
                  data-testid={`court-selection-${order.id}`}
                  onChange={handleCourtSelection}
                  aria-label="New court options"
                  ref={courtSelectionRef}
                  value={orderTransfer.newCourtDivisionCode}
                >
                  {officesList.map((court, index) => (
                    <option value={court.divisionCode} key={index}>
                      {court.courtName} ({court.courtDivisionName})
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid-col-1"></div>
          </div>
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
          <div className="preview-results grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="grid-col-10">
              <span data-testid={`preview-description-${order.id}`}>
                {orderTransfer.newRegionId && orderTransfer.newCourtDivisionName && (
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
                )}
              </span>
            </div>
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
              <Button onClick={approveOrder}>Approve</Button>
            </div>
            <div className="grid-col-1"></div>
          </div>
        </section>
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
