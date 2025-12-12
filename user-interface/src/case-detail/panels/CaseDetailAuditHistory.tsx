import './CaseDetailAuditHistory.scss';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { orderStatusType } from '@/lib/utils/labels';
import {
  CaseAssignmentHistory,
  CaseConsolidationHistory,
  CaseHistory,
  CaseTransferHistory,
} from '@common/cams/history';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { CaseAssignment } from '@common/cams/assignments';

interface CaseDetailAuditHistoryProps {
  caseId: string;
}

export default function CaseDetailAuditHistory(props: CaseDetailAuditHistoryProps) {
  const [caseHistory, setCaseHistory] = useState<CaseHistory[]>([]);
  const [isAuditHistoryLoading, setIsAuditHistoryLoading] = useState<boolean>(false);
  const api = Api2;

  async function fetchCaseHistory() {
    setIsAuditHistoryLoading(true);
    api
      .getCaseHistory(props.caseId)
      .then((response) => {
        if (response) {
          setCaseHistory(response.data.sort((a, b) => sortByDateReverse(a.updatedOn, b.updatedOn)));
          setIsAuditHistoryLoading(false);
        }
      })
      .catch(() => {
        setCaseHistory([]);
        setIsAuditHistoryLoading(false);
      });
  }

  function showCaseAssignmentHistory(history: CaseAssignmentHistory, idx: number) {
    return (
      <tr key={idx}>
        <td>Staff</td>
        <td data-testid={`previous-assignment-${idx}`}>
          {assignmentHistoryHasValue(history.before) ? (
            history.before
              .map((assignment) => {
                return assignment.name;
              })
              .join(', ')
          ) : (
            <>(none)</>
          )}
        </td>
        <td data-testid={`new-assignment-${idx}`}>
          {assignmentHistoryHasValue(history.after) ? (
            history.after
              .map((assignment) => {
                return assignment.name;
              })
              .join(', ')
          ) : (
            <>(none)</>
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

  function showCaseOrderHistory(
    history: CaseTransferHistory | CaseConsolidationHistory,
    idx: number,
  ) {
    return (
      <tr key={idx}>
        <td>{history.documentType === 'AUDIT_TRANSFER' ? 'Transfer' : 'Consolidation'} </td>
        <td data-testid={`previous-order-${idx}`}>
          {!history.before && <>(none)</>}
          {history.before && orderStatusType.get(history.before.status)}
        </td>
        <td data-testid={`new-order-${idx}`}>
          {history.after && orderStatusType.get(history.after.status)}
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
  function assignmentHistoryHasValue(assignmentHistory: CaseAssignment[] | null): boolean {
    let noValue = true;
    if (assignmentHistory === null || assignmentHistory.length === 0) {
      noValue = false;
    }
    return noValue;
  }

  function renderCaseHistory() {
    return caseHistory.map((history, idx: number) => {
      switch (history.documentType) {
        case 'AUDIT_ASSIGNMENT':
          return showCaseAssignmentHistory(history, idx);
        case 'AUDIT_TRANSFER':
        case 'AUDIT_CONSOLIDATION':
          return showCaseOrderHistory(history, idx);
      }
    });
  }

  useEffect(() => {
    fetchCaseHistory();
  }, []);

  return (
    <div className="case-audit-history">
      <h3>Change History</h3>
      {isAuditHistoryLoading && <LoadingIndicator />}
      {!isAuditHistoryLoading && (
        <>
          {caseHistory.length < 1 && (
            <div data-testid="empty-assignments-test-id">
              <Alert
                message="No changes have been made to this case."
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
                  <th>Changed by</th>
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
  );
}
