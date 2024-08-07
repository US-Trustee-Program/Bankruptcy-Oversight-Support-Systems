import { ButtonProps, BUTTON_BASE_CLASS, UswdsButtonState, UswdsButtonStyle } from '../Button';
import { ObjectKeyVal } from '@/lib/type-declarations/basic';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { ModalRefType, ToggleModalButtonRef } from './modal-refs';

export interface ModalToggleButtonProps {
  children: React.ReactNode;
  buttonIndex?: string;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
  toggleAction: 'open' | 'close';
  toggleProps?: object;
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
  title?: string;
  ariaLabel?: string;
}

function ToggleModalButtonComponent(
  {
    children,
    buttonIndex,
    uswdsStyle,
    buttonState,
    disabled,
    toggleAction,
    toggleProps,
    modalId,
    onClick,
    className,
    modalRef,
    title,
    ariaLabel,
  }: ModalToggleButtonProps & ButtonProps & JSX.IntrinsicElements['button'],
  ref: React.Ref<ToggleModalButtonRef>,
) {
  const dataProp: ObjectKeyVal = {};

  const dataTestidSuffix = buttonIndex ? `-${buttonIndex}` : '';

  let classes = BUTTON_BASE_CLASS;
  const [isDisabled, setIsDisabled] = useState<boolean>(!!disabled);

  if (toggleAction === 'open') {
    dataProp['data-open-modal'] = 'true';
  } else {
    dataProp['data-close-modal'] = 'true';
  }

  if (uswdsStyle) classes += ' ' + uswdsStyle;
  if (buttonState) classes += ' ' + buttonState;
  if (className) classes += ' ' + className;
  classes = classes.trim();

  function disableButton(state: boolean) {
    setIsDisabled(state);
  }

  function handleOnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (onClick) {
      onClick(e);
    }
    if (toggleAction === 'open') {
      modalRef.current?.show(toggleProps);
    } else {
      modalRef.current?.hide(toggleProps);
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
      aria-label={ariaLabel}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      title={title}
      {...dataProp}
    >
      {children}
    </button>
  );
}

const ToggleModalButton = forwardRef(ToggleModalButtonComponent);

export { ToggleModalButton };
