import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { EditBankModal, EditBankModalRef } from './EditBankModal';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { BankProfile } from '@common/cams/banks';

const MODAL_ID = 'edit-bank-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;

const mockBank: BankProfile = {
  id: 'bank-1',
  documentType: 'BANK_PROFILE',
  name: 'Fifth Third Bank',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

const updatedBank: BankProfile = {
  ...mockBank,
  name: 'Fifth Third Bank Updated',
  status: 'inactive',
};

describe('EditBankModal', () => {
  let modalRef: React.RefObject<EditBankModalRef | null>;
  let onSuccess: (bank: BankProfile) => void;
  let userEvent: CamsUserEvent;
  let alertSpy: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  function renderComponent(bank = mockBank) {
    modalRef = React.createRef<EditBankModalRef>();
    onSuccess = vi.fn<(bank: BankProfile) => void>();
    render(<EditBankModal ref={modalRef} modalId={MODAL_ID} bank={bank} onSuccess={onSuccess} />);
  }

  function openModal() {
    act(() => modalRef.current?.show());
  }

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    alertSpy = TestingUtilities.spyOnGlobalAlert();
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should be hidden initially', () => {
    renderComponent();
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
  });

  test('should show modal with pre-filled values when show() is called', async () => {
    renderComponent();
    openModal();
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
      expect(screen.getByLabelText(/bank name/i)).toHaveValue('Fifth Third Bank');
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-active`)).toBeChecked();
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-inactive`)).not.toBeChecked();
    });
  });

  test('should pre-select Inactive radio when bank status is inactive', async () => {
    renderComponent({ ...mockBank, status: 'inactive' });
    openModal();
    await waitFor(() => {
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-inactive`)).toBeChecked();
    });
  });

  test('should show validation error when name is cleared and submitted', async () => {
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByText('Bank Name is required')).toBeInTheDocument();
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
  });

  test('should call Api2.updateBank with trimmed name and selected status on valid submit', async () => {
    const updateBankSpy = vi
      .spyOn(Api2, 'updateBank')
      .mockResolvedValue({ data: updatedBank } as never);
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), '  Fifth Third Bank Updated  ');
    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-inactive-click-target`),
    );
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(updateBankSpy).toHaveBeenCalledWith('bank-1', {
        name: 'Fifth Third Bank Updated',
        status: 'inactive',
      });
    });
  });

  test('should call onSuccess, close modal, and show success alert after successful submit', async () => {
    vi.spyOn(Api2, 'updateBank').mockResolvedValue({ data: updatedBank } as never);
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), 'Fifth Third Bank Updated');
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(updatedBank);
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
      expect(alertSpy.success).toHaveBeenCalledWith('Bank updated successfully.');
    });
  });

  test('should keep modal open, not call onSuccess, and show error alert when API call fails', async () => {
    vi.spyOn(Api2, 'updateBank').mockRejectedValue(new Error('server error'));
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), 'Updated');
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
      expect(alertSpy.error).toHaveBeenCalledWith('Failed to update bank. Please try again.');
    });
  });

  test('should close modal and reset to bank values on cancel', async () => {
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), 'Changed');
    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });

    openModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/bank name/i)).toHaveValue('Fifth Third Bank');
    });
  });

  test('should call hide on the modal ref', async () => {
    renderComponent();
    openModal();
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
    act(() => modalRef.current?.hide());
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should set status to active when active radio is clicked', async () => {
    renderComponent();
    openModal();
    await screen.findByLabelText(/bank name/i);

    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-inactive-click-target`),
    );
    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-active-click-target`),
    );

    expect(screen.getByTestId(`radio-${MODAL_ID}-status-active`)).toBeChecked();
  });

  test('should disable both buttons while save is in progress', async () => {
    vi.spyOn(Api2, 'updateBank').mockReturnValue(new Promise(() => {}));
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), 'Updated Name');
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BTN)).toBeDisabled();
      expect(screen.getByTestId(CANCEL_BTN)).toBeDisabled();
    });
  });

  test('should re-enable buttons after a failed save', async () => {
    vi.spyOn(Api2, 'updateBank').mockRejectedValue(new Error('server error'));
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), 'Updated Name');
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BTN)).not.toBeDisabled();
      expect(screen.getByTestId(CANCEL_BTN)).not.toBeDisabled();
    });
  });

  test('should not close modal when cancel is clicked during save', async () => {
    vi.spyOn(Api2, 'updateBank').mockReturnValue(new Promise(() => {}));
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.clear(screen.getByLabelText(/bank name/i));
    await userEvent.type(screen.getByLabelText(/bank name/i), 'Updated Name');
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeDisabled());
    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
  });
});
