import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AttorneyAssignmentCard from './AttorneyAssignmentCard';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { AttorneyUser } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';

vi.mock('../modals/TrusteeAttorneyAssignmentModal', () => {
  return {
    default: (() => {
      interface MockModalProps {
        onAssignmentCreated?: (assignment: TrusteeOversightAssignment) => void;
        onAssignment?: (assignment: TrusteeOversightAssignment) => void;
      }

      const MockModal = React.forwardRef((props: MockModalProps, ref) => {
        React.useImperativeHandle(ref, () => ({
          show: vi.fn(),
          hide: vi.fn(),
        }));

        return props.onAssignment ? (
          <button
            data-testid="mock-assignment-created-trigger"
            onClick={() =>
              props.onAssignment!({
                id: 'new-assignment-1',
                trusteeId: 'trustee-123',
                user: { id: 'user-1', name: 'New Attorney' },
                role: CamsRole.OversightAttorney,
                updatedOn: '2024-01-01T00:00:00Z',
                updatedBy: { id: 'user-1', name: 'Test User' },
                createdOn: '2024-01-01T00:00:00Z',
                createdBy: { id: 'user-1', name: 'Test User' },
              })
            }
          >
            Trigger Assignment Created
          </button>
        ) : null;
      });
      MockModal.displayName = 'MockTrusteeAttorneyAssignmentModal';
      return MockModal;
    })(),
  };
});

describe('AttorneyAssignmentCard', () => {
  const mockAttorneys: AttorneyUser[] = [
    {
      id: 'attorney-1',
      name: 'John Doe',
      offices: [],
      roles: [CamsRole.TrialAttorney],
    },
    {
      id: 'attorney-2',
      name: 'Jane Smith',
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
        name: 'John Doe',
      },
      role: CamsRole.OversightAttorney,
      createdBy: { id: 'user-1', name: 'Admin User' },
      createdOn: '2023-01-01T00:00:00Z',
      updatedBy: { id: 'user-1', name: 'Admin User' },
      updatedOn: '2023-01-01T00:00:00Z',
    },
  ];

  const renderWithRouter = (
    override?: Partial<{
      trusteeId: string;
      assignments: TrusteeOversightAssignment[];
      attorneys: AttorneyUser[];
      onAssignmentChange: () => void;
      isLoading?: boolean;
    }>,
  ) => {
    const defaults = {
      trusteeId: 'trustee-123',
      assignments: [] as TrusteeOversightAssignment[],
      attorneys: mockAttorneys,
      onAssignmentChange: vi.fn() as unknown as () => void,
      isLoading: false,
    } as const;

    return render(
      <BrowserRouter>
        <AttorneyAssignmentCard {...defaults} {...override} />
      </BrowserRouter>,
    );
  };

  test('should show no assignment state when no staff assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: [],
      onAssignmentChange,
    });

    expect(screen.getByTestId('no-attorney-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('no-attorney-assigned')).toHaveTextContent('No attorney assigned');
  });

  test('should display assigned attorney information', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    expect(screen.getByTestId('attorney-assignments-display')).toBeInTheDocument();
  });

  test('should show edit button when attorney is assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    const editButton = screen.getByTestId('button-edit-attorney-assignment');
    expect(editButton).toBeInTheDocument();
  });

  test('should show loading state when isLoading is true', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: [],
      onAssignmentChange,
      isLoading: true,
    });

    expect(screen.getByTestId('attorney-assignments-loading')).toBeInTheDocument();
  });

  test('should show attorney name when assignment exists', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    expect(screen.getByTestId('attorney-assignments-display')).toBeInTheDocument();
    const displayArea = screen.getByTestId('attorney-assignments-display');
    expect(displayArea).toHaveTextContent('John Doe');
  });

  test('should call onAssignmentChange when handleAssignmentCreated is triggered', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: [],
      onAssignmentChange,
    });

    const triggerButton = screen.getByTestId('mock-assignment-created-trigger');
    fireEvent.click(triggerButton);

    expect(onAssignmentChange).toHaveBeenCalledTimes(1);
  });
});
