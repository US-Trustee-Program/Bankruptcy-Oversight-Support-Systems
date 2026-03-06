import './Alert.scss';
import React, {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useImperativeHandle,
  useState,
  useId,
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
  timeout?: number;
  className?: string;
  inline?: boolean;
  show?: boolean;
  noIcon?: true;
  slim?: boolean;
  title?: string;
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
  const autoId = useId();
  const alertId = props.id || autoId;
  const [isVisible, setIsVisible] = useState<IsVisible>(
    props.show ? IsVisible.True : IsVisible.Unset,
  );
  let classes = `usa-alert ${props.type}`;
  const isInlineClass = props.inline ? `inline-alert` : '';
  const [containerClasses, setContainerClasses] = useState<string>(`${isInlineClass}`);

  if (props.slim && props.title) {
    // Slim alert with title uses compact styling for NVDA compatibility
    classes += ' usa-alert--compact-with-title';
  } else if (props.slim) {
    // Slim alert without title uses standard slim styling
    classes += ' usa-alert--slim';
  }
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

  const resolvedRole = props.role || (props.type === UswdsAlertStyle.Error ? 'alert' : 'status');

  const headingId = props.title ? `${alertId}-heading` : undefined;

  return (
    <div
      className={`usa-alert-container ${containerClasses}`}
      data-testid={`alert-container${props.id ? '-' + props.id : ''}`}
      id={props.id}
    >
      <div
        className={classes}
        role={resolvedRole}
        aria-live={resolvedRole === 'alert' ? 'assertive' : 'polite'}
        aria-labelledby={isVisible === IsVisible.True ? headingId : undefined}
        aria-atomic="true"
        data-testid={`alert${props.id ? '-' + props.id : ''}`}
      >
        {isVisible === IsVisible.True && (
          <div className="usa-alert__body">
            {props.title && (
              <h4 className="usa-alert__heading" id={headingId}>
                {props.title}
              </h4>
            )}
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
        )}
      </div>
    </div>
  );
}

const Alert = forwardRef(Alert_);
export default Alert;
