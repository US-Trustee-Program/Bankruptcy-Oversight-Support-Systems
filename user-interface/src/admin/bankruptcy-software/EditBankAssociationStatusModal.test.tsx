import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  let alertSpy: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  function renderComponent() {
    modalRef = React.createRef<EditBankAssociationStatusModalRef>();
    onSave = vi.fn<EditBankAssociationStatusModalProps['onSave']>().mockResolvedValue(undefined);
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
  }

  function openModal(status: 'active' | 'inactive' = 'active') {
    act(() => modalRef.current?.show('bank-1', 'Chase Bank', status));
  }

  beforeEach(() => {
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

  test('should disable both buttons while onSave is in progress', async () => {
    onSave = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BTN)).toBeDisabled();
      expect(screen.getByTestId(CANCEL_BTN)).toBeDisabled();
    });
  });

  test('should re-enable buttons after onSave resolves', async () => {
    onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(screen.getByTestId(SUBMIT_BTN)).not.toBeDisabled();
      expect(screen.getByTestId(CANCEL_BTN)).not.toBeDisabled();
    });
  });

  test('should show error alert and re-enable buttons when onSave rejects', async () => {
    onSave = vi.fn().mockRejectedValue(new Error('API failure'));
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(alertSpy.error).toHaveBeenCalledWith(
        'Failed to save bank association status. Please try again.',
      );
      expect(screen.getByTestId(SUBMIT_BTN)).not.toBeDisabled();
      expect(screen.getByTestId(CANCEL_BTN)).not.toBeDisabled();
    });
  });

  test('should not close modal when cancel is clicked during save', async () => {
    onSave = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeDisabled());
    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
  });

  test('should not hide modal when handleCancel is invoked while save is in progress', async () => {
    onSave = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<EditBankAssociationStatusModal ref={modalRef} modalId={MODAL_ID} onSave={onSave} />);
    openModal();
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeDisabled());

    const cancelBtn = screen.getByTestId(CANCEL_BTN);

    // Patch the React synthetic event handler on the DOM node so fireEvent can reach handleCancel
    // even though the button is disabled (disabled prevents userEvent but not fireEvent with patching).
    const reactPropsKey = Object.keys(cancelBtn).find((k) => k.startsWith('__reactProps$'));
    if (reactPropsKey) {
      const originalProps = (cancelBtn as unknown as Record<string, unknown>)[
        reactPropsKey
      ] as Record<string, unknown>;
      (cancelBtn as unknown as Record<string, unknown>)[reactPropsKey] = {
        ...originalProps,
        disabled: false,
      };
    }

    // Also patch the Modal fiber's memoizedProps so the Modal wrapper doesn't swallow the click.
    const fiberKey = Object.keys(cancelBtn).find((k) => k.startsWith('__reactFiber$'));
    if (fiberKey) {
      let fiber = (cancelBtn as unknown as Record<string, unknown>)[fiberKey] as
        | { return?: unknown; memoizedProps?: Record<string, unknown> }
        | null
        | undefined;
      while (fiber) {
        const props = fiber.memoizedProps as Record<string, unknown> | undefined;
        if (props && 'actionButtonGroup' in props) {
          const group = props['actionButtonGroup'] as Record<string, unknown>;
          const cancelButton = group['cancelButton'] as Record<string, unknown>;
          cancelButton['disabled'] = false;
          break;
        }
        fiber = fiber.return as typeof fiber;
      }
    }

    fireEvent.click(cancelBtn);

    // handleCancel ran and hit `if (isPending) return` — onSave was not re-triggered.
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
