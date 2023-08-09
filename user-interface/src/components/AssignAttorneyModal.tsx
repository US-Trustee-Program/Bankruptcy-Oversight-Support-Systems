import { SubmitCancelButtonGroup, TSubmitCancelBtnProps } from './uswds/SubmitCancelButtonGroup';
import { UswdsButtonStyle } from './uswds/Button';
import useGlobalKeyDown from '../hooks/UseGlobalKeyDown';
import { useEffect } from 'react';
import { ObjectKeyVal } from '../type-declarations/basic';

type TModalProps = {
  className?: string;
  modalId: string;
  heading: string;
  content: React.ReactNode;
  actionButtonGroup: TSubmitCancelBtnProps;
  hide: () => void;
  isVisible: boolean;
  forceAction?: boolean;
};

export const AssignAttorneyModal: React.FC<TModalProps> = ({
  className,
  modalId,
  heading,
  content,
  actionButtonGroup,
  hide,
  isVisible,
  forceAction,
}: TModalProps) => {
  const data = {
    'data-force-action': false,
  };

  const classes = ['usa-modal'];
  if (className) {
    className.split(' ').forEach((cls) => {
      classes.push(cls);
    });
  }

  if (forceAction) {
    data['data-force-action'] = true;
  }

  useGlobalKeyDown(handleKeyDown, { forceAction: !!forceAction });

  useEffect(() => {
    // This will run whenever someValue changes
    console.log('isVisible changed:', isVisible);

    // You can perform any additional logic here based on the updated value
    // For example, update the component's state, trigger other functions, etc.
  }, [isVisible]); // Watch the someValue prop for changes

  const close = (e: MouseEvent | React.MouseEvent | KeyboardEvent | React.KeyboardEvent) => {
    hide();
    e.preventDefault();
  };

  function submitBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (actionButtonGroup.submitButton.onClick) {
      actionButtonGroup.submitButton.onClick(e);
    }
    close(e);
  }

  function cancelBtnClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (actionButtonGroup.cancelButton?.onClick) {
      actionButtonGroup.cancelButton.onClick(e);
    }
    close(e);
  }

  function outsideClick(e: React.MouseEvent<HTMLDivElement>, id: string) {
    if (!forceAction) {
      const clickedElement = e.target as HTMLElement;
      if (clickedElement.id === id) {
        close(e);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent, state: ObjectKeyVal) {
    if (!state.forceAction) {
      if (e.key === 'Escape') {
        close(e);
      }
    }
  }

  return (
    <div
      className={`usa-modal-wrapper ${isVisible ? 'is-visible' : 'is-hidden'}`}
      role="dialog"
      id={modalId + '-wrapper'}
      aria-labelledby={modalId + '-heading'}
      aria-describedby={modalId + '-description'}
    >
      <div
        className="usa-modal-overlay"
        aria-controls={modalId}
        id={modalId + '-overlay'}
        onClick={(e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
          outsideClick(e, modalId + '-overlay')
        }
      >
        <div
          className={classes.join(' ')}
          id={modalId}
          aria-labelledby={modalId + '-heading'}
          aria-describedby={modalId + '-description'}
          {...data}
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              <h2 className="usa-modal__heading" id={modalId + '-heading'}>
                {heading}
              </h2>
              <div className="usa-prose">
                <section id={modalId + '-description'}>{content}</section>
              </div>
              <div className="usa-modal__footer">
                <SubmitCancelButtonGroup
                  modalId={modalId}
                  submitButton={{
                    label: actionButtonGroup.submitButton.label,
                    onClick: submitBtnClick,
                    className: actionButtonGroup.submitButton.className ?? '',
                    uswdsStyle:
                      actionButtonGroup.submitButton.uswdsStyle ?? UswdsButtonStyle.Default,
                  }}
                  cancelButton={{
                    label: actionButtonGroup.cancelButton?.label ?? '',
                    onClick: cancelBtnClick,
                    className: actionButtonGroup.cancelButton?.className ?? '',
                    uswdsStyle:
                      actionButtonGroup.cancelButton?.uswdsStyle ?? UswdsButtonStyle.Unstyled,
                  }}
                ></SubmitCancelButtonGroup>
              </div>
            </div>
            {forceAction || (
              <button
                type="button"
                className="usa-button usa-modal__close"
                aria-label="Close this window"
                data-close-modal
                onClick={close}
              >
                <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
                  <use xlinkHref="/node_modules/@uswds/uswds/dist/img/sprite.svg#close"></use>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
