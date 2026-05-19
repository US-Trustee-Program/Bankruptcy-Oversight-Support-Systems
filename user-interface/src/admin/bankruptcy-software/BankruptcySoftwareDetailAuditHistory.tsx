import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
  SoftwareBankAssociation,
} from '@common/cams/bankruptcy-software';
import { Auditable } from '@common/cams/auditable';

interface BankruptcySoftwareDetailAuditHistoryProps {
  softwareId: string;
}

export function BankruptcySoftwareDetailAuditHistory({
  softwareId,
}: Readonly<BankruptcySoftwareDetailAuditHistoryProps>) {
  const [history, setHistory] = useState<BankruptcySoftwareAuditHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await Api2.getSoftwareHistory(softwareId);
        if (response) {
          setHistory(
            response.data.sort((a: Auditable, b: Auditable) =>
              sortByDateReverse(a.updatedOn, b.updatedOn),
            ),
          );
        }
      } catch {
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [softwareId]);

  return (
    <div className="software-audit-history">
      <h3 data-testid="software-change-history-heading">Change History</h3>
      {isLoading && <LoadingIndicator />}
      {!isLoading && (
        <>
          {history.length < 1 && (
            <div data-testid="empty-software-history">
              <Alert
                message="No changes have been made to this software."
                type={UswdsAlertStyle.Info}
                role={'status'}
                timeout={0}
                title=""
                show={true}
                inline={true}
              />
            </div>
          )}
          {history.length > 0 && (
            <table data-testid="software-history-table" className="usa-table usa-table--borderless">
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
                {history.map((entry, idx) => (
                  <SoftwareHistoryRow key={entry.id ?? idx} entry={entry} idx={idx} />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function formatBankAssociations(associations?: SoftwareBankAssociation[]): string {
  if (!associations || associations.length === 0) return '(none)';
  return associations.map((a) => `${a.bankName} (${a.status})`).join(', ');
}

function SoftwareHistoryRow({
  entry,
  idx,
}: Readonly<{ entry: BankruptcySoftwareAuditHistory; idx: number }>) {
  const changes: Array<{ field: string; before: string; after: string }> = [];
  const before = entry.before as Partial<BankruptcySoftwareProfile> | null;
  const after = entry.after as Partial<BankruptcySoftwareProfile>;

  if (before === null) {
    changes.push({ field: 'Created', before: '(none)', after: after?.name ?? '' });
  } else {
    if (before?.name !== after?.name) {
      changes.push({
        field: 'Name',
        before: before?.name ?? '(none)',
        after: after?.name ?? '(none)',
      });
    }
    if (before?.status !== after?.status) {
      changes.push({
        field: 'Status',
        before: before?.status ?? '(none)',
        after: after?.status ?? '(none)',
      });
    }
    const beforeBanks = formatBankAssociations(before?.associatedBanks);
    const afterBanks = formatBankAssociations(after?.associatedBanks);
    if (beforeBanks !== afterBanks) {
      changes.push({
        field: 'Associated Banks',
        before: beforeBanks,
        after: afterBanks,
      });
    }
    if (before?.contact?.contactNames?.[0] !== after?.contact?.contactNames?.[0]) {
      changes.push({
        field: 'Contact Name',
        before: before?.contact?.contactNames?.[0] ?? '(none)',
        after: after?.contact?.contactNames?.[0] ?? '(none)',
      });
    }
    if (changes.length === 0) {
      changes.push({ field: 'Updated', before: '-', after: '-' });
    }
  }

  return (
    <>
      {changes.map((change, changeIdx) => (
        <tr key={`${idx}-${changeIdx}`}>
          <td data-testid={`software-change-type-${idx}-${changeIdx}`}>{change.field}</td>
          <td data-testid={`software-previous-${idx}-${changeIdx}`}>{change.before}</td>
          <td data-testid={`software-new-${idx}-${changeIdx}`}>{change.after}</td>
          <td data-testid={`software-changed-by-${idx}`}>
            {entry.updatedBy && <>{entry.updatedBy.name}</>}
          </td>
          <td data-testid={`software-change-date-${idx}`}>
            <span className="text-no-wrap">{formatDate(entry.updatedOn)}</span>
          </td>
        </tr>
      ))}
    </>
  );
}
