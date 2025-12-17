import { ButtonProps, BUTTON_BASE_CLASS, UswdsButtonStyle } from '../Button';
import React, { forwardRef, useImperativeHandle, useRef, useState, type JSX } from 'react';
import { ModalRefType, OpenModalButtonRef } from './modal-refs';

interface ModalOpenButtonProps {
  id?: string;
  children: React.ReactNode;
  buttonIndex?: string;
  uswdsStyle?: UswdsButtonStyle;
  disabled?: boolean;
  openProps?: object;
  modalId: string;
  modalRef: React.RefObject<ModalRefType | null>;
  title?: string;
  ariaLabel?: string;
}

function OpenModalButton_(
  props: ModalOpenButtonProps & ButtonProps & JSX.IntrinsicElements['button'],
  ref: React.Ref<OpenModalButtonRef>,
) {
  const {
    id,
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
    ...otherProps
  } = props;
  let dataTestidSuffix = id ? `_${id}` : '';
  if (buttonIndex?.length) {
    dataTestidSuffix += `_${buttonIndex}`;
  }

  let classes = BUTTON_BASE_CLASS;
  const [isDisabled, setIsDisabled] = useState<boolean>(!!disabled);

  const buttonRef = useRef<HTMLButtonElement>(null);

  if (uswdsStyle) {
    classes += ' ' + uswdsStyle;
  }
  if (className) {
    classes += ' ' + className;
  }
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
      {...otherProps}
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

const OpenModalButton = forwardRef(OpenModalButton_);
export default OpenModalButton;
