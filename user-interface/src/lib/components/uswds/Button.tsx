import React, { forwardRef, useImperativeHandle, useState } from 'react';

export const BUTTON_BASE_CLASS = 'usa-button';

export enum UswdsButtonStyle {
  Default = '',
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
    id,
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
  const classes = [BUTTON_BASE_CLASS];

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
      id={id}
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      data-testid={`button-${id}`}
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
