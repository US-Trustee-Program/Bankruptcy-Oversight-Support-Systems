import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { BankAuditHistory } from '@common/cams/banks';
import { Auditable } from '@common/cams/auditable';

interface BankDetailAuditHistoryProps {
  bankId: string;
}

export function BankDetailAuditHistory({ bankId }: Readonly<BankDetailAuditHistoryProps>) {
  const [history, setHistory] = useState<BankAuditHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await Api2.getBankHistory(bankId);
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
  }, [bankId]);

  return (
    <div className="bank-audit-history">
      <h3 data-testid="bank-change-history-heading">Change History</h3>
      {isLoading && <LoadingIndicator />}
      {!isLoading && (
        <>
          {history.length < 1 && (
            <div data-testid="empty-bank-history">
              <Alert
                message="No changes have been made to this bank."
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
            <table data-testid="bank-history-table" className="usa-table usa-table--borderless">
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
                  <BankHistoryRow key={entry.id ?? idx} entry={entry} idx={idx} />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function BankHistoryRow({ entry, idx }: Readonly<{ entry: BankAuditHistory; idx: number }>) {
  const changes: Array<{ field: string; before: string; after: string }> = [];

  if (entry.before === null) {
    changes.push({ field: 'Created', before: '(none)', after: entry.after?.name ?? '' });
  } else {
    if (entry.before?.name !== entry.after?.name) {
      changes.push({
        field: 'Name',
        before: entry.before?.name ?? '(none)',
        after: entry.after?.name ?? '(none)',
      });
    }
    if (entry.before?.status !== entry.after?.status) {
      changes.push({
        field: 'Status',
        before: entry.before?.status ?? '(none)',
        after: entry.after?.status ?? '(none)',
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
          <td data-testid={`bank-change-type-${idx}-${changeIdx}`}>{change.field}</td>
          <td data-testid={`bank-previous-${idx}-${changeIdx}`}>{change.before}</td>
          <td data-testid={`bank-new-${idx}-${changeIdx}`}>{change.after}</td>
          <td data-testid={`bank-changed-by-${idx}`}>
            {entry.updatedBy && <>{entry.updatedBy.name}</>}
          </td>
          <td data-testid={`bank-change-date-${idx}`}>
            <span className="text-no-wrap">{formatDate(entry.updatedOn)}</span>
          </td>
        </tr>
      ))}
    </>
  );
}
