import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToggleModalButton } from './ToggleModalButton';
import Modal, { ModalRefType } from './Modal';

describe('Test Modal component', () => {
  const modalId = 'assign-attorney-modal';
  const onOpenModal = vi.fn();
  const closeModal = vi.fn();
  const submitButtonOnClick = vi.fn();
  const cancelButtonOnClick = vi.fn();

  beforeEach(() => {
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
        onClick: submitButtonOnClick,
      },
      cancelButton: {
        label: 'Cancel',
        onClick: cancelButtonOnClick,
      },
    };

    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <ToggleModalButton
              id={'toggle'}
              buttonIndex="open-test"
              toggleAction={'open'}
              modalId={modalId}
              modalRef={modalRef}
            >
              Open Modal
            </ToggleModalButton>
            <Modal
              modalId={modalId}
              ref={modalRef}
              heading={'Test Heading'}
              content={'Test Content'}
              actionButtonGroup={actionButtonGroup}
              onClose={closeModal}
              onOpen={onOpenModal}
            ></Modal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  });

  test('should open modal', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');
    expect(modal).not.toHaveClass('is-hidden');
    expect(onOpenModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we press the `esc` key', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');

    act(() => {
      fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });
    });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click on the X', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(openButton);
    });

    expect(modal).toHaveClass('is-visible');

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);
    act(() => {
      fireEvent.click(closeButton);
    });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click outside of modal', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(openButton);
    });

    expect(modal).toHaveClass('is-visible');

    const overlay = screen.getByTestId(`modal-overlay-${modalId}`);
    act(() => {
      fireEvent.click(overlay);
    });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click cancel button', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(openButton);
    });

    expect(modal).toHaveClass('is-visible');

    const cancelButton = screen.getByTestId(`toggle-modal-button-cancel`);
    act(() => {
      fireEvent.click(cancelButton);
    });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
    expect(cancelButtonOnClick).toHaveBeenCalled();
  });

  test('should run onClick handler when submit button is clicked', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const submitButton = screen.getByTestId('toggle-modal-button-submit');
    const modal = screen.getByTestId(`modal-${modalId}`);

    act(() => {
      fireEvent.click(openButton);
    });

    expect(modal).toHaveClass('is-visible');

    act(() => {
      fireEvent.click(submitButton);
    });

    expect(submitButtonOnClick).toHaveBeenCalled();
  });
});

describe('Test Modal component with force action', () => {
  const modalId = 'assign-attorney-modal';
  beforeEach(() => {
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <ToggleModalButton
              id={'toggle'}
              buttonIndex="open-test"
              toggleAction={'open'}
              modalId={modalId}
              modalRef={modalRef}
            >
              Open Modal
            </ToggleModalButton>
            <Modal
              modalId={modalId}
              ref={modalRef}
              heading={'Test Heading'}
              content={'Test Content'}
              actionButtonGroup={actionButtonGroup}
              forceAction={true}
            ></Modal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  });

  test('should not close modal when we press the `esc` key', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(button);
    });

    expect(modal).toHaveClass('is-visible');

    act(() => {
      fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });
    });

    expect(modal).not.toHaveClass('is-hidden');
    expect(modal).toHaveClass('is-visible');
  });

  test('should not have an X button', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(openButton);
    });

    expect(modal).toHaveClass('is-visible');

    let xButton;
    try {
      xButton = screen.getByTestId(`modal-x-button-${modalId}`);
    } catch (e) {
      expect((e as Error).message).toContain('Unable to find an element by');
    }
    expect(xButton).toBeUndefined();
  });

  test('should not close modal when we click outside of modal', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    act(() => {
      fireEvent.click(openButton);
    });

    expect(modal).toHaveClass('is-visible');

    const overlay = screen.getByTestId(`modal-overlay-${modalId}`);
    act(() => {
      fireEvent.click(overlay);
    });

    expect(modal).not.toHaveClass('is-hidden');
    expect(modal).toHaveClass('is-visible');
  });
});
