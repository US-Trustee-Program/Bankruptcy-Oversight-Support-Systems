import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { BUTTON_BASE_CLASS, ButtonProps, UswdsButtonStyle } from '../Button';
import { ModalRefType, OpenModalButtonRef } from './modal-refs';

export interface ModalOpenButtonProps {
  ariaLabel?: string;
  buttonIndex?: string;
  children: React.ReactNode;
  disabled?: boolean;
  id?: string;
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
  openProps?: object;
  title?: string;
  uswdsStyle?: UswdsButtonStyle;
}

function OpenModalButtonComponent(
  {
    ariaLabel,
    buttonIndex,
    children,
    className,
    disabled,
    id,
    modalId,
    modalRef,
    onClick,
    openProps,
    title,
    uswdsStyle,
  }: ButtonProps & JSX.IntrinsicElements['button'] & ModalOpenButtonProps,
  ref: React.Ref<OpenModalButtonRef>,
) {
  let dataTestidSuffix = id ? `_${id}` : '';
  if (buttonIndex && buttonIndex.length) dataTestidSuffix += `_${buttonIndex}`;

  let classes = BUTTON_BASE_CLASS;
  const [isDisabled, setIsDisabled] = useState<boolean>(!!disabled);

  const buttonRef = useRef<HTMLButtonElement>(null);

  if (uswdsStyle) classes += ' ' + uswdsStyle;
  if (className) classes += ' ' + className;
  classes = classes.trim();

  function disableButton(state: boolean) {
    setIsDisabled(state);
  }

  function handleOnClick(e: React.MouseEvent<HTMLButtonElement>) {
    const modalOpenProps = { ...openProps, openModalButtonRef: ref };
    if (onClick) {
      onClick(e);
    }
    modalRef.current?.show(modalOpenProps);
  }

  useImperativeHandle(ref, () => ({
    disableButton,
    focus: () => {
      buttonRef?.current?.focus();
    },
  }));

  return (
    <button
      aria-controls={modalId}
      aria-disabled={isDisabled}
      aria-label={ariaLabel}
      className={classes}
      data-testid={`open-modal-button${dataTestidSuffix}`}
      disabled={isDisabled}
      onClick={handleOnClick}
      ref={buttonRef}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

const OpenModalButton = forwardRef(OpenModalButtonComponent);

export { OpenModalButton };
