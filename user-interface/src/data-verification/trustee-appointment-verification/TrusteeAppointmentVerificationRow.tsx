import { useState } from 'react';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { getCaseNumber } from '@common/cams/cases';
import {
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import { formatDate } from '@/lib/utils/datetime';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';
import { buildAppointmentTaskReasonParts } from './trustee-appointment-explanation';
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
}

function subjectOf(order: TrusteeAppointmentVerificationListItem): string {
  const court = order.courtName ?? order.courtId;
  const division = order.courtDivisionName ?? order.divisionCode;
  return `${court} (${division}): Chapter ${order.chapter}`;
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
 * A trustee appointment task (CAMS-956) in the Data Verification queue. Expanding it fetches and
 * shows the task's detail (Slice 2): why it opened, which cases it affects, and the trustee's
 * actual appointments.
 */
export function TrusteeAppointmentVerificationRow(props: TrusteeAppointmentVerificationRowProps) {
  const { order, statusType, taskType, fieldHeaders, hidden, onExpand, onCollapse, expandedId } =
    props;
  const [detail, setDetail] = useState<TrusteeAppointmentVerificationDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);

  async function fetchDetail() {
    if (detail || detailLoadError || isLoadingDetail) return;
    setIsLoadingDetail(true);
    try {
      const response = await Api2.getTrusteeAppointmentVerificationDetail(order.id);
      setDetail((response as ResponseBody<TrusteeAppointmentVerificationDetail>).data);
    } catch {
      setDetailLoadError(true);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function handleExpand(id: string) {
    onExpand?.(id);
    await fetchDetail();
  }

  const taskTypeLabel = taskType.get(order.taskType);
  const subject = subjectOf(order);
  const statusLabel = statusType.get(order.status);

  function renderContent() {
    if (isLoadingDetail) {
      return <LoadingSpinner caption="Loading task details..." />;
    }
    if (detailLoadError) {
      return <p className="text-error">Unable to load task details. Please try again.</p>;
    }
    if (!detail) return null;

    return (
      <>
        <ReasonStatement detail={detail} />
        <AppointmentsTable appointments={detail.appointments} />
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
