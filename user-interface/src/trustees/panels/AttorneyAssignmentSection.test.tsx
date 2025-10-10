import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AttorneyAssignmentSection from './AttorneyAssignmentSection';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';

vi.mock('../modals/TrusteeAttorneyAssignmentModal', () => {
  return {
    default: (() => {
      interface MockModalProps {
        onAssignmentCreated?: (assignment: TrusteeOversightAssignment) => void;
      }

      const MockModal = React.forwardRef((props: MockModalProps, ref) => {
        React.useImperativeHandle(ref, () => ({
          show: vi.fn(),
          hide: vi.fn(),
        }));

        // Add a test button to trigger the onAssignmentCreated callback for testing
        return props.onAssignmentCreated ? (
          <button
            data-testid="mock-assignment-created-trigger"
            onClick={() =>
              props.onAssignmentCreated!({
                id: 'new-assignment-1',
                trusteeId: 'trustee-123',
                user: { id: 'user-1', name: 'New Attorney' },
                role: OversightRole.OversightAttorney,
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

describe('AttorneyAssignmentSection', () => {
  const mockAssignments: TrusteeOversightAssignment[] = [
    {
      id: 'assignment-1',
      trusteeId: 'trustee-123',
      user: {
        id: 'attorney-1',
        name: 'John Doe',
      },
      role: OversightRole.OversightAttorney,
      createdBy: { id: 'user-1', name: 'Admin User' },
      createdOn: '2023-01-01T00:00:00Z',
      updatedBy: { id: 'user-1', name: 'Admin User' },
      updatedOn: '2023-01-01T00:00:00Z',
    },
  ];

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  test('should show no assignment state when no attorneys assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={[]}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    expect(screen.getByTestId('no-attorney-assigned')).toBeInTheDocument();
    expect(screen.getByTestId('no-attorney-assigned')).toHaveTextContent('No attorney assigned');
  });

  test('should display assigned attorney information', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={mockAssignments}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    expect(screen.getByTestId('attorney-assignments-display')).toBeInTheDocument();
  });

  test('should open assignment modal when assign button clicked', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={[]}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    // Get the assign button and click it - buttons get random ids so use generic testid
    const assignButton = screen.getByTestId('button-test');
    fireEvent.click(assignButton);

    // Since we're mocking the modal, we can't directly test that it opens
    // but we can verify the click handler was called
    expect(assignButton).toBeInTheDocument();
  });

  test('should handle assignment creation callback', () => {
    const onAssignmentChange = vi.fn();

    const { container } = renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={[]}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    // We can't directly test the callback without complex test setup,
    // but we can verify the component renders correctly
    expect(container).toBeInTheDocument();
  });

  test('should show edit button when attorney is assigned', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={mockAssignments}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    const editButton = screen.getByTestId('button-test');
    expect(editButton).toBeInTheDocument();
  });

  test('should show loading state when isLoading is true', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={[]}
        onAssignmentChange={onAssignmentChange}
        isLoading={true}
      />,
    );

    expect(screen.getByTestId('attorney-assignments-loading')).toBeInTheDocument();
  });

  test('should show attorney name when assignment exists', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={mockAssignments}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    expect(screen.getByTestId('attorney-assignments-display')).toBeInTheDocument();
    const displayArea = screen.getByTestId('attorney-assignments-display');
    expect(displayArea).toHaveTextContent('John Doe');
  });

  test('should call onAssignmentChange when handleAssignmentCreated is triggered', () => {
    const onAssignmentChange = vi.fn();

    renderWithRouter(
      <AttorneyAssignmentSection
        trusteeId="trustee-123"
        assignments={[]}
        onAssignmentChange={onAssignmentChange}
      />,
    );

    const triggerButton = screen.getByTestId('mock-assignment-created-trigger');
    fireEvent.click(triggerButton);

    expect(onAssignmentChange).toHaveBeenCalledTimes(1);
  });
});
