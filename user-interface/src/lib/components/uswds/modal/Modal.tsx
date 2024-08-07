import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SubmitCancelButtonGroup, SubmitCancelBtnProps } from './SubmitCancelButtonGroup';
import useGlobalKeyDown from '@/lib/hooks/UseGlobalKeyDown';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import useComponent from '@/lib/hooks/UseComponent';
import { ModalRefType, SubmitCancelButtonGroupRef } from './modal-refs';

export interface ModalProps {
  modalId: string;
  openerId?: string;
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
  const data = { 'data-force-action': false };
  const { isVisible, show, hide } = useComponent();
  const submitCancelButtonGroupRef = useRef<SubmitCancelButtonGroupRef>(null);
  const [keyboardAccessible, setKeyboardAccessible] = useState<number>(-1);
  const closeIcon = `/assets/styles/img/sprite.svg#close`;
  const modalShellRef = useRef<HTMLInputElement | null>(null);

  let wrapperData = {};
  if (props.openerId) {
    wrapperData = {
      'data-opener': props.openerId,
    };
  }

  if (props.forceAction) {
    data['data-force-action'] = true;
  }

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (!props.forceAction) {
      if (ev.key === 'Escape') {
        close(ev);
      }
    }
  };

  useGlobalKeyDown(handleKeyDown, { forceAction: !!props.forceAction });

  const close = (ev: MouseEvent | React.MouseEvent | KeyboardEvent | React.KeyboardEvent) => {
    closeModal();
    ev.preventDefault();
  };

  function closeModal() {
    if (props.onClose) {
      props.onClose();
    }
    hide();
    setKeyboardAccessible(100000);
  }

  const handleTab = (ev: React.KeyboardEvent<HTMLButtonElement>) => {
    if (
      ev.key == 'Tab' &&
      !ev.shiftKey &&
      isVisible &&
      (ev.target as Element).classList.contains('usa-modal__close')
    ) {
      ev.preventDefault();
      modalShellRef?.current?.focus();
    }
  };

  const handleShiftTab = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    const elementEquivalency =
      (ev.target as Element).id === `${props.modalId}-description` ||
      (ev.target as Element).id === `${props.modalId}`;
    if (ev.key == 'Tab' && ev.shiftKey && isVisible && elementEquivalency) {
      ev.preventDefault();
      const button = document.querySelector('.usa-button.usa-modal__close');
      if (button) {
        (button as HTMLElement).focus();
      }
    }
  };
  function submitBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    const { onClick, closeOnClick } = props.actionButtonGroup.submitButton;
    if (onClick) onClick(e);
    if (closeOnClick !== false) close(e);
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

  function showModal() {
    if (props.onOpen) {
      props.onOpen();
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
      setKeyboardAccessible(-1);
      modalShellRef.current.focus();
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
      {...wrapperData}
    >
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
          tabIndex={keyboardAccessible}
          ref={modalShellRef}
          onKeyDown={handleShiftTab}
          data-testid={`modal-content-${props.modalId}`}
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              {props.heading && (
                <h2 className="usa-modal__heading" id={props.modalId + '-heading'}>
                  {props.heading}
                </h2>
              )}
              <div className="usa-prose">
                <section id={props.modalId + '-description'} tabIndex={0}>
                  {props.content}
                </section>
              </div>
              <div className="usa-modal__footer">
                <SubmitCancelButtonGroup
                  ref={submitCancelButtonGroupRef}
                  modalId={props.modalId}
                  modalRef={ref as React.RefObject<ModalRefType>}
                  submitButton={{
                    label: props.actionButtonGroup.submitButton.label,
                    onClick: submitBtnClick,
                    className: props.actionButtonGroup.submitButton.className ?? '',
                    disabled: props.actionButtonGroup.submitButton.disabled ?? false,
                    uswdsStyle:
                      props.actionButtonGroup.submitButton.uswdsStyle ?? UswdsButtonStyle.Default,
                  }}
                  cancelButton={{
                    label: props.actionButtonGroup.cancelButton?.label ?? '',
                    onClick: cancelBtnClick,
                    className: props.actionButtonGroup.cancelButton?.className ?? '',
                    uswdsStyle:
                      props.actionButtonGroup.cancelButton?.uswdsStyle ?? UswdsButtonStyle.Unstyled,
                  }}
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
