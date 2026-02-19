import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import StaffAssignmentCard from './StaffAssignmentCard';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';

vi.mock('../modals/TrusteeOversightAssignmentModal', () => {
  const MockModal = React.forwardRef<unknown, { onAssignment?: (isAssigned: boolean) => void }>(
    (props, ref) => {
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
    },
  );
  MockModal.displayName = 'MockTrusteeOversightAssignmentModal';
  return { default: MockModal };
});

describe('StaffAssignmentCard', () => {
  const mockAttorneyAssignments: TrusteeOversightAssignment[] = [
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

  const mockParalegalAssignments: TrusteeOversightAssignment[] = [
    {
      id: 'assignment-2',
      trusteeId: 'trustee-123',
      user: {
        id: 'paralegal-1',
        name: 'Jane Smith',
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
      role:
        | typeof CamsRole.OversightAttorney
        | typeof CamsRole.OversightParalegal
        | typeof CamsRole.OversightAuditor;
      trusteeId: string;
      assignments: TrusteeOversightAssignment[];
      onAssignmentChange: () => void;
      isLoading?: boolean;
    }>,
  ) => {
    const defaults = {
      role: CamsRole.OversightAttorney as typeof CamsRole.OversightAttorney,
      trusteeId: 'trustee-123',
      assignments: [] as TrusteeOversightAssignment[],
      onAssignmentChange: vi.fn() as unknown as () => void,
      isLoading: false,
    } as const;

    return render(
      <BrowserRouter>
        <StaffAssignmentCard {...defaults} {...override} />
      </BrowserRouter>,
    );
  };

  test('should show no assignment state for attorney when no staff assigned', () => {
    renderWithRouter({ role: CamsRole.OversightAttorney });
    expect(screen.getByTestId('no-attorney-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('no-attorney-assigned')).toHaveTextContent('No attorney assigned');
  });

  test('should show no assignment state for paralegal when no staff assigned', () => {
    renderWithRouter({ role: CamsRole.OversightParalegal });
    expect(screen.getByTestId('no-paralegal-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('no-paralegal-assigned')).toHaveTextContent('No paralegal assigned');
  });

  test('should show no assignment state for auditor when no staff assigned', () => {
    renderWithRouter({ role: CamsRole.OversightAuditor });
    expect(screen.getByTestId('no-auditor-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('no-auditor-assigned')).toHaveTextContent('No auditor assigned');
  });

  test('should display assigned attorney information', () => {
    renderWithRouter({
      role: CamsRole.OversightAttorney,
      assignments: mockAttorneyAssignments,
    });

    expect(screen.getByTestId('attorney-assignments-display')).toBeInTheDocument();
    expect(screen.getByTestId('attorney-assignments-display')).toHaveTextContent('John Doe');
  });

  test('should display assigned paralegal information', () => {
    renderWithRouter({
      role: CamsRole.OversightParalegal,
      assignments: mockParalegalAssignments,
    });

    expect(screen.getByTestId('paralegal-assignments-display')).toBeInTheDocument();
    expect(screen.getByTestId('paralegal-assignments-display')).toHaveTextContent('Jane Smith');
  });

  test('should show edit button for attorney when assigned', () => {
    renderWithRouter({
      role: CamsRole.OversightAttorney,
      assignments: mockAttorneyAssignments,
    });

    expect(screen.getByTestId('button-edit-attorney-assignment')).toBeInTheDocument();
  });

  test('should show add button for paralegal when not assigned', () => {
    renderWithRouter({ role: CamsRole.OversightParalegal });
    expect(screen.getByTestId('button-add-paralegal-assignment')).toBeInTheDocument();
  });

  test('should show loading state for attorney', () => {
    renderWithRouter({
      role: CamsRole.OversightAttorney,
      isLoading: true,
    });

    expect(screen.getByTestId('attorney-assignments-loading')).toBeInTheDocument();
  });

  test('should show loading state for auditor', () => {
    renderWithRouter({
      role: CamsRole.OversightAuditor,
      isLoading: true,
    });

    expect(screen.getByTestId('auditor-assignments-loading')).toBeInTheDocument();
  });

  test('should display correct header label for attorney', () => {
    renderWithRouter({ role: CamsRole.OversightAttorney });
    expect(screen.getByText('Attorney')).toBeInTheDocument();
  });

  test('should display correct header label for paralegal', () => {
    renderWithRouter({ role: CamsRole.OversightParalegal });
    expect(screen.getByText('Paralegal')).toBeInTheDocument();
  });

  test('should display correct header label for auditor', () => {
    renderWithRouter({ role: CamsRole.OversightAuditor });
    expect(screen.getByText('Auditor')).toBeInTheDocument();
  });

  test('should call onAssignmentChange when handleAssignment is triggered', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      role: CamsRole.OversightAttorney,
      onAssignmentChange,
    });

    const triggerButton = screen.getByTestId('mock-assignment-created-trigger');
    fireEvent.click(triggerButton);

    expect(onAssignmentChange).toHaveBeenCalledTimes(1);
  });
});
