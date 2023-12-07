import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import './Alert.scss';
import React from 'react';

export interface AlertProps {
  message: string;
  type: UswdsAlertStyle;
  role: 'status' | 'alert';
  slim?: boolean;
  timeout?: number;
  title?: string;
  className?: string;
  inline?: boolean;
}

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

export interface AlertRefType {
  show: (inline?: boolean) => void;
  hide: () => void;
}

function AlertComponent(props: AlertProps, ref: React.Ref<AlertRefType>) {
  const [isVisible, setIsVisible] = useState<IsVisible>(IsVisible.Unset);
  let classes = `usa-alert ${props.type}`;
  const isInlineClass = props.inline ? `inline-alert` : '';
  const [containerClasses, setContainerClasses] = useState<string>(`${isInlineClass}`);

  if (props.slim === true) classes += ' usa-alert--slim';

  function show() {
    setIsVisible(IsVisible.True);
  }

  function hide() {
    setIsVisible(IsVisible.False);
  }

  useEffect(() => {
    if (isVisible === IsVisible.True) {
      setContainerClasses(`${isInlineClass} visible`);
      if (!!props.timeout && props.timeout > 0) {
        setTimeout(hide, props.timeout * 1000);
      }
    } else {
      setContainerClasses(isInlineClass);
    }
  }, [isVisible === IsVisible.True]);

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  return (
    <div className={`usa-alert-container ${containerClasses}`} data-testid={'alert-container'}>
      <div
        className={`${classes} ${
          isVisible === IsVisible.True
            ? 'usa-alert__visible'
            : isVisible === IsVisible.False
              ? 'usa-alert__hidden'
              : 'usa-alert__unset'
        }`}
        role={props.role}
        data-testid={`alert`}
      >
        <div className="usa-alert__body">
          {props.title && <h4 className="usa-alert__heading">{props.title}</h4>}
          <p className="usa-alert__text" data-testid="alert-message">
            {props.message}
          </p>
        </div>
      </div>
    </div>
  );
}

const Alert = forwardRef(AlertComponent);

export default Alert;
