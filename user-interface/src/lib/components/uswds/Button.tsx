import React, { JSX, forwardRef, useImperativeHandle, useState } from 'react';

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

export type ButtonProps = JSX.IntrinsicElements['button'] & {
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
};

const ButtonComponent = (props: ButtonProps, ref: React.Ref<ButtonRef>) => {
  const { id, uswdsStyle, buttonState, className, disabled, onClick, title, children } = props;
  const [isDisabled, setIsDisabled] = useState<boolean>(!!disabled);
  const classes = [BUTTON_BASE_CLASS];

  if (uswdsStyle) classes.push(uswdsStyle);
  if (buttonState) classes.push(buttonState);
  if (className) classes.push(className);

  const tabIndex = props.tabIndex ?? 0;

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
      tabIndex={tabIndex}
    >
      {children}
    </button>
  );
};

const Button = forwardRef(ButtonComponent);

export default Button;
