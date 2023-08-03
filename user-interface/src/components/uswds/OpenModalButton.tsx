import { Component, MouseEventHandler } from 'react';

type TOpenModalButtonProps = {
  modalId: string;
  className: string;
  onClick: MouseEventHandler<HTMLAnchorElement>;
};

type TOpenModalButtonState = {
  href: string;
  className: string;
};

export class OpenModalButton extends Component<TOpenModalButtonProps, TOpenModalButtonState> {
  state: TOpenModalButtonState = {
    href: '#' + this.props.modalId,
    className: this.props.className + ' usa-button ',
  };

  render() {
    return (
      <a
        href={this.state.href}
        className={this.state.className}
        aria-controls={this.props.modalId}
        data-open-modal
        onClick={this.props.onClick}
      >
        Open modal
      </a>
    );
  }
}
