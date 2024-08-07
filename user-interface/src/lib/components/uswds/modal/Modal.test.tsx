import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToggleModalButton } from './ToggleModalButton';
import Modal from './Modal';
import { ModalRefType } from './modal-refs';

describe('Test Modal component', () => {
  const modalId = 'test-modal';
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

    fireEvent.click(button);

    expect(modal).toHaveClass('is-visible');
    expect(modal).not.toHaveClass('is-hidden');
    expect(onOpenModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we press the `esc` key', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(button);

    expect(modal).toHaveClass('is-visible');

    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click on the X', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);
    fireEvent.click(closeButton);

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click outside of modal', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');

    const overlay = screen.getByTestId(`modal-overlay-${modalId}`);
    fireEvent.click(overlay);

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click cancel button', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');

    const cancelButton = screen.getByTestId(`button-${modalId}-cancel-button`);
    fireEvent.click(cancelButton);

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
    expect(cancelButtonOnClick).toHaveBeenCalled();
  });

  test('should run onClick handler when submit button is clicked', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    const modal = screen.getByTestId(`modal-${modalId}`);

    fireEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');

    fireEvent.click(submitButton);

    expect(submitButtonOnClick).toHaveBeenCalled();
  });

  test('should focus modal when modal is first opened', async () => {
    const button = screen.getByTestId('toggle-modal-button-open-test');
    const modalContent = screen.getByTestId(`modal-content-${modalId}`);

    fireEvent.click(button);

    expect(onOpenModal).toHaveBeenCalled();
    expect(modalContent).toHaveFocus();
  });
});

describe('Test Modal component with force action', () => {
  const modalId = 'test-modal';
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

    fireEvent.click(button);

    expect(modal).toHaveClass('is-visible');

    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });

    expect(modal).not.toHaveClass('is-hidden');
    expect(modal).toHaveClass('is-visible');
  });

  test('should not have an X button', async () => {
    const openButton = screen.getByTestId('toggle-modal-button-open-test');
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(openButton);

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

    fireEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');

    const overlay = screen.getByTestId(`modal-overlay-${modalId}`);
    fireEvent.click(overlay);

    expect(modal).not.toHaveClass('is-hidden');
    expect(modal).toHaveClass('is-visible');
  });
});
