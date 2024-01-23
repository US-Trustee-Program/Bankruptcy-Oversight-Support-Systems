import { MouseEventHandler, forwardRef, useImperativeHandle, useRef } from 'react';
import { ToggleModalButton } from './ToggleModalButton';
import { UswdsButtonStyle } from '../Button';
import { ModalRefType, SubmitCancelButtonGroupRef, ToggleModalButtonRef } from './modal-refs';

export type SubmitCancelBtnProps = {
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
  className?: string;
  submitButton: {
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
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
  { modalId, modalRef, className, submitButton, cancelButton }: SubmitCancelBtnProps,
  ref: React.Ref<SubmitCancelButtonGroupRef>,
) {
  const toggleSubmitButtonRef = useRef<ToggleModalButtonRef>(null);

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
          <ToggleModalButton
            ref={toggleSubmitButtonRef}
            toggleAction="close"
            buttonIndex="submit"
            modalId={modalId}
            modalRef={modalRef}
            uswdsStyle={submitButton.uswdsStyle ?? UswdsButtonStyle.Default}
            className={submitButton.className ?? ''}
            onClick={submitButton.onClick ?? close}
            disabled={submitButton.disabled ?? false}
          >
            {submitButton.label.length > 0 ? submitButton.label : 'Submit'}
          </ToggleModalButton>
        </li>
        {cancelButton && (
          <li className="usa-button-group__item">
            <ToggleModalButton
              toggleAction="close"
              buttonIndex="cancel"
              modalId={modalId}
              modalRef={modalRef}
              uswdsStyle={cancelButton.uswdsStyle ?? UswdsButtonStyle.Unstyled}
              className={cancelButton.className ?? ' padding-105 text-center '}
              onClick={cancelButton.onClick ?? close}
            >
              {cancelButton.label.length > 0 ? cancelButton.label : 'Go back'}
            </ToggleModalButton>
          </li>
        )}
      </ul>
    </>
  );
}

const SubmitCancelButtonGroup = forwardRef(SubmitCancelButtonGroupComponent);

export { SubmitCancelButtonGroup };
