import { formatDate } from '@/lib/utils/datetime';
import { CaseHistory } from '@/lib/type-declarations/chapter-15';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { transferStatusType } from '@/lib/utils/labels';

export interface CaseDetailAuditHistoryProps {
  caseHistory: CaseHistory[];
  isAuditHistoryLoading: boolean;
}

export default function CaseDetailAuditHistory(props: CaseDetailAuditHistoryProps) {
  const { caseHistory, isAuditHistoryLoading } = props;

  return (
    <div className="case-audit-history">
      <div className="history-type-title">
        <h3>Audit History</h3>
        {isAuditHistoryLoading && <LoadingIndicator />}
        {!isAuditHistoryLoading && (
          <>
            {caseHistory.length < 1 && (
              <div data-testid="empty-assignments-test-id">
                <Alert
                  message="There are no assignments in the case history."
                  type={UswdsAlertStyle.Info}
                  role={'status'}
                  slim={true}
                  timeout={0}
                  title=""
                  show={true}
                  inline={true}
                />
              </div>
            )}
            {caseHistory.length > 0 && (
              <table data-testid="history-table" className="usa-table usa-table--borderless">
                <thead>
                  <tr>
                    <th>Change</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <>
                    {caseHistory &&
                      caseHistory.map((history, idx: number) => {
                        if (history.documentType === 'AUDIT_ASSIGNMENT') {
                          return (
                            <tr key={idx}>
                              <td>Staff</td>
                              <td data-testid={`previous-assignment-${idx}`}>
                                {history.before.length === 0 && <>(none)</>}
                                {history.before
                                  .map((assignment) => {
                                    return assignment.name;
                                  })
                                  .join(', ')}
                              </td>
                              <td data-testid={`new-assignment-${idx}`}>
                                {history.after.length === 0 && <>(none)</>}
                                {history.after
                                  .map((assignment) => {
                                    return assignment.name;
                                  })
                                  .join(', ')}
                              </td>
                              <td data-testid={`change-date-${idx}`}>
                                <span className="text-no-wrap">
                                  {formatDate(history.occurredAtTimestamp)}
                                </span>
                              </td>
                            </tr>
                          );
                        } else if (history.documentType === 'AUDIT_TRANSFER') {
                          return (
                            <tr key={idx}>
                              <td>Order</td>
                              <td data-testid={`previous-order-${idx}`}>
                                {!history.before && <>(none)</>}
                                {history.before && transferStatusType.get(history.before.status)}
                              </td>
                              <td data-testid={`new-order-${idx}`}>
                                {history.after && transferStatusType.get(history.after.status)}
                              </td>
                              <td data-testid={`change-date-${idx}`}>
                                <span className="text-no-wrap">
                                  {formatDate(history.occurredAtTimestamp)}
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      })}
                  </>
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
