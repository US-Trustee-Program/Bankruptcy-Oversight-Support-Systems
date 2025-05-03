import './DataVerificationScreen.scss';

import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Stop } from '@/lib/components/Stop';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';
import Alert, { AlertDetails, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Icon from '@/lib/components/uswds/Icon';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { sortByDate } from '@/lib/utils/datetime';
import { orderStatusType, orderType } from '@/lib/utils/labels';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  ConsolidationOrder,
  isConsolidationOrder,
  isTransferOrder,
  Order,
  OrderStatus,
  OrderType,
  TransferOrder,
} from '@common/cams/orders';
import { CamsRole } from '@common/cams/roles';
import { useEffect, useRef, useState } from 'react';

import useFeatureFlags, {
  CONSOLIDATIONS_ENABLED,
  TRANSFER_ORDERS_ENABLED,
} from '../lib/hooks/UseFeatureFlags';
import { ConsolidationOrderAccordion } from './consolidation/ConsolidationOrderAccordion';
import { courtSorter } from './dataVerificationHelper';
import { TransferOrderAccordion } from './TransferOrderAccordion';

interface FilterProps<T extends string> {
  callback: (filterString: T) => void;
  filters: T[];
  filterType: T;
  label: string;
}

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
    timeOut: 8,
    type: UswdsAlertStyle.Success,
  });

  const session = LocalStorage.getSession();
  const hasValidPermissions = session?.user?.roles?.includes(CamsRole.DataVerifier);
  const hasOffices = session?.user?.offices && session?.user?.offices.length > 0;
  const showDataVerification = hasValidPermissions && hasOffices;

  // TODO: This needs to be dynamic!
  const regionHeader = 'Region 02';

  const api = useApi2();

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Event Type', 'Event Status'];

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

  async function getCourts() {
    api
      .getCourts()
      .then((response) => {
        const courts = (response as ResponseBody<CourtDivisionDetails[]>).data;
        setCourts(courts.filter((division) => !division.isLegacy).sort(courtSorter));
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
      if (!isHidden) visibleItemCount++;
      if (order.status === 'pending') pendingItemCount++;

      return isTransferOrder(order) ? (
        <TransferOrderAccordion
          courts={courts}
          fieldHeaders={accordionFieldHeaders}
          hidden={isHidden}
          key={`accordion-${order.id}`}
          onOrderUpdate={handleTransferOrderUpdate}
          order={order}
          orderType={orderType}
          regionsMap={regionsMap}
          statusType={orderStatusType}
        ></TransferOrderAccordion>
      ) : (
        <ConsolidationOrderAccordion
          courts={courts}
          fieldHeaders={accordionFieldHeaders}
          hidden={isHidden}
          key={`accordion-${order.id}`}
          onOrderUpdate={handleConsolidationOrderUpdate}
          order={order}
          orderType={orderType}
          regionsMap={regionsMap}
          statusType={orderStatusType}
        ></ConsolidationOrderAccordion>
      );
    });

  return (
    <MainContent className="data-verification-screen" data-testid="data-verification-screen">
      <DocumentTitle name="Data Verification" />
      <Alert
        id="data-verification-alert"
        message={reviewOrderAlert.message}
        ref={alertRef}
        role="status"
        timeout={reviewOrderAlert.timeOut}
        type={reviewOrderAlert.type}
      />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Data Verification</h1>
          {!hasValidPermissions && (
            <Stop
              asError
              id="forbidden-alert"
              message="You do not have permission to verify orders in CAMS."
              title="Forbidden"
            ></Stop>
          )}
          {hasValidPermissions && !hasOffices && (
            <Stop
              id="no-office"
              message="You cannot verify orders because you are not currently assigned to a USTP office in Active Directory."
              showHelpDeskContact
              title="No Office Assigned"
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
                          callback={handleTypeFilter}
                          filters={typeFilter}
                          filterType="transfer"
                          label="Transfer"
                        />
                      )}
                      {featureFlags[CONSOLIDATIONS_ENABLED] && (
                        <Filter<OrderType>
                          callback={handleTypeFilter}
                          filters={typeFilter}
                          filterType="consolidation"
                          label="Consolidation"
                        />
                      )}
                    </div>
                  </div>
                  <div className="event-status-container">
                    <h4 className="event-header">Event Status</h4>
                    <div>
                      <Filter<OrderStatus>
                        callback={handleStatusFilter}
                        filters={statusFilter}
                        filterType="pending"
                        label="Pending Review"
                      />
                      <Filter<OrderStatus>
                        callback={handleStatusFilter}
                        filters={statusFilter}
                        filterType="approved"
                        label="Verified"
                      />
                      <Filter<OrderStatus>
                        callback={handleStatusFilter}
                        filters={statusFilter}
                        filterType="rejected"
                        label="Rejected"
                      />
                    </div>
                  </div>
                </div>
                {pendingItemCount === 0 && (
                  <Alert
                    className="measure-6"
                    id="no-pending-orders"
                    inline={true}
                    message="There are no case events pending review"
                    show={true}
                    slim={true}
                    title="All case events reviewed"
                    type={UswdsAlertStyle.Info}
                  ></Alert>
                )}
                {visibleItemCount === 0 && orderList.length > 0 && (
                  <Alert
                    className="measure-6"
                    id="too-many-filters"
                    inline={true}
                    message="Please enable one or more filters to show hidden cases"
                    show={true}
                    slim={true}
                    title="All Cases Hidden"
                    type={UswdsAlertStyle.Info}
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
        <div className="grid-col-1"></div>
      </div>
    </MainContent>
  );
}

function Filter<T extends string>(props: FilterProps<T>) {
  const { callback, filters, filterType, label } = props;
  return (
    <button
      aria-checked={filters.includes(filterType) ? true : false}
      aria-label={`Filter on ${label} status`}
      className={`filter ${filterType}${filters.includes(filterType) ? ' active' : ' inactive'} usa-tag--big usa-button--unstyled`}
      data-testid={`order-status-filter-${filterType}`}
      onClick={() => callback(filterType)}
      role="switch"
      title={generateTooltip(label, filters.includes(filterType))}
    >
      {label}
      <Icon className={filters.includes(filterType) ? 'active' : ''} name="check"></Icon>
    </button>
  );
}

function generateTooltip(label: string, isActive: boolean) {
  const base = `${label} ${isActive ? 'shown' : 'hidden'}.`.toLowerCase();
  const tooltip = base.slice(0, 1).toUpperCase() + base.slice(1);
  return tooltip;
}
