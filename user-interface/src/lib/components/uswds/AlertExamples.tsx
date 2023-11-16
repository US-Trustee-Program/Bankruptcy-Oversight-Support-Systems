import { useRef } from 'react';
import Alert, { AlertRefType, UswdsAlertStyle } from './Alert';
import React from 'react';

export const UswdsAlertExamples = () => {
  const alertRef1 = useRef<AlertRefType>(null);
  const alertRef2 = useRef<AlertRefType>(null);
  const alertRef3 = useRef<AlertRefType>(null);
  const alertRef4 = useRef<AlertRefType>(null);
  const alertRef5 = useRef<AlertRefType>(null);
  alertRef1.current?.show();
  alertRef2.current?.show();
  alertRef3.current?.show();
  alertRef4.current?.show();
  alertRef5.current?.show();
  return (
    <>
      <Alert
        type={UswdsAlertStyle.Info}
        message="Info Message"
        role="status"
        slim={true}
        ref={alertRef1}
      />
      <Alert
        type={UswdsAlertStyle.Success}
        message="Success Message"
        role="status"
        slim={true}
        ref={alertRef2}
      />
      <Alert
        type={UswdsAlertStyle.Warning}
        message="Warning Message"
        role="alert"
        slim={true}
        ref={alertRef3}
      />
      <Alert
        type={UswdsAlertStyle.Error}
        message="Error Message"
        role="alert"
        slim={true}
        ref={alertRef4}
      />
      <Alert
        type={UswdsAlertStyle.Error}
        message="Error Message with timeout"
        role="alert"
        slim={true}
        timeout={4}
        ref={alertRef5}
      />
    </>
  );
};
