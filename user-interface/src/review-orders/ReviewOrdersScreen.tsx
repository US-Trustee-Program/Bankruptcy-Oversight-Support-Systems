import { useEffect, useState } from 'react';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import './ReviewOrdersScreen.scss';
import { Order, OrderResponseData } from '@/lib/type-declarations/chapter-15';
import { formatDate } from '@/lib/utils/datetime';

const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;

type ReviewOrderCourtInfo = {
  name: string;
  region: string;
  location: string;
};

export default function ReviewOrders() {
  const [courtSelection, setCourtSelection] = useState<ReviewOrderCourtInfo>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_caseSelection, setCaseSelection] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [orderList, setOrderList] = useState<Array<Order>>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isOrderListLoading, setIsOrderListLoading] = useState(false);

  /****  START MOCK DATA  ****/

  const regionNumber = '02';
  // const orderList = [
  //   {
  //     caseId: '23-12345',
  //     region: '02',
  //     location: 'Manhattan',
  //     caseTitle: 'Some case title',
  //     courtName: 'court 1',
  //     orderType: 'transfer',
  //     orderDate: '01/23/2024',
  //     status: 'pending',
  //     summaryText: '1st accordion',
  //     fullText: 'here is some content hidden inside the 1st accordion',
  //   },
  //   {
  //     caseId: '23-12346',
  //     region: '02',
  //     location: 'Manhattan',
  //     caseTitle: 'Some case title 2',
  //     courtName: 'court 2',
  //     orderDate: '01/24/2024',
  //     orderType: 'consolidation',
  //     status: 'pending',
  //     summaryText: '2nd accordion',
  //     fullText: 'here is some content hidden inside the 2nd accordion',
  //   },
  //   {
  //     caseId: '23-12347',
  //     region: '02',
  //     location: 'Manhattan',
  //     caseTitle: 'Some case title 3',
  //     courtName: 'court 2',
  //     orderDate: '01/25/2024',
  //     orderType: 'transfer',
  //     status: 'approved',
  //     summaryText: '3rd accordion',
  //     fullText: 'here is some content hidden inside the 3rd accordion',
  //   },
  //   {
  //     caseId: '23-12348',
  //     region: '02',
  //     location: 'Manhattan',
  //     caseTitle: 'Some case title 4',
  //     courtName: 'court 1',
  //     orderDate: '01/26/2024',
  //     orderType: 'transfer',
  //     status: 'pending',
  //     summaryText: '4th accordion',
  //     fullText: 'here is some content hidden inside the 4th accordion',
  //   },
  //   {
  //     caseId: '23-12349',
  //     region: '02',
  //     location: 'Manhattan',
  //     caseTitle: 'Some case title 5',
  //     courtName: 'court 3',
  //     orderDate: '01/27/2024',
  //     orderType: 'transfer',
  //     status: 'rejected',
  //     summaryText: '5th accordion',
  //     fullText: 'here is some content hidden inside the 5th accordion',
  //   },
  // ];

  const courtList: ReviewOrderCourtInfo[] = [
    {
      name: 'court 1',
      region: '02',
      location: 'Manhattan',
    },
    {
      name: 'court 2',
      region: '02',
      location: 'Manhattan',
    },
    {
      name: 'court 3',
      region: '02',
      location: 'Manhattan',
    },
  ];
  const courtListHashMap = new Map();
  courtList.map((court) => {
    courtListHashMap.set(court.name, court);
  });

  const caseList = ['case 1', 'case 2', 'case 3'];

  /****  END MOCK DATA  ****/

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

  useEffect(() => {
    getOrders();
  }, []);

  const statusType = new Map();
  statusType.set('pending', 'Pending Review');
  statusType.set('approved', 'Approved');
  statusType.set('rejected', 'Rejected');

  const orderType = new Map();
  orderType.set('transfer', 'Transfer');
  orderType.set('consolidation', 'Consolidation');

  function handleCourtSelection(ev: React.ChangeEvent<HTMLSelectElement>) {
    setCourtSelection(courtListHashMap.get(ev.target.value));
  }

  function handleCaseSelection(ev: React.ChangeEvent<HTMLSelectElement>) {
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
                    <div className="accordion-heading grid-row grid-gap-lg">
                      <div className="grid-col-1 case-id text-no-wrap">{order.caseId}</div>
                      <div className="grid-col-3 case-title text-no-wrap">{order.caseTitle}</div>
                      <div className="grid-col-1 order-date text-no-wrap">
                        {formatDate(order.orderDate)}
                      </div>
                      <div className="grid-col-3"></div>
                      <div className="grid-col-2 order-type text-no-wrap">
                        <span>{orderType.get(order.orderType)}</span>
                      </div>
                      <div className="grid-col-2 order-status text-no-wrap">
                        <span className={order.status}>{statusType.get(order.status)}</span>
                      </div>
                    </div>
                    <div className="accordion-content">
                      <div className="order-legal-statement">
                        <h4>
                          {formatDate(order.orderDate)} - {order.summaryText}
                        </h4>
                        <p>{order.fullText}</p>
                      </div>
                      <section className="order-form">
                        <div className="court-selection">
                          <div>
                            Transfer {order.caseId} from {order.caseTitle} to
                          </div>
                          <div>
                            <label>New Court</label>
                            <select
                              className="usa-select"
                              id={`court-selection-${order.caseId}`}
                              onChange={handleCourtSelection}
                            >
                              {courtList.map((court, index) => (
                                <option value={court.name} key={index}>
                                  {court.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="case-selection">
                          <label>New Case</label>
                          <select
                            className="usa-select"
                            id={`case-selection-${order.caseId}`}
                            onChange={handleCaseSelection}
                          >
                            {caseList.map((bCase, index) => (
                              <option value={bCase} key={index}>
                                {bCase}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="preview-results">
                          <CaseSelection
                            fromCourt={courtListHashMap.get(order.courtName)}
                            toCourt={courtSelection}
                          ></CaseSelection>
                        </div>
                      </section>
                    </div>
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

interface CaseSelectionProps {
  toCourt: ReviewOrderCourtInfo | undefined;
  fromCourt: ReviewOrderCourtInfo;
}

function CaseSelection(props: CaseSelectionProps) {
  const { fromCourt, toCourt }: CaseSelectionProps = props;

  return (
    <>
      {fromCourt && toCourt && (
        <>
          USTP Office: transfer from
          <span className="from-location">
            {fromCourt.region} - {fromCourt.location}
          </span>
          to
          <span className="to-location">
            {toCourt.region} - {toCourt.location}
          </span>
        </>
      )}
    </>
  );
}
