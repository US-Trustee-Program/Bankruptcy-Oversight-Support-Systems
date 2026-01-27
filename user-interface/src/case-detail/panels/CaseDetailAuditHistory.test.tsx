import { render, screen, waitFor } from '@testing-library/react';
import CaseDetailAuditHistory from '@/case-detail/panels/CaseDetailAuditHistory';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseHistory } from '@common/cams/history';
import { ConsolidationOrder } from '@common/cams/orders';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

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
      updatedOn: '2023-12-25T00:00:00.000Z',
      updatedBy: MockData.getCamsUserReference(),
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-02',
      name: 'Bradford',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
      updatedOn: '2023-12-25T00:00:00.000Z',
      updatedBy: MockData.getCamsUserReference(),
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
      updatedOn: '2023-12-25T00:00:00.000Z',
      updatedBy: MockData.getCamsUserReference(),
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-04',
      name: 'Daniel',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
      updatedOn: '2023-12-25T00:00:00.000Z',
      updatedBy: MockData.getCamsUserReference(),
    },
    {
      caseId,
      documentType: 'ASSIGNMENT',
      userId: 'userId-05',
      name: 'Edward',
      role: 'TrialAttorney',
      assignedOn: '2023-12-25T00:00:00.000Z',
      updatedOn: '2023-12-25T00:00:00.000Z',
      updatedBy: MockData.getCamsUserReference(),
    },
  ];
  const caseHistory: CaseHistory[] = [
    {
      id: '1234567890',
      documentType: 'AUDIT_ASSIGNMENT',
      caseId,
      updatedOn: '2023-12-25T00:00:00.000Z',
      before: assignmentBefore,
      after: assignmentAfter,
      updatedBy: MockData.getCamsUserReference(),
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_TRANSFER',
      caseId,
      updatedOn: '2023-12-25T00:00:00.000Z',
      before: pendingTransferOrder,
      after: approvedTransferOrder,
      updatedBy: MockData.getCamsUserReference(),
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_CONSOLIDATION',
      caseId,
      updatedOn: '2023-12-25T00:00:00.000Z',
      before: null,
      after: pendingConsolidationOrder,
      updatedBy: MockData.getCamsUserReference(),
    },
    {
      id: '1234567890',
      documentType: 'AUDIT_CONSOLIDATION',
      caseId,
      updatedOn: '2023-12-25T00:00:00.000Z',
      before: pendingConsolidationOrder,
      after: rejectedConsolidationOrder,
      updatedBy: MockData.getCamsUserReference(),
    },
  ];

  test('should display loading indicator if loading', async () => {
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: [],
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    await waitFor(() => {
      const loading = screen.queryByTestId('loading-indicator');
      expect(loading).toBeInTheDocument();
    });
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

    render(<CaseDetailAuditHistory caseId={caseId} />);

    await waitFor(() => {
      const previousElement = screen.queryByTestId('previous-assignment-0');
      expect(previousElement).toBeInTheDocument();
    });

    const previousElement = screen.getByTestId('previous-assignment-0');
    const newElement = screen.getByTestId('new-assignment-0');

    const previousDivs = previousElement.querySelectorAll('div');
    expect(previousDivs).toHaveLength(assignmentBefore.length);
    assignmentBefore.forEach((assignment, idx) => {
      expect(previousDivs[idx]).toHaveTextContent(assignment.name);
    });

    const newDivs = newElement.querySelectorAll('div');
    expect(newDivs).toHaveLength(assignmentAfter.length);
    assignmentAfter.forEach((assignment, idx) => {
      expect(newDivs[idx]).toHaveTextContent(assignment.name);
    });

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
        id: '',
        documentType: 'AUDIT_ASSIGNMENT',
        caseId,
        updatedOn: '',
        updatedBy: SYSTEM_USER_REFERENCE,
        before: [],
        after: [],
      },
    ];
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: caseHistory,
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    let previousElement;
    await waitFor(() => {
      previousElement = screen.queryByTestId('previous-assignment-0');
      expect(previousElement).toBeInTheDocument();
    });
    expect(previousElement).toHaveTextContent('(none)');

    let newElement;
    await waitFor(() => {
      newElement = screen.queryByTestId('new-assignment-0');
      expect(newElement).toBeInTheDocument();
    });
    expect(newElement).toHaveTextContent('(none)');
  });

  test('should display a row for pending transfer', async () => {
    const caseHistory: CaseHistory[] = [
      {
        id: '',
        documentType: 'AUDIT_TRANSFER',
        caseId,
        updatedOn: '2024-01-31T12:00:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
        before: pendingTransferOrder,
        after: approvedTransferOrder,
      },
      {
        id: '',
        documentType: 'AUDIT_TRANSFER',
        caseId,
        updatedOn: '2024-01-29T12:00:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
        before: null,
        after: pendingTransferOrder,
      },
    ];
    vi.spyOn(Api2, 'getCaseHistory').mockResolvedValue({
      data: caseHistory,
    });

    render(<CaseDetailAuditHistory caseId={caseId} />);

    let previousElement1;
    await waitFor(() => {
      previousElement1 = screen.queryByTestId('previous-order-0');
      expect(previousElement1).toBeInTheDocument();
    });
    expect(previousElement1).toHaveTextContent('Pending Review');

    let newElement1;
    await waitFor(() => {
      newElement1 = screen.queryByTestId('new-order-0');
      expect(newElement1).toBeInTheDocument();
    });
    expect(newElement1).toHaveTextContent('Verified');

    let changeDate1;
    await waitFor(() => {
      changeDate1 = screen.queryByTestId('change-date-0');
      expect(changeDate1).toBeInTheDocument();
    });
    expect(changeDate1).toHaveTextContent('01/31/2024');

    let previousElement2;
    await waitFor(() => {
      previousElement2 = screen.queryByTestId('previous-order-1');
      expect(previousElement2).toBeInTheDocument();
    });
    expect(previousElement2).toHaveTextContent('(none)');

    let newElement2;
    await waitFor(() => {
      newElement2 = screen.queryByTestId('new-order-1');
      expect(newElement2).toBeInTheDocument();
    });
    expect(newElement2).toHaveTextContent('Pending Review');

    let changeDate2;
    await waitFor(() => {
      changeDate2 = screen.queryByTestId('change-date-1');
      expect(changeDate2).toBeInTheDocument();
    });
    expect(changeDate2).toHaveTextContent('01/29/2024');
  });
});
