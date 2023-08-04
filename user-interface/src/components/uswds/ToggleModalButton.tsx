import { Component } from 'react';
import { ButtonProps } from './Button';

export interface ModalToggleButtonProps extends ButtonProps {
  modalState: 'open' | 'close';
  modalId: string;
}

export class ToggleModalButton extends Component<
  ModalToggleButtonProps & JSX.IntrinsicElements['button']
> {
  render() {
    const { modalState, modalId, ...props } = this.props;
    const dataProp: string[] = [];
    if (modalState === 'open') {
      dataProp.push('data-open-modal');
    } else {
      dataProp.push('data-close-modal');
    }

    return (
      <button type="button" aria-controls={modalId} {...dataProp} {...props}>
        {this.props.children}
      </button>
    );
  }
}
