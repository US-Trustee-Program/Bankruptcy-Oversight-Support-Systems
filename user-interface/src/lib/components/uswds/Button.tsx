import './Button.scss';
import React, { JSX, forwardRef, useEffect, useId, useImperativeHandle, useState } from 'react';

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

const Button_ = (props: ButtonProps, ref: React.Ref<ButtonRef>) => {
  const { id, uswdsStyle, buttonState, className, title, children, type, ...otherProps } = props;

  const [isDisabled, setIsDisabled] = useState<boolean>(!!otherProps.disabled);
  const generatedId = useId();
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

  const buttonId = id ?? `button-id-${generatedId}`;
  const testId = id ?? 'test';
  return (
    <button
      {...otherProps}
      id={buttonId}
      type={type || 'button'}
      className={classes.join(' ')}
      data-testid={`button-${testId}`}
      disabled={isDisabled}
      title={title}
      tabIndex={tabIndex}
    >
      {children}
    </button>
  );
};

const Button = forwardRef(Button_);
export default Button;
