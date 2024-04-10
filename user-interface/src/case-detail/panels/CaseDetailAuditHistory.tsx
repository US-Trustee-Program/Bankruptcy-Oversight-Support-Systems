import { formatDate } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { orderStatusType } from '@/lib/utils/labels';
import {
  CaseAssignmentHistory,
  CaseConsolidationHistory,
  CaseHistory,
  CaseTransferHistory,
} from '@common/cams/history';

export interface CaseDetailAuditHistoryProps {
  caseHistory: CaseHistory[];
  isAuditHistoryLoading: boolean;
}

export default function CaseDetailAuditHistory(props: CaseDetailAuditHistoryProps) {
  const { caseHistory, isAuditHistoryLoading } = props;

  function showCaseAssignmentHistory(history: CaseAssignmentHistory, idx: number) {
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
          <span className="text-no-wrap">{formatDate(history.occurredAtTimestamp)}</span>
        </td>
      </tr>
    );
  }

  function showCaseTransferHistory(history: CaseTransferHistory, idx: number) {
    return (
      <tr key={idx}>
        <td>Transfer</td>
        <td data-testid={`previous-order-${idx}`}>
          {!history.before && <>(none)</>}
          {history.before && orderStatusType.get(history.before.status)}
        </td>
        <td data-testid={`new-order-${idx}`}>
          {history.after && orderStatusType.get(history.after.status)}
        </td>
        <td data-testid={`change-date-${idx}`}>
          <span className="text-no-wrap">{formatDate(history.occurredAtTimestamp)}</span>
        </td>
      </tr>
    );
  }

  function showCaseConsolidationHistory(history: CaseConsolidationHistory, idx: number) {
    return (
      <tr key={idx}>
        <td>Consolidation</td>
        <td data-testid={`previous-order-${idx}`}>
          {!history.before && <>(none)</>}
          {history.before && orderStatusType.get(history.before.status)}
        </td>
        <td data-testid={`new-order-${idx}`}>
          {history.after && orderStatusType.get(history.after.status)}
        </td>
        <td data-testid={`change-date-${idx}`}>
          <span className="text-no-wrap">{formatDate(history.occurredAtTimestamp)}</span>
        </td>
      </tr>
    );
  }

  function renderCaseHistory() {
    return caseHistory.map((history, idx: number) => {
      switch (history.documentType) {
        case 'AUDIT_ASSIGNMENT':
          return showCaseAssignmentHistory(history, idx);
        case 'AUDIT_TRANSFER':
          return showCaseTransferHistory(history, idx);
        case 'AUDIT_CONSOLIDATION':
          return showCaseConsolidationHistory(history, idx);
      }
    });
  }

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
                  <>{renderCaseHistory()}</>
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
