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

export interface TrusteeDetailAuditHistoryProps {
  trusteeId: string;
}

export default function TrusteeDetailAuditHistory(props: TrusteeDetailAuditHistoryProps) {
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
            response.data.sort((a, b) => sortByDateReverse(a.updatedOn, b.updatedOn)),
          );
          setIsAuditHistoryLoading(false);
        }
      })
      .catch(() => {
        setTrusteeHistory([]);
        setIsAuditHistoryLoading(false);
      });
  }

  function showTrusteeNameHistory(history: TrusteeNameHistory, idx: number) {
    return (
      <tr key={idx}>
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

  function showTrusteeContactHistory(
    history: TrusteePublicContactHistory | TrusteeInternalContactHistory,
    idx: number,
  ) {
    const changeType =
      history.documentType === 'AUDIT_PUBLIC_CONTACT' ? 'Public Contact' : 'Internal Contact';

    return (
      <tr key={idx}>
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

  function renderTrusteeHistory() {
    return trusteeHistory.map((history, idx: number) => {
      switch (history.documentType) {
        case 'AUDIT_NAME':
          return showTrusteeNameHistory(history, idx);
        case 'AUDIT_PUBLIC_CONTACT':
        case 'AUDIT_INTERNAL_CONTACT':
          return showTrusteeContactHistory(history, idx);
      }
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
                <tr>
                  <th>Change</th>
                  <th>Previous</th>
                  <th>New</th>
                  <th>Changed by</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <>{renderTrusteeHistory()}</>
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
