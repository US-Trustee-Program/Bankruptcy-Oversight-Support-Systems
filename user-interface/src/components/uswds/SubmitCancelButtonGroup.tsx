import { Component } from 'react';

interface TSubmitCancelBtnProps {
  modalId: string;
  className: string;
  submitButton: React.ReactNode;
  cancelButton: React.ReactNode;
  children: React.ReactNode;
}

interface TSubmitCancelBtnState {
  href: string;
  className: string;
}

export class SubmitCancelButtonGroup extends Component<
  TSubmitCancelBtnProps,
  TSubmitCancelBtnState
> {
  state: TSubmitCancelBtnState = {
    href: '#' + this.props.modalId,
    className: this.props.className + ' usa-button ',
  };

  render() {
    return <></>;
  }
}
