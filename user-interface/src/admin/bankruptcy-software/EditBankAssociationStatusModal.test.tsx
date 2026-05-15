import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  EditBankAssociationStatusModal,
  EditBankAssociationStatusModalRef,
} from './EditBankAssociationStatusModal';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

const MODAL_ID = 'edit-bank-association-status-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;

const mockSoftware: BankruptcySoftwareProfile = {
  id: 'software-1',
  documentType: 'BANKRUPTCY_SOFTWARE',
  name: 'Axos',
  status: 'active',
  updatedOn: '2024-01-01T00:00:00.000Z',
  updatedBy: { id: 'user-1', name: 'User One' },
};

describe('EditBankAssociationStatusModal', () => {
  let modalRef: React.RefObject<EditBankAssociationStatusModalRef | null>;
  let onSuccess: (software: BankruptcySoftwareProfile) => void;
  let userEvent: CamsUserEvent;

  function renderComponent() {
    modalRef = React.createRef<EditBankAssociationStatusModalRef>();
    onSuccess = vi.fn<(software: BankruptcySoftwareProfile) => void>();
    render(
      <EditBankAssociationStatusModal
        ref={modalRef}
        modalId={MODAL_ID}
        softwareId="software-1"
        onSuccess={onSuccess}
      />,
    );
  }

  function openModal(status: 'active' | 'inactive' = 'active') {
    act(() => modalRef.current?.show('bank-1', 'Chase Bank', status));
  }

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    TestingUtilities.spyOnGlobalAlert();
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should be hidden initially', () => {
    renderComponent();
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
  });

  test('should show bank name in heading when show() is called', async () => {
    renderComponent();
    openModal();
    await waitFor(() => {
      expect(screen.getByText(/Edit Chase Bank Bank Status/i)).toBeInTheDocument();
    });
  });

  test('should pre-select Active radio when current status is active', async () => {
    renderComponent();
    openModal('active');
    await waitFor(() => {
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-active`)).toBeChecked();
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-inactive`)).not.toBeChecked();
    });
  });

  test('should pre-select Inactive radio when current status is inactive', async () => {
    renderComponent();
    openModal('inactive');
    await waitFor(() => {
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-inactive`)).toBeChecked();
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-active`)).not.toBeChecked();
    });
  });

  test('should show the warning message', async () => {
    renderComponent();
    openModal();
    await waitFor(() => {
      expect(
        screen.getByText(
          /Banks with an inactive status will not appear as a bank option for Trustees using this software\./i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Marking a status as inactive will not remove it from existing Trustees\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  test('should call Api2.updateBankAssociationStatus with selected status on submit', async () => {
    const updateSpy = vi
      .spyOn(Api2, 'updateBankAssociationStatus')
      .mockResolvedValue({ data: mockSoftware } as never);
    renderComponent();
    openModal('active');
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-inactive-click-target`),
    );
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('software-1', 'bank-1', 'inactive');
    });
  });

  test('should call onSuccess and close modal after successful submit', async () => {
    vi.spyOn(Api2, 'updateBankAssociationStatus').mockResolvedValue({
      data: mockSoftware,
    } as never);
    renderComponent();
    openModal('active');
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockSoftware);
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should keep modal open and not call onSuccess when API call fails', async () => {
    vi.spyOn(Api2, 'updateBankAssociationStatus').mockRejectedValue(new Error('server error'));
    renderComponent();
    openModal('active');
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
    });
  });

  test('should close modal and reset to original status on cancel', async () => {
    renderComponent();
    openModal('active');
    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeVisible());

    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-inactive-click-target`),
    );
    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });

    openModal('active');
    await waitFor(() => {
      expect(screen.getByTestId(`radio-${MODAL_ID}-status-active`)).toBeChecked();
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
});
