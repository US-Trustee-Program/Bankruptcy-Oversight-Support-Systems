import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { SubmitCancelButtonGroup, SubmitCancelBtnProps } from './SubmitCancelButtonGroup';
import useGlobalKeyDown from '@/hooks/UseGlobalKeyDown';
import { UswdsButtonStyle } from '@/components/uswds/Button';
import useComponent from '@/hooks/UseComponent';
import { ModalRefType, SubmitCancelButtonGroupRef } from './modal-refs';
import sprite from '@uswds/uswds/img/sprite.svg';

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
  const closeIcon = `${sprite}#close`;

  let wrapperData = {};
  if (props.openerId) {
    wrapperData = {
      'data-opener': props.openerId,
    };
  }

  if (props.forceAction) {
    data['data-force-action'] = true;
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.forceAction) {
      if (e.key === 'Escape') {
        close(e);
      }
    }
  };

  useGlobalKeyDown(handleKeyDown, { forceAction: !!props.forceAction });

  const close = (e: MouseEvent | React.MouseEvent | KeyboardEvent | React.KeyboardEvent) => {
    hide();
    if (props.onClose) {
      props.onClose();
    }
    e.preventDefault();
  };

  function submitBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (props.actionButtonGroup.submitButton.onClick) {
      props.actionButtonGroup.submitButton.onClick(e);
    }
    close(e);
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
    hide,
    show: showModal,
    buttons: submitCancelButtonGroupRef,
  }));

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
        <div className={modalClassNames} id={props.modalId} {...data}>
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              <h2 className="usa-modal__heading" id={props.modalId + '-heading'}>
                {props.heading}
              </h2>
              <div className="usa-prose">
                <section id={props.modalId + '-description'}>{props.content}</section>
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
