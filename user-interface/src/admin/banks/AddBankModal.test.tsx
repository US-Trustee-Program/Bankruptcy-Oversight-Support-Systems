import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AddBankModal, AddBankModalRef } from './AddBankModal';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { BankProfile } from '@common/cams/banks';

const MODAL_ID = 'add-bank-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;

const createdBank: BankProfile = {
  id: 'bank-new',
  documentType: 'BANK_PROFILE',
  name: 'First National',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

describe('AddBankModal', () => {
  let modalRef: React.RefObject<AddBankModalRef | null>;
  let onSuccess: (bank: BankProfile) => void;

  function renderComponent() {
    modalRef = React.createRef<AddBankModalRef>();
    onSuccess = vi.fn<(bank: BankProfile) => void>();
    render(<AddBankModal ref={modalRef} modalId={MODAL_ID} onSuccess={onSuccess} />);
  }

  function openModal() {
    act(() => modalRef.current?.show());
  }

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    TestingUtilities.spyOnGlobalAlert();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should be hidden initially', () => {
    renderComponent();
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
  });

  test('should show modal when show() is called', async () => {
    renderComponent();
    openModal();
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
  });

  test('should show validation error when submitting with empty name', async () => {
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByText('Bank Name is required')).toBeInTheDocument();
    });
  });

  test('should keep modal open when validation fails', async () => {
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
  });

  test('should call Api2.createBank with trimmed name on valid submit', async () => {
    const createBankSpy = vi
      .spyOn(Api2, 'createBank')
      .mockResolvedValue({ data: createdBank } as never);
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Bank Name/i), {
      target: { value: '  First National  ' },
    });
    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(createBankSpy).toHaveBeenCalledWith({ name: 'First National' });
    });
  });

  test('should call onSuccess and close modal after successful submit', async () => {
    vi.spyOn(Api2, 'createBank').mockResolvedValue({ data: createdBank } as never);
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Bank Name/i), { target: { value: 'First National' } });
    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(createdBank);
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should keep modal open and not call onSuccess when API call fails', async () => {
    vi.spyOn(Api2, 'createBank').mockRejectedValue(new Error('server error'));
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Bank Name/i), { target: { value: 'First National' } });
    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
  });

  test('should hide modal when hide() is called imperatively', async () => {
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible'));

    act(() => modalRef.current?.hide());

    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should close modal and clear form on cancel', async () => {
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Bank Name/i), { target: { value: 'Some Bank' } });
    fireEvent.click(screen.getByTestId(CANCEL_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });

    // Re-open and verify form is cleared
    openModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/Bank Name/i)).toHaveValue('');
    });
  });
});
