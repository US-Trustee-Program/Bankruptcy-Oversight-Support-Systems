import CaseDetailAuditHistory from '@/case-detail/panels/CaseDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { CaseAssignment } from '@common/cams/assignments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CaseHistory } from '@common/cams/history';
import { ConsolidationOrder } from '@common/cams/orders';
import MockData from '@common/cams/test-utilities/mock-data';
import { render, screen, waitFor } from '@testing-library/react';

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
    reason: 'This order is rejected',
    status: 'rejected',
  };
  const assignmentBefore: CaseAssignment[] = [
    {
      assignedOn: '2023-12-25T00:00:00.000Z',
      caseId,
      documentType: 'ASSIGNMENT',
      name: 'Alfred',
      role: 'TrialAttorney',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
      userId: 'userId-01',
    },
    {
      assignedOn: '2023-12-25T00:00:00.000Z',
      caseId,
      documentType: 'ASSIGNMENT',
      name: 'Bradford',
      role: 'TrialAttorney',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
      userId: 'userId-02',
    },
  ];
  const assignmentAfter: CaseAssignment[] = [
    {
      assignedOn: '2023-12-25T00:00:00.000Z',
      caseId,
      documentType: 'ASSIGNMENT',
      name: 'Charles',
      role: 'TrialAttorney',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
      userId: 'userId-03',
    },
    {
      assignedOn: '2023-12-25T00:00:00.000Z',
      caseId,
      documentType: 'ASSIGNMENT',
      name: 'Daniel',
      role: 'TrialAttorney',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
      userId: 'userId-04',
    },
    {
      assignedOn: '2023-12-25T00:00:00.000Z',
      caseId,
      documentType: 'ASSIGNMENT',
      name: 'Edward',
      role: 'TrialAttorney',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
      userId: 'userId-05',
    },
  ];
  const caseHistory: CaseHistory[] = [
    {
      after: assignmentAfter,
      before: assignmentBefore,
      caseId,
      documentType: 'AUDIT_ASSIGNMENT',
      id: '1234567890',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
    },
    {
      after: approvedTransferOrder,
      before: pendingTransferOrder,
      caseId,
      documentType: 'AUDIT_TRANSFER',
      id: '1234567890',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
    },
    {
      after: pendingConsolidationOrder,
      before: null,
      caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      id: '1234567890',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
    },
    {
      after: rejectedConsolidationOrder,
      before: pendingConsolidationOrder,
      caseId,
      documentType: 'AUDIT_CONSOLIDATION',
      id: '1234567890',
      updatedBy: MockData.getCamsUserReference(),
      updatedOn: '2023-12-25T00:00:00.000Z',
    },
  ];

  test('should display loading indicator if loading', async () => {
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: [],
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    const historyTable = screen.queryByTestId('loading-indicator');
    expect(historyTable).toBeInTheDocument();
  });

  test('should display no assignments message if no history exists', async () => {
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: [],
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    const emptyAssignments = await screen.findByTestId('empty-assignments-test-id');
    expect(emptyAssignments).toHaveTextContent('No changes have been made to this case.');

    const historyTable = screen.queryByTestId('history-table');
    expect(historyTable).not.toBeInTheDocument();
  });

  test('should display assignment history when history exists', async () => {
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: caseHistory,
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

    const updatedByElement = screen.queryByTestId('changed-by-0');
    expect(updatedByElement).toBeInTheDocument();
    expect(updatedByElement).toHaveTextContent(caseHistory[0].updatedBy!.name);
  });

  test('should display (none) when no assignments exist.', async () => {
    const caseHistory: CaseHistory[] = [
      {
        after: [],
        before: [],
        caseId,
        documentType: 'AUDIT_ASSIGNMENT',
        id: '',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '',
      },
    ];
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: caseHistory,
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
        after: approvedTransferOrder,
        before: pendingTransferOrder,
        caseId,
        documentType: 'AUDIT_TRANSFER',
        id: '',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-31T12:00:00Z',
      },
      {
        after: pendingTransferOrder,
        before: null,
        caseId,
        documentType: 'AUDIT_TRANSFER',
        id: '',
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-29T12:00:00Z',
      },
    ];
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: caseHistory,
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    await waitFor(() => {
      const previousElement1 = screen.queryByTestId('previous-order-0');
      expect(previousElement1).toBeInTheDocument();
      expect(previousElement1).toHaveTextContent('Pending Review');
    });

    const newElement1 = screen.queryByTestId('new-order-0');
    expect(newElement1).toBeInTheDocument();
    expect(newElement1).toHaveTextContent('Verified');

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
