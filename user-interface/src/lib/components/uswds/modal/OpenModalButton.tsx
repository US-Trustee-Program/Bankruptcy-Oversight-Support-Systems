import { ButtonProps, BUTTON_BASE_CLASS, UswdsButtonStyle } from '../Button';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ModalRefType, OpenModalButtonRef } from './modal-refs';

export interface ModalOpenButtonProps {
  children: React.ReactNode;
  buttonIndex?: string;
  uswdsStyle?: UswdsButtonStyle;
  disabled?: boolean;
  openProps?: object;
  modalId: string;
  modalRef: React.RefObject<ModalRefType>;
  title?: string;
  ariaLabel?: string;
}

function OpenModalButtonComponent(
  {
    children,
    buttonIndex,
    uswdsStyle,
    disabled,
    openProps,
    modalId,
    onClick,
    className,
    modalRef,
    title,
    ariaLabel,
  }: ModalOpenButtonProps & ButtonProps & JSX.IntrinsicElements['button'],
  ref: React.Ref<OpenModalButtonRef>,
) {
  const dataTestidSuffix = buttonIndex ? `-${buttonIndex}` : '';

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
      type="button"
      aria-controls={modalId}
      className={classes}
      onClick={handleOnClick}
      data-testid={`open-modal-button${dataTestidSuffix}`}
      aria-label={ariaLabel}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      title={title}
      ref={buttonRef}
    >
      {children}
    </button>
  );
}

const OpenModalButton = forwardRef(OpenModalButtonComponent);

export { OpenModalButton };
