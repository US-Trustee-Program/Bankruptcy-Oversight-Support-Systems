import { useEffect, useState } from 'react';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import './ReviewOrdersScreen.scss';
import {
  OfficeDetails,
  OfficesResponseData,
  Order,
  OrderResponseData,
} from '@/lib/type-declarations/chapter-15';
import { TransferOrderAccordion } from './TransferOrderAccordion';

// TODO: Consider moving statusType and orderType to a common lib.
export const statusType = new Map();
statusType.set('pending', 'Pending Review');
statusType.set('approved', 'Approved');
statusType.set('rejected', 'Rejected');

export const orderType = new Map();
orderType.set('transfer', 'Transfer');
orderType.set('consolidation', 'Consolidation');

export function officeSorter(a: OfficeDetails, b: OfficeDetails) {
  const aKey = a.courtName + '-' + a.courtDivisionName;
  const bKey = b.courtName + '-' + b.courtDivisionName;
  if (aKey === bKey) return 0;
  return aKey > bKey ? 1 : -1;
}

export default function ReviewOrders() {
  const [regionsMap, setRegionsMap] = useState<Map<string, string>>(new Map());
  const [officesList, setOfficesList] = useState<Array<OfficeDetails>>([]);
  const [orderList, setOrderList] = useState<Array<Order>>([]);
  const [_isOrderListLoading, setIsOrderListLoading] = useState(false);

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

  function handleOrderUpdate(updatedOrder: Order) {
    setOrderList(
      orderList.map((order) => {
        return order.id === updatedOrder.id ? updatedOrder : order;
      }),
    );
  }

  useEffect(() => {
    getOrders();
    getOffices();
  }, []);

  return (
    <div data-testid="review-orders-screen" className="review-orders-screen">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Review Court Orders</h1>
          <h2>Region {regionNumber}</h2>

          <section className="order-list-container">
            <AccordionGroup>
              {orderList.map((order: Order) => {
                return (
                  <TransferOrderAccordion
                    key={`accordion-${order.id}`}
                    order={order}
                    regionsMap={regionsMap}
                    officesList={officesList}
                    orderType={orderType}
                    statusType={statusType}
                    onOrderUpdate={handleOrderUpdate}
                  ></TransferOrderAccordion>
                );
              }) || <></>}
            </AccordionGroup>
          </section>
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
