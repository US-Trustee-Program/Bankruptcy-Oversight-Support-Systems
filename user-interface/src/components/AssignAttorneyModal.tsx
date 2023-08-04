import { Component } from 'react';

type TModalProps = {
  className?: string;
  modalId: string;
  heading: string;
  content: React.ReactNode;
  actionButtonGroup: React.ReactNode;
};

type TModalState = {
  className: string;
};

export class AssignAttorneyModal extends Component<TModalProps, TModalState> {
  state: TModalState = {
    className: this.props.className ? this.props.className + ' usa-modal' : ' usa-modal',
  };

  render() {
    return (
      <div
        className={this.state.className}
        id={this.props.modalId}
        aria-labelledby={this.props.modalId + '-heading'}
        aria-describedby={this.props.modalId + '-description'}
        data-force-action
      >
        <div className="usa-modal__content">
          <div className="usa-modal__main">
            <h2 className="usa-modal__heading" id={this.props.modalId + '-heading'}>
              {this.props.heading}
            </h2>
            <div className="usa-prose">
              <section id={this.props.modalId + '-description'}>{this.props.content}</section>
            </div>
            <div className="usa-modal__footer">
              <ul className="usa-button-group">
                <li className="usa-button-group__item">
                  <button type="button" className="usa-button" data-close-modal>
                    Yes, stay signed in
                  </button>
                </li>
                <li className="usa-button-group__item">
                  <button
                    type="button"
                    className="usa-button usa-button--unstyled padding-105 text-center"
                    data-close-modal
                  >
                    Sign out
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
