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
    return (
      <>
        Chapter: {getAppointmentDetails(chapter, appointmentType)}
        <br />
        District:{' '}
        {data.courtName && data.courtDivisionName
          ? `${data.courtName} (${data.courtDivisionName})`
          : data.divisionCode}
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
