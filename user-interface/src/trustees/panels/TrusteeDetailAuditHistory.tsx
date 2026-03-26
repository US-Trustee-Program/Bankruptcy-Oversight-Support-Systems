import './TrusteeDetailAuditHistory.scss';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import {
  TrusteeHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeInternalContactHistory,
  TrusteeBankHistory,
  TrusteeSoftwareHistory,
  TrusteeOversightHistory,
  TrusteeAppointmentHistory,
  TrusteeZoomInfoHistory,
  TrusteeAssistantHistory,
  getAppointmentDetails,
  ZoomInfo,
} from '@common/cams/trustees';
import {
  TrusteeUpcomingKeyDatesHistory,
  TrusteeUpcomingKeyDates,
  isoToMMDDYYYY,
  isoToMMYYYY,
  isoToMMDD,
  isoRangeToMMDD,
} from '@common/cams/trustee-upcoming-key-dates';
import React from 'react';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import { Auditable } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';

const ROLE_DISPLAY_MAP = {
  [CamsRole.OversightAttorney]: 'Attorney',
  [CamsRole.OversightAuditor]: 'Auditor',
  [CamsRole.OversightParalegal]: 'Paralegal',
} as const;

export interface TrusteeDetailAuditHistoryProps {
  trusteeId: string;
}

type ShowTrusteeNameHistoryProps = Readonly<{ history: TrusteeNameHistory; idx: number }>;

