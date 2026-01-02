import './Alert.scss';
import React, {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

export type AlertDetails = {
  message: string;
  title?: string;
  type: UswdsAlertStyle;
  timeOut: number;
};

export type AlertProps = PropsWithChildren & {
  id?: string;
  message?: string;
  type: UswdsAlertStyle;
  role?: 'status' | 'alert';
  slim?: boolean;
  timeout?: number;
  title?: string;
  className?: string;
  inline?: boolean;
  show?: boolean;
  noIcon?: true;
};

export enum UswdsAlertStyle {
  Info = 'usa-alert--info',
  Warning = 'usa-alert--warning',
  Error = 'usa-alert--error',
  Success = 'usa-alert--success',
}

enum IsVisible {
  True = 1,
  False = 0,
  Unset = -1,
}

export type AlertRefType = {
  show: (inline?: boolean) => void;
  hide: () => void;
};

function Alert_(props: AlertProps, ref: React.Ref<AlertRefType>) {
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
    show,
    hide,
  }));

  return (
    <div
      className={`usa-alert-container ${containerClasses}`}
      data-testid={`alert-container${props.id ? '-' + props.id : ''}`}
      id={props.id}
    >
      <div
        className={`${classes} ${
          isVisible === IsVisible.True
            ? 'usa-alert__visible'
            : isVisible === IsVisible.False
              ? 'usa-alert__hidden'
              : 'usa-alert__unset'
        }`}
        role={props.role}
        aria-live={props.role === 'alert' ? 'assertive' : 'polite'}
        data-testid={`alert${props.id ? '-' + props.id : ''}`}
      >
        <div className="usa-alert__body">
          {props.title && <h4 className="usa-alert__heading">{props.title}</h4>}
          {!!props.message && (
            <p
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

const Alert = forwardRef(Alert_);
export default Alert;
