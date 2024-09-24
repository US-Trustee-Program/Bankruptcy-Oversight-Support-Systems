import React, {
  cloneElement,
  forwardRef,
  ReactElement,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { SubmitCancelButtonGroup, SubmitCancelBtnProps } from './SubmitCancelButtonGroup';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import useComponent from '@/lib/hooks/UseComponent';
import { ModalRefType, SubmitCancelButtonGroupRef, OpenModalButtonRef } from './modal-refs';

export interface ModalProps {
  modalId: string;
  className?: string;
  heading: React.ReactNode;
  content: React.ReactNode;
  forceAction?: boolean;
  actionButtonGroup: SubmitCancelBtnProps;
  onOpen?: () => void;
  onClose?: () => void;
}

function ModalComponent(props: ModalProps, ref: React.Ref<ModalRefType>) {
  const modalClassNames = `usa-modal ${props.className}`;
  const closeIcon = `/assets/styles/img/sprite.svg#close`;
  const data = { 'data-force-action': false };
  const { isVisible, show, hide } = useComponent();
  const [openModalButtonRef, setOpenModalButtonRef] =
    useState<React.RefObject<OpenModalButtonRef> | null>(null);
  const [firstElement, setFirstElement] = useState<HTMLElement | null>(null);

  const modalShellRef = useRef<HTMLInputElement | null>(null);
  const submitCancelButtonGroupRef = useRef<SubmitCancelButtonGroupRef>(null);

  if (props.forceAction) {
    data['data-force-action'] = true;
  }

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLElement> | KeyboardEvent) => {
    if (!props.forceAction) {
      if (ev.key === 'Escape') {
        close(ev);
      }
    }
  };

  const close = (ev: MouseEvent | React.MouseEvent | KeyboardEvent | React.KeyboardEvent) => {
    closeModal();
    ev.preventDefault();
  };

  function closeModal() {
    if (props.onClose) {
      props.onClose();
    }

    hide();

    openModalButtonRef?.current?.focus();
  }

  const handleTab = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (
      ev.key == 'Tab' &&
      !ev.shiftKey &&
      isVisible &&
      (ev.target as Element).classList.contains('usa-modal__close')
    ) {
      ev.preventDefault();
      if (firstElement) {
        firstElement.focus();
      }
    } else if (
      ev.key == 'Tab' &&
      ev.shiftKey &&
      isVisible &&
      (ev.target as Element) === firstElement
    ) {
      ev.preventDefault();
      const button = document.querySelector('.usa-button.usa-modal__close');
      if (button) {
        (button as HTMLElement).focus();
      }
    }
  };

  interface EnhancableProps {
    onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
    children?: ReactNode;
  }

  function enhanceChildrenWithKeyDownHandlers(
    child: ReactNode,
    isFirstInteractive: boolean = true,
  ): ReactNode {
    if (React.isValidElement(child)) {
      const props = child.props as EnhancableProps;

      // eslint-disable-next-line react/prop-types
      const existingOnKeyDown = props.onKeyDown;

      const combinedOnKeyDown = isFirstInteractive
        ? (ev: React.KeyboardEvent<HTMLElement>) => {
            if (existingOnKeyDown) existingOnKeyDown(ev);
            handleKeyDown(ev);
          }
        : existingOnKeyDown;

      // according to chatGPT, we don't need to worry about Prop Types because typescript should manage prop validation
      // eslint-disable-next-line react/prop-types
      const enhancedContent = props.children
        ? // eslint-disable-next-line react/prop-types
          React.Children.map(props.children, (child) =>
            enhanceChildrenWithKeyDownHandlers(
              child,
              isFirstInteractive && !isInteractiveElement(child),
            ),
          )
        : null;

      return cloneElement(child as ReactElement, {
        onKeyDown: combinedOnKeyDown,
        children: enhancedContent,
      });
    }

    return child;
  }

  function isInteractiveElement(child: ReactNode): boolean {
    if (React.isValidElement(child)) {
      const tag = child.type;
      return (
        typeof tag === 'string' &&
        ['button', 'a', 'input', 'textarea', 'select', 'checkbox', 'radio'].includes(tag)
      );
    }
    return false;
  }

  function submitBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (props.actionButtonGroup.submitButton?.onClick) {
      const { onClick, closeOnClick } = props.actionButtonGroup.submitButton;
      if (onClick) onClick(e);
      if (closeOnClick !== false) close(e);
    }
  }

  function cancelBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (props.actionButtonGroup.cancelButton?.onClick) {
      props.actionButtonGroup.cancelButton.onClick(e);
    }
    close(e);
  }

  function outsideClick(e: React.MouseEvent<HTMLDivElement>, id: string) {
    if (!props.forceAction) {
      const clickedElement = e.target as HTMLElement;
      if (clickedElement.id === id) {
        close(e);
      }
    }
  }

  function showModal(options: object) {
    if (props.onOpen) {
      props.onOpen();
    }
    if (options && 'openModalButtonRef' in options) {
      const openRef = options.openModalButtonRef as React.RefObject<OpenModalButtonRef>;
      setOpenModalButtonRef(openRef);
    }
    show();
  }

  useImperativeHandle(ref, () => ({
    hide: closeModal,
    show: showModal,
    buttons: submitCancelButtonGroupRef,
  }));

  useEffect(() => {
    if (isVisible && modalShellRef.current) {
      const firstFocusableElement = modalShellRef.current.querySelector(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );

      if (firstFocusableElement) {
        setFirstElement(firstFocusableElement as HTMLElement);
        (firstFocusableElement as HTMLElement).focus();
      } else {
        setFirstElement(modalShellRef.current as HTMLElement);
        modalShellRef.current.focus();
      }

      const keyDownEventHandler = (ev: KeyboardEvent) => {
        handleKeyDown(ev);
      };

      document.addEventListener('keydown', keyDownEventHandler);

      return () => {
        document.removeEventListener('keydown', keyDownEventHandler);
      };
    }
  }, [isVisible]);

  return (
    <div
      className={`usa-modal-wrapper ${isVisible ? 'is-visible' : 'is-hidden'}`}
      role="dialog"
      id={props.modalId + '-wrapper'}
      data-testid={`modal-${props.modalId}`}
      aria-labelledby={props.modalId + '-heading'}
      aria-describedby={props.modalId + '-description'}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="usa-modal-overlay"
        aria-controls={props.modalId}
        id={props.modalId + '-overlay'}
        data-testid={`modal-overlay-${props.modalId}`}
        onClick={(e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
          outsideClick(e, props.modalId + '-overlay')
        }
      >
        <div
          className={modalClassNames}
          id={props.modalId}
          {...data}
          ref={modalShellRef}
          data-testid={`modal-content-${props.modalId}`}
          aria-modal="true"
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              {props.heading && (
                <h2 className="usa-modal__heading" id={props.modalId + '-heading'}>
                  {props.heading}
                </h2>
              )}
              <div className="usa-prose">
                <section id={props.modalId + '-description'}>
                  {enhanceChildrenWithKeyDownHandlers(props.content)}
                </section>
              </div>
              <div className="usa-modal__footer">
                <SubmitCancelButtonGroup
                  ref={submitCancelButtonGroupRef}
                  modalId={props.modalId}
                  modalRef={ref as React.RefObject<ModalRefType>}
                  submitButton={
                    props.actionButtonGroup.submitButton
                      ? {
                          label: props.actionButtonGroup.submitButton.label,
                          onClick: submitBtnClick,
                          onKeyDown: handleTab,
                          className: props.actionButtonGroup.submitButton.className ?? '',
                          disabled: props.actionButtonGroup.submitButton.disabled ?? false,
                          uswdsStyle:
                            props.actionButtonGroup.submitButton.uswdsStyle ??
                            UswdsButtonStyle.Default,
                        }
                      : undefined
                  }
                  cancelButton={
                    props.actionButtonGroup.cancelButton
                      ? {
                          label: props.actionButtonGroup.cancelButton.label,
                          onClick: cancelBtnClick,
                          onKeyDown: handleTab,
                          className: props.actionButtonGroup.cancelButton?.className ?? '',
                          uswdsStyle:
                            props.actionButtonGroup.cancelButton?.uswdsStyle ??
                            UswdsButtonStyle.Unstyled,
                        }
                      : undefined
                  }
                ></SubmitCancelButtonGroup>
              </div>
            </div>
            {props.forceAction || (
              <button
                type="button"
                className="usa-button usa-modal__close"
                aria-label="Close this window"
                data-close-modal
                onClick={close}
                data-testid={`modal-x-button-${props.modalId}`}
                onKeyDown={handleTab}
              >
                <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
                  <use xlinkHref={closeIcon}></use>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Modal = forwardRef(ModalComponent);

export default Modal;
