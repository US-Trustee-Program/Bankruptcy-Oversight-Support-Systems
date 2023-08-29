import { ButtonProps, UswdsButtonState, UswdsButtonStyle } from './Button';
import { ObjectKeyVal } from '../../type-declarations/basic';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { ModalRefType } from './Modal';

export interface ModalToggleButtonProps {
  children: React.ReactNode;
  buttonId?: string;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
  toggleAction: 'open' | 'close';
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
}

export interface ToggleModalButtonRef {
  disableButton: (state: boolean) => void;
}

function ToggleModalButtonComponent(
  {
    children,
    buttonId,
    uswdsStyle,
    buttonState,
    disabled,
    toggleAction,
    modalId,
    onClick,
    className,
    modalRef,
  }: ModalToggleButtonProps & ButtonProps & JSX.IntrinsicElements['button'],
  ref: React.Ref<ToggleModalButtonRef>,
) {
  const dataProp: ObjectKeyVal = {};

  const dataTestidSuffix = buttonId ? `-${buttonId}` : '';

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

  function handleOnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (onClick) {
      onClick(e);
    }
    if (toggleAction === 'open') {
      modalRef.current?.show();
    } else {
      modalRef.current?.hide();
    }
  }

  useImperativeHandle(ref, () => ({
    disableButton,
  }));

  return (
    <button
      type="button"
      aria-controls={modalId}
      className={classes}
      onClick={handleOnClick}
      data-testid={`toggle-modal-button${dataTestidSuffix}`}
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
