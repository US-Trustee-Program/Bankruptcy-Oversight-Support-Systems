import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  EditBankAssociationStatusModal,
  EditBankAssociationStatusModalProps,
  EditBankAssociationStatusModalRef,
} from './EditBankAssociationStatusModal';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

const MODAL_ID = 'edit-bank-association-status-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;

describe('EditBankAssociationStatusModal', () => {
  let modalRef: React.RefObject<EditBankAssociationStatusModalRef | null>;
  let onSave: EditBankAssociationStatusModalProps['onSave'];
  let userEvent: CamsUserEvent;

  function renderComponent() {
    modalRef = React.createRef<EditBankAssociationStatusModalRef>();
    onSave = vi.fn<EditBankAssociationStatusModalProps['onSave']>();
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
  }

  function openModal(status: 'active' | 'inactive' = 'active') {
    act(() => modalRef.current?.show('bank-1', 'Chase Bank', status));
  }

  beforeEach(() => {
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
      expect(screen.getByText(/Edit Chase Bank Status/i)).toBeInTheDocument();
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

  test('should call onSave with bankId, bankName, and selected status on submit', async () => {
    renderComponent();
    openModal('active');
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-inactive-click-target`),
    );
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('bank-1', 'Chase Bank', 'inactive');
    });
  });

  test('should call onSave with active status when active radio is selected', async () => {
    renderComponent();
    openModal('inactive');
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(
      screen.getByTestId(`button-radio-${MODAL_ID}-status-active-click-target`),
    );
    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('bank-1', 'Chase Bank', 'active');
    });
  });

  test('should close modal on cancel', async () => {
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
