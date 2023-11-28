import React, { forwardRef, useImperativeHandle, useState } from 'react';

export enum UswdsButtonStyle {
  Default = 'usa-button',
  Unstyled = 'usa-button--unstyled',
  Secondary = 'usa-button--secondary',
  Cool = 'usa-button--accent-cool',
  Warm = 'usa-button--accent-warm',
  Base = 'usa-button--base',
  Outline = 'usa-button--outline',
  Inverse = 'usa-button--outline usa-button--inverse',
}

export enum UswdsButtonState {
  Default = '',
  Hover = 'usa-button--hover',
  Active = 'usa-button--active',
  Focus = 'usa-focus',
}

export interface ButtonRef {
  disableButton: (state: boolean) => void;
}

export interface ButtonProps {
  children: React.ReactNode;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
}

const ButtonComponent = (
  {
    uswdsStyle,
    buttonState,
    className,
    disabled,
    onClick,
    title,
    children,
  }: ButtonProps & JSX.IntrinsicElements['button'],
  ref: React.Ref<ButtonRef>,
) => {
  const [isDisabled, setIsDisabled] = useState<boolean>(!!disabled);
  const classes = ['usa-button'];

  if (uswdsStyle) classes.push(uswdsStyle);
  if (buttonState) classes.push(buttonState);
  if (className) classes.push(className);

  function disableButton(state: boolean) {
    setIsDisabled(state);
  }

  useImperativeHandle(ref, () => ({
    disableButton,
  }));

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      data-testid="button"
      aria-disabled={isDisabled}
      disabled={isDisabled}
      title={title}
    >
      {children}
    </button>
  );
};

const Button = forwardRef(ButtonComponent);

export default Button;
