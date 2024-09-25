import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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

  const handleTab = (ev: React.KeyboardEvent<HTMLElement> | KeyboardEvent) => {
    console.log(ev);
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
      firstElement &&
      (ev.target as Element) === firstElement
    ) {
      ev.preventDefault();
      const button = document.querySelector(`#${props.modalId} .usa-button.usa-modal__close`);
      if (button) {
        (button as HTMLElement).focus();
      }
    }
  };

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
    let firstEl: HTMLElement | null = null;
    if (isVisible && modalShellRef.current) {
      const interactiveElements = modalShellRef.current.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );

      interactiveElements.forEach((el) => {
        const element = el as HTMLElement;
        if (!firstEl) {
          firstEl = element;
          if (firstEl.classList.contains('usa-radio__input')) {
            const inputLabel = firstEl.parentElement?.querySelector('label');
            if (inputLabel) {
              const labelButton = inputLabel.querySelector('button.usa-radio__label');
              if (labelButton) firstEl = labelButton as HTMLElement;
            }
          } else if (firstEl.classList.contains('usa-checkbox__input')) {
            const inputLabel = firstEl.parentElement?.querySelector('label');
            if (inputLabel) {
              const labelButton = inputLabel.querySelector('button.usa-checkbox__label');
              if (labelButton) firstEl = labelButton as HTMLElement;
            }
          }
        }

        const existingHandler = element.onkeydown;

        const enhancedHandler = (event: KeyboardEvent) => {
          if (existingHandler) {
            existingHandler.call(element, event);
          }
          handleTab(event);
        };

        element.onkeydown = enhancedHandler;
      });

      if (firstEl) {
        setFirstElement(firstEl);
        (firstEl as HTMLElement).focus();
      } else {
        setFirstElement(modalShellRef.current as HTMLElement);
        modalShellRef.current.focus();
      }

      const keyDownEventHandler = (ev: KeyboardEvent) => {
        handleKeyDown(ev);
      };

      document.addEventListener('keydown', keyDownEventHandler);

      return () => {
        interactiveElements.forEach((el) => {
          (el as HTMLElement).onkeydown = null;
        });
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
                <section id={props.modalId + '-description'}>{props.content}</section>
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
