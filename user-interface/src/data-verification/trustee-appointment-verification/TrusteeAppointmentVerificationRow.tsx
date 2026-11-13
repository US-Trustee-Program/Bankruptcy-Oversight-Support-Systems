import './TrusteeAppointmentVerificationRow.scss';
import { useEffect, useRef, useState } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { getCaseNumber } from '@common/cams/cases';
import {
  TrusteeAppointmentRefreshResult,
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import Alert, { AlertDetails, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { formatDate } from '@/lib/utils/datetime';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';
import {
  buildAppointmentTaskReasonParts,
  buildRefreshResolvedMessage,
  buildResolvedStatement,
  buildRefreshStillUncoveredMessage,
  formatCourtAndDivision,
} from './trustee-appointment-explanation';
import { AppointmentsTable } from './AppointmentsTable';

export interface TrusteeAppointmentVerificationRowProps {
  order: TrusteeAppointmentVerificationListItem;
  statusType: Map<string, string>;
  taskType: Map<string, string>;
  fieldHeaders: string[];
  hidden?: boolean;
  onExpand?: (id: string) => void;
  onCollapse?: (id: string) => void;
  expandedId?: string;
  /** Called when a refresh resolves the task: the queue shows the alert and updates the row. */
  onOrderUpdate: (
    alertDetails: AlertDetails,
    order: TrusteeAppointmentVerificationListItem,
  ) => void;
}

type RefreshAlert = { type: UswdsAlertStyle; message: string };

function subjectOf(order: TrusteeAppointmentVerificationListItem): string {
  return `${formatCourtAndDivision(order)}: Chapter ${order.chapter}`;
}

function AffectedCases({ caseIds }: { caseIds: string[] }) {
  const sortedCaseIds = [...caseIds].sort();
  if (sortedCaseIds.length <= 1) {
    return (
      <NewTabLink to={`/case-detail/${sortedCaseIds[0]}`} label={getCaseNumber(sortedCaseIds[0])} />
    );
  }
  return (
    <span data-testid="affected-cases">
      {sortedCaseIds.length} cases:
      <span className="affected-cases-list">
        {sortedCaseIds.map((caseId) => (
          <span key={caseId} className="affected-case-item">
            <NewTabLink to={`/case-detail/${caseId}`} label={getCaseNumber(caseId)} />
          </span>
        ))}
      </span>
    </span>
  );
}

function ReasonStatement({ detail }: { detail: TrusteeAppointmentVerificationDetail }) {
  const { before, after } = buildAppointmentTaskReasonParts(detail.reason);
  const affectedCaseCount = detail.caseIds.length;
  return (
    <p className="problem-statement" data-testid="problem-statement">
      <span>
        {before}
        <NewTabLink to={`/trustees/${detail.trusteeId}`} label={detail.trusteeName} />
        {after} Affects {affectedCaseCount > 1 ? '' : '1 case: '}
      </span>
      <AffectedCases caseIds={detail.caseIds} />
    </p>
  );
}

/**
 * A trustee appointment task in the Data Verification queue. Expanding it fetches the detail: why
 * it opened, which cases it affects, and the trustee's actual appointments.
 */
export function TrusteeAppointmentVerificationRow(props: TrusteeAppointmentVerificationRowProps) {
  const {
    order,
    statusType,
    taskType,
    fieldHeaders,
    hidden,
    onExpand,
    onCollapse,
    expandedId,
    onOrderUpdate,
  } = props;
  const [detail, setDetail] = useState<TrusteeAppointmentVerificationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshAlert, setRefreshAlert] = useState<RefreshAlert | null>(null);
  // Resolving unmounts the Refresh button, so focus moves to the statement that replaces it. Only
  // a refresh made here hands off focus on resolve.
  const justResolvedRef = useRef(false);
  const resolvedStatementRef = useRef<HTMLParagraphElement>(null);
  const refreshAlertRef = useRef<AlertRefType>(null);

  /**
   * Refetches on every expand rather than caching the first load: another write (e.g. a case
   * joining the task through openOrJoin) can change caseIds/reason after the first expand, and a
   * verifier who hits a transient load failure can retry simply by collapsing and re-expanding.
   */
  async function loadDetail() {
    const response = await Api2.getTrusteeAppointmentVerificationDetail(order.id, order.trusteeId);
    setDetail((response as ResponseBody<TrusteeAppointmentVerificationDetail>).data);
  }

  async function fetchDetail() {
    if (isLoadingDetail) return;
    setIsLoadingDetail(true);
    setDetailLoadError(false);
    try {
      await loadDetail();
    } catch {
      setDetailLoadError(true);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  /**
   * "Refresh Trustee Appointments": the backend decides whether an active covering appointment now
   * exists. Resolved goes up to the queue (row status + top alert); still uncovered or a failure
   * stays here in the inline alert, and the task stays open. The button is never disabled, so
   * focus stays on it and the verifier can retry at once.
   */
  async function refresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshAlert(null);
    let result: TrusteeAppointmentRefreshResult;
    try {
      const response = await Api2.refreshTrusteeAppointmentVerification(order.id, order.trusteeId);
      result = (response as ResponseBody<TrusteeAppointmentRefreshResult>).data;
    } catch {
      setIsRefreshing(false);
      setRefreshAlert({
        type: UswdsAlertStyle.Error,
        message: 'Unable to refresh trustee appointments. Try again later.',
      });
      return;
    }
    // The call has settled, so end the progress state now. The reload below runs silently and
    // must not hold the spinner or the button.
    setIsRefreshing(false);
    if (result.outcome === 'resolved') {
      justResolvedRef.current = true;
      onOrderUpdate(
        {
          message: buildRefreshResolvedMessage(result.trusteeName, result.updatedCaseCount),
          type: UswdsAlertStyle.Success,
          timeOut: 8,
        },
        result.task,
      );
    } else {
      setRefreshAlert({
        type: UswdsAlertStyle.Warning,
        message: buildRefreshStillUncoveredMessage(result),
      });
    }
    await reloadAppointments();
  }

  /**
   * Reloads the detail in place, without the loading spinner, so the alert stays visible. Runs
   * after both a still-uncovered refresh and a resolved one, so a verified row shows the new
   * covering appointment.
   */
  async function reloadAppointments() {
    try {
      await loadDetail();
    } catch {
      // Keep the appointments already shown; the warning already tells the verifier to retry.
    }
  }

  async function handleExpand(id: string) {
    onExpand?.(id);
    await fetchDetail();
  }

  const taskTypeLabel = taskType.get(order.taskType);
  const subject = subjectOf(order);
  const statusLabel = statusType.get(order.status);
  const isResolved = order.status === 'approved';

  useEffect(() => {
    if (isResolved && justResolvedRef.current) {
      justResolvedRef.current = false;
      resolvedStatementRef.current?.focus();
    }
  }, [isResolved]);

  // The alert region is mounted once and only its content changes, so assistive technology
  // announces each warning or error as it arrives.
  useEffect(() => {
    if (refreshAlert) {
      refreshAlertRef.current?.show();
    } else {
      refreshAlertRef.current?.hide();
    }
  }, [refreshAlert]);

  function renderContent() {
    return (
      <>
        <div
          role="alert"
          className="detail-load-alert"
          data-testid={`detail-load-alert-${order.id}`}
        >
          {!isLoadingDetail && detailLoadError && (
            <p className="text-error">Unable to load task details. Please try again.</p>
          )}
        </div>
        {/* Mounted before the load so the loading text is announced when it appears. */}
        <div
          className="detail-load-status"
          role="status"
          data-testid={`detail-load-status-${order.id}`}
        >
          {isLoadingDetail && (
            <>
              <LoadingSpinner id={`detail-load-progress-${order.id}`} aria-hidden="true" />
              <span>Loading task details...</span>
            </>
          )}
        </div>
        {!isLoadingDetail && !detailLoadError && detail && (
          <>
            {isResolved && (
              <>
                <p
                  className="resolved-statement"
                  data-testid="resolved-statement"
                  ref={resolvedStatementRef}
                  tabIndex={-1}
                >
                  {buildResolvedStatement(detail.trusteeName)}
                </p>
                <p className="original-reason-label">Original reason</p>
              </>
            )}
            <ReasonStatement detail={detail} />
            {order.status === 'pending' && (
              <>
                <p className="refresh-guidance" data-testid="refresh-guidance">
                  To fix this, a Trustee Admin must add or reactivate the appointment on the
                  trustee&apos;s profile. Then{' '}
                  <Button
                    id={`refresh-trustee-appointments-${order.id}`}
                    uswdsStyle={UswdsButtonStyle.Unstyled}
                    onClick={refresh}
                    aria-disabled={isRefreshing}
                  >
                    Refresh Trustee Appointments
                  </Button>{' '}
                  to check again.
                </p>
                <div
                  className="refresh-status"
                  role="status"
                  data-testid={`refresh-status-${order.id}`}
                >
                  {isRefreshing && (
                    <>
                      <LoadingSpinner id={`refresh-progress-${order.id}`} aria-hidden="true" />
                      <span>Refreshing trustee appointments...</span>
                    </>
                  )}
                </div>
                <Alert
                  id={`refresh-alert-${order.id}`}
                  ref={refreshAlertRef}
                  className="refresh-alert"
                  type={refreshAlert?.type ?? UswdsAlertStyle.Warning}
                  role="alert"
                  message={refreshAlert?.message}
                  inline
                  slim
                  show={refreshAlert !== null}
                />
              </>
            )}
            <AppointmentsTable appointments={detail.appointments} />
          </>
        )}
      </>
    );
  }

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      hidden={hidden}
      expandedId={expandedId}
      onExpand={handleExpand}
      onCollapse={onCollapse}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div
          className="accordion-header-field grid-col-2 order-type text-no-wrap"
          data-cell={fieldHeaders[0]}
        >
          <span className="event-type-label" aria-label={`${fieldHeaders[0]} - ${taskTypeLabel}.`}>
            {taskTypeLabel}
          </span>
        </div>
        <div
          className="accordion-header-field grid-col-6 text-no-wrap"
          aria-label={`${fieldHeaders[1]} – ${subject}.`}
          data-cell={fieldHeaders[1]}
        >
          {subject}
        </div>
        <div
          className="accordion-header-field grid-col-2 text-no-wrap"
          aria-label={`${fieldHeaders[2]} on ${formatDate(order.taskDate)}.`}
          data-cell={fieldHeaders[2]}
        >
          {formatDate(order.taskDate)}
        </div>
        <div
          className="accordion-header-field grid-col-2 order-status text-no-wrap"
          data-cell={fieldHeaders[3]}
        >
          <span
            className={`${order.status} event-status-label`}
            aria-label={`${fieldHeaders[3]} - ${statusLabel}.`}
          >
            {statusLabel}
          </span>
        </div>
      </section>
      <section
        className="accordion-content trustee-appointment-content"
        data-testid={`accordion-content-${order.id}`}
      >
        {renderContent()}
      </section>
    </Accordion>
  );
}
