import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAssignedStaff from './TrusteeAssignedStaff';
import * as UseTrusteeAssignmentsModule from '@/trustees/modals/UseTrusteeAssignments';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { Staff } from '@common/cams/users';

describe('TrusteeAssignedStaff', () => {
  const mockStaffByRole: Record<OversightRoleType, Staff[]> = {
    [CamsRole.OversightAttorney]: [],
    [CamsRole.OversightAuditor]: [],
    [CamsRole.OversightParalegal]: [],
  };

  const mockUseTrusteeAssignments = {
    assignments: [],
    isLoading: false,
    error: null,
    getTrusteeOversightAssignments: vi.fn(),
    assignAttorneyToTrustee: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    // Reset the vi.fn() mocks before each test
    mockUseTrusteeAssignments.getTrusteeOversightAssignments = vi.fn();
    mockUseTrusteeAssignments.assignAttorneyToTrustee = vi.fn();
    mockUseTrusteeAssignments.clearError = vi.fn();
    vi.spyOn(UseTrusteeAssignmentsModule, 'useTrusteeAssignments').mockReturnValue(
      mockUseTrusteeAssignments,
    );
    vi.spyOn(Api2, 'getOversightStaff').mockResolvedValue({ data: mockStaffByRole });
  });

  test('should render component with correct structure', async () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();
    });
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
    vi.spyOn(UseTrusteeAssignmentsModule, 'useTrusteeAssignments').mockReturnValue({
      ...mockUseTrusteeAssignments,
      error: 'Failed to load assignments',
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load assignments');
  });

  test('should show alert container when error is present', () => {
    vi.spyOn(UseTrusteeAssignmentsModule, 'useTrusteeAssignments').mockReturnValue({
      ...mockUseTrusteeAssignments,
      error: 'Failed to load assignments',
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByTestId('alert-container')).toBeInTheDocument();
  });

  test('should have correct container structure', async () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();
    });

    const container = document.querySelector('.right-side-screen-content');
    expect(container).toBeInTheDocument();
    expect(container?.querySelector('.trustee-assigned-staff-container')).toBeInTheDocument();
    expect(container?.querySelector('.assigned-staff-cards')).toBeInTheDocument();
    expect(screen.getByTestId('auditor-assignment-section')).toBeInTheDocument();
  });

  test('should render ParalegalAssignmentSection', () => {
    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    expect(screen.getByTestId('paralegal-assignment-section')).toBeInTheDocument();
  });

  test('should call getTrusteeOversightAssignments when onAssignmentChange callback is triggered', async () => {
    const getTrusteeOversightAssignmentsSpy = vi.fn();

    vi.spyOn(UseTrusteeAssignmentsModule, 'useTrusteeAssignments').mockReturnValue({
      ...mockUseTrusteeAssignments,
      getTrusteeOversightAssignments: getTrusteeOversightAssignmentsSpy,
    });

    vi.spyOn(Api2, 'getOversightStaff').mockResolvedValue({
      data: {
        [CamsRole.OversightAttorney]: [
          {
            id: 'attorney-1',
            name: 'Attorney Smith',
            roles: [CamsRole.OversightAttorney],
          },
        ],
        [CamsRole.OversightAuditor]: [],
        [CamsRole.OversightParalegal]: [],
      },
    });

    vi.spyOn(Api2, 'createTrusteeOversightAssignment').mockResolvedValue({
      data: {
        id: 'new-assignment',
        trusteeId: 'trustee-123',
        user: { id: 'attorney-1', name: 'Attorney Smith' },
        role: CamsRole.OversightAttorney,
        createdBy: { id: 'admin', name: 'Admin' },
        createdOn: '2024-01-01',
        updatedBy: { id: 'admin', name: 'Admin' },
        updatedOn: '2024-01-01',
      },
    });

    render(<TrusteeAssignedStaff trusteeId="trustee-123" />);

    await waitFor(() => {
      expect(screen.getByTestId('attorney-assignment-section')).toBeInTheDocument();
    });

    // Clear the initial mount call
    getTrusteeOversightAssignmentsSpy.mockClear();

    const addButton = screen.getByRole('button', { name: /add assigned attorney to trustee/i });
    addButton.click();

    await waitFor(() => {
      expect(
        screen.getByTestId('modal-content-assign-attorney-modal-trustee-123'),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(Api2.getOversightStaff).toHaveBeenCalled();
    });

    await TestingUtilities.toggleComboBoxItemSelection('staff-search', 0);

    const submitButton = screen.getByTestId(
      'button-assign-attorney-modal-trustee-123-submit-button',
    );
    submitButton.click();

    await waitFor(() => {
      expect(getTrusteeOversightAssignmentsSpy).toHaveBeenCalledWith('trustee-123');
      expect(getTrusteeOversightAssignmentsSpy).toHaveBeenCalledTimes(1);
    });
  });
});
