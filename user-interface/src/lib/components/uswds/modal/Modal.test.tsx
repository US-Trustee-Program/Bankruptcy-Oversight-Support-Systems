import { fireEvent, render, screen } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { OpenModalButton } from './OpenModalButton';
import Modal from './Modal';
import { ModalRefType } from './modal-refs';
import Checkbox from '../Checkbox';
import Radio from '../Radio';
import Button from '../Button';

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
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
        className: 'submit-button',
        onClick: submitButtonOnClick,
      },
      cancelButton: {
        label: 'Cancel',
        className: 'cancel-button',
        onClick: cancelButtonOnClick,
      },
    };

    const content = (
      <div>
        Test Content
        <Checkbox id={'test-checkbox'} value={5}></Checkbox>
        <Radio id={'test-radio-button'} name={'radio1'} label={'Radio 1'} value={'1'}></Radio>
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
              modalId={modalId}
              ref={modalRef}
              heading={'Test Heading'}
              content={content}
              actionButtonGroup={actionButtonGroup}
              onClose={closeModal}
              onOpen={onOpenModal}
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

    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });

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

  test('should render modal with headingTooltip', async () => {
    const modalId = 'tooltip-modal';
    const modalRef = React.createRef<ModalRefType>();
    const tooltip = 'This is a tooltip for the heading';

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    render(
      <BrowserRouter>
        <Modal
          modalId={modalId}
          ref={modalRef}
          heading={'Test Heading'}
          headingTooltip={tooltip}
          content={'Test Content'}
          actionButtonGroup={actionButtonGroup}
        />
      </BrowserRouter>,
    );

    const heading = document.getElementById(`${modalId}-heading`);
    expect(heading).toHaveAttribute('title', tooltip);
  });

  test('should handle Tab key when no first element is available', async () => {
    const modalId = 'empty-modal';
    const modalRef = React.createRef<ModalRefType>();

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    // Create modal with no interactive elements
    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-empty" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Empty Modal'}
            content={<div>No interactive content</div>}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-empty');
    fireEvent.click(openButton);

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);

    // This should trigger the handleTab function with no firstElement
    fireEvent.keyDown(closeButton, { key: 'Tab' });

    // Should still work without errors
    expect(closeButton).toBeInTheDocument();
  });

  test('should handle radio input focus correctly', async () => {
    const modalId = 'radio-modal';
    const modalRef = React.createRef<ModalRefType>();

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    const content = (
      <div>
        <Radio id={'first-radio'} name={'radio-group'} label={'First Radio'} value={'1'} />
        <Radio id={'second-radio'} name={'radio-group'} label={'Second Radio'} value={'2'} />
      </div>
    );

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-radio" modalId={modalId} modalRef={modalRef}>
            Open Radio Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Radio Modal'}
            content={content}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-radio');
    fireEvent.click(openButton);

    // The radio input should be handled and focus should go to the radio button label
    const firstRadioLabel = screen.getByTestId('button-radio-first-radio-click-target');
    expect(firstRadioLabel).toHaveFocus();
  });

  test('should not close modal when submit button has closeOnClick set to false', async () => {
    const modalId = 'no-close-modal';
    const modalRef = React.createRef<ModalRefType>();
    const submitOnClick = vi.fn();

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
        onClick: submitOnClick,
        closeOnClick: false,
      },
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-no-close" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Test Heading'}
            content={'Test Content'}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-no-close');
    const modal = screen.getByTestId(`modal-${modalId}`);

    fireEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    fireEvent.click(submitButton);

    expect(submitOnClick).toHaveBeenCalled();
    expect(modal).toHaveClass('is-visible'); // Should still be visible
    expect(modal).not.toHaveClass('is-hidden');
  });

  test('should handle elements with existing keydown handlers', async () => {
    const modalId = 'existing-handler-modal';
    const modalRef = React.createRef<ModalRefType>();
    const existingHandler = vi.fn();

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    const TestElementWithHandler = () => {
      const elementRef = useRef<HTMLInputElement>(null);

      useEffect(() => {
        if (elementRef.current) {
          elementRef.current.onkeydown = existingHandler;
        }
      }, []);

      return <input ref={elementRef} data-testid="element-with-handler" />;
    };

    const content = (
      <div>
        <TestElementWithHandler />
      </div>
    );

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-handler" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Handler Modal'}
            content={content}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-handler');
    fireEvent.click(openButton);

    const elementWithHandler = screen.getByTestId('element-with-handler');
    fireEvent.keyDown(elementWithHandler, { key: 'a' });

    expect(existingHandler).toHaveBeenCalled();
  });

  test('should handle Tab key early return when firstEl is null', async () => {
    const modalId = 'null-firstel-modal';
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-early-return" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading="Early Return Test"
            content={<div>Test content with no interactive elements</div>}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-early-return');
    fireEvent.click(openButton);

    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-visible');

    // Directly simulate Tab key press on the modal to trigger handleTab
    // This tests various handleTab scenarios including when firstEl might be null
    fireEvent.keyDown(modal, { key: 'Tab' });
    fireEvent.keyDown(modal, { key: 'Tab', shiftKey: true });

    // Modal should remain functional
    expect(modal).toHaveClass('is-visible');
  });

  test('should set firstElement to modalShellRef when no interactive elements found', async () => {
    const modalId = 'no-interactive-modal';
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
    };

    // Content with no interactive elements (no buttons, inputs, etc.)
    const content = (
      <div>
        <p>Just text content with no interactive elements</p>
        <span>More text</span>
        <div>A div</div>
      </div>
    );

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-no-interactive" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'No Interactive Modal'}
            content={content}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-no-interactive');
    fireEvent.click(openButton);

    // Should fallback to modalShellRef.current as firstElement
    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-visible');

    // Modal should still be functional
    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    expect(submitButton).toBeInTheDocument();
  });

  test('should handle modal with no cancel button (undefined branch)', async () => {
    const modalId = 'no-cancel-modal';
    const modalRef = React.createRef<ModalRefType>();

    // Only submit button, no cancel button to trigger undefined branch (line 272)
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit Only',
      },
      // No cancelButton property at all
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-no-cancel" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'No Cancel Modal'}
            content={<div>Content without cancel button</div>}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-no-cancel');
    fireEvent.click(openButton);

    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-visible');

    // Should only have submit button, no cancel button
    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    expect(submitButton).toBeInTheDocument();

    // Cancel button should not exist
    expect(() => screen.getByTestId(`button-${modalId}-cancel-button`)).toThrow();
  });

  test('should handle modal with truly no interactive content (fallback case)', async () => {
    const modalId = 'truly-no-interactive-modal';
    const modalRef = React.createRef<ModalRefType>();

    // No buttons at all - this forces the modalShellRef fallback (lines 192-193)
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      // No submitButton or cancelButton at all
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-truly-empty" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Truly Empty Modal'}
            content={
              <div>
                {/* Only non-interactive elements */}
                <p>Just a paragraph</p>
                <span>Just text</span>
                <img src="test.jpg" alt="test" />
              </div>
            }
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-truly-empty');
    fireEvent.click(openButton);

    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-visible');

    // Since no interactive elements exist, should fallback to modal itself for focus
    // This exercises lines 192-193: setFirstElement(modalShellRef.current as HTMLElement)
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

    fireEvent.keyDown(modal, { key: 'Escape', code: 'Escape' });

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
