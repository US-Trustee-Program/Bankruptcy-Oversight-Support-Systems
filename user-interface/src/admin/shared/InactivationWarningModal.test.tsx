import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { InactivationWarningModal, InactivationWarningModalRef } from './InactivationWarningModal';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

const MODAL_ID = 'inactivation-warning-modal';
const MODAL_WRAPPER = `modal-${MODAL_ID}`;
const SUBMIT_BTN = `button-${MODAL_ID}-submit-button`;
const CANCEL_BTN = `button-${MODAL_ID}-cancel-button`;

describe('InactivationWarningModal', () => {
  let modalRef: React.RefObject<InactivationWarningModalRef | null>;
  let onProceed: () => void;
  let onCancel: () => void;
  let userEvent: CamsUserEvent;

  function renderComponent(entityLabel = 'bank') {
    modalRef = React.createRef<InactivationWarningModalRef>();
    onProceed = vi.fn();
    onCancel = vi.fn();
    render(
      <InactivationWarningModal
        ref={modalRef}
        modalId={MODAL_ID}
        entityLabel={entityLabel}
        onProceed={onProceed}
        onCancel={onCancel}
      />,
    );
  }

  function openModal(count = 3) {
    act(() => modalRef.current?.show(count));
  }

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should be hidden initially', () => {
    renderComponent();
    expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
  });

  test('should show modal with plural trustee count message', async () => {
    renderComponent('bank');
    openModal(5);
    await waitFor(() => {
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible');
      expect(screen.getByTestId('warning-message')).toHaveTextContent(
        '5 trustees are currently using this bank.',
      );
    });
  });

  test('should show singular message for count of 1', async () => {
    renderComponent('bank');
    openModal(1);
    await waitFor(() => {
      expect(screen.getByTestId('warning-message')).toHaveTextContent(
        '1 trustee is currently using this bank.',
      );
    });
  });

  test('should show plural message for count of 0', async () => {
    renderComponent('bank');
    openModal(0);
    await waitFor(() => {
      expect(screen.getByTestId('warning-message')).toHaveTextContent(
        '0 trustees are currently using this bank.',
      );
    });
  });

  test('should use provided entityLabel in message', async () => {
    renderComponent('software vendor');
    openModal(3);
    await waitFor(() => {
      expect(screen.getByTestId('warning-message')).toHaveTextContent(
        '3 trustees are currently using this software vendor.',
      );
    });
  });

  test('should call onProceed and close modal when "Proceed Anyway" is clicked', async () => {
    renderComponent();
    openModal(3);
    await waitFor(() => expect(screen.getByTestId(SUBMIT_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(SUBMIT_BTN));

    await waitFor(() => {
      expect(onProceed).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should call onCancel and close modal when "Cancel" is clicked', async () => {
    renderComponent();
    openModal(3);
    await waitFor(() => expect(screen.getByTestId(CANCEL_BTN)).toBeVisible());

    await userEvent.click(screen.getByTestId(CANCEL_BTN));

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden');
    });
  });

  test('should imperatively hide via ref', async () => {
    renderComponent();
    openModal(3);
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-visible'));

    act(() => modalRef.current?.hide());
    await waitFor(() => expect(screen.getByTestId(MODAL_WRAPPER)).toHaveClass('is-hidden'));
  });
});
