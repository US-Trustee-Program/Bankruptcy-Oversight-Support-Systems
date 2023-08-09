import React, { Component } from 'react';

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

export interface ButtonProps {
  children: React.ReactNode;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
}

export class Button extends Component<ButtonProps & JSX.IntrinsicElements['button']> {
  private classes = ['usa-button'];
  private ariaDisabled = false;

  constructor(props: ButtonProps & JSX.IntrinsicElements['button']) {
    const { uswdsStyle, buttonState, className, disabled } = props;
    super(props);

    if (uswdsStyle) this.classes.push(uswdsStyle);
    if (buttonState) this.classes.push(buttonState);
    if (className) this.classes.push(className);

    if (disabled === true) {
      this.ariaDisabled = true;
    }
  }

  render() {
    return (
      <button
        type="button"
        className={this.classes.join(' ')}
        onClick={this.props.onClick}
        data-testid="button"
        aria-disabled={this.ariaDisabled}
      >
        {this.props.children}
      </button>
    );
  }
}

export default Button;
