import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import useComponent from '@/lib/hooks/UseComponent';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { ModalRefType, OpenModalButtonRef, SubmitCancelButtonGroupRef } from './modal-refs';
import { SubmitCancelBtnProps, SubmitCancelButtonGroup } from './SubmitCancelButtonGroup';

export interface ModalProps {
  actionButtonGroup: SubmitCancelBtnProps;
  className?: string;
  content: React.ReactNode;
  forceAction?: boolean;
  heading: React.ReactNode;
  headingTooltip?: string;
  modalId: string;
  onClose?: () => void;
  onOpen?: () => void;
  onTabKey?: (ev: React.KeyboardEvent, isVisible: boolean) => void;
}

function ModalComponent(props: ModalProps, ref: React.Ref<ModalRefType>) {
  const modalClassNames = `usa-modal ${props.className}`;
  const closeIcon = `/assets/styles/img/sprite.svg#close`;
  const data = { 'data-force-action': false };
  const { hide, isVisible, show } = useComponent();
  const headingTooltip = props.headingTooltip ?? undefined;
  const [openModalButtonRef, setOpenModalButtonRef] =
    useState<null | React.RefObject<OpenModalButtonRef>>(null);
  const [firstElement, setFirstElement] = useState<HTMLElement | null>(null);

  const modalShellRef = useRef<HTMLInputElement | null>(null);
  const submitCancelButtonGroupRef = useRef<SubmitCancelButtonGroupRef>(null);

  if (props.forceAction) {
    data['data-force-action'] = true;
  }

  const handleKeyDown = (ev: KeyboardEvent | React.KeyboardEvent<HTMLElement>) => {
    if (!props.forceAction) {
      if (ev.key === 'Escape') {
        close(ev);
      }
    }
  };

  const handleTab = (
    ev: KeyboardEvent | React.KeyboardEvent<HTMLElement>,
    firstEl: HTMLElement | null,
  ) => {
    if (!firstEl) return;

    if (
      ev.key == 'Tab' &&
      !ev.shiftKey &&
      isVisible &&
      (ev.target as Element).classList.contains('usa-modal__close')
    ) {
      ev.preventDefault();
      if (firstEl) {
        firstEl.focus();
      }
    } else if (
      ev.key == 'Tab' &&
      ev.shiftKey &&
      isVisible &&
      firstEl &&
      (ev.target as Element) === firstEl
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
      const { closeOnClick, onClick } = props.actionButtonGroup.submitButton;
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

  const close = (ev: KeyboardEvent | MouseEvent | React.KeyboardEvent | React.MouseEvent) => {
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

  useImperativeHandle(ref, () => ({
    buttons: submitCancelButtonGroupRef,
    hide: closeModal,
    show: showModal,
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
          handleTab(event, firstEl);
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
      aria-describedby={props.modalId + '-description'}
      aria-labelledby={props.modalId + '-heading'}
      className={`usa-modal-wrapper ${isVisible ? 'is-visible' : 'is-hidden'}`}
      data-testid={`modal-${props.modalId}`}
      id={props.modalId + '-wrapper'}
      role="dialog"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        aria-controls={props.modalId}
        className="usa-modal-overlay"
        data-testid={`modal-overlay-${props.modalId}`}
        id={props.modalId + '-overlay'}
        onClick={(e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
          outsideClick(e, props.modalId + '-overlay')
        }
      >
        <div
          className={modalClassNames}
          id={props.modalId}
          {...data}
          aria-modal="true"
          data-testid={`modal-content-${props.modalId}`}
          ref={modalShellRef}
          role="dialog"
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              {props.heading && (
                <h2
                  className="usa-modal__heading"
                  id={props.modalId + '-heading'}
                  title={headingTooltip ?? undefined}
                >
                  {props.heading}
                </h2>
              )}
              <div className="usa-prose">
                <section id={props.modalId + '-description'}>{props.content}</section>
              </div>
              <div className="usa-modal__footer">
                <SubmitCancelButtonGroup
                  cancelButton={
                    props.actionButtonGroup.cancelButton
                      ? {
                          className: props.actionButtonGroup.cancelButton?.className ?? '',
                          label: props.actionButtonGroup.cancelButton.label,
                          onClick: cancelBtnClick,
                          onKeyDown: (ev) => handleTab(ev, firstElement),
                          uswdsStyle:
                            props.actionButtonGroup.cancelButton?.uswdsStyle ??
                            UswdsButtonStyle.Unstyled,
                        }
                      : undefined
                  }
                  modalId={props.modalId}
                  modalRef={ref as React.RefObject<ModalRefType>}
                  ref={submitCancelButtonGroupRef}
                  submitButton={
                    props.actionButtonGroup.submitButton
                      ? {
                          className: props.actionButtonGroup.submitButton.className ?? '',
                          disabled: props.actionButtonGroup.submitButton.disabled ?? false,
                          label: props.actionButtonGroup.submitButton.label,
                          onClick: submitBtnClick,
                          onKeyDown: (ev) => handleTab(ev, firstElement),
                          uswdsStyle:
                            props.actionButtonGroup.submitButton.uswdsStyle ??
                            UswdsButtonStyle.Default,
                        }
                      : undefined
                  }
                ></SubmitCancelButtonGroup>
              </div>
            </div>
            {props.forceAction || (
              <button
                aria-label="Close this window"
                className="usa-button usa-modal__close"
                data-close-modal
                data-testid={`modal-x-button-${props.modalId}`}
                onClick={close}
                onKeyDown={(ev) => handleTab(ev, firstElement)}
                type="button"
              >
                <svg aria-hidden="true" className="usa-icon" focusable="false" role="img">
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
