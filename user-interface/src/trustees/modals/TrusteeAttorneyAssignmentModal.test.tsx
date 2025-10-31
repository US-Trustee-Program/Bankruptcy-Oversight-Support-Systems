import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeAttorneyAssignmentModal from './TrusteeAttorneyAssignmentModal';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { AttorneyUser } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole, OversightRole } from '@common/cams/roles';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { TrusteeAttorneyAssignmentModalRef } from './TrusteeAttorneyAssignmentModal';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

// TODO: Remove the use of vi.mock()
vi.mock('@/lib/hooks/UseApi2');
vi.mock('@/lib/hooks/UseGlobalAlert');

vi.mock('@/lib/components/combobox/ComboBox', () => {
  return {
    default: ({
      onUpdateSelection,
      options = [],
    }: {
      onUpdateSelection?: (options: ComboOption[]) => void;
      options?: Array<{ value: string; label: string }>;
    }) => (
      <select
        data-testid="mock-combobox"
        onChange={(e) => {
          if (onUpdateSelection) {
            if (e.target.value) {
              const selectedOption = options.find((opt) => opt.value === e.target.value);
              if (selectedOption) {
                onUpdateSelection([{ value: selectedOption.value, label: selectedOption.label }]);
              }
            } else {
              onUpdateSelection([]);
            }
          }
        }}
      >
        <option value="">Select an attorney</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

describe('TrusteeAttorneyAssignmentModal', () => {
  let userEvent: CamsUserEvent;

  const defaultProps = {
    modalId: 'test-modal',
    trusteeId: 'trustee-123',
  } as const;

  function renderWithProps(
    props?: Partial<{
      onAssignment: (flag: boolean) => void;
      ref?: React.RefObject<TrusteeAttorneyAssignmentModalRef | null> | undefined;
    }>,
  ) {
    const onAssignment = props?.onAssignment ?? vi.fn();
    const ref = props?.ref ?? undefined;

    render(
      <TrusteeAttorneyAssignmentModal
        modalId={defaultProps.modalId}
        trusteeId={defaultProps.trusteeId}
        onAssignment={onAssignment}
        ref={ref}
      />,
    );

    return { onAssignment, ref } as {
      onAssignment: typeof onAssignment;
      ref: React.RefObject<TrusteeAttorneyAssignmentModalRef | null> | undefined;
    };
  }

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

  const mockAssignment: TrusteeOversightAssignment = {
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
  };

  const mockApiMethods = {
    getAttorneys: vi.fn().mockResolvedValue({ data: mockAttorneys }),
    createTrusteeOversightAssignment: vi.fn().mockResolvedValue({ data: mockAssignment }),
  };

  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();
    (useApi2 as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockApiMethods);
    (useGlobalAlert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockGlobalAlert);
  });

  test('should render modal with correct structure', () => {
    const onAssignment = vi.fn();

    renderWithProps({ onAssignment });

    expect(screen.getByTestId('modal-test-modal')).toBeInTheDocument();
  });

  test('should load staff when modal opens', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await waitFor(() => {
      expect(mockApiMethods.getAttorneys).toHaveBeenCalledTimes(1);
    });
  });

  test('should display ComboBox for attorney selection', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
  });

  test('should enable submit button when attorney is selected', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());
    await screen.findByTestId('mock-combobox');

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    expect(submitButton).toBeDisabled();

    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test('should successfully assign attorney', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
        'trustee-123',
        'attorney-1',
        OversightRole.OversightAttorney,
      );
    });

    expect(mockGlobalAlert.success).toHaveBeenCalledWith('Attorney assigned successfully');
    expect(onAssignment).toHaveBeenCalledWith(true);
  });

  test('should handle assignment error', async () => {
    const errorMessage = 'Failed to assign attorney';
    mockApiMethods.createTrusteeOversightAssignment.mockRejectedValueOnce(new Error(errorMessage));

    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(onAssignment).not.toHaveBeenCalled();
    });
  });

  test('should handle loading error', async () => {
    mockApiMethods.getAttorneys.mockRejectedValueOnce(new Error('API Error'));

    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load attorneys');
    });
  });

  test('should hide modal and reset selected attorney when hide is called', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    act(() => ref.current!.hide());

    await waitFor(() => {
      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).toBeDisabled();
    });
  });

  test('should not call API when trying to assign with no attorney selected', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    await userEvent.selectOptions(comboBox, '');

    mockApiMethods.createTrusteeOversightAssignment.mockClear();

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    submitButton.removeAttribute('disabled');
    await userEvent.click(submitButton);

    expect(mockApiMethods.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    expect(onAssignment).not.toHaveBeenCalled();
  });

  test('should show loading spinner while fetching staff', async () => {
    let resolvePromise!: (value: { data: AttorneyUser[] }) => void;
    const loadingPromise = new Promise<{ data: AttorneyUser[] }>((resolve) => {
      resolvePromise = resolve;
    });
    mockApiMethods.getAttorneys.mockReturnValueOnce(loadingPromise);

    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());

    await waitFor(() => {
      expect(screen.getByText('Loading attorneys...')).toBeInTheDocument();
    });

    resolvePromise({ data: mockAttorneys });

    await waitFor(() => {
      expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
    });
  });

  test('should clear selected attorney when ComboBox selection is cleared', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show());
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
    await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await userEvent.selectOptions(comboBox, '');

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  test('should close modal without API call when same attorney is selected as current assignment', async () => {
    const onAssignment = vi.fn();
    const ref = React.createRef<TrusteeAttorneyAssignmentModalRef>();

    renderWithProps({ onAssignment, ref });

    act(() => ref.current!.show(mockAssignment));
    await waitFor(() => expect(mockApiMethods.getAttorneys).toHaveBeenCalled());

    mockApiMethods.createTrusteeOversightAssignment.mockClear();

    const submitButton = screen.getByTestId('button-test-modal-submit-button');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockApiMethods.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      expect(onAssignment).not.toHaveBeenCalled();
    });
  });
});
