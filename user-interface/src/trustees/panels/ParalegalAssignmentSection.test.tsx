import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ParalegalAssignmentSection from './ParalegalAssignmentSection';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';

vi.mock('../modals/TrusteeOversightAssignmentModal', () => {
  return {
    default: (() => {
      interface MockModalProps {
        onAssignmentCreated?: (assignment: TrusteeOversightAssignment) => void;
        onAssignment?: (isAssigned: boolean) => void;
      }

      const MockModal = React.forwardRef((props: MockModalProps, ref) => {
        React.useImperativeHandle(ref, () => ({
          show: vi.fn(),
          hide: vi.fn(),
        }));

        return props.onAssignment ? (
          <button
            data-testid="mock-assignment-created-trigger"
            onClick={() => props.onAssignment!(true)}
          >
            Trigger Assignment Created
          </button>
        ) : null;
      });
      MockModal.displayName = 'MockTrusteeOversightAssignmentModal';
      return MockModal;
    })(),
  };
});

describe('ParalegalAssignmentSection', () => {
  const mockAssignments: TrusteeOversightAssignment[] = [
    {
      id: 'assignment-1',
      trusteeId: 'trustee-123',
      user: {
        id: 'paralegal-1',
        name: 'John Doe',
      },
      role: CamsRole.OversightParalegal,
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
      onAssignmentChange: () => void;
      isLoading?: boolean;
    }>,
  ) => {
    const defaults = {
      trusteeId: 'trustee-123',
      assignments: [] as TrusteeOversightAssignment[],
      onAssignmentChange: vi.fn() as unknown as () => void,
      isLoading: false,
    } as const;

    return render(
      <BrowserRouter>
        <ParalegalAssignmentSection {...defaults} {...override} />
      </BrowserRouter>,
    );
  };

  test('should show no assignment state when no paralegal assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: [],
      onAssignmentChange,
    });

    expect(screen.getByTestId('no-paralegal-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('no-paralegal-assigned')).toHaveTextContent('No paralegal assigned');
  });

  test('should display assigned paralegal information', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    expect(screen.getByTestId('paralegal-assignments-display')).toBeInTheDocument();
  });

  test('should show edit button when paralegal is assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    const editButton = screen.getByTestId('button-test');
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

    expect(screen.getByTestId('paralegal-assignments-loading')).toBeInTheDocument();
  });

  test('should show paralegal name when assignment exists', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    expect(screen.getByTestId('paralegal-assignments-display')).toBeInTheDocument();
    const displayArea = screen.getByTestId('paralegal-assignments-display');
    expect(displayArea).toHaveTextContent('John Doe');
  });

  test('should call onAssignmentChange when handleAssignment is triggered', () => {
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
