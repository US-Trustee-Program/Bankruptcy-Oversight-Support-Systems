import { fireEvent, render, screen } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import OpenModalButton from './OpenModalButton';
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

  test('should add modal-open class to document.body when opened and remove it when closed', async () => {
    const button = screen.getByTestId(testButtonId);
    expect(document.body).not.toHaveClass('modal-open');

    fireEvent.click(button);
    expect(document.body).toHaveClass('modal-open');

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);
    fireEvent.click(closeButton);

    expect(document.body).not.toHaveClass('modal-open');
  });

  test('should redirect focus back into the modal when focus lands outside of it', async () => {
    const openButton = screen.getByTestId(testButtonId);
    fireEvent.click(openButton);

    const firstElement = document.querySelector('.usa-checkbox__label') as HTMLElement;
    expect(firstElement).toHaveFocus();

    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);

    outsideButton.focus();

    await vi.waitFor(() => {
      expect(firstElement).toHaveFocus();
    });

    document.body.removeChild(outsideButton);
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

  test('should not invoke cancel button onClick and should stay open when cancel button is disabled', async () => {
    const modalId = 'disabled-cancel-modal';
    const modalRef = React.createRef<ModalRefType>();
    const disabledCancelOnClick = vi.fn();

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit',
      },
      cancelButton: {
        label: 'Cancel',
        onClick: disabledCancelOnClick,
        disabled: true,
      },
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-disabled-cancel" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Disabled Cancel Modal'}
            content={'Test Content'}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    const openButton = screen.getByTestId('open-modal-button_open-disabled-cancel');
    const modal = screen.getByTestId(`modal-${modalId}`);
    fireEvent.click(openButton);
    expect(modal).toHaveClass('is-visible');

    const cancelButton = screen.getByTestId(`button-${modalId}-cancel-button`);
    fireEvent.click(cancelButton);

    expect(disabledCancelOnClick).not.toHaveBeenCalled();
    expect(modal).toHaveClass('is-visible');
  });

  test('should render footerContent inside the modal footer', async () => {
    const modalId = 'footer-content-modal';
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
          <OpenModalButton buttonIndex="open-footer-content" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Footer Content Modal'}
            content={'Test Content'}
            actionButtonGroup={actionButtonGroup}
            footerContent={<span data-testid="custom-footer-content">Processing...</span>}
          />
        </>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByTestId('open-modal-button_open-footer-content'));

    expect(screen.getByTestId('custom-footer-content')).toBeInTheDocument();
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

  test('should handle modal with no cancel button', async () => {
    const modalId = 'no-cancel-modal';
    const modalRef = React.createRef<ModalRefType>();

    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
      submitButton: {
        label: 'Submit Only',
      },
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

    expect(screen.queryByTestId(`button-${modalId}-cancel-button`)).not.toBeInTheDocument();
  });
});

describe('Test Modal component focus fallback when no interactive content exists', () => {
  test('should focus the submit button when it is the only interactive element in the modal', async () => {
    const modalId = 'submit-only-modal';
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
          <OpenModalButton buttonIndex="open-submit-only" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Submit Only Modal'}
            content={<div>Just text content with no interactive elements</div>}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByTestId('open-modal-button_open-submit-only'));

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    expect(submitButton).toHaveFocus();
  });

  test('should loop focus back onto the close button when it is the only interactive element in the modal', async () => {
    const modalId = 'close-only-modal';
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="open-close-only" modalId={modalId} modalRef={modalRef}>
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'Close Only Modal'}
            content={<div>No interactive content</div>}
            actionButtonGroup={actionButtonGroup}
          />
        </>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByTestId('open-modal-button_open-close-only'));

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: 'Tab' });

    expect(closeButton).toHaveFocus();
  });

  test('should not automatically focus any element when a forceAction modal has no interactive content', async () => {
    const modalId = 'force-action-no-interactive-modal';
    const modalRef = React.createRef<ModalRefType>();
    const actionButtonGroup = {
      modalId: modalId,
      modalRef: modalRef,
    };

    render(
      <BrowserRouter>
        <>
          <OpenModalButton
            buttonIndex="open-force-action-no-interactive"
            modalId={modalId}
            modalRef={modalRef}
          >
            Open Modal
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading={'No Interactive Content'}
            content={<div>Just a paragraph with no interactive elements</div>}
            actionButtonGroup={actionButtonGroup}
            forceAction={true}
          />
        </>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByTestId('open-modal-button_open-force-action-no-interactive'));

    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-visible');
    expect(modal.contains(document.activeElement)).toBe(false);
  });
});

describe('Test Modal handleTab via action buttons', () => {
  const modalId = 'tab-modal';

  beforeEach(() => {
    const modalRef = React.createRef<ModalRefType>();
    const content = (
      <div>
        <Checkbox id="tab-test-checkbox" value={1} />
      </div>
    );
    render(
      <BrowserRouter>
        <>
          <OpenModalButton buttonIndex="tab-test" modalId={modalId} modalRef={modalRef}>
            Open
          </OpenModalButton>
          <Modal
            modalId={modalId}
            ref={modalRef}
            heading="Tab Test Modal"
            content={content}
            actionButtonGroup={{
              modalId,
              modalRef,
              submitButton: { label: 'Submit', className: 'tab-submit', onClick: vi.fn() },
              cancelButton: { label: 'Cancel', className: 'tab-cancel', onClick: vi.fn() },
            }}
          />
        </>
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByTestId('open-modal-button_tab-test'));
  });

  test('should call handleTab when Tab is pressed on submit button', () => {
    const submitButton = document.querySelector('.tab-submit') as HTMLElement;
    const firstElement = document.querySelector('.usa-checkbox__label') as HTMLElement;
    fireEvent.keyDown(submitButton, { key: 'Tab' });
    expect(firstElement).toHaveFocus();
  });

  test('should call handleTab when Tab is pressed on cancel button', () => {
    const cancelButton = document.querySelector('.tab-cancel') as HTMLElement;
    const firstElement = document.querySelector('.usa-checkbox__label') as HTMLElement;
    fireEvent.keyDown(cancelButton, { key: 'Tab' });
    expect(firstElement).toHaveFocus();
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

    expect(screen.queryByTestId(`modal-x-button-${modalId}`)).not.toBeInTheDocument();
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
