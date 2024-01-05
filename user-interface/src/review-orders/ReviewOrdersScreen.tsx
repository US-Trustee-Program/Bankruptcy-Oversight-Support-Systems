import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import './ReviewOrdersScreen.scss';
import {
  OfficeDetails,
  OfficesResponseData,
  Order,
  OrderResponseData,
} from '@/lib/type-declarations/chapter-15';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';

const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;

export function officeSorter(a: OfficeDetails, b: OfficeDetails) {
  const aKey = a.courtName + '-' + a.courtDivisionName;
  const bKey = b.courtName + '-' + b.courtDivisionName;
  if (aKey === bKey) return 0;
  return aKey > bKey ? 1 : -1;
}

export default function ReviewOrders() {
  const [officesList, setOfficesList] = useState<Array<OfficeDetails>>([]);
  const [courtSelection, setCourtSelection] = useState<OfficeDetails>();
  const [caseSelection, setCaseSelection] = useState<string>('');
  const [orderList, setOrderList] = useState<Array<Order>>([]);
  const [_isOrderListLoading, setIsOrderListLoading] = useState(false);

  const regionNumber = '02';

  async function getOrders() {
    setIsOrderListLoading(true);
    api
      .get(`/orders`, {})
      .then((data) => {
        const response = data as OrderResponseData;
        setOrderList(response.body);
        setIsOrderListLoading(false);
      })
      .catch(() => {
        setOrderList([]);
        setIsOrderListLoading(false);
      });
  }

  async function getOffices() {
    api
      .get(`/offices`, {})
      .then((data) => {
        const response = data as OfficesResponseData;
        setOfficesList(response.body.sort(officeSorter));
      })
      .catch(() => {});
  }

  useEffect(() => {
    getOrders();
    getOffices();
  }, []);

  const statusType = new Map();
  statusType.set('pending', 'Pending Review');
  statusType.set('approved', 'Approved');
  statusType.set('rejected', 'Rejected');

  const orderType = new Map();
  orderType.set('transfer', 'Transfer');
  orderType.set('consolidation', 'Consolidation');

  function handleCourtSelection(ev: React.ChangeEvent<HTMLSelectElement>) {
    const office = officesList.find((o) => o.divisionCode === ev.target.value);
    if (office) setCourtSelection(office);
    else setCourtSelection(undefined);
  }

  function handleCaseInputChange(ev: React.ChangeEvent<HTMLInputElement>) {
    console.log('id', ev.target.id);
    setCaseSelection(ev.target.value);
  }

  return (
    <div data-testid="review-orders-screen" className="review-orders-screen">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Review Court Orders</h1>
          <h2>Region {regionNumber}</h2>

          <section className="order-list-container">
            <AccordionGroup>
              {orderList.map((order, idx: number) => {
                return (
                  <Accordion key={idx} id={`order-list-${idx}`}>
                    <section
                      className="accordion-heading grid-row grid-gap-lg"
                      data-testid={`accordion-heading-${idx}`}
                    >
                      <div className="grid-col-1 case-id text-no-wrap">
                        {getCaseNumber(order.caseId)}
                      </div>
                      <div className="grid-col-4 case-title text-no-wrap">{order.caseTitle}</div>
                      <div className="grid-col-1 order-date text-no-wrap">
                        {formatDate(order.orderDate)}
                      </div>
                      <div className="grid-col-2"></div>
                      <div className="grid-col-2 order-type text-no-wrap">
                        <span>{orderType.get(order.orderType)}</span>
                      </div>
                      <div className="grid-col-2 order-status text-no-wrap">
                        <span className={order.status}>{statusType.get(order.status)}</span>
                      </div>
                    </section>
                    <section className="accordion-content" data-testid={`accordion-content-${idx}`}>
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
                          {order.documents && (
                            <DocketEntryDocumentList documents={order.documents} />
                          )}
                        </div>
                        <div className="grid-col-1"></div>
                      </div>
                      <section className="order-form">
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
                              <select
                                className="usa-select new-court__select"
                                id={`court-selection-${order.caseId}`}
                                data-testid={`court-selection-${idx}`}
                                onChange={handleCourtSelection}
                                aria-label="New court options"
                              >
                                <option value=""></option>
                                {officesList.map((court, index) => (
                                  <option value={court.divisionCode} key={index}>
                                    {court.courtName} ({court.courtDivisionName})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid-col-1"></div>
                        </div>
                        <div className="case-selection grid-row grid-gap-lg">
                          <div className="grid-col-1"></div>
                          <div className="grid-col-4">
                            <label>New Case</label>
                            <div>
                              <input
                                id={`new-case-input-${idx}`}
                                data-testid={`new-case-input-${idx}`}
                                className="usa-input"
                                value={caseSelection}
                                onChange={handleCaseInputChange}
                                aria-label="New case ID"
                              />
                            </div>
                          </div>
                          <div className="grid-col-6"></div>
                          <div className="grid-col-1"></div>
                        </div>
                        <div className="preview-results grid-row grid-gap-lg">
                          <div className="grid-col-1"></div>
                          <div className="grid-col-10">
                            <span data-testid={`preview-description-${idx}`}>
                              <CaseSelection
                                fromCourt={{
                                  region: order.regionId,
                                  courtDivisionName: order.courtDivisionName,
                                }}
                                toCourt={courtSelection}
                              ></CaseSelection>
                            </span>
                          </div>
                          <div className="grid-col-1"></div>
                        </div>
                      </section>
                    </section>
                  </Accordion>
                );
              })}
            </AccordionGroup>
          </section>
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}

interface CaseSelectionAttributes {
  courtDivisionName: string;
  region: string;
}

interface CaseSelectionProps {
  fromCourt: CaseSelectionAttributes;
  toCourt?: CaseSelectionAttributes;
}

function CaseSelection(props: CaseSelectionProps) {
  const { fromCourt, toCourt }: CaseSelectionProps = props;

  return (
    <>
      {fromCourt && toCourt && (
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
      )}
    </>
  );
}
