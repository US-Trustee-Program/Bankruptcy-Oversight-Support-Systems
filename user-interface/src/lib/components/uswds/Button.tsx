import React, { forwardRef, JSX, useEffect, useImperativeHandle, useState } from 'react';

export const BUTTON_BASE_CLASS = 'usa-button';

export enum UswdsButtonState {
  Active = 'usa-button--active',
  Default = '',
  Focus = 'usa-focus',
  Hover = 'usa-button--hover',
}

export enum UswdsButtonStyle {
  Base = 'usa-button--base',
  Cool = 'usa-button--accent-cool',
  Default = '',
  Inverse = 'usa-button--outline usa-button--inverse',
  Outline = 'usa-button--outline',
  Secondary = 'usa-button--secondary',
  Unstyled = 'usa-button--unstyled',
  Warm = 'usa-button--accent-warm',
}

export type ButtonProps = JSX.IntrinsicElements['button'] & {
  buttonState?: UswdsButtonState;
  disabled?: boolean;
  uswdsStyle?: UswdsButtonStyle;
};

export interface ButtonRef {
  disableButton: (state: boolean) => void;
}

const ButtonComponent = (props: ButtonProps, ref: React.Ref<ButtonRef>) => {
  const { buttonState, children, className, id, title, uswdsStyle, ...otherProps } = props;

  const [isDisabled, setIsDisabled] = useState<boolean>(!!otherProps.disabled);
  const classes = [BUTTON_BASE_CLASS];

  if (uswdsStyle) {
    classes.push(uswdsStyle);
  }
  if (buttonState) {
    classes.push(buttonState);
  }
  if (className) {
    classes.push(className);
  }

  const tabIndex = props.tabIndex ?? 0;

  function disableButton(state: boolean) {
    setIsDisabled(state);
  }

  useEffect(() => {
    setIsDisabled(!!otherProps.disabled);
  }, [otherProps.disabled]);

  useImperativeHandle(ref, () => ({
    disableButton,
  }));

  const buttonId = id ?? `button-id-${Math.floor(Math.random() * 10000)}`;
  const testId = id ?? 'test';
  return (
    <button
      {...otherProps}
      aria-disabled={isDisabled}
      className={classes.join(' ')}
      data-testid={`button-${testId}`}
      disabled={isDisabled}
      id={buttonId}
      tabIndex={tabIndex}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
};

const Button = forwardRef(ButtonComponent);

export default Button;
