import './TrusteeDetailAuditHistory.scss';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useState } from 'react';
import useApi2 from '@/lib/hooks/UseApi2';
import {
  TrusteeHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeInternalContactHistory,
} from '@common/cams/trustees';
import FormattedAddress from '@/lib/components/cams/FormattedAddress';
import { Auditable } from '@common/cams/auditable';

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
        <FormattedAddress
          contact={history.before}
          className="trustee-audit-history__address-before"
          testIdPrefix={`previous-contact-${idx}`}
          emailAsLink={false}
        />
      </td>
      <td data-testid={`new-contact-${idx}`}>
        <FormattedAddress
          contact={history.after}
          className="trustee-audit-history__address-after"
          testIdPrefix={`new-contact-${idx}`}
          emailAsLink={false}
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

function RenderTrusteeHistory(props: Readonly<{ trusteeHistory: TrusteeHistory[] }>) {
  const { trusteeHistory } = props;
  return (
    <>
      {trusteeHistory.map((history, idx: number) => {
        switch (history.documentType) {
          case 'AUDIT_NAME':
            return (
              <ShowTrusteeNameHistory
                key={window.crypto.randomUUID()}
                history={history}
                idx={idx}
              />
            );
          case 'AUDIT_PUBLIC_CONTACT':
          case 'AUDIT_INTERNAL_CONTACT':
            return (
              <ShowTrusteeContactHistory
                key={window.crypto.randomUUID()}
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
  const api = useApi2();

  async function fetchTrusteeHistory() {
    setIsAuditHistoryLoading(true);
    api
      .getTrusteeHistory(props.trusteeId)
      .then((response) => {
        if (response) {
          setTrusteeHistory(
            response.data.sort((a: Auditable, b: Auditable) =>
              sortByDateReverse(a.updatedOn, b.updatedOn),
            ),
          );
          setIsAuditHistoryLoading(false);
        }
      })
      .catch(() => {
        setTrusteeHistory([]);
        setIsAuditHistoryLoading(false);
      });
  }

  useEffect(() => {
    fetchTrusteeHistory();
  }, []);

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
