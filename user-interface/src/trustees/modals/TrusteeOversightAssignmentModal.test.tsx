import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TrusteeOversightAssignmentModal from './TrusteeOversightAssignmentModal';
import createApi2 from '@/lib/Api2Factory';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Staff } from '@common/cams/users';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole, OversightRole } from '@common/cams/roles';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { TrusteeOversightAssignmentModalRef } from './TrusteeOversightAssignmentModal';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

vi.mock('@/lib/Api2Factory', () => ({
  default: vi.fn(),
}));
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
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

describe('TrusteeOversightAssignmentModal', () => {
  let userEvent: CamsUserEvent;

  const mockAttorneys: Staff[] = [
    { id: 'attorney-1', name: 'John Doe', roles: [CamsRole.TrialAttorney] },
    { id: 'attorney-2', name: 'Jane Smith', roles: [CamsRole.TrialAttorney] },
  ];

  const mockAuditors: Staff[] = [
    { id: 'auditor-1', name: 'Alice Auditor', roles: [CamsRole.Auditor] },
    { id: 'auditor-2', name: 'Bob Auditor', roles: [CamsRole.Auditor] },
  ];

  const mockParalegals: Staff[] = [
    { id: 'paralegal-1', name: 'Charlie Paralegal', roles: [CamsRole.Paralegal] },
    { id: 'paralegal-2', name: 'Dana Paralegal', roles: [CamsRole.Paralegal] },
  ];

  const mockAllStaff: Staff[] = [...mockAttorneys, ...mockAuditors, ...mockParalegals];

  const mockAttorneyAssignment: TrusteeOversightAssignment = {
    id: 'assignment-1',
    trusteeId: 'trustee-123',
    user: { id: 'attorney-1', name: 'John Doe' },
    role: OversightRole.OversightAttorney,
    createdBy: { id: 'user-1', name: 'Admin User' },
    createdOn: '2023-01-01T00:00:00Z',
    updatedBy: { id: 'user-1', name: 'Admin User' },
    updatedOn: '2023-01-01T00:00:00Z',
  };

  const mockAuditorAssignment: TrusteeOversightAssignment = {
    id: 'assignment-2',
    trusteeId: 'trustee-123',
    user: { id: 'auditor-1', name: 'Alice Auditor' },
    role: OversightRole.OversightAuditor,
    createdBy: { id: 'user-1', name: 'Admin User' },
    createdOn: '2023-01-01T00:00:00Z',
    updatedBy: { id: 'user-1', name: 'Admin User' },
    updatedOn: '2023-01-01T00:00:00Z',
  };

  const mockApiMethods = {
    getOversightStaff: vi.fn().mockResolvedValue({
      data: mockAllStaff,
    }),
    createTrusteeOversightAssignment: vi.fn().mockResolvedValue({ data: mockAttorneyAssignment }),
  };

  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();
    (createApi2 as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockApiMethods);
    (useGlobalAlert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockGlobalAlert);
  });

  function renderWithProps(
    role: OversightRole,
    props?: Partial<{
      onAssignment: (flag: boolean) => void;
      ref?: React.RefObject<TrusteeOversightAssignmentModalRef | null> | undefined;
    }>,
  ) {
    const onAssignment = props?.onAssignment ?? vi.fn();
    const ref = props?.ref ?? undefined;

    render(
      <TrusteeOversightAssignmentModal
        modalId="test-modal"
        trusteeId="trustee-123"
        role={role}
        onAssignment={onAssignment}
        ref={ref}
      />,
    );

    return { onAssignment, ref } as {
      onAssignment: typeof onAssignment;
      ref: React.RefObject<TrusteeOversightAssignmentModalRef | null> | undefined;
    };
  }

  describe('Attorney Role', () => {
    test('should render modal with correct structure', () => {
      const onAssignment = vi.fn();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment });
      expect(screen.getByTestId('modal-test-modal')).toBeInTheDocument();
    });

    test('should load attorneys when modal opens', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());

      await waitFor(() => {
        expect(mockApiMethods.getOversightStaff).toHaveBeenCalledTimes(1);
      });
    });

    test('should display ComboBox for attorney selection', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
    });

    test('should enable submit button when attorney is selected', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());
      await screen.findByTestId('mock-combobox');

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).toBeDisabled();

      const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
      await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('should successfully assign attorney with role parameter', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

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
      mockApiMethods.createTrusteeOversightAssignment.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

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
      mockApiMethods.getOversightStaff.mockRejectedValueOnce(new Error('API Error'));

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByTestId('alert')).toHaveTextContent('Failed to load attorneys');
      });
    });

    test('should show loading spinner while fetching staff', async () => {
      let resolvePromise!: (value: { data: Staff[] }) => void;
      const loadingPromise = new Promise<{ data: Staff[] }>((resolve) => {
        resolvePromise = resolve;
      });
      mockApiMethods.getOversightStaff.mockReturnValueOnce(loadingPromise);

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());

      await waitFor(() => {
        expect(screen.getByText('Loading attorneys...')).toBeInTheDocument();
      });

      resolvePromise({ data: mockAllStaff });

      await waitFor(() => {
        expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
      });
    });
  });

  describe('Auditor Role', () => {
    test('should render modal with correct structure for auditor', () => {
      const onAssignment = vi.fn();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment });
      expect(screen.getByTestId('modal-test-modal')).toBeInTheDocument();
    });

    test('should load auditors when modal opens', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment, ref });

      act(() => ref.current!.show());

      await waitFor(() => {
        expect(mockApiMethods.getOversightStaff).toHaveBeenCalledTimes(1);
      });
    });

    test('should display ComboBox for auditor selection', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
    });

    test('should successfully assign auditor with role parameter', async () => {
      mockApiMethods.createTrusteeOversightAssignment.mockResolvedValueOnce({
        data: mockAuditorAssignment,
      });

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
      await userEvent.selectOptions(comboBox, mockAuditors[0].id);

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
          'trustee-123',
          'auditor-1',
          OversightRole.OversightAuditor,
        );
      });

      expect(mockGlobalAlert.success).toHaveBeenCalledWith('Auditor assigned successfully');
      expect(onAssignment).toHaveBeenCalledWith(true);
    });

    test('should show loading spinner with auditor text while fetching', async () => {
      let resolvePromise!: (value: { data: Staff[] }) => void;
      const loadingPromise = new Promise<{ data: Staff[] }>((resolve) => {
        resolvePromise = resolve;
      });
      mockApiMethods.getOversightStaff.mockReturnValueOnce(loadingPromise);

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment, ref });

      act(() => ref.current!.show());

      await waitFor(() => {
        expect(screen.getByText('Loading auditors...')).toBeInTheDocument();
      });

      resolvePromise({ data: mockAllStaff });

      await waitFor(() => {
        expect(screen.getByTestId('mock-combobox')).toBeInTheDocument();
      });
    });

    test('should handle auditor assignment error', async () => {
      const errorMessage = 'Failed to assign auditor';
      mockApiMethods.createTrusteeOversightAssignment.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
      await userEvent.selectOptions(comboBox, mockAuditors[0].id);

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockGlobalAlert.error).toHaveBeenCalledWith(errorMessage);
        expect(onAssignment).not.toHaveBeenCalled();
      });
    });
  });

  describe('Common Behavior', () => {
    test('should hide modal and reset selected staff when hide is called', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
      await userEvent.selectOptions(comboBox, mockAttorneys[0].id);

      act(() => ref.current!.hide());

      await waitFor(() => {
        const submitButton = screen.getByTestId('button-test-modal-submit-button');
        expect(submitButton).toBeDisabled();
      });
    });

    test('should not call API when trying to assign with no staff selected', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

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

    test('should clear selected staff when ComboBox selection is cleared', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

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

    test('should close modal without API call when same staff is selected as current assignment', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show(mockAttorneyAssignment));
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      mockApiMethods.createTrusteeOversightAssignment.mockClear();

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiMethods.createTrusteeOversightAssignment).not.toHaveBeenCalled();
        expect(onAssignment).not.toHaveBeenCalled();
      });
    });

    test('should display Edit Attorney button and heading when editing existing assignment', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAttorney, { onAssignment, ref });

      act(() => ref.current!.show(mockAttorneyAssignment));
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).toHaveTextContent('Edit Attorney');

      const modal = screen.getByTestId('modal-test-modal');
      expect(modal).toHaveTextContent('Edit Attorney');
    });

    test('should display Add Auditor button and heading when creating new auditor assignment', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightAuditor, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).toHaveTextContent('Add Auditor');

      const modal = screen.getByTestId('modal-test-modal');
      expect(modal).toHaveTextContent('Add Auditor');
    });
  });

  describe('Paralegal Role', () => {
    test('should render modal with correct structure for paralegal', () => {
      const onAssignment = vi.fn();
      renderWithProps(OversightRole.OversightParalegal, { onAssignment });
      expect(screen.getByTestId('modal-test-modal')).toBeInTheDocument();
    });

    test('should successfully assign paralegal with role parameter', async () => {
      const mockParalegalAssignment: TrusteeOversightAssignment = {
        id: 'assignment-3',
        trusteeId: 'trustee-123',
        user: { id: 'paralegal-1', name: 'Bob Paralegal' },
        role: OversightRole.OversightParalegal,
        createdBy: { id: 'user-1', name: 'Admin User' },
        createdOn: '2023-01-01T00:00:00Z',
        updatedBy: { id: 'user-1', name: 'Admin User' },
        updatedOn: '2023-01-01T00:00:00Z',
      };

      mockApiMethods.createTrusteeOversightAssignment.mockResolvedValueOnce({
        data: mockParalegalAssignment,
      });

      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightParalegal, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const comboBox = screen.getByTestId('mock-combobox') as HTMLSelectElement;
      await userEvent.selectOptions(comboBox, 'paralegal-1');

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiMethods.createTrusteeOversightAssignment).toHaveBeenCalledWith(
          'trustee-123',
          'paralegal-1',
          OversightRole.OversightParalegal,
        );
      });

      expect(mockGlobalAlert.success).toHaveBeenCalledWith('Paralegal assigned successfully');
      expect(onAssignment).toHaveBeenCalledWith(true);
    });

    test('should display Add Paralegal button and heading when creating new paralegal assignment', async () => {
      const onAssignment = vi.fn();
      const ref = React.createRef<TrusteeOversightAssignmentModalRef>();
      renderWithProps(OversightRole.OversightParalegal, { onAssignment, ref });

      act(() => ref.current!.show());
      await waitFor(() => expect(mockApiMethods.getOversightStaff).toHaveBeenCalled());

      const submitButton = screen.getByTestId('button-test-modal-submit-button');
      expect(submitButton).toHaveTextContent('Add Paralegal');

      const modal = screen.getByTestId('modal-test-modal');
      expect(modal).toHaveTextContent('Add Paralegal');
    });
  });
});
