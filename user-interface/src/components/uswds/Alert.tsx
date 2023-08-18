import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import './Alert.scss';
import React from 'react';

export interface AlertProps {
  message: string;
  type: UswdsAlertStyle;
  role: 'status' | 'alert';
  slim?: boolean;
  timeout?: number;
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
  show: () => void;
  hide: () => void;
}

function AlertComponent(props: AlertProps, ref: React.Ref<AlertRefType>) {
  const [isVisible, setIsVisible] = useState<IsVisible>(IsVisible.Unset);
  let classes = `usa-alert ${props.type}`;
  if (props.slim === true) classes += ' usa-alert--slim';

  function show() {
    setIsVisible(IsVisible.True);
  }

  function hide() {
    setIsVisible(IsVisible.False);
  }

  useEffect(() => {
    if (isVisible !== IsVisible.Unset && props.timeout && props.timeout > 0) {
      setTimeout(hide, props.timeout * 1000);
    }
  }, [isVisible !== IsVisible.Unset && !!props.timeout]);

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  return (
    <div
      className={`${classes} ${
        isVisible === IsVisible.True
          ? 'usa-alert__visible'
          : isVisible === IsVisible.False
          ? 'usa-alert__hidden'
          : 'usa-alert__unset'
      }`}
      role={props.role}
    >
      <div className="usa-alert__body">
        <p className="usa-alert__text">{props.message}</p>
      </div>
    </div>
  );
}

const Alert = forwardRef(AlertComponent);

export default Alert;
