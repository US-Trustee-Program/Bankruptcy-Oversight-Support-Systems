import { MouseEventHandler } from 'react';
import { ToggleModalButton } from './ToggleModalButton';
import { UswdsButtonStyle } from './Button';

export interface SubmitCancelButtonGroupRef {
  disableSubmitButton: (state: boolean) => void;
}

export type SubmitCancelBtnProps = {
  modalId: string;
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

export const SubmitCancelButtonGroup: React.FC<SubmitCancelBtnProps> = (
  { modalId, className, submitButton, cancelButton }: SubmitCancelBtnProps,
  ref: React.Ref<SubmitCancelButtonGroupRef>,
) => {
  const classes = ['usa-button-group'];
  if (className) {
    className.split(' ').forEach((cls) => {
      classes.push(cls);
    });
  }

  function disableSubmitButton(state: boolean) {
    submitButton.disabled = state;
  }

  return (
    <>
      <ul className={classes.join(' ')}>
        <li className="usa-button-group__item">
          <ToggleModalButton
            toggleAction="close"
            modalId={modalId}
            uswdsStyle={submitButton.uswdsStyle ?? UswdsButtonStyle.Default}
            className={submitButton.className ?? ''}
            onClick={submitButton.onClick ?? close}
          >
            {submitButton.label}
          </ToggleModalButton>
        </li>
        {cancelButton && (
          <li className="usa-button-group__item">
            <ToggleModalButton
              toggleAction="close"
              modalId={modalId}
              uswdsStyle={cancelButton.uswdsStyle ?? UswdsButtonStyle.Unstyled}
              className={cancelButton.className ?? ' padding-105 text-center '}
              onClick={cancelButton.onClick ?? close}
            >
              {cancelButton.label}
            </ToggleModalButton>
          </li>
        )}
      </ul>
    </>
  );
};
