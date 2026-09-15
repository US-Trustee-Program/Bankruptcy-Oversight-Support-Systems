import { fireEvent, render, screen } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import OpenModalButton from './OpenModalButton';
import Modal from './Modal';
import { ModalRefType, OpenModalButtonRef } from './modal-refs';
import { SubmitCancelBtnProps } from './SubmitCancelButtonGroup';
import Checkbox from '../Checkbox';
import Radio from '../Radio';

const testButtonId = 'open-modal-button_open-test';

type RenderModalOptions = {
  modalId?: string;
  modalRef?: React.RefObject<ModalRefType | null>;
  openButtonRef?: React.RefObject<OpenModalButtonRef | null>;
  openButtonIndex?: string;
  openButtonLabel?: React.ReactNode;
  withOpenButton?: boolean;
  heading?: React.ReactNode;
  headingTooltip?: string;
  content?: React.ReactNode;
  buttonGroup?: Pick<SubmitCancelBtnProps, 'submitButton' | 'cancelButton' | 'className'>;
  onOpen?: () => void;
  onClose?: () => void;
  forceAction?: boolean;
  footerContent?: React.ReactNode;
  strictMode?: boolean;
};

function renderModal(options: RenderModalOptions = {}) {
  const modalId = options.modalId ?? 'test-modal';
  const modalRef = options.modalRef ?? React.createRef<ModalRefType>();
  const openButtonIndex = options.openButtonIndex ?? 'open-test';
  const withOpenButton = options.withOpenButton ?? true;
  const buttonGroup = options.buttonGroup ?? { submitButton: { label: 'Submit' } };

  const modalElement = (
    <Modal
      modalId={modalId}
      ref={modalRef}
      heading={options.heading ?? 'Test Heading'}
      headingTooltip={options.headingTooltip}
      content={options.content ?? 'Test Content'}
      actionButtonGroup={{ modalId, modalRef, ...buttonGroup }}
      onOpen={options.onOpen}
      onClose={options.onClose}
      forceAction={options.forceAction}
      footerContent={options.footerContent}
    />
  );

  const tree = (
    <BrowserRouter>
      {withOpenButton ? (
        <>
          <OpenModalButton
            buttonIndex={openButtonIndex}
            modalId={modalId}
            modalRef={modalRef}
            ref={options.openButtonRef}
          >
            {options.openButtonLabel ?? 'Open Modal'}
          </OpenModalButton>
          {modalElement}
        </>
      ) : (
        modalElement
      )}
    </BrowserRouter>
  );

  render(options.strictMode ? <React.StrictMode>{tree}</React.StrictMode> : tree);

  return {
    modalId,
    modalRef,
    openButton: withOpenButton ? screen.getByTestId(`open-modal-button_${openButtonIndex}`) : null,
  };
}

