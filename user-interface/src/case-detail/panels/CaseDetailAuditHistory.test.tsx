import { render, screen, waitFor } from '@testing-library/react';
import CaseDetailAuditHistory from '@/case-detail/panels/CaseDetailAuditHistory';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseHistory } from '@common/cams/history';
import { ConsolidationOrder } from '@common/cams/orders';
import MockData from '@common/cams/test-utilities/mock-data';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';

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
      changedBy: MockData.getCamsUserReference(),
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-02',
      name: 'Bradford',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
      changedBy: MockData.getCamsUserReference(),
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
      changedBy: MockData.getCamsUserReference(),
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-04',
      name: 'Daniel',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
      changedBy: MockData.getCamsUserReference(),
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-05',
      name: 'Edward',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
      changedBy: MockData.getCamsUserReference(),
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
      changedBy: MockData.getCamsUserReference(),
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_TRANSFER',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: pendingTransferOrder,
      after: approvedTransferOrder,
      changedBy: MockData.getCamsUserReference(),
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_CONSOLIDATION',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: null,
      after: pendingConsolidationOrder,
      changedBy: MockData.getCamsUserReference(),
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_CONSOLIDATION',
      caseId,
      occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
      before: pendingConsolidationOrder,
      after: rejectedConsolidationOrder,
      changedBy: MockData.getCamsUserReference(),
    },
  ];

  test('should display loading indicator if loading', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      message: 'test message',
      count: 0,
      body: [],
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    const historyTable = screen.queryByTestId('loading-indicator');
    expect(historyTable).toBeInTheDocument();
  });

  test('should display no assignments message if no history exists', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      message: 'test message',
      count: 0,
      body: [],
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    const emptyAssignments = await screen.findByTestId('empty-assignments-test-id');
    expect(emptyAssignments).toHaveTextContent('There are no assignments in the case history.');

    const historyTable = screen.queryByTestId('history-table');
    expect(historyTable).not.toBeInTheDocument();
  });

  test('should display assignment history when history exists', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      message: 'test message',
      count: 0,
      body: caseHistory,
    });

    const expectedPrevious = assignmentBefore.map((n) => n.name).join(', ');
    const expectedNew = assignmentAfter.map((n) => n.name).join(', ');

    render(<CaseDetailAuditHistory caseId={caseId} />);

    await waitFor(() => {
      const previousElement = screen.queryByTestId('previous-assignment-0');
      expect(previousElement).toBeInTheDocument();
      expect(previousElement).toHaveTextContent(expectedPrevious);
    });

    const newElement = screen.queryByTestId('new-assignment-0');
    expect(newElement).toBeInTheDocument();
    expect(newElement).toHaveTextContent(expectedNew);

    const dateElement = screen.queryByTestId('change-date-0');
    expect(dateElement).toBeInTheDocument();
    expect(dateElement).toHaveTextContent('12/25/2023');

    const changedByElement = screen.queryByTestId('changed-by-0');
    expect(changedByElement).toBeInTheDocument();
    expect(changedByElement).toHaveTextContent(caseHistory[0].changedBy!.name);
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
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      message: 'test message',
      count: 0,
      body: caseHistory,
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    await waitFor(() => {
      const previousElement = screen.queryByTestId('previous-assignment-0');
      expect(previousElement).toBeInTheDocument();
      expect(previousElement).toHaveTextContent('(none)');
    });

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
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      message: 'test message',
      count: 0,
      body: caseHistory,
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    await waitFor(() => {
      const previousElement1 = screen.queryByTestId('previous-order-0');
      expect(previousElement1).toBeInTheDocument();
      expect(previousElement1).toHaveTextContent('Pending Review');
    });

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
