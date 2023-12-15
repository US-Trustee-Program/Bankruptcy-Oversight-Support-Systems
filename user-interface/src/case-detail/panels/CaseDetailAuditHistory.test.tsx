import { render, screen } from '@testing-library/react';
import CaseDetailAuditHistory from '@/case-detail/panels/CaseDetailAuditHistory';
import { CaseAuditHistory, CaseStaffAssignment } from '@/lib/type-declarations/chapter-15';

const EXPECTED_DATE_TIME = '01/01/2024 12:01 PM MST';

vi.mock('../../lib/utils/datetime', () => {
  return {
    formatDateTime: (): string => EXPECTED_DATE_TIME,
  };
});

describe('audit history tests', () => {
  const caseId = '000-11-22222';

  test('should display loading indicator if loading', async () => {
    const caseHistory: CaseAuditHistory[] = [];

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={true} />);

    const historyTable = screen.queryByTestId('loading-indicator');
    expect(historyTable).toBeInTheDocument();
  });

  test('should display no assignments message if no history exists', async () => {
    const caseHistory: CaseAuditHistory[] = [];

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={false} />);

    const emptyAssignments = await screen.findByTestId('empty-assignments-test-id');
    expect(emptyAssignments).toHaveTextContent('No assignments in history.');

    const historyTable = screen.queryByTestId('history-table');
    expect(historyTable).not.toBeInTheDocument();
  });

  test('should display assignment history when history exists', async () => {
    const previousAssignments: CaseStaffAssignment[] = [
      {
        caseId,
        documentType: 'ASSIGNMENT',
        name: 'Alfred',
        role: 'TrialAttorney',
        assignedOn: '2023-12-25T00:00:00.000Z',
      },
      {
        caseId,
        documentType: 'ASSIGNMENT',
        name: 'Bradford',
        role: 'TrialAttorney',
        assignedOn: '2023-12-25T00:00:00.000Z',
      },
    ];
    const newAssignments: CaseStaffAssignment[] = [
      {
        caseId,
        documentType: 'ASSIGNMENT',
        name: 'Charles',
        role: 'TrialAttorney',
        assignedOn: '2023-12-25T00:00:00.000Z',
      },
      {
        caseId,
        documentType: 'ASSIGNMENT',
        name: 'Daniel',
        role: 'TrialAttorney',
        assignedOn: '2023-12-25T00:00:00.000Z',
      },
      {
        caseId,
        documentType: 'ASSIGNMENT',
        name: 'Edward',
        role: 'TrialAttorney',
        assignedOn: '2023-12-25T00:00:00.000Z',
      },
    ];
    const caseHistory: CaseAuditHistory[] = [
      {
        id: '1234567890',
        documentType: 'ASSIGNMENT_HISTORY',
        caseId,
        occurredAtTimestamp: '2023-12-25T00:00:00.000Z',
        previousAssignments,
        newAssignments,
      },
    ];

    const expectedPrevious = previousAssignments.map((n) => n.name).join(', ');
    const expectedNew = newAssignments.map((n) => n.name).join(', ');

    render(<CaseDetailAuditHistory caseHistory={caseHistory} isAuditHistoryLoading={false} />);

    const previousElement = screen.queryByTestId('previous-assignment-0');
    expect(previousElement).toBeInTheDocument();
    expect(previousElement).toHaveTextContent(expectedPrevious);

    const newElement = screen.queryByTestId('new-assignment-0');
    expect(newElement).toBeInTheDocument();
    expect(newElement).toHaveTextContent(expectedNew);

    const dateElement = screen.queryByTestId('change-date-0');
    expect(dateElement).toBeInTheDocument();
    console.log(dateElement);
    expect(dateElement).toHaveTextContent(EXPECTED_DATE_TIME);
  });

  test('should display (none) when no assignments exist.', async () => {
    const caseHistory: CaseAuditHistory[] = [
      {
        id: '',
        documentType: 'ASSIGNMENT_HISTORY',
        caseId,
        occurredAtTimestamp: '',
        previousAssignments: [],
        newAssignments: [],
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
});
