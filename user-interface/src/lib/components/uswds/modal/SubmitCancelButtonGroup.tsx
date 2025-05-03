import './SubmitCancelButtonGroup.scss';

import { forwardRef, MouseEventHandler, useImperativeHandle, useRef } from 'react';

import Button, { ButtonRef, UswdsButtonStyle } from '../Button';
import { ModalRefType, SubmitCancelButtonGroupRef } from './modal-refs';

export type SubmitCancelBtnProps = {
  cancelButton?: {
    className?: string;
    label: string;
    onClick?: MouseEventHandler;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    uswdsStyle?: UswdsButtonStyle;
  };
  className?: string;
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
  submitButton?: {
    className?: string;
    closeOnClick?: boolean;
    disabled?: boolean;
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    uswdsStyle?: UswdsButtonStyle;
  };
};

function SubmitCancelButtonGroupComponent(
  props: SubmitCancelBtnProps,
  ref: React.Ref<SubmitCancelButtonGroupRef>,
) {
  const { cancelButton, className, modalId, submitButton } = props;
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
    <>
      <ul className={classes}>
        {submitButton && (
          <li className="usa-button-group__item">
            <Button
              className={submitButton.className ?? ''}
              disabled={submitButton.disabled ?? false}
              id={`${modalId}-submit-button`}
              onClick={submitButton.onClick}
              onKeyDown={submitButton.onKeyDown}
              ref={toggleSubmitButtonRef}
              uswdsStyle={submitButton.uswdsStyle ?? UswdsButtonStyle.Default}
            >
              {submitButton.label.length > 0 ? submitButton.label : 'Submit'}
            </Button>
          </li>
        )}
        {cancelButton && (
          <li className="usa-button-group__item">
            <Button
              className={cancelButtonClassName}
              id={`${modalId}-cancel-button`}
              onClick={cancelButton.onClick ?? close}
              onKeyDown={cancelButton.onKeyDown}
              uswdsStyle={cancelButton.uswdsStyle ?? UswdsButtonStyle.Unstyled}
            >
              {cancelButton.label.length > 0 ? cancelButton.label : 'Go back'}
            </Button>
          </li>
        )}
      </ul>
    </>
  );
}

const SubmitCancelButtonGroup = forwardRef(SubmitCancelButtonGroupComponent);

export { SubmitCancelButtonGroup };
