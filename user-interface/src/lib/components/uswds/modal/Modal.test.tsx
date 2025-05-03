import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import Button from '../Button';
import Checkbox from '../Checkbox';
import Radio from '../Radio';
import Modal from './Modal';
import { ModalRefType } from './modal-refs';
import { OpenModalButton } from './OpenModalButton';

const testButtonId = 'open-modal-button_open-test';

describe('Test Modal component', () => {
  const modalId = 'test-modal';
  const onOpenModal = vi.fn();
  const closeModal = vi.fn();
  const submitButtonOnClick = vi.fn();
  const cancelButtonOnClick = vi.fn();

  function createModal() {
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      cancelButton: {
        className: 'cancel-button',
        label: 'Cancel',
        onClick: cancelButtonOnClick,
      },
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        className: 'submit-button',
        label: 'Submit',
        onClick: submitButtonOnClick,
      },
    };

    const content = (
      <div>
        Test Content
        <Checkbox id={'test-checkbox'} value={5}></Checkbox>
        <Radio id={'test-radio-button'} label={'Radio 1'} name={'radio1'} value={'1'}></Radio>
        <Button>Foo</Button>;
      </div>
    );

    render(
      <React.StrictMode>
        <BrowserRouter>
          <>
            <OpenModalButton buttonIndex="open-test" modalId={modalId} modalRef={modalRef}>
              Open Modal
            </OpenModalButton>
            <Modal
              actionButtonGroup={actionButtonGroup}
              content={content}
              heading={'Test Heading'}
              modalId={modalId}
              onClose={closeModal}
              onOpen={onOpenModal}
              ref={modalRef}
            ></Modal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  beforeEach(() => {
    createModal();
  });

  test('should open modal', async () => {
    const button = screen.getByTestId(testButtonId);
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(button);

    expect(modal).toHaveClass('is-visible');
    expect(modal).not.toHaveClass('is-hidden');
    expect(onOpenModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we press the `esc` key', async () => {
    const button = screen.getByTestId(testButtonId);
    const modal = screen.getByTestId(`modal-${modalId}`);

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(button);

    expect(modal).toHaveClass('is-visible');

    fireEvent.keyDown(modal, { code: 'Escape', key: 'Escape' });

    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    expect(closeModal).toHaveBeenCalled();
  });

  test('should close modal and call onClose when we click on the X', async () => {
    const openButton = screen.getByTestId(testButtonId);
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
    const openButton = screen.getByTestId(testButtonId);
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
    const openButton = screen.getByTestId(testButtonId);
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
    const openButton = screen.getByTestId(testButtonId);
    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    const modal = screen.getByTestId(`modal-${modalId}`);

    fireEvent.click(openButton);

    expect(modal).toHaveClass('is-visible');

    fireEvent.click(submitButton);

    expect(submitButtonOnClick).toHaveBeenCalled();
  });

  test('should initially focus first input in modal when modal is first opened, and then move focus to first input in modal when close button is in focus and user presses Tab key', async () => {
    const openButton = screen.getByTestId(testButtonId);
    const modalCloseButton = screen.getByTestId(`modal-x-button-${modalId}`);
    const firstElement = document.querySelector('.usa-checkbox__label');

    fireEvent.click(openButton);

    expect(onOpenModal).toHaveBeenCalled();
    expect(firstElement).toHaveFocus();

    modalCloseButton.focus();
    expect(modalCloseButton).toHaveFocus();

    fireEvent.keyDown(modalCloseButton, { key: 'Tab' });

    expect(firstElement).toHaveFocus();
  });

  test('should move focus to close button if modals first input field is in focus and user presses Shift-Tab key combination', async () => {
    const openButton = screen.getByTestId(testButtonId);
    const modalCloseButton = screen.getByTestId(`modal-x-button-${modalId}`);
    const firstElement = document.querySelector('.usa-checkbox__label');

    fireEvent.click(openButton);

    expect(onOpenModal).toHaveBeenCalled();
    expect(firstElement).toHaveFocus();

    fireEvent.keyDown(firstElement!, { key: 'Tab', shiftKey: true });

    await vi.waitFor(() => {
      expect(modalCloseButton).toHaveFocus();
    });
  });

  test('modal buttons should have the given labels', async () => {
    const submitButton = document.querySelector('.submit-button');
    const cancelButton = document.querySelector('.cancel-button');

    expect(submitButton).toHaveTextContent('Submit');
    expect(cancelButton).toHaveTextContent('Cancel');
  });
});

describe('Test Modal component with force action set to true', () => {
  const modalId = 'test-modal';

  function createModal() {
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
            <OpenModalButton buttonIndex="open-test" modalId={modalId} modalRef={modalRef}>
              Open Modal
            </OpenModalButton>
            <Modal
              actionButtonGroup={actionButtonGroup}
              content={'Test Content'}
              forceAction={true}
              heading={'Test Heading'}
              modalId={modalId}
              ref={modalRef}
            ></Modal>
          </>
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  beforeEach(() => {
    createModal();
  });

  test('should not close modal when we press the `esc` key if forceAction is true', async () => {
    const button = screen.getByTestId(testButtonId);
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-hidden');
    expect(modal).not.toHaveClass('is-visible');

    fireEvent.click(button);

    expect(modal).toHaveClass('is-visible');

    fireEvent.keyDown(modal, { code: 'Escape', key: 'Escape' });

    expect(modal).not.toHaveClass('is-hidden');
    expect(modal).toHaveClass('is-visible');
  });

  test('should not have an X button if forceAction is true', async () => {
    const openButton = screen.getByTestId(testButtonId);
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

  test('should not close modal when we click outside of modal if forceAction is true', async () => {
    const openButton = screen.getByTestId(testButtonId);
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
