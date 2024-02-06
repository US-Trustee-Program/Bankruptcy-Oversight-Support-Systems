import { useEffect, useRef, useState } from 'react';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import './DataVerificationScreen.scss';
import {
  OfficeDetails,
  OfficesResponseData,
  Order,
  OrderResponseData,
} from '@/lib/type-declarations/chapter-15';
import { TransferOrderAccordion } from './TransferOrderAccordion';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { orderType, transferStatusType } from '@/lib/utils/labels';

export interface AlertDetails {
  message: string;
  type: UswdsAlertStyle;
  timeOut: number;
}

export function officeSorter(a: OfficeDetails, b: OfficeDetails) {
  const aKey = a.courtName + '-' + a.courtDivisionName;
  const bKey = b.courtName + '-' + b.courtDivisionName;
  if (aKey === bKey) return 0;
  return aKey > bKey ? 1 : -1;
}

export default function DataVerificationScreen() {
  const [regionsMap, setRegionsMap] = useState<Map<string, string>>(new Map());
  const [officesList, setOfficesList] = useState<Array<OfficeDetails>>([]);
  const [orderList, setOrderList] = useState<Array<Order>>([]);
  const [isOrderListLoading, setIsOrderListLoading] = useState(false);
  const alertRef = useRef<AlertRefType>(null);
  const [reviewOrderAlert, setReviewOrderAlert] = useState<AlertDetails>({
    message: '',
    type: UswdsAlertStyle.Success,
    timeOut: 8,
  });

  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
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
        setRegionsMap(
          response.body.reduce((regionsMap, office) => {
            if (!regionsMap.has(office.regionId)) {
              regionsMap.set(office.regionId, office.regionName);
            }
            return regionsMap;
          }, new Map()),
        );
      })
      .catch(() => {});
  }

  function handleOrderUpdate(alertDetails: AlertDetails, updatedOrder?: Order) {
    if (updatedOrder) {
      setOrderList(
        orderList.map((order) => {
          return order.id === updatedOrder.id ? updatedOrder : order;
        }),
      );
    }

    setReviewOrderAlert(alertDetails);
    alertRef.current?.show();
  }

  useEffect(() => {
    getOrders();
    getOffices();
  }, []);

  return (
    <div data-testid="data-verification-screen" className="data-verification-screen">
      <Alert
        id="data-verification-alert"
        message={reviewOrderAlert.message}
        type={reviewOrderAlert.type}
        role="status"
        slim={true}
        ref={alertRef}
        timeout={reviewOrderAlert.timeOut}
      />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Data Verification</h1>
          <h2>Region {regionNumber}</h2>
          {isOrderListLoading && <LoadingSpinner caption="Loading court orders..." />}
          {!isOrderListLoading && (
            <section className="order-list-container">
              <div className="data-verification-accordion-header">
                <div className="grid-row grid-gap-lg">
                  <div className="grid-col-2 text-no-wrap">Case Number</div>
                  <div className="grid-col-4 text-no-wrap">Case Title</div>
                  <div className="grid-col-2 text-no-wrap">Order Date</div>
                  <div className="grid-col-2 text-no-wrap">Order Type</div>
                  <div className="grid-col-2 text-no-wrap">Order Status</div>
                </div>
              </div>
              <AccordionGroup>
                {orderList.map((order: Order) => {
                  return (
                    <TransferOrderAccordion
                      key={`accordion-${order.id}`}
                      order={order}
                      regionsMap={regionsMap}
                      officesList={officesList}
                      orderType={orderType}
                      statusType={transferStatusType}
                      onOrderUpdate={handleOrderUpdate}
                    ></TransferOrderAccordion>
                  );
                })}
              </AccordionGroup>
            </section>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
