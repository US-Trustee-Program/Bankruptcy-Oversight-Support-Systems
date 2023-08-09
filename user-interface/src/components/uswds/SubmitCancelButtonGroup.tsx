import { MouseEventHandler } from 'react';
import { ToggleModalButton } from './ToggleModalButton';
import { UswdsButtonStyle } from './Button';

export type TSubmitCancelBtnProps = {
  modalId: string;
  className?: string;
  submitButton: {
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    className?: string;
    uswdsStyle?: UswdsButtonStyle;
  };
  cancelButton?: {
    label: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    className?: string;
    uswdsStyle?: UswdsButtonStyle;
  };
};

export const SubmitCancelButtonGroup: React.FC<TSubmitCancelBtnProps> = ({
  modalId,
  className,
  submitButton,
  cancelButton,
}: TSubmitCancelBtnProps) => {
  const classes = ['usa-button-group'];
  if (className) {
    className.split(' ').forEach((cls) => {
      classes.push(cls);
    });
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
