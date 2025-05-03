import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import React from 'react';

import Alert, { AlertProps, AlertRefType, UswdsAlertStyle } from '../../uswds/Alert';

export type GlobalAlertRef = {
  error: (message: string) => void;
  info: (message: string) => void;
  show: (props: AlertProps) => void;
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
    show({ message, timeout, type: UswdsAlertStyle.Error });
  }

  function info(message: string) {
    show({ message, timeout, type: UswdsAlertStyle.Info });
  }

  function success(message: string) {
    show({ message, timeout, type: UswdsAlertStyle.Success });
  }

  function warning(message: string) {
    show({ message, timeout: 8, type: UswdsAlertStyle.Warning });
  }

  useImperativeHandle(ref, () => ({
    error,
    info,
    show,
    success,
    warning,
  }));

  return <Alert {...state} ref={alertRef} />;
}

const GlobalAlert = forwardRef(_GlobalAlert);

export default GlobalAlert;
