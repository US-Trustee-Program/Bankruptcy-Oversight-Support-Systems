import { ButtonProps, UswdsButtonState, UswdsButtonStyle } from './Button';
import { ObjectKeyVal } from '../../type-declarations/basic';
import { Component } from 'react';

export interface ModalToggleButtonProps {
  children: React.ReactNode;
  uswdsStyle?: UswdsButtonStyle;
  buttonState?: UswdsButtonState;
  disabled?: boolean;
  toggleAction: 'open' | 'close';
  modalId: string;
}

export class ToggleModalButton extends Component<
  ModalToggleButtonProps & JSX.IntrinsicElements['button']
> {
  private dataProp: ObjectKeyVal = {};
  private modalId: string;
  private classes = ['usa-button'];
  private ariaDisabled = false;

  constructor(props: ModalToggleButtonProps & ButtonProps & JSX.IntrinsicElements['button']) {
    const { toggleAction, modalId, uswdsStyle, buttonState, className, disabled } = props;
    super(props);

    if (toggleAction === 'open') {
      this.dataProp['data-open-modal'] = 'true';
    } else {
      this.dataProp['data-close-modal'] = 'true';
    }

    this.modalId = modalId;

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
        aria-controls={this.modalId}
        className={this.classes.join(' ')}
        onClick={this.props.onClick}
        data-testid="button"
        aria-disabled={this.ariaDisabled}
        {...this.dataProp}
      >
        {this.props.children}
      </button>
    );
  }
}
