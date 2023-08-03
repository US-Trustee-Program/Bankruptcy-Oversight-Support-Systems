import { Component } from 'react';

type TModalProps = {
  className?: string;
  modalId: string;
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
        aria-labelledby="modal-3-heading"
        aria-describedby="modal-3-description"
        data-force-action
      >
        <div className="usa-modal__content">
          <div className="usa-modal__main">
            <h2 className="usa-modal__heading" id="modal-3-heading">
              Your session will end soon.
            </h2>
            <div className="usa-prose">
              <p id="modal-3-description">
                You&apos;ve been inactive for too long. Please choose to stay signed in or sign out.
                Otherwise, you&apos;ll be signed out automatically in 5 minutes.
              </p>
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
