import { render, screen } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ParalegalAssignmentSection from './ParalegalAssignmentSection';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';

describe('ParalegalAssignmentSection', () => {
  const mockAssignments: TrusteeOversightAssignment[] = [
    {
      id: 'assignment-1',
      trusteeId: 'trustee-123',
      user: {
        id: 'paralegal-1',
        name: 'John Doe',
      },
      role: OversightRole.OversightParalegal,
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

  test('should show Add button when no paralegal is assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: [],
      onAssignmentChange,
    });

    const addButton = screen.getByLabelText('Add assigned paralegal to trustee');
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent('Add');
  });

  test('should show Edit button when paralegal is assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: mockAssignments,
      onAssignmentChange,
    });

    const editButton = screen.getByLabelText("Edit trustee's assigned paralegal");
    expect(editButton).toBeInTheDocument();
    expect(editButton).toHaveTextContent('Edit');
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

  test('should render paralegal assignment section with correct heading', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter({
      trusteeId: 'trustee-123',
      assignments: [],
      onAssignmentChange,
    });

    expect(screen.getByRole('heading', { name: 'Paralegal' })).toBeInTheDocument();
  });
});
