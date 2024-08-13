import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Alert, { AlertProps, AlertRefType } from '../../uswds/Alert';
import React from 'react';

export type GlobalAlertRef = {
  show: (props: AlertProps) => void;
};

export function _GlobalAlert(props: AlertProps, ref: React.Ref<GlobalAlertRef>) {
  const [state, setState] = useState<AlertProps>(props);
  const alertRef = useRef<AlertRefType>(null);

  function show(props: AlertProps) {
    setState(props);
    alertRef.current?.show();
  }

  useImperativeHandle(ref, () => ({
    show,
  }));

  return <Alert {...state} ref={alertRef} />;
}

const GlobalAlert = forwardRef(_GlobalAlert);

export default GlobalAlert;
