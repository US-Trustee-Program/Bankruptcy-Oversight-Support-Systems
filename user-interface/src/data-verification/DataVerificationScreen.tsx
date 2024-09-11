import './DataVerificationScreen.scss';
import Icon from '@/lib/components/uswds/Icon';
import { useEffect, useRef, useState } from 'react';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import { TransferOrderAccordion } from './TransferOrderAccordion';
import Alert, { AlertDetails, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { ConsolidationOrderAccordion } from './consolidation/ConsolidationOrderAccordion';
import {
  ConsolidationOrder,
  Order,
  OrderStatus,
  OrderType,
  TransferOrder,
  isConsolidationOrder,
  isTransferOrder,
} from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import useFeatureFlags, { CONSOLIDATIONS_ENABLED } from '../lib/hooks/UseFeatureFlags';
import { sortDates } from '@/lib/utils/datetime';
import { useApi2 } from '@/lib/hooks/UseApi2';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import { ResponseBody } from '@common/api/response';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

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

  const globalAlert = useGlobalAlert();
  const session = LocalStorage.getSession();
  const regionNumber = '02';

  const api = useApi2();

  if (!session?.user?.roles?.includes(CamsRole.DataVerifier)) {
    globalAlert?.error('Invalid Permissions');
    return <></>;
  }

  async function getOrders() {
    setIsOrderListLoading(true);
    api
      .getOrders()
      .then((response) => {
        setOrderList((response as ResponseBody<Order[]>).data);
        setIsOrderListLoading(false);
      })
      .catch(() => {
        setOrderList([]);
        setIsOrderListLoading(false);
      });
  }

  async function getOffices() {
    api
      .getOffices()
      .then((response) => {
        const officeList = (response as ResponseBody<OfficeDetails[]>).data;
        setOfficesList(officeList.sort(officeSorter));
        setRegionsMap(
          officeList.reduce((regionsMap, office) => {
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
    alertDetails: AlertDetails,
    orders?: ConsolidationOrder[],
    deletedOrder?: ConsolidationOrder,
  ) {
    // update the orders list
    if (deletedOrder && orders) {
      const newOrderList = orderList.filter((o) => o.id !== deletedOrder.id);
      newOrderList.push(...(orders as Order[]));
      setOrderList(newOrderList);
    }
    // display alert
    setReviewOrderAlert(alertDetails);
    alertRef.current?.show();
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

  let visibleItemCount = 0;
  let pendingItemCount = 0;
  const accordionItems = orderList
    .filter((o) => {
      if (isConsolidationOrder(o)) {
        return featureFlags[CONSOLIDATIONS_ENABLED];
      } else {
        return true;
      }
    })
    .sort((a, b) => sortDates(a.orderDate, b.orderDate))
    .map((order) => {
      const isHidden =
        !typeFilter.includes(order.orderType) || !statusFilter.includes(order.status);
      if (!isHidden) visibleItemCount++;
      if (order.status === 'pending') pendingItemCount++;

      return isTransferOrder(order) ? (
        <TransferOrderAccordion
          key={`accordion-${order.id}`}
          order={order}
          regionsMap={regionsMap}
          officesList={officesList}
          orderType={orderType}
          statusType={orderStatusType}
          onOrderUpdate={handleTransferOrderUpdate}
          hidden={isHidden}
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
          hidden={isHidden}
        ></ConsolidationOrderAccordion>
      );
    });

  return (
    <MainContent data-testid="data-verification-screen" className="data-verification-screen">
      <DocumentTitle name="Data Verification" />
      <Alert
        id="data-verification-alert"
        message={reviewOrderAlert.message}
        type={reviewOrderAlert.type}
        role="status"
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
            <>
              <h3>Filters</h3>
              <section className="order-list-container">
                <div className="filters order-status">
                  {featureFlags[CONSOLIDATIONS_ENABLED] && (
                    <>
                      <div className="event-type-container">
                        <div className="event-header">Event Type</div>
                        <div>
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
                        </div>
                      </div>
                    </>
                  )}
                  <div className="event-status-container">
                    <div className="event-header">Event Status</div>
                    <div>
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
                    </div>
                  </div>
                </div>
                {pendingItemCount === 0 && (
                  <Alert
                    id="no-pending-orders"
                    type={UswdsAlertStyle.Info}
                    title="All case events reviewed"
                    message="There are no case events pending review"
                    show={true}
                  ></Alert>
                )}
                {visibleItemCount === 0 && orderList.length > 0 && (
                  <Alert
                    id="too-many-filters"
                    type={UswdsAlertStyle.Info}
                    title="All Cases Hidden"
                    message="Please enable one or more filters to show hidden cases"
                    show={true}
                  ></Alert>
                )}
                {visibleItemCount > 0 && (
                  <>
                    <div className="data-verification-accordion-header" data-testid="orders-header">
                      <div className="grid-row grid-gap-lg">
                        <div className="grid-col-6 text-no-wrap">Court District</div>
                        <div className="grid-col-2 text-no-wrap">Order Filed</div>
                        <div className="grid-col-2 text-no-wrap">Event Type</div>
                        <div className="grid-col-2 text-no-wrap">Event Status</div>
                      </div>
                    </div>
                    <AccordionGroup>{...accordionItems}</AccordionGroup>
                  </>
                )}
              </section>
            </>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </MainContent>
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
