import './CaseDetailAuditHistory.scss';

import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api2 from '@/lib/models/api2';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import { orderStatusType } from '@/lib/utils/labels';
import { CaseAssignment } from '@common/cams/assignments';
import {
  CaseAssignmentHistory,
  CaseConsolidationHistory,
  CaseHistory,
  CaseTransferHistory,
} from '@common/cams/history';
import { useEffect, useState } from 'react';

export interface CaseDetailAuditHistoryProps {
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
    history: CaseConsolidationHistory | CaseTransferHistory,
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
        case 'AUDIT_CONSOLIDATION':
        case 'AUDIT_TRANSFER':
          return showCaseOrderHistory(history, idx);
      }
    });
  }

  useEffect(() => {
    fetchCaseHistory();
  }, []);

  return (
    <div className="case-audit-history">
      <div className="history-type-title">
        <h3>Change History</h3>
        {isAuditHistoryLoading && <LoadingIndicator />}
        {!isAuditHistoryLoading && (
          <>
            {caseHistory.length < 1 && (
              <div data-testid="empty-assignments-test-id">
                <Alert
                  inline={true}
                  message="No changes have been made to this case."
                  role={'status'}
                  show={true}
                  timeout={0}
                  title=""
                  type={UswdsAlertStyle.Info}
                />
              </div>
            )}
            {caseHistory.length > 0 && (
              <table className="usa-table usa-table--borderless" data-testid="history-table">
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
    </div>
  );
}
