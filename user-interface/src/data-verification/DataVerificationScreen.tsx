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
import { CourtDivisionDetails } from '@common/cams/courts';
import useFeatureFlags, {
  CONSOLIDATIONS_ENABLED,
  TRANSFER_ORDERS_ENABLED,
} from '../lib/hooks/UseFeatureFlags';
import { sortByDate } from '@/lib/utils/datetime';
import Api2 from '@/lib/models/api2';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import { ResponseBody } from '@common/api/response';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
import { Stop } from '@/lib/components/Stop';

export default function DataVerificationScreen() {
  const featureFlags = useFeatureFlags();
  const [statusFilter, setStatusFilter] = useState<OrderStatus[]>(['pending']);
  const [typeFilter, setTypeFilter] = useState<OrderType[]>(['transfer', 'consolidation']);
  const [regionsMap, setRegionsMap] = useState<Map<string, string>>(new Map());
  const [courts, setCourts] = useState<Array<CourtDivisionDetails>>([]);
  const [orderList, setOrderList] = useState<Array<Order>>([]);
  const [isOrderListLoading, setIsOrderListLoading] = useState(false);
  const alertRef = useRef<AlertRefType>(null);
  const [reviewOrderAlert, setReviewOrderAlert] = useState<AlertDetails>({
    message: '',
    type: UswdsAlertStyle.Success,
    timeOut: 8,
  });

  const session = LocalStorage.getSession();
  const hasValidPermissions = session?.user?.roles?.includes(CamsRole.DataVerifier);
  const hasOffices = session?.user?.offices && session?.user?.offices.length > 0;
  const showDataVerification = hasValidPermissions && hasOffices;

  // TODO: This needs to be dynamic!
  const regionHeader = 'Region 02';

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Event Type', 'Event Status'];

  async function getOrders() {
    setIsOrderListLoading(true);
    Api2.getOrders()
      .then((response) => {
        setOrderList((response as ResponseBody<Order[]>).data);
        setIsOrderListLoading(false);
      })
      .catch(() => {
        setOrderList([]);
        setIsOrderListLoading(false);
      });
  }

  async function getCourts() {
    Api2.getCourts()
      .then((response) => {
        const courts = (response as ResponseBody<CourtDivisionDetails[]>).data;
        setCourts(sortByCourtLocation(courts));
        setRegionsMap(
          courts.reduce((regionsMap, court) => {
            if (!regionsMap.has(court.regionId)) {
              regionsMap.set(court.regionId, court.regionName);
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
    if (showDataVerification) {
      getOrders();
      getCourts();
    }
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
    .filter((o) => {
      if (isTransferOrder(o)) {
        return featureFlags[TRANSFER_ORDERS_ENABLED];
      } else {
        return true;
      }
    })
    .sort((a, b) => sortByDate(a.orderDate, b.orderDate))
    .map((order) => {
      const isHidden =
        !typeFilter.includes(order.orderType) || !statusFilter.includes(order.status);
      if (!isHidden) {
        visibleItemCount++;
      }
      if (order.status === 'pending') {
        pendingItemCount++;
      }

      return isTransferOrder(order) ? (
        <TransferOrderAccordion
          key={`accordion-${order.id}`}
          order={order}
          regionsMap={regionsMap}
          courts={courts}
          orderType={orderType}
          statusType={orderStatusType}
          onOrderUpdate={handleTransferOrderUpdate}
          fieldHeaders={accordionFieldHeaders}
          hidden={isHidden}
        ></TransferOrderAccordion>
      ) : (
        <ConsolidationOrderAccordion
          key={`accordion-${order.id}`}
          order={order}
          regionsMap={regionsMap}
          courts={courts}
          orderType={orderType}
          statusType={orderStatusType}
          onOrderUpdate={handleConsolidationOrderUpdate}
          fieldHeaders={accordionFieldHeaders}
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
        <div className="grid-col-12">
          <h1>Data Verification</h1>
          {!hasValidPermissions && (
            <Stop
              id="forbidden-alert"
              title="Forbidden"
              message="You do not have permission to verify orders in CAMS."
              asError
            ></Stop>
          )}
          {hasValidPermissions && !hasOffices && (
            <Stop
              id="no-office"
              title="No Office Assigned"
              message="You cannot verify orders because you are not currently assigned to a USTP office in Active Directory."
              showHelpDeskContact
            ></Stop>
          )}
          {isOrderListLoading && showDataVerification && (
            <LoadingSpinner caption="Loading court orders..." />
          )}
          {!isOrderListLoading && showDataVerification && (
            <>
              <h2>{regionHeader}</h2>
              <h3>Filters</h3>
              <section className="order-list-container">
                <div className="filters order-status">
                  <div className="event-type-container">
                    <h4 className="event-header">Event Status</h4>
                    <div>
                      {featureFlags[TRANSFER_ORDERS_ENABLED] && (
                        <Filter<OrderType>
                          label="Transfer"
                          filterType="transfer"
                          filters={typeFilter}
                          callback={handleTypeFilter}
                        />
                      )}
                      {featureFlags[CONSOLIDATIONS_ENABLED] && (
                        <Filter<OrderType>
                          label="Consolidation"
                          filterType="consolidation"
                          filters={typeFilter}
                          callback={handleTypeFilter}
                        />
                      )}
                    </div>
                  </div>
                  <div className="event-status-container">
                    <h4 className="event-header">Event Status</h4>
                    <div>
                      <Filter<OrderStatus>
                        label="Pending Review"
                        filterType="pending"
                        filters={statusFilter}
                        callback={handleStatusFilter}
                      />
                      <Filter<OrderStatus>
                        label="Verified"
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
                    inline={true}
                    className="measure-6"
                  ></Alert>
                )}
                {visibleItemCount === 0 && orderList.length > 0 && (
                  <Alert
                    id="too-many-filters"
                    type={UswdsAlertStyle.Info}
                    title="All Cases Hidden"
                    message="Please enable one or more filters to show hidden cases"
                    show={true}
                    inline={true}
                    className="measure-6"
                  ></Alert>
                )}
                {visibleItemCount > 0 && (
                  <>
                    <div className="data-verification-accordion-header" data-testid="orders-header">
                      <div className="grid-row grid-gap-lg">
                        <div className="grid-col-6 text-no-wrap">
                          <h3>{accordionFieldHeaders[0]}</h3>
                        </div>
                        <h3 className="grid-col-2 text-no-wrap">{accordionFieldHeaders[1]}</h3>
                        <h3 className="grid-col-2 text-no-wrap">{accordionFieldHeaders[2]}</h3>
                        <h3 className="grid-col-2 text-no-wrap">{accordionFieldHeaders[3]}</h3>
                      </div>
                    </div>
                    <AccordionGroup>{...accordionItems}</AccordionGroup>
                  </>
                )}
              </section>
            </>
          )}
        </div>
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

function generateTooltip(label: string, isActive: boolean) {
  const base = `${label} ${isActive ? 'shown' : 'hidden'}.`.toLowerCase();
  const tooltip = base.slice(0, 1).toUpperCase() + base.slice(1);
  return tooltip;
}

function Filter<T extends string>(props: FilterProps<T>) {
  const { label, filterType, filters, callback } = props;
  return (
    <button
      className={`filter ${filterType}${filters.includes(filterType) ? ' active' : ' inactive'} usa-tag--big usa-button--unstyled`}
      aria-label={`Filter on ${label} status`}
      role="switch"
      aria-checked={filters.includes(filterType) ? true : false}
      onClick={() => callback(filterType)}
      data-testid={`order-status-filter-${filterType}`}
      title={generateTooltip(label, filters.includes(filterType))}
    >
      {label}
      <Icon name="check" className={filters.includes(filterType) ? 'active' : ''}></Icon>
    </button>
  );
}
