import { useEffect, useRef, useState } from 'react';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import './DataVerificationScreen.scss';
import { OfficesResponseData, OrderResponseData, Order } from '@/lib/type-declarations/chapter-15';
import { TransferOrderAccordion } from './TransferOrderAccordion';
import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import Icon from '@/lib/components/uswds/Icon';
import { ConsolidationOrderAccordion } from './ConsolidationOrderAccordion';
import {
  ConsolidationOrder,
  OrderStatus,
  OrderType,
  TransferOrder,
  isConsolidationOrder,
  isTransferOrder,
} from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import useFeatureFlags, { CONSOLIDATIONS_ENABLED } from '../lib/hooks/UseFeatureFlags';

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
  const featureFlags = useFeatureFlags();
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>(['pending']);
  const [typeFilter, setTypeFilter] = useState<OrderType[]>(['transfer', 'consolidation']);
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

  function handleTransferOrderUpdate(alertDetails: AlertDetails, updatedOrder?: TransferOrder) {
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

  function handleConsolidationOrderUpdate(
    _alertDetails: AlertDetails,
    _updatedOrder?: ConsolidationOrder,
  ) {
    // TODO: Implement the APi call to update the consolidation order.
  }

  function handleStatusFilter(filterString: OrderStatus) {
    if (statusFilter.includes(filterString)) {
      setStatusFilter(
        statusFilter.filter((filter) => {
          return filter !== filterString;
        }),
      );
    } else {
      setStatusFilter([...statusFilter, filterString]);
    }
  }

  function handleTypeFilter(filterString: OrderType) {
    if (typeFilter.includes(filterString)) {
      setTypeFilter(
        typeFilter.filter((filter) => {
          return filter !== filterString;
        }),
      );
    } else {
      setTypeFilter([...typeFilter, filterString]);
    }
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
              <div className="filters order-status">
                <Filter<OrderStatus>
                  label="Pending Review"
                  filterType="pending"
                  filters={statusFilter}
                  callback={handleStatusFilter}
                />
                <Filter<OrderStatus>
                  label="Approved"
                  filterType="approved"
                  filters={statusFilter}
                  callback={handleStatusFilter}
                />
                <Filter<OrderStatus>
                  label="Rejected"
                  filterType="rejected"
                  filters={statusFilter}
                  callback={handleStatusFilter}
                />
                {featureFlags[CONSOLIDATIONS_ENABLED] && (
                  <>
                    <Filter<OrderType>
                      label="Transfer"
                      filterType="transfer"
                      filters={typeFilter}
                      callback={handleTypeFilter}
                    />
                    <Filter<OrderType>
                      label="Consolidation"
                      filterType="consolidation"
                      filters={typeFilter}
                      callback={handleTypeFilter}
                    />
                  </>
                )}
              </div>
              <div className="data-verification-accordion-header">
                <div className="grid-row grid-gap-lg">
                  <div className="grid-col-6 text-no-wrap">Court District</div>
                  <div className="grid-col-2 text-no-wrap">Event Date</div>
                  <div className="grid-col-2 text-no-wrap">Event Type</div>
                  <div className="grid-col-2 text-no-wrap">Event Status</div>
                </div>
              </div>
              <AccordionGroup>
                {orderList
                  .filter((o) => {
                    if (isConsolidationOrder(o)) {
                      return featureFlags[CONSOLIDATIONS_ENABLED];
                    } else {
                      return true;
                    }
                  })
                  .filter((o) => typeFilter.includes(o.orderType))
                  .filter((o) => statusFilter.includes(o.status))
                  .map((order) => {
                    return isTransferOrder(order) ? (
                      <TransferOrderAccordion
                        key={`accordion-${order.id}`}
                        order={order}
                        regionsMap={regionsMap}
                        officesList={officesList}
                        orderType={orderType}
                        statusType={orderStatusType}
                        onOrderUpdate={handleTransferOrderUpdate}
                      ></TransferOrderAccordion>
                    ) : (
                      <ConsolidationOrderAccordion
                        key={`accordion-${order.id}`}
                        order={order}
                        regionsMap={regionsMap}
                        officesList={officesList}
                        orderType={orderType}
                        statusType={orderStatusType}
                        onOrderUpdate={handleConsolidationOrderUpdate}
                      ></ConsolidationOrderAccordion>
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

interface FilterProps<T extends string> {
  label: string;
  filterType: T;
  filters: T[];
  callback: (filterString: T) => void;
}

function Filter<T extends string>(props: FilterProps<T>) {
  const { label, filterType, filters, callback } = props;
  return (
    <div
      className={`filter ${filterType}${filters.includes(filterType) ? ' active' : ' inactive'} usa-tag--big`}
      aria-label={`Filter on ${filterType.charAt(0).toUpperCase() + filterType.slice(1)} status`}
      onClick={() => callback(filterType)}
      data-testid={`order-status-filter-${filterType}`}
    >
      {label}
      <Icon name="check" className={filters.includes(filterType) ? 'active' : ''}></Icon>
    </div>
  );
}
