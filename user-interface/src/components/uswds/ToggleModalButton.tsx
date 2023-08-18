import { ButtonProps, UswdsButtonState, UswdsButtonStyle } from './Button';
import { ObjectKeyVal } from '../../type-declarations/basic';
import { useState } from 'react';

export interface ModalToggleButtonProps {
  children: React.ReactNode;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
  toggleAction: 'open' | 'close';
  modalId: string;
}

export function ToggleModalButton({
  children,
  uswdsStyle,
  buttonState,
  disabled,
  toggleAction,
  modalId,
  onClick,
  className,
}: ModalToggleButtonProps & ButtonProps & JSX.IntrinsicElements['button']) {
  const dataProp: ObjectKeyVal = {};

  let classes = 'usa-button';
  const [ariaDisabled, setAriaDisabled] = useState<boolean>(false);

  if (toggleAction === 'open') {
    dataProp['data-open-modal'] = 'true';
  } else {
    dataProp['data-close-modal'] = 'true';
  }

  if (uswdsStyle) classes += ' ' + uswdsStyle;
  if (buttonState) classes += ' ' + buttonState;
  if (className) classes += ' ' + className;

  if (disabled === true && !ariaDisabled) {
    setAriaDisabled(true);
  }

  return (
    <button
      type="button"
      aria-controls={modalId}
      className={classes}
      onClick={onClick}
      data-testid="button"
      aria-disabled={ariaDisabled}
      {...dataProp}
    >
      {children}
    </button>
  );
}
