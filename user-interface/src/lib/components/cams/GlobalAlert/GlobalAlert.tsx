import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Alert, { AlertProps, AlertRefType } from '../../uswds/Alert';
import React from 'react';

// TODO: instead of having to build props, have some convenience functions with predefined props for each alert type
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
