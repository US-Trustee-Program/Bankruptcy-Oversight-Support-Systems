import { MouseEventHandler, forwardRef, useImperativeHandle, useRef } from 'react';
import Button, { ButtonRef, UswdsButtonStyle } from '../Button';
import { ModalRefType, SubmitCancelButtonGroupRef } from './modal-refs';

export type SubmitCancelBtnProps = {
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
  className?: string;
  submitButton: {
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    closeOnClick?: boolean;
    className?: string;
    uswdsStyle?: UswdsButtonStyle;
    disabled?: boolean;
  };
  cancelButton?: {
    label: string;
    onClick?: MouseEventHandler;
    className?: string;
    uswdsStyle?: UswdsButtonStyle;
  };
};

function SubmitCancelButtonGroupComponent(
  { modalId, className, submitButton, cancelButton }: SubmitCancelBtnProps,
  ref: React.Ref<SubmitCancelButtonGroupRef>,
) {
  const toggleSubmitButtonRef = useRef<ButtonRef>(null);

  const classes = `usa-button-group ${className ?? ''}`;

  function disableSubmitButton(state: boolean) {
    toggleSubmitButtonRef.current?.disableButton(state);
  }

  useImperativeHandle(ref, () => ({
    disableSubmitButton,
  }));

  return (
    <>
      <ul className={classes}>
        <li className="usa-button-group__item">
          <Button
            id={`${modalId}-submit-button`}
            ref={toggleSubmitButtonRef}
            uswdsStyle={submitButton.uswdsStyle ?? UswdsButtonStyle.Default}
            className={submitButton.className ?? ''}
            onClick={submitButton.onClick}
            disabled={submitButton.disabled ?? false}
          >
            {submitButton.label.length > 0 ? submitButton.label : 'Submit'}
          </Button>
        </li>
        {cancelButton && (
          <li className="usa-button-group__item">
            <Button
              id={`${modalId}-cancel-button`}
              uswdsStyle={cancelButton.uswdsStyle ?? UswdsButtonStyle.Unstyled}
              className={cancelButton.className ?? ' padding-105 text-center '}
              onClick={cancelButton.onClick ?? close}
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
