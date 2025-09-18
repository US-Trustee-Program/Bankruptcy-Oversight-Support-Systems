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
import { ContactInformation } from '@common/cams/contact';

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

  function formatContactInformation(contact?: ContactInformation): string {
    if (!contact) {
      return '(none)';
    }

    const parts: string[] = [];

    if (contact.email) {
      parts.push(`Email: ${contact.email}`);
    }

    if (contact.phone?.number) {
      const phone = contact.phone.extension
        ? `${contact.phone.number} x${contact.phone.extension}`
        : contact.phone.number;
      parts.push(`Phone: ${phone}`);
    }

    if (contact.address) {
      // Build city, state zipCode string only if at least one is present
      const cityState = [contact.address.city, contact.address.state].filter(Boolean).join(', ');
      const cityStateZip = [cityState, contact.address.zipCode].filter(Boolean).join(' ');

      const address = [
        contact.address.address1,
        contact.address.address2,
        contact.address.address3,
        cityStateZip,
      ]
        .filter(Boolean)
        .join(', ');
      if (address) {
        parts.push(`Address: ${address}`);
      }
    }

    return parts.length > 0 ? parts.join('; ') : '(none)';
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
        <td data-testid={`previous-contact-${idx}`}>{formatContactInformation(history.before)}</td>
        <td data-testid={`new-contact-${idx}`}>{formatContactInformation(history.after)}</td>
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
