import { ButtonProps, UswdsButtonState, UswdsButtonStyle } from './Button';
import { ObjectKeyVal } from '../../type-declarations/basic';
import { forwardRef, useImperativeHandle, useState } from 'react';

export interface ModalToggleButtonProps {
  children: React.ReactNode;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
  toggleAction: 'open' | 'close';
  modalId: string;
}

export interface ToggleModalButtonRef {
  disableButton: (state: boolean) => void;
}

function ToggleModalButtonComponent(
  {
    children,
    uswdsStyle,
    buttonState,
    disabled,
    toggleAction,
    modalId,
    onClick,
    className,
  }: ModalToggleButtonProps & ButtonProps & JSX.IntrinsicElements['button'],
  ref: React.Ref<ToggleModalButtonRef>,
) {
  const dataProp: ObjectKeyVal = {};

  let classes = 'usa-button';
  const [isDisabled, setIsDisabled] = useState<boolean>(!!disabled);

  if (toggleAction === 'open') {
    dataProp['data-open-modal'] = 'true';
  } else {
    dataProp['data-close-modal'] = 'true';
  }

  if (uswdsStyle) classes += ' ' + uswdsStyle;
  if (buttonState) classes += ' ' + buttonState;
  if (className) classes += ' ' + className;

  function disableButton(state: boolean) {
    setIsDisabled(state);
  }

  useImperativeHandle(ref, () => ({
    disableButton,
  }));

  return (
    <button
      type="button"
      aria-controls={modalId}
      className={classes}
      onClick={onClick}
      data-testid="button"
      aria-disabled={isDisabled}
      disabled={isDisabled}
      {...dataProp}
    >
      {children}
    </button>
  );
}

const ToggleModalButton = forwardRef(ToggleModalButtonComponent);

export { ToggleModalButton };
