import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Alert, { AlertProps, AlertRefType, UswdsAlertStyle } from '../../uswds/Alert';
import React from 'react';

export type GlobalAlertRef = {
  show: (props: AlertProps) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
};

export function _GlobalAlert(props: AlertProps, ref: React.Ref<GlobalAlertRef>) {
  const timeout = 8;

  const [state, setState] = useState<AlertProps>(props);
  const alertRef = useRef<AlertRefType>(null);

  function show(props: AlertProps) {
    setState(props);
    alertRef.current?.show();
  }

  function error(message: string) {
    show({ message, type: UswdsAlertStyle.Error, timeout });
  }

  function info(message: string) {
    show({ message, type: UswdsAlertStyle.Info, timeout });
  }

  function success(message: string) {
    show({ message, type: UswdsAlertStyle.Success, timeout });
  }

  function warning(message: string) {
    show({ message, type: UswdsAlertStyle.Warning, timeout: 8 });
  }

  useImperativeHandle(ref, () => ({
    show,
    error,
    info,
    success,
    warning,
  }));

  return <Alert {...state} ref={alertRef} />;
}

const GlobalAlert = forwardRef(_GlobalAlert);

export default GlobalAlert;
