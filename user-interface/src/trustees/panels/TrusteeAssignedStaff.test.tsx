import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAssignedStaff from './TrusteeAssignedStaff';
import { useTrusteeAssignments } from '@/lib/hooks/UseTrusteeAssignments';
import { Trustee, TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';

// Mock the hook
vi.mock('@/lib/hooks/UseTrusteeAssignments', () => ({
  useTrusteeAssignments: vi.fn(),
}));

// Mock the AttorneyAssignmentSection component
vi.mock('./AttorneyAssignmentSection', () => ({
  default: vi.fn(({ trusteeId, assignments, onAssignmentChange, isLoading }) => (
    <div
      data-testid="attorney-assignment-section"
      data-trustee-id={trusteeId}
      data-loading={isLoading}
      data-assignments-count={assignments?.length || 0}
    >
      <button onClick={onAssignmentChange} data-testid="refresh-assignments">
        Refresh Assignments
      </button>
    </div>
  )),
}));

describe('TrusteeAssignedStaff', () => {
  const mockTrustee: Trustee = {
    id: 'trustee-123',
    trusteeId: '123',
    name: 'Test Trustee Name',
    public: {
      address: {
        address1: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        countryCode: 'US',
      },
      phone: { number: '555-123-4567' },
      email: 'test@example.com',
    },
    status: 'active',
    updatedBy: { id: 'user-1', name: 'Test User' },
    updatedOn: '2023-01-01T00:00:00.000Z',
  };

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
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useTrusteeAssignments as jest.Mock).mockReturnValue(mockUseTrusteeAssignments);
  });

  test('should render component with correct structure', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    // Should have the main containers
    expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();
  });

  test('should call getTrusteeOversightAssignments on mount with correct trusteeId', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(1);
  });

  test('should call getTrusteeOversightAssignments again when trusteeId changes', () => {
    const { rerender } = render(
      <TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />,
    );

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );

    // Change trusteeId
    rerender(<TrusteeAssignedStaff trusteeId="trustee-456" trustee={mockTrustee} />);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-456',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(2);
  });

  test('should not display error alert when there is no error', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-container')).not.toBeInTheDocument();
  });

  test('should display error alert when error exists', () => {
    (useTrusteeAssignments as jest.Mock).mockReturnValue({
      ...mockUseTrusteeAssignments,
      error: 'Failed to load assignments',
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load assignments');
  });

  test('should show alert container when error is present', () => {
    (useTrusteeAssignments as jest.Mock).mockReturnValue({
      ...mockUseTrusteeAssignments,
      error: 'Failed to load assignments',
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    expect(screen.getByTestId('alert-container')).toBeInTheDocument();
  });

  test('should pass correct props to AttorneyAssignmentSection', () => {
    (useTrusteeAssignments as jest.Mock).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: mockAssignments,
      isLoading: true,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-trustee-id', 'trustee-123');
    expect(section).toHaveAttribute('data-loading', 'true');
    expect(section).toHaveAttribute('data-assignments-count', '1');
  });

  test('should refresh assignments when onAssignmentChange is called', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    // Clear the initial call
    mockUseTrusteeAssignments.getTrusteeOversightAssignments.mockClear();

    // Trigger refresh through the AttorneyAssignmentSection
    const refreshButton = screen.getByTestId('refresh-assignments');
    fireEvent.click(refreshButton);

    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledWith(
      'trustee-123',
    );
    expect(mockUseTrusteeAssignments.getTrusteeOversightAssignments).toHaveBeenCalledTimes(1);
  });

  test('should have correct container structure', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    // Should have the attorney assignment section
    expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();

    // Should have the right-side-screen-content class structure (from the component)
    const container = document.querySelector('.right-side-screen-content');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('.record-detail-container')).toBeInTheDocument();
  });

  test('should handle loading state properly', () => {
    (useTrusteeAssignments as jest.Mock).mockReturnValue({
      ...mockUseTrusteeAssignments,
      isLoading: true,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-loading', 'true');
  });

  test('should handle empty assignments array', () => {
    (useTrusteeAssignments as jest.Mock).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: [],
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

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

    (useTrusteeAssignments as jest.Mock).mockReturnValue({
      ...mockUseTrusteeAssignments,
      assignments: multipleAssignments,
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" trustee={mockTrustee} />);

    const section = screen.getByTestId('attorney-assignment-section');
    expect(section).toHaveAttribute('data-assignments-count', '2');
  });
});
