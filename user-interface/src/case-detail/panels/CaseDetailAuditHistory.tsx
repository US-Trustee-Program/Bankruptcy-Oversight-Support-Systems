import { formatDate } from '@/lib/utils/datetime';
import { CaseStaffAssignmentHistory } from '@/lib/type-declarations/chapter-15';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

export interface CaseDetailAuditHistoryProps {
  caseHistory: CaseStaffAssignmentHistory[];
  isAuditHistoryLoading: boolean;
}

export default function CaseDetailAuditHistory(props: CaseDetailAuditHistoryProps) {
  const { caseHistory, isAuditHistoryLoading } = props;

  return (
    <div className="case-audit-history">
      <div className="history-type-title">
        <h3>Assignment History</h3>
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
                        return (
                          <tr key={idx}>
                            <td>Staff</td>
                            <td data-testid={`previous-assignment-${idx}`}>
                              {history.previousAssignments.length === 0 && <>(none)</>}
                              {history.previousAssignments
                                .map((assignment) => {
                                  return assignment.name;
                                })
                                .join(', ')}
                            </td>
                            <td data-testid={`new-assignment-${idx}`}>
                              {history.newAssignments.length === 0 && <>(none)</>}
                              {history.newAssignments
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
