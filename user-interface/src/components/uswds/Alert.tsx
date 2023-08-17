import { forwardRef, useImperativeHandle, useState } from 'react';
import './Alert.scss';

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

export interface AlertRefType {
  show: () => void;
  hide: () => void;
}

function AlertComponent(props: AlertProps, ref: React.Ref<AlertRefType>) {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  let classes = `usa-alert ${props.type}`;
  if (props.slim === true) classes += ' usa-alert--slim';

  if (props.timeout) {
    setTimeout(hide, props.timeout * 1000);
  }

  function show() {
    setIsVisible(true);
  }

  function hide() {
    setIsVisible(false);
  }

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  return (
    <div
      className={`${classes} ${isVisible ? 'usa-alert__visible' : 'usa-alert__hidden'}`}
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
