import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, MockedFunction } from 'vitest';
import TrusteeAssignedStaff from './TrusteeAssignedStaff';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { AttorneyUser } from '@common/cams/users';
import { CamsRole, OversightRole } from '@common/cams/roles';
import createApi2 from '@/lib/Api2Factory';

vi.mock('@/trustees/modals/UseTrusteeAssignments', () => ({
  useTrusteeAssignments: vi.fn(),
}));

vi.mock('@/lib/Api2Factory', () => ({
  default: vi.fn(),
}));

vi.mock('./AttorneyAssignmentSection', () => ({
  default: vi.fn(({ trusteeId, assignments, attorneys, onAssignmentChange, isLoading }) => (
    <div
      data-testid="attorney-assignment-section"
      data-trustee-id={trusteeId}
      data-loading={isLoading}
      data-assignments-count={assignments?.length || 0}
      data-attorneys-count={attorneys?.length || 0}
    >
      <button onClick={onAssignmentChange} data-testid="refresh-assignments">
        Refresh Assignments
      </button>
    </div>
  )),
}));

vi.mock('./AuditorAssignmentSection', () => ({
  default: vi.fn(({ trusteeId, assignments, onAssignmentChange, isLoading }) => (
    <div
      data-testid="auditor-assignment-section"
      data-trustee-id={trusteeId}
      data-loading={isLoading}
      data-assignments-count={assignments?.length || 0}
    >
      <button onClick={onAssignmentChange} data-testid="refresh-auditor-assignments">
        Refresh Auditor Assignments
      </button>
    </div>
  )),
}));

vi.mock('./ParalegalAssignmentSection', () => ({
  default: vi.fn(({ trusteeId, assignments, onAssignmentChange, isLoading }) => (
    <div
      data-testid="paralegal-assignment-section"
      data-trustee-id={trusteeId}
      data-loading={isLoading}
      data-assignments-count={assignments?.length || 0}
    >
      <button onClick={onAssignmentChange} data-testid="refresh-paralegal-assignments">
        Refresh Paralegal Assignments
      </button>
    </div>
  )),
}));