describe('Test Modal component', () => {
  const modalId = 'test-modal';
  const onOpenModal = vi.fn();
  const closeModal = vi.fn();
  const submitButtonOnClick = vi.fn();
  const cancelButtonOnClick = vi.fn();

  beforeEach(() => {
    renderModal({
      modalId,
      onOpen: onOpenModal,
      onClose: closeModal,
      strictMode: true,
      content: (
        <div>
          Test Content
          <Checkbox id={'test-checkbox'} value={5}></Checkbox>
          <Radio id={'test-radio-button'} name={'radio1'} label={'Radio 1'} value={'1'}></Radio>
        </div>
      ),
      buttonGroup: {
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
      },
    });
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

  test('should return focus to the opener button after closing, not back into the modal', async () => {
    const openButtonRef = React.createRef<OpenModalButtonRef>();
    const { openButton } = renderModal({
      modalId: 'opener-focus-modal',
      openButtonIndex: 'opener-focus-test',
      openButtonRef,
    });

    fireEvent.click(openButton!);

    const closeButton = screen.getByTestId('modal-x-button-opener-focus-modal');
    fireEvent.click(closeButton);

    await vi.waitFor(() => {
      expect(openButton).toHaveFocus();
    });
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

  test('should keep modal-open on document.body while another modal is still visible', async () => {
    const secondModalId = 'second-modal';
    const { openButton: secondOpenButton } = renderModal({
      modalId: secondModalId,
      openButtonIndex: 'open-second',
      openButtonLabel: 'Open Second Modal',
      heading: 'Second Modal',
      content: 'Second Modal Content',
    });

    const firstOpenButton = screen.getByTestId(testButtonId);

    fireEvent.click(firstOpenButton);
    fireEvent.click(secondOpenButton!);
    expect(document.body).toHaveClass('modal-open');

    const firstCloseButton = screen.getByTestId(`modal-x-button-${modalId}`);
    fireEvent.click(firstCloseButton);

    expect(document.body).toHaveClass('modal-open');

    const secondCloseButton = screen.getByTestId(`modal-x-button-${secondModalId}`);
    fireEvent.click(secondCloseButton);

    expect(document.body).not.toHaveClass('modal-open');
  });

  test('should focus the newly-opened modal, not leave focus trapped in the previously-opened one', async () => {
    const secondModalId = 'stacked-second-modal';
    const { openButton: secondOpenButton } = renderModal({
      modalId: secondModalId,
      openButtonIndex: 'open-stacked-second',
      openButtonLabel: 'Open Second Modal',
      heading: 'Second Modal',
      content: 'Second Modal Content',
    });

    fireEvent.click(screen.getByTestId(testButtonId));
    const firstModalFirstElement = document.querySelector('.usa-checkbox__label') as HTMLElement;
    expect(firstModalFirstElement).toHaveFocus();

    fireEvent.click(secondOpenButton!);

    const secondSubmitButton = screen.getByTestId(`button-${secondModalId}-submit-button`);
    expect(secondSubmitButton).toHaveFocus();

    const secondCloseButton = screen.getByTestId(`modal-x-button-${secondModalId}`);
    fireEvent.click(secondCloseButton);

    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    await vi.waitFor(() => {
      expect(firstModalFirstElement).toHaveFocus();
    });

    document.body.removeChild(outsideButton);
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
    const tooltip = 'This is a tooltip for the heading';
    const { modalId: tooltipModalId } = renderModal({
      modalId: 'tooltip-modal',
      headingTooltip: tooltip,
      withOpenButton: false,
    });

    const heading = document.getElementById(`${tooltipModalId}-heading`);
    expect(heading).toHaveAttribute('title', tooltip);
  });

  test('should not invoke cancel button onClick and should stay open when cancel button is disabled', async () => {
    const disabledCancelOnClick = vi.fn();
    const { modalId: disabledCancelModalId, openButton } = renderModal({
      modalId: 'disabled-cancel-modal',
      openButtonIndex: 'open-disabled-cancel',
      heading: 'Disabled Cancel Modal',
      buttonGroup: {
        submitButton: { label: 'Submit' },
        cancelButton: { label: 'Cancel', onClick: disabledCancelOnClick, disabled: true },
      },
    });

    const modal = screen.getByTestId(`modal-${disabledCancelModalId}`);
    fireEvent.click(openButton!);
    expect(modal).toHaveClass('is-visible');

    const cancelButton = screen.getByTestId(`button-${disabledCancelModalId}-cancel-button`);
    fireEvent.click(cancelButton);

    expect(disabledCancelOnClick).not.toHaveBeenCalled();
    expect(modal).toHaveClass('is-visible');
  });

  test('should render footerContent inside the modal footer', async () => {
    const { openButton } = renderModal({
      modalId: 'footer-content-modal',
      openButtonIndex: 'open-footer-content',
      heading: 'Footer Content Modal',
      footerContent: <span data-testid="custom-footer-content">Processing...</span>,
    });

    fireEvent.click(openButton!);

    expect(screen.getByTestId('custom-footer-content')).toBeInTheDocument();
  });

  test('should handle radio input focus correctly', async () => {
    const { openButton } = renderModal({
      modalId: 'radio-modal',
      openButtonIndex: 'open-radio',
      openButtonLabel: 'Open Radio Modal',
      heading: 'Radio Modal',
      content: (
        <div>
          <Radio id={'first-radio'} name={'radio-group'} label={'First Radio'} value={'1'} />
          <Radio id={'second-radio'} name={'radio-group'} label={'Second Radio'} value={'2'} />
        </div>
      ),
    });

    fireEvent.click(openButton!);

    // The radio input should be handled and focus should go to the radio button label
    const firstRadioLabel = screen.getByTestId('button-radio-first-radio-click-target');
    expect(firstRadioLabel).toHaveFocus();
  });

  test('should not close modal when submit button has closeOnClick set to false', async () => {
    const submitOnClick = vi.fn();
    const { modalId: noCloseModalId, openButton } = renderModal({
      modalId: 'no-close-modal',
      openButtonIndex: 'open-no-close',
      buttonGroup: {
        submitButton: { label: 'Submit', onClick: submitOnClick, closeOnClick: false },
      },
    });

    const modal = screen.getByTestId(`modal-${noCloseModalId}`);

    fireEvent.click(openButton!);
    expect(modal).toHaveClass('is-visible');

    const submitButton = screen.getByTestId(`button-${noCloseModalId}-submit-button`);
    fireEvent.click(submitButton);

    expect(submitOnClick).toHaveBeenCalled();
    expect(modal).toHaveClass('is-visible'); // Should still be visible
    expect(modal).not.toHaveClass('is-hidden');
  });

  test('should handle elements with existing keydown handlers', async () => {
    const existingHandler = vi.fn();

    const TestElementWithHandler = () => {
      const elementRef = useRef<HTMLInputElement>(null);

      useEffect(() => {
        if (elementRef.current) {
          elementRef.current.onkeydown = existingHandler;
        }
      }, []);

      return <input ref={elementRef} data-testid="element-with-handler" />;
    };

    const { openButton } = renderModal({
      modalId: 'existing-handler-modal',
      openButtonIndex: 'open-handler',
      heading: 'Handler Modal',
      content: (
        <div>
          <TestElementWithHandler />
        </div>
      ),
    });

    fireEvent.click(openButton!);

    const elementWithHandler = screen.getByTestId('element-with-handler');
    fireEvent.keyDown(elementWithHandler, { key: 'a' });

    expect(existingHandler).toHaveBeenCalled();
  });

  test('should handle modal with no cancel button', async () => {
    const { modalId: noCancelModalId, openButton } = renderModal({
      modalId: 'no-cancel-modal',
      openButtonIndex: 'open-no-cancel',
      heading: 'No Cancel Modal',
      content: <div>Content without cancel button</div>,
      buttonGroup: { submitButton: { label: 'Submit Only' } },
    });

    fireEvent.click(openButton!);

    const modal = screen.getByTestId(`modal-${noCancelModalId}`);
    expect(modal).toHaveClass('is-visible');

    // Should only have submit button, no cancel button
    const submitButton = screen.getByTestId(`button-${noCancelModalId}-submit-button`);
    expect(submitButton).toBeInTheDocument();

    expect(screen.queryByTestId(`button-${noCancelModalId}-cancel-button`)).not.toBeInTheDocument();
  });
});

describe('Test Modal component focus fallback when no interactive content exists', () => {
  test('should focus the submit button when it is the only interactive element in the modal', async () => {
    const { modalId, openButton } = renderModal({
      modalId: 'submit-only-modal',
      openButtonIndex: 'open-submit-only',
      heading: 'Submit Only Modal',
      content: <div>Just text content with no interactive elements</div>,
    });

    fireEvent.click(openButton!);

    const submitButton = screen.getByTestId(`button-${modalId}-submit-button`);
    expect(submitButton).toHaveFocus();
  });

  test('should loop focus back onto the close button when it is the only interactive element in the modal', async () => {
    const { modalId, openButton } = renderModal({
      modalId: 'close-only-modal',
      openButtonIndex: 'open-close-only',
      heading: 'Close Only Modal',
      content: <div>No interactive content</div>,
      buttonGroup: {},
    });

    fireEvent.click(openButton!);

    const closeButton = screen.getByTestId(`modal-x-button-${modalId}`);
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: 'Tab' });

    expect(closeButton).toHaveFocus();
  });

  test('should not automatically focus any element when a forceAction modal has no interactive content', async () => {
    const { modalId, openButton } = renderModal({
      modalId: 'force-action-no-interactive-modal',
      openButtonIndex: 'open-force-action-no-interactive',
      heading: 'No Interactive Content',
      content: <div>Just a paragraph with no interactive elements</div>,
      buttonGroup: {},
      forceAction: true,
    });

    fireEvent.click(openButton!);

    const modal = screen.getByTestId(`modal-${modalId}`);
    expect(modal).toHaveClass('is-visible');
    expect(modal.contains(document.activeElement)).toBe(false);
  });
});

describe('Test Modal handleTab via action buttons', () => {
  const modalId = 'tab-modal';

  beforeEach(() => {
    renderModal({
      modalId,
      openButtonIndex: 'tab-test',
      openButtonLabel: 'Open',
      heading: 'Tab Test Modal',
      content: (
        <div>
          <Checkbox id="tab-test-checkbox" value={1} />
        </div>
      ),
      buttonGroup: {
        submitButton: { label: 'Submit', className: 'tab-submit', onClick: vi.fn() },
        cancelButton: { label: 'Cancel', className: 'tab-cancel', onClick: vi.fn() },
      },
    });
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

  beforeEach(() => {
    renderModal({ modalId, strictMode: true, forceAction: true });
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
