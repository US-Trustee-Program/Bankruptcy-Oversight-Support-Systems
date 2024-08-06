import { render, screen } from '@testing-library/react';
import CaseDetailAuditHistory from '@/case-detail/panels/CaseDetailAuditHistory';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { CaseHistory } from '@common/cams/history';
import { CaseAssignment } from '@common/cams/assignments';
import { ConsolidationOrder } from '@common/cams/orders';

describe('audit history tests', () => {
  const caseId = '000-11-22222';
  const pendingTransferOrder = MockData.getTransferOrder({
    override: { caseId, status: 'pending' },
  });
  const approvedTransferOrder = MockData.getTransferOrder({
    override: { caseId, status: 'approved' },
  });
  const pendingConsolidationOrder: ConsolidationOrder = MockData.getConsolidationOrder();
  const rejectedConsolidationOrder: ConsolidationOrder = {
    ...pendingConsolidationOrder,
    status: 'rejected',
    reason: 'This order is rejected',
  };
  const assignmentBefore: CaseAssignment[] = [
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-01',
      name: 'Alfred',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-02',
      name: 'Bradford',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
    },
  ];
  const assignmentAfter: CaseAssignment[] = [
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-03',
      name: 'Charles',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-04',
      name: 'Daniel',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-05',
      name: 'Edward',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
    },
  ];
  const caseHistory: CaseHistory[] = [
    {
      id: '1234567890',
      documentType: 'AUDIT_ASSIGNMENT',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: assignmentBefore,
      after: assignmentAfter,
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_TRANSFER',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: pendingTransferOrder,
      after: approvedTransferOrder,
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_CONSOLIDATION',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: null,
      after: pendingConsolidationOrder,
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_CONSOLIDATION',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: pendingConsolidationOrder,
      after: rejectedConsolidationOrder,
    },
  ];

  test('should display loading indicator if loading', async () => {
    const caseHistory: CaseHistory[] = [];

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={true} />);

    const historyTable = screen.queryByTestId('loading-indicator');
    expect(historyTable).toBeInTheDocument();
  });

  test('should display no assignments message if no history exists', async () => {
    const caseHistory: CaseHistory[] = [];

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={false} />);

    const emptyAssignments = await screen.findByTestId('empty-assignments-test-id');
    expect(emptyAssignments).toHaveTextContent('There are no assignments in the case history.');

    const historyTable = screen.queryByTestId('history-table');
    expect(historyTable).not.toBeInTheDocument();
  });

  test('should display assignment history when history exists', async () => {
    const expectedPrevious = assignmentBefore.map((n) => n.name).join(', ');
    const expectedNew = assignmentAfter.map((n) => n.name).join(', ');

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={false} />);

    const previousElement = screen.queryByTestId('previous-assignment-0');
    expect(previousElement).toBeInTheDocument();
    expect(previousElement).toHaveTextContent(expectedPrevious);

    const newElement = screen.queryByTestId('new-assignment-0');
    expect(newElement).toBeInTheDocument();
    expect(newElement).toHaveTextContent(expectedNew);

    const dateElement = screen.queryByTestId('change-date-0');
    expect(dateElement).toBeInTheDocument();
    expect(dateElement).toHaveTextContent('12/25/2023');
  });

  test('should display (none) when no assignments exist.', async () => {
    const caseHistory: CaseHistory[] = [
      {
        id: '',
        documentType: 'AUDIT_ASSIGNMENT',
        caseId,
        occurredAtTimestamp: '',
        before: [],
        after: [],
      },
    ];

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={false} />);

    const previousElement = screen.queryByTestId('previous-assignment-0');
    expect(previousElement).toBeInTheDocument();
    expect(previousElement).toHaveTextContent('(none)');

    const newElement = screen.queryByTestId('new-assignment-0');
    expect(newElement).toBeInTheDocument();
    expect(newElement).toHaveTextContent('(none)');
  });

  test('should display a row for pending transfer', async () => {
    const caseHistory: CaseHistory[] = [
      {
        id: '',
        documentType: 'AUDIT_TRANSFER',
        caseId,
        occurredAtTimestamp: '2024-01-31T12:00:00Z',
        before: pendingTransferOrder,
        after: approvedTransferOrder,
      },
      {
        id: '',
        documentType: 'AUDIT_TRANSFER',
        caseId,
        occurredAtTimestamp: '2024-01-29T12:00:00Z',
        before: null,
        after: pendingTransferOrder,
      },
    ];

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={false} />);

    const previousElement1 = screen.queryByTestId('previous-order-0');
    expect(previousElement1).toBeInTheDocument();
    expect(previousElement1).toHaveTextContent('Pending Review');

    const newElement1 = screen.queryByTestId('new-order-0');
    expect(newElement1).toBeInTheDocument();
    expect(newElement1).toHaveTextContent('Approved');

    const changeDate1 = screen.queryByTestId('change-date-0');
    expect(changeDate1).toHaveTextContent('01/31/2024');

    const previousElement2 = screen.queryByTestId('previous-order-1');
    expect(previousElement2).toBeInTheDocument();
    expect(previousElement2).toHaveTextContent('(none)');

    const newElement2 = screen.queryByTestId('new-order-1');
    expect(newElement2).toBeInTheDocument();
    expect(newElement2).toHaveTextContent('Pending Review');

    const changeDate2 = screen.queryByTestId('change-date-1');
    expect(changeDate2).toHaveTextContent('01/29/2024');
  });
});
