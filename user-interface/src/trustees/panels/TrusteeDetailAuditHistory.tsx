import './TrusteeDetailAuditHistory.scss';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useState } from 'react';
import createApi2 from '@/lib/Api2Factory';
import {
  TrusteeHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeInternalContactHistory,
  TrusteeBankHistory,
  TrusteeSoftwareHistory,
  TrusteeOversightHistory,
} from '@common/cams/trustees';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import { Auditable } from '@common/cams/auditable';
import { OversightRole } from '@common/cams/roles';

const ROLE_DISPLAY_MAP = {
  [OversightRole.OversightAttorney]: 'Attorney',
  [OversightRole.OversightAuditor]: 'Auditor',
  [OversightRole.OversightParalegal]: 'Paralegal',
} as const;

export interface TrusteeDetailAuditHistoryProps {
  trusteeId: string;
}

type ShowTrusteeNameHistoryProps = Readonly<{ history: TrusteeNameHistory; idx: number }>;

function ShowTrusteeNameHistory(props: ShowTrusteeNameHistoryProps) {
  const { history, idx } = props;
  return (
    <tr>
      <td>Name</td>
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

  return (
    <tr>
      <td>{changeType}</td>
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
      <td>Bank(s)</td>
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
          case 'AUDIT_OVERSIGHT':
            return (
              <ShowTrusteeOversightHistory
                key={`${history.trusteeId}-${idx}`}
                history={history}
                idx={idx}
              ></ShowTrusteeOversightHistory>
            );
        }
      })}
    </>
  );
}

export default function TrusteeDetailAuditHistory(props: Readonly<TrusteeDetailAuditHistoryProps>) {
  const [trusteeHistory, setTrusteeHistory] = useState<TrusteeHistory[]>([]);
  const [isAuditHistoryLoading, setIsAuditHistoryLoading] = useState<boolean>(false);
  const api = createApi2();

  useEffect(() => {
    const fetchTrusteeHistory = async () => {
      setIsAuditHistoryLoading(true);
      try {
        const response = await api.getTrusteeHistory(props.trusteeId);
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
  }, [api, props.trusteeId]);

  return (
    <div className="trustee-audit-history">
      <h3>Change History</h3>
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