function ShowTrusteeNameHistory(props: ShowTrusteeNameHistoryProps) {
  const { history, idx } = props;
  return (
    <tr>
      <td data-testid={`change-type-name-${idx}`}>Name</td>
      <td data-testid={`previous-name-${idx}`}>{history.before || '(none)'}</td>
      <td data-testid={`new-name-${idx}`}>{history.after || '(none)'}</td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

type ShowTrusteeContactHistoryProps = Readonly<{
  history: TrusteePublicContactHistory | TrusteeInternalContactHistory;
  idx: number;
}>;

function ShowTrusteeContactHistory(props: ShowTrusteeContactHistoryProps) {
  const { history, idx } = props;
  const changeType =
    history.documentType === 'AUDIT_PUBLIC_CONTACT' ? 'Public Contact' : 'Internal Contact';
  const testIdSuffix =
    history.documentType === 'AUDIT_PUBLIC_CONTACT' ? 'public-contact' : 'internal-contact';

  return (
    <tr>
      <td data-testid={`change-type-${testIdSuffix}-${idx}`}>{changeType}</td>
      <td data-testid={`previous-contact-${idx}`}>
        <FormattedContact
          contact={history.before}
          className="trustee-audit-history__address-before"
          testIdPrefix={`previous-contact-${idx}`}
          showLinks={false}
        />
      </td>
      <td data-testid={`new-contact-${idx}`}>
        <FormattedContact
          contact={history.after}
          className="trustee-audit-history__address-after"
          testIdPrefix={`new-contact-${idx}`}
          showLinks={false}
        />
      </td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

function BankList({ banks }: Readonly<{ banks?: string[] }>) {
  if (!banks || banks.length === 0) {
    return <>(none)</>;
  }
  return (
    <ul className="usa-list--unstyled">
      {banks.map((bank, index) => (
        <li key={`${bank}-${index}`}>{bank}</li>
      ))}
    </ul>
  );
}

type ShowTrusteeBankHistoryProps = Readonly<{
  history: TrusteeBankHistory;
  idx: number;
}>;

function ShowTrusteeBankHistory(props: ShowTrusteeBankHistoryProps) {
  const { history, idx } = props;

  return (
    <tr>
      <td data-testid={`change-type-banks-${idx}`}>Bank(s)</td>
      <td data-testid={`previous-banks-${idx}`}>
        <BankList banks={history.before} />
      </td>
      <td data-testid={`new-banks-${idx}`}>
        <BankList banks={history.after} />
      </td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

type ShowTrusteeSoftwareHistoryProps = Readonly<{
  history: TrusteeSoftwareHistory;
  idx: number;
}>;

function ShowTrusteeSoftwareHistory(props: ShowTrusteeSoftwareHistoryProps) {
  const { history, idx } = props;
  return (
    <tr>
      <td data-testid={`change-type-software-${idx}`}>Software</td>
      <td data-testid={`previous-software-${idx}`}>{history.before || '(none)'}</td>
      <td data-testid={`new-software-${idx}`}>{history.after || '(none)'}</td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

function ZoomInfoDisplay({ zoomInfo }: Readonly<{ zoomInfo?: ZoomInfo }>) {
  if (!zoomInfo) {
    return <>(none)</>;
  }
  return (
    <dl className="usa-list--unstyled">
      <dt>Link:</dt>
      <dd>{zoomInfo.link}</dd>
      <dt>Phone:</dt>
      <dd>{zoomInfo.phone}</dd>
      <dt>Meeting ID:</dt>
      <dd>{zoomInfo.meetingId}</dd>
      <dt>Passcode:</dt>
      <dd>{zoomInfo.passcode}</dd>
    </dl>
  );
}

type ShowTrusteeZoomInfoHistoryProps = Readonly<{
  history: TrusteeZoomInfoHistory;
  idx: number;
}>;

function ShowTrusteeZoomInfoHistory(props: ShowTrusteeZoomInfoHistoryProps) {
  const { history, idx } = props;

  return (
    <tr>
      <td data-testid={`change-type-zoom-info-${idx}`}>341 Meeting Zoom Info</td>
      <td
        data-testid={`previous-zoom-info-${idx}`}
        aria-label="Previous 341 meeting zoom information"
      >
        <ZoomInfoDisplay zoomInfo={history.before} />
      </td>
      <td data-testid={`new-zoom-info-${idx}`} aria-label="New 341 meeting zoom information">
        <ZoomInfoDisplay zoomInfo={history.after} />
      </td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

type ShowTrusteeOversightHistoryProps = Readonly<{
  history: TrusteeOversightHistory;
  idx: number;
}>;

function ShowTrusteeOversightHistory(props: ShowTrusteeOversightHistoryProps) {
  const { history, idx } = props;

  const before = history.before ? (
    <>
      {ROLE_DISPLAY_MAP[history.before.role] || history.before.role}
      <br />
      {history.before.user.name}
    </>
  ) : (
    '(none)'
  );
  const after = history.after ? (
    <>
      {ROLE_DISPLAY_MAP[history.after.role] || history.after.role}
      <br />
      {history.after.user.name}
    </>
  ) : (
    '(none)'
  );
  return (
    <tr>
      <td data-testid={`change-type-oversight-${idx}`}>Oversight</td>
      <td data-testid={`previous-oversight-${idx}`}>{before}</td>
      <td data-testid={`new-oversight-${idx}`}>{after}</td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

type ShowTrusteeAppointmentHistoryProps = Readonly<{
  history: TrusteeAppointmentHistory;
  idx: number;
}>;

function ShowTrusteeAppointmentHistory(props: ShowTrusteeAppointmentHistoryProps) {
  const { history, idx } = props;

  const formatAppointmentData = (data: typeof history.before | typeof history.after) => {
    if (!data) return '(none)';
    const { chapter, appointmentType } = data;

    // Build district display with guards for missing data
    let districtDisplay: string;
    if (data.courtName && data.courtDivisionName) {
      districtDisplay = `${data.courtName} (${data.courtDivisionName})`;
    } else if (data.courtName) {
      districtDisplay = data.courtName;
    } else if (data.courtId) {
      districtDisplay = `Court ${data.courtId}`;
    } else if (data.divisionCode) {
      districtDisplay = data.divisionCode;
    } else {
      districtDisplay = 'Court information not available';
    }

    return (
      <>
        Chapter: {getAppointmentDetails(chapter, appointmentType)}
        <br />
        District: {districtDisplay}
        <br />
        Appointed: {formatDate(data.appointedDate)}
        <br />
        Status: {data.status.charAt(0).toUpperCase() + data.status.slice(1)}{' '}
        {formatDate(data.effectiveDate)}
      </>
    );
  };

  return (
    <tr>
      <td data-testid={`change-type-appointment-${idx}`}>Appointment</td>
      <td data-testid={`previous-appointment-${idx}`}>{formatAppointmentData(history.before)}</td>
      <td data-testid={`new-appointment-${idx}`}>{formatAppointmentData(history.after)}</td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

type ShowTrusteeAssistantHistoryProps = Readonly<{ history: TrusteeAssistantHistory; idx: number }>;

function ShowTrusteeAssistantHistory(props: ShowTrusteeAssistantHistoryProps) {
  const { history, idx } = props;
  return (
    <tr>
      <td data-testid={`change-type-assistant-${idx}`}>Assistant</td>
      <td data-testid={`previous-assistant-${idx}`}>
        {history.before && (
          <>
            <div className="assistant-name" data-testid={`previous-assistant-name-${idx}`}>
              {history.before.name}
            </div>
            {history.before.title && (
              <div className="assistant-title" data-testid={`previous-assistant-title-${idx}`}>
                {history.before.title}
              </div>
            )}
            <FormattedContact contact={history.before.contact} showLinks={false} />
          </>
        )}
      </td>
      <td data-testid={`new-assistant-${idx}`}>
        {history.after && (
          <>
            <div className="assistant-name" data-testid={`new-assistant-name-${idx}`}>
              {history.after.name}
            </div>
            {history.after.title && (
              <div className="assistant-title" data-testid={`new-assistant-title-${idx}`}>
                {history.after.title}
              </div>
            )}
            <FormattedContact contact={history.after.contact} showLinks={false} />
          </>
        )}
      </td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

type ReportDateFieldConfig = {
  key: keyof TrusteeUpcomingKeyDates;
  label: string;
  format: (data: Partial<TrusteeUpcomingKeyDates>) => string;
};

function formatOptionalMMDDYYYY(value: string | undefined): string {
  return value ? isoToMMDDYYYY(value) : '(none)';
}

function formatOptionalMMYYYY(value: string | undefined): string {
  return value ? isoToMMYYYY(value) : '(none)';
}

function formatOptionalDateRange(start: string | undefined, end: string | undefined): string {
  return start && end ? isoRangeToMMDD(start, end) : '(none)';
}

const REPORT_DATE_FIELD_CONFIG: ReportDateFieldConfig[] = [
  {
    key: 'pastFieldExam',
    label: 'Field Exam',
    format: (d) => formatOptionalMMDDYYYY(d.pastFieldExam),
  },
  {
    key: 'pastAudit',
    label: 'Audit',
    format: (d) => formatOptionalMMYYYY(d.pastAudit),
  },
  {
    key: 'tprReviewPeriodStart',
    label: 'TPR Review Period',
    format: (d) => formatOptionalDateRange(d.tprReviewPeriodStart, d.tprReviewPeriodEnd),
  },
  {
    key: 'tprDue',
    label: 'TPR Due',
    format: (d) => formatOptionalMMYYYY(d.tprDue),
  },
  {
    key: 'tirReviewPeriodStart',
    label: 'TIR Review Period',
    format: (d) => formatOptionalDateRange(d.tirReviewPeriodStart, d.tirReviewPeriodEnd),
  },
  {
    key: 'tirSubmission',
    label: 'TIR Submission',
    format: (d) => (d.tirSubmission ? isoToMMDD(d.tirSubmission) : '(none)'),
  },
  {
    key: 'tirReview',
    label: 'TIR Review',
    format: (d) => (d.tirReview ? isoToMMDD(d.tirReview) : '(none)'),
  },
];

function UpcomingKeyDateFields({
  data,
}: Readonly<{ data: Partial<TrusteeUpcomingKeyDates> | undefined }>) {
  if (!data) return <>(none)</>;

  const fields = REPORT_DATE_FIELD_CONFIG.filter(({ key }) => key in data).map(
    ({ label, format }) => ({ label, value: format(data) }),
  );

  if (fields.length === 0) return <>(none)</>;

  return (
    <dl>
      {fields.map(({ label, value }) => (
        <React.Fragment key={label}>
          <dt>{label}:</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

type ShowTrusteeUpcomingKeyDatesHistoryProps = Readonly<{
  history: TrusteeUpcomingKeyDatesHistory;
  idx: number;
}>;

function ShowTrusteeUpcomingKeyDatesHistory(props: ShowTrusteeUpcomingKeyDatesHistoryProps) {
  const { history, idx } = props;
  return (
    <tr>
      <td data-testid={`change-type-upcoming-key-dates-${idx}`}>Upcoming Key Dates</td>
      <td data-testid={`previous-upcoming-key-dates-${idx}`}>
        <UpcomingKeyDateFields data={history.before} />
      </td>
      <td data-testid={`new-upcoming-key-dates-${idx}`}>
        <UpcomingKeyDateFields data={history.after} />
      </td>
      <td data-testid={`changed-by-${idx}`}>
        {history.updatedBy && <>{history.updatedBy.name}</>}
      </td>
      <td data-testid={`change-date-${idx}`}>
        <span className="text-no-wrap">{formatDate(history.updatedOn)}</span>
      </td>
    </tr>
  );
}

function RenderTrusteeHistory(props: Readonly<{ trusteeHistory: TrusteeHistory[] }>) {
  const { trusteeHistory } = props;
  return (
    <>
      {trusteeHistory.map((history, idx: number) => {
        switch (history.documentType) {
          case 'AUDIT_NAME':
            return <ShowTrusteeNameHistory key={history.id} history={history} idx={idx} />;
          case 'AUDIT_PUBLIC_CONTACT':
          case 'AUDIT_INTERNAL_CONTACT':
            return <ShowTrusteeContactHistory key={history.id} history={history} idx={idx} />;
          case 'AUDIT_BANKS':
            return <ShowTrusteeBankHistory key={history.id} history={history} idx={idx} />;
          case 'AUDIT_SOFTWARE':
            return (
              <ShowTrusteeSoftwareHistory
                key={`${history.trusteeId}-${idx}`}
                history={history}
                idx={idx}
              />
            );
          case 'AUDIT_ZOOM_INFO':
            return (
              <ShowTrusteeZoomInfoHistory
                key={`${history.trusteeId}-${idx}`}
                history={history}
                idx={idx}
              />
            );
          case 'AUDIT_OVERSIGHT':
            return (
              <ShowTrusteeOversightHistory
                key={`${history.trusteeId}-${idx}`}
                history={history}
                idx={idx}
              ></ShowTrusteeOversightHistory>
            );
          case 'AUDIT_APPOINTMENT':
            return (
              <ShowTrusteeAppointmentHistory
                key={`${history.trusteeId}-${idx}`}
                history={history}
                idx={idx}
              />
            );
          case 'AUDIT_ASSISTANT':
            return (
              <ShowTrusteeAssistantHistory
                key={`${history.trusteeId || history.id}-${idx}`}
                history={history}
                idx={idx}
              />
            );
          case 'AUDIT_UPCOMING_REPORT_DATES':
            return (
              <ShowTrusteeUpcomingKeyDatesHistory
                key={`${history.trusteeId || history.id}-${idx}`}
                history={history}
                idx={idx}
              />
            );
        }
      })}
    </>
  );
}

export default function TrusteeDetailAuditHistory(props: Readonly<TrusteeDetailAuditHistoryProps>) {
  const [trusteeHistory, setTrusteeHistory] = useState<TrusteeHistory[]>([]);
  const [isAuditHistoryLoading, setIsAuditHistoryLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchTrusteeHistory = async () => {
      setIsAuditHistoryLoading(true);
      try {
        const response = await Api2.getTrusteeHistory(props.trusteeId);
        if (response) {
          setTrusteeHistory(
            response.data.sort((a: Auditable, b: Auditable) =>
              sortByDateReverse(a.updatedOn, b.updatedOn),
            ),
          );
        }
      } catch {
        setTrusteeHistory([]);
      } finally {
        setIsAuditHistoryLoading(false);
      }
    };
    fetchTrusteeHistory();
  }, [props.trusteeId]);

  return (
    <div className="trustee-audit-history">
      <h3 data-testid="change-history-heading">Change History</h3>
      {isAuditHistoryLoading && <LoadingIndicator />}
      {!isAuditHistoryLoading && (
        <>
          {trusteeHistory.length < 1 && (
            <div data-testid="empty-trustee-history-test-id">
              <Alert
                message="No changes have been made to this trustee."
                type={UswdsAlertStyle.Info}
                role={'status'}
                timeout={0}
                title=""
                show={true}
                inline={true}
              />
            </div>
          )}
          {trusteeHistory.length > 0 && (
            <table data-testid="trustee-history-table" className="usa-table usa-table--borderless">
              <thead>
                <tr key="history-header">
                  <th>Change</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>Changed by</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <RenderTrusteeHistory trusteeHistory={trusteeHistory} />
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
