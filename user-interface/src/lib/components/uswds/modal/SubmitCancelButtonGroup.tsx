import './SubmitCancelButtonGroup.scss';
import React, { MouseEventHandler, forwardRef, useImperativeHandle, useRef } from 'react';
import Button, { ButtonRef, UswdsButtonStyle } from '../Button';
import { ModalRefType, SubmitCancelButtonGroupRef } from './modal-refs';

export type SubmitCancelBtnProps = {
  modalId: string;
  modalRef: React.RefObject<ModalRefType | null>;
  className?: string;
  submitButton?: {
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    closeOnClick?: boolean;
    className?: string;
    uswdsStyle?: UswdsButtonStyle;
    disabled?: boolean;
  };
  cancelButton?: {
    label: string;
    onClick?: MouseEventHandler;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    className?: string;
    uswdsStyle?: UswdsButtonStyle;
  };
};

function SubmitCancelButtonGroup_(
  props: SubmitCancelBtnProps,
  ref: React.Ref<SubmitCancelButtonGroupRef>,
) {
  const { modalId, className, submitButton, cancelButton } = props;
  const toggleSubmitButtonRef = useRef<ButtonRef>(null);
  const cancelButtonClassName = `${props.cancelButton?.className} text-center`;

  const classes = `usa-button-group submit-cancel-button-group ${className ?? ''}`;

  function disableSubmitButton(state: boolean) {
    toggleSubmitButtonRef.current?.disableButton(state);
  }

  useImperativeHandle(ref, () => ({
    disableSubmitButton,
  }));

  return (
    <ul className={classes} role="group" aria-label="Modal actions">
      {submitButton && (
        <li className="usa-button-group__item">
          <Button
            id={`${modalId}-submit-button`}
            ref={toggleSubmitButtonRef}
            uswdsStyle={submitButton.uswdsStyle ?? UswdsButtonStyle.Default}
            className={submitButton.className ?? ''}
            onClick={submitButton.onClick}
            onKeyDown={submitButton.onKeyDown}
            disabled={submitButton.disabled ?? false}
          >
            {submitButton.label.length > 0 ? submitButton.label : 'Submit'}
          </Button>
        </li>
      )}
      {cancelButton && (
        <li className="usa-button-group__item">
          <Button
            id={`${modalId}-cancel-button`}
            uswdsStyle={cancelButton.uswdsStyle ?? UswdsButtonStyle.Unstyled}
            className={cancelButtonClassName}
            onClick={cancelButton.onClick ?? close}
            onKeyDown={cancelButton.onKeyDown}
          >
            {cancelButton.label.length > 0 ? cancelButton.label : 'Go back'}
          </Button>
        </li>
      )}
    </ul>
  );
}

const SubmitCancelButtonGroup = forwardRef(SubmitCancelButtonGroup_);
export default SubmitCancelButtonGroup;
