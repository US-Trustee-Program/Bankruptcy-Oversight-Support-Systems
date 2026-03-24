import './DataVerificationScreen.scss';
import { useEffect, useRef, useState } from 'react';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { useSessionState } from '@/lib/hooks/UseSessionState';
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
import { DataVerificationItem, isTrusteeMatchVerification } from '@common/cams/data-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import useFeatureFlags, {
  CONSOLIDATIONS_ENABLED,
  TRANSFER_ORDERS_ENABLED,
  TRUSTEE_VERIFICATION_ENABLED,
} from '../lib/hooks/UseFeatureFlags';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { TrusteeMatchVerificationAccordion } from './trustee-verification/TrusteeMatchVerificationAccordion';
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
  const [typeSelections, setTypeSelections] = useSessionState<ComboOption[]>(
    'cams:filter:data-verification:type',
    [],
  );
  const [statusSelections, setStatusSelections] = useSessionState<ComboOption[]>(
    'cams:filter:data-verification:status',
    [
      { value: 'pending', label: 'Pending Review' },
      { value: 'approved', label: 'Verified' },
      { value: 'rejected', label: 'Rejected' },
    ],
  );
  const typeFilter = typeSelections.map((s) => s.value as OrderType);
  const statusFilter = statusSelections.map((s) => s.value as OrderStatus);
  const [regionsMap, setRegionsMap] = useState<Map<string, string>>(new Map());
  const [courts, setCourts] = useState<Array<CourtDivisionDetails>>([]);
  const [orderList, setOrderList] = useState<Array<DataVerificationItem>>([]);
  const [isOrderListLoading, setIsOrderListLoading] = useState(true);
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

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Task Type', 'Task Status'];

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
      newOrderList.push(...orders);
      setOrderList(newOrderList);
    }
    // display alert
    setReviewOrderAlert(alertDetails);
    alertRef.current?.show();
  }

  function handleTrusteeMatchVerificationUpdate(
    alertDetails: AlertDetails,
    updatedOrder: TrusteeMatchVerification,
  ) {
    setOrderList((prev) =>
      prev.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
    );
    setReviewOrderAlert(alertDetails);
    alertRef.current?.show();
  }

  function handleTypeFilter(selections: ComboOption[]) {
    setTypeSelections(selections);
  }

  function handleStatusFilter(selections: ComboOption[]) {
    setStatusSelections(selections);
  }

  useEffect(() => {
    if (typeSelections.length > 0) return;
    const defaults: ComboOption[] = [
      ...(featureFlags[TRANSFER_ORDERS_ENABLED] ? [{ value: 'transfer', label: 'Transfer' }] : []),
      ...(featureFlags[CONSOLIDATIONS_ENABLED]
        ? [{ value: 'consolidation', label: 'Consolidation' }]
        : []),
      ...(featureFlags[TRUSTEE_VERIFICATION_ENABLED]
        ? [{ value: 'trustee-match', label: 'Trustee Mismatch' }]
        : []),
    ];
    if (defaults.length > 0) setTypeSelections(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    featureFlags[TRANSFER_ORDERS_ENABLED],
    featureFlags[CONSOLIDATIONS_ENABLED],
    featureFlags[TRUSTEE_VERIFICATION_ENABLED],
  ]);

  useEffect(() => {
    if (!showDataVerification) return;

    let cancelled = false;
    setIsOrderListLoading(true);

    async function loadOrders() {
      try {
        const [ordersResponse, verificationResponse] = await Promise.all([
          Api2.getOrders(),
          featureFlags[TRUSTEE_VERIFICATION_ENABLED]
            ? Api2.getTrusteeMatchVerifications()
            : Promise.resolve({ data: [] as TrusteeMatchVerification[] }),
        ]);
        if (cancelled) return;
        setOrderList([
          ...(ordersResponse as ResponseBody<Order[]>).data,
          ...(verificationResponse as ResponseBody<TrusteeMatchVerification[]>).data,
        ]);
      } catch {
        if (cancelled) return;
        setOrderList([]);
      }

      if (cancelled) return;

      try {
        const courtsResponse = await Api2.getCourts();
        if (cancelled) return;
        const courtList = (courtsResponse as ResponseBody<CourtDivisionDetails[]>).data;
        setCourts(sortByCourtLocation(courtList));
        setRegionsMap(
          courtList.reduce((regionsMap, court) => {
            if (!regionsMap.has(court.regionId)) {
              regionsMap.set(court.regionId, court.regionName);
            }
            return regionsMap;
          }, new Map()),
        );
      } catch {
        // courts failure — orders still display, court names fall back to court IDs
      }

      if (!cancelled) setIsOrderListLoading(false);
    }

    loadOrders();

    return () => {
      cancelled = true;
    };
    // featureFlags object and showDataVerification are intentionally omitted: we only want to
    // re-fetch when the trustee-verification flag toggles. showDataVerification is always true
    // for authenticated users by the time this effect runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureFlags[TRUSTEE_VERIFICATION_ENABLED]]);

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
    .filter((o) => {
      if (isTrusteeMatchVerification(o)) {
        return featureFlags[TRUSTEE_VERIFICATION_ENABLED];
      } else {
        return true;
      }
    })
    .sort((a, b) => {
      const dateA = (a as TransferOrder).orderDate ?? (a as TrusteeMatchVerification).createdOn;
      const dateB = (b as TransferOrder).orderDate ?? (b as TrusteeMatchVerification).createdOn;
      return sortByDate(dateA, dateB);
    })
    .map((order) => {
      const noFiltersSelected = typeFilter.length === 0 && statusFilter.length === 0;
      const isHidden =
        noFiltersSelected ||
        (typeFilter.length > 0 && !typeFilter.includes(order.orderType)) ||
        (statusFilter.length > 0 && !statusFilter.includes(order.status));
      if (!isHidden) {
        visibleItemCount++;
      }
      if (order.status === 'pending') {
        pendingItemCount++;
      }

      if (isTransferOrder(order)) {
        return (
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
        );
      } else if (isTrusteeMatchVerification(order)) {
        return (
          <TrusteeMatchVerificationAccordion
            key={`accordion-${order.id}`}
            order={order}
            orderType={orderType}
            statusType={orderStatusType}
            fieldHeaders={accordionFieldHeaders}
            courts={courts}
            hidden={isHidden}
            onOrderUpdate={handleTrusteeMatchVerificationUpdate}
          ></TrusteeMatchVerificationAccordion>
        );
      } else {
        return (
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
      }
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
            <LoadingSpinner caption="Loading Data Verification tasks..." />
          )}
          {!isOrderListLoading && showDataVerification && (
            <>
              <h2>{regionHeader}</h2>
              <section className="order-list-container">
                <div className="filters">
                  <ComboBox
                    id="task-type-filter"
                    label="Task Type"
                    multiSelect={true}
                    options={[
                      ...(featureFlags[TRANSFER_ORDERS_ENABLED]
                        ? [{ value: 'transfer', label: 'Transfer' }]
                        : []),
                      ...(featureFlags[CONSOLIDATIONS_ENABLED]
                        ? [{ value: 'consolidation', label: 'Consolidation' }]
                        : []),
                      ...(featureFlags[TRUSTEE_VERIFICATION_ENABLED]
                        ? [{ value: 'trustee-match', label: 'Trustee Mismatch' }]
                        : []),
                    ]}
                    selections={typeSelections}
                    onUpdateSelection={handleTypeFilter}
                    singularLabel="type"
                    pluralLabel="types"
                    hideClearAllButton
                    placeholder="- Select one or more -"
                  />
                  <ComboBox
                    id="task-status-filter"
                    label="Task Status"
                    multiSelect={true}
                    options={[
                      { value: 'pending', label: 'Pending Review' },
                      { value: 'approved', label: 'Verified' },
                      { value: 'rejected', label: 'Rejected' },
                    ]}
                    selections={statusSelections}
                    onUpdateSelection={handleStatusFilter}
                    singularLabel="status"
                    pluralLabel="statuses"
                    hideClearAllButton
                    placeholder="- Select one or more -"
                  />
                </div>
                {(orderList.length === 0 || (pendingItemCount === 0 && visibleItemCount > 0)) && (
                  <Alert
                    id="no-pending-orders"
                    type={UswdsAlertStyle.Info}
                    title="No data verification tasks found"
                    message="There are no data verification tasks."
                    show={true}
                    inline={true}
                    className="measure-6 margin-left-0"
                    slim={true}
                  ></Alert>
                )}
                {visibleItemCount === 0 && orderList.length > 0 && (
                  <Alert
                    id="too-many-filters"
                    type={UswdsAlertStyle.Info}
                    title="No data verification tasks found"
                    message="Please modify your search criteria to see tasks."
                    show={true}
                    inline={true}
                    className="measure-6 margin-left-0"
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