describe('TrusteeAssignedStaff', () => {
  const mockAttorneys: AttorneyUser[] = [
    {
      id: 'attorney-1',
      name: 'Attorney Smith',
      offices: [],
      roles: [CamsRole.TrialAttorney],
    },
    {
      id: 'attorney-2',
      name: 'Attorney Jones',
      offices: [],
      roles: [CamsRole.TrialAttorney],
    },
  ];

  const mockAssignments: TrusteeOversightAssignment[] = [
    {
      id: 'assignment-1',
      trusteeId: 'trustee-123',
      user: {
        id: 'attorney-1',
        name: 'Attorney Smith',
      },
      role: OversightRole.OversightAttorney,
      createdBy: {
        id: 'user-1',
        name: 'Admin User',
      },
      createdOn: '2023-01-01T00:00:00.000Z',
      updatedBy: {
        id: 'user-1',
        name: 'Admin User',
      },
      updatedOn: '2023-01-01T00:00:00.000Z',
    },
  ];

  const mockUseTrusteeAssignments = {
    assignments: [],
    isLoading: false,
    error: null,
    getTrusteeOversightAssignments: vi.fn(),
    assignAttorneyToTrustee: vi.fn(),
    clearError: vi.fn(),
  };

  const mockApi = {
    getOversightStaff: vi.fn().mockResolvedValue({ data: mockAttorneys }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue(
      mockUseTrusteeAssignments,
    );
    (createApi2 as MockedFunction<typeof createApi2>).mockReturnValue(mockApi as never);
  });

  test('should render component with correct structure', async () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();
    });
  });

  test('should load attorneys on mount', async () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(mockApi.getOversightStaff).toHaveBeenCalledTimes(1);
    });
  });

  test('should pass attorneys to AttorneyAssignmentSection after loading', async () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      const section = screen.getByTestId('attorney-assignment-section');
      expect(section).toHaveAttribute('data-attorneys-count', '2');
    });
    expect(screen.getByTestId('auditor-assignment-section')).toBeInTheDocument();
  });

  test('should call getTrusteeOversightAssignments on mount with correct trusteeId', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(1);
  });

  test('should call getTrusteeOversightAssignments again when trusteeId changes', () => {
    const { rerender } = render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );

    rerender(<TrusteeAssignedStaff trusteeId="trustee-456" />);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-456',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(2);
  });

  test('should not display error alert when there is no error', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-container')).not.toBeInTheDocument();
  });

  test('should display error alert when error exists', () => {
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      error: 'Failed to load assignments',
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load assignments');
  });

  test('should display error alert when attorneys fail to load', async () => {
    (createApi2 as MockedFunction<typeof createApi2>).mockReturnValue({
      getAttorneys: vi.fn().mockRejectedValue(new Error('Failed to load attorneys')),
    } as never);

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const alertTexts = alerts.map((alert) => alert.textContent);
      expect(alertTexts).toContain('Failed to load attorneys');
    });
  });

  test('should show alert container when error is present', () => {
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      error: 'Failed to load assignments',
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByTestId('alert-container')).toBeInTheDocument();
  });

  test('should pass correct props to AttorneyAssignmentSection', async () => {
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: mockAssignments,
      isLoading: true,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-trustee-id', 'trustee-123');
    expect(section).toHaveAttribute('data-loading', 'true');
    expect(section).toHaveAttribute('data-assignments-count', '1');

    await waitFor(() => {
      expect(section).toHaveAttribute('data-attorneys-count', '2');
    });
  });

  test('should refresh assignments when onAssignmentChange is called', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    mockUseTrusteeAssignments.getTrusteeOversightAssignments.mockClear();

    const refreshButton = screen.getByTestId('refresh-assignments');
    fireEvent.click(refreshButton);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(1);
  });

  test('should have correct container structure', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();

    const container = document.querySelector('.right-side-screen-content');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('.record-detail-container')).toBeInTheDocument();
  });

  test('should handle loading state properly', () => {
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      isLoading: true,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-loading', 'true');
  });

  test('should handle empty assignments array', () => {
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: [],
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-assignments-count', '0');
  });

  test('should handle multiple assignments', () => {
    const multipleAssignments = [
      ...mockAssignments,
      {
        ...mockAssignments[0],
        id: 'assignment-2',
        user: { id: 'attorney-2', name: 'Attorney Jones' },
      },
    ];

    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: multipleAssignments,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-assignments-count', '2');
  });

  test('should pass correct props to AuditorAssignmentSection', () => {
    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: mockAssignments,
      isLoading: true,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    const section = screen.getByTestId('auditor-assignment-section');
    expect(section).toHaveAttribute('data-trustee-id', 'trustee-123');
    expect(section).toHaveAttribute('data-loading', 'true');
    expect(section).toHaveAttribute('data-assignments-count', '1');
  });

  test('should refresh assignments when auditor section onAssignmentChange is called', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    mockUseTrusteeAssignments.getTrusteeOversightAssignments.mockClear();

    const refreshButton = screen.getByTestId('refresh-auditor-assignments');
    fireEvent.click(refreshButton);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(1);
  });

  test('should render ParalegalAssignmentSection', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByTestId('paralegal-assignment-section')).toBeInTheDocument();
  });

  test('should pass correct props to ParalegalAssignmentSection', () => {
    const mockAssignments: TrusteeOversightAssignment[] = [
      {
        id: 'assignment-3',
        trusteeId: 'trustee-123',
        user: { id: 'paralegal-1', name: 'Bob Paralegal' },
        role: OversightRole.OversightParalegal,
        createdBy: { id: 'user-1', name: 'Admin User' },
        createdOn: '2023-01-01T00:00:00Z',
        updatedBy: { id: 'user-1', name: 'Admin User' },
        updatedOn: '2023-01-01T00:00:00Z',
      },
    ];

    (useTrusteeAssignments as MockedFunction<typeof useTrusteeAssignments>).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: mockAssignments,
      isLoading: true,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    const section = screen.getByTestId('paralegal-assignment-section');
    expect(section).toHaveAttribute('data-trustee-id', 'trustee-123');
    expect(section).toHaveAttribute('data-loading', 'true');
    expect(section).toHaveAttribute('data-assignments-count', '1');
  });

  test('should refresh assignments when paralegal section onAssignmentChange is called', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    mockUseTrusteeAssignments.getTrusteeOversightAssignments.mockClear();

    const refreshButton = screen.getByTestId('refresh-paralegal-assignments');
    fireEvent.click(refreshButton);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(1);
  });
});
