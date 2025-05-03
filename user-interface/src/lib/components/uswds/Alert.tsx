import './Alert.scss';
import React, {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

export enum UswdsAlertStyle {
  Error = 'usa-alert--error',
  Info = 'usa-alert--info',
  Success = 'usa-alert--success',
  Warning = 'usa-alert--warning',
}

enum IsVisible {
  False = 0,
  True = 1,
  Unset = -1,
}

export type AlertDetails = {
  message: string;
  timeOut: number;
  title?: string;
  type: UswdsAlertStyle;
};

export type AlertProps = PropsWithChildren & {
  className?: string;
  id?: string;
  inline?: boolean;
  message?: string;
  noIcon?: true;
  role?: 'alert' | 'status';
  show?: boolean;
  slim?: boolean;
  timeout?: number;
  title?: string;
  type: UswdsAlertStyle;
};

export type AlertRefType = {
  hide: () => void;
  show: (inline?: boolean) => void;
};

function AlertComponent(props: AlertProps, ref: React.Ref<AlertRefType>) {
  const [isVisible, setIsVisible] = useState<IsVisible>(
    props.show ? IsVisible.True : IsVisible.Unset,
  );
  let classes = `usa-alert ${props.type}`;
  const isInlineClass = props.inline ? `inline-alert` : '';
  const [containerClasses, setContainerClasses] = useState<string>(`${isInlineClass}`);

  if (props.slim) classes += ' usa-alert--slim';
  if (props.noIcon) classes += ' usa-alert--no-icon';

  function show() {
    setIsVisible(IsVisible.True);
  }

  function hide() {
    setIsVisible(IsVisible.False);
  }

  useEffect(() => {
    const classNames = props.className ?? '';
    if (isVisible === IsVisible.True) {
      setContainerClasses(`${classNames} ${isInlineClass} visible`);
      if (!!props.timeout && props.timeout > 0) {
        setTimeout(hide, props.timeout * 1000);
      }
    } else {
      setContainerClasses(`${classNames} ${isInlineClass}`);
    }
  }, [isVisible === IsVisible.True]);

  useImperativeHandle(ref, () => ({
    hide,
    show,
  }));

  return (
    <div
      className={`usa-alert-container ${containerClasses}`}
      data-testid={`alert-container${props.id ? '-' + props.id : ''}`}
      id={props.id}
      role="alert"
    >
      <div
        aria-live={props.role === 'alert' ? 'assertive' : 'polite'}
        className={`${classes} ${
          isVisible === IsVisible.True
            ? 'usa-alert__visible'
            : isVisible === IsVisible.False
              ? 'usa-alert__hidden'
              : 'usa-alert__unset'
        }`}
        data-testid={`alert${props.id ? '-' + props.id : ''}`}
        role={props.role}
      >
        <div className="usa-alert__body">
          {props.title && <h4 className="usa-alert__heading">{props.title}</h4>}
          {!!props.message && (
            <p
              aria-label={props.message}
              className="usa-alert__text"
              data-testid={`alert-message${props.id ? '-' + props.id : ''}`}
            >
              {props.message}
            </p>
          )}
          {!props.message && props.children}
        </div>
      </div>
    </div>
  );
}

const Alert = forwardRef(AlertComponent);

export default Alert;
