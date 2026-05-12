import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AddSoftwareModal, AddSoftwareModalRef } from './AddSoftwareModal';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

const MODAL_ID = 'add-software-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;

const createdSoftware: BankruptcySoftwareProfile = {
  id: 'sw-new',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'TrustBooks',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

describe('AddSoftwareModal', () => {
  let modalRef: React.RefObject<AddSoftwareModalRef | null>;
  let onSuccess: (software: BankruptcySoftwareProfile) => void;

  function renderComponent() {
    modalRef = React.createRef<AddSoftwareModalRef>();
    onSuccess = vi.fn<(software: BankruptcySoftwareProfile) => void>();
    render(<AddSoftwareModal ref={modalRef} modalId={MODAL_ID} onSuccess={onSuccess} />);
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
      expect(screen.getByText('Software Name is required')).toBeInTheDocument();
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

  test('should call Api2.createSoftware with trimmed name on valid submit', async () => {
    const createSoftwareSpy = vi
      .spyOn(Api2, 'createSoftware')
      .mockResolvedValue({ data: createdSoftware } as never);
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Software Name/i), {
      target: { value: '  TrustBooks  ' },
    });
    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(createSoftwareSpy).toHaveBeenCalledWith({ name: 'TrustBooks' });
    });
  });

  test('should call onSuccess and close modal after successful submit', async () => {
    vi.spyOn(Api2, 'createSoftware').mockResolvedValue({ data: createdSoftware } as never);
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Software Name/i), {
      target: { value: 'TrustBooks' },
    });
    fireEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(createdSoftware);
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should keep modal open and not call onSuccess when API call fails', async () => {
    vi.spyOn(Api2, 'createSoftware').mockRejectedValue(new Error('server error'));
    renderComponent();
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    fireEvent.change(screen.getByLabelText(/Software Name/i), {
      target: { value: 'TrustBooks' },
    });
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

    fireEvent.change(screen.getByLabelText(/Software Name/i), {
      target: { value: 'Some Software' },
    });
    fireEvent.click(screen.getByTestId(CANCEL_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });

    // Re-open and verify form is cleared
    openModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/Software Name/i)).toHaveValue('');
    });
  });
});
