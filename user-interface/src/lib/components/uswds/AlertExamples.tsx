import { useRef } from 'react';

import Alert, { AlertRefType, UswdsAlertStyle } from './Alert';

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
        message="Info Message"
        ref={alertRef1}
        role="status"
        slim={true}
        type={UswdsAlertStyle.Info}
      />
      <Alert
        message="Success Message"
        ref={alertRef2}
        role="status"
        slim={true}
        type={UswdsAlertStyle.Success}
      />
      <Alert
        message="Warning Message"
        ref={alertRef3}
        role="alert"
        slim={true}
        type={UswdsAlertStyle.Warning}
      />
      <Alert
        message="Error Message"
        ref={alertRef4}
        role="alert"
        slim={true}
        type={UswdsAlertStyle.Error}
      />
      <Alert
        message="Error Message with timeout"
        ref={alertRef5}
        role="alert"
        slim={true}
        timeout={4}
        type={UswdsAlertStyle.Error}
      />
    </>
  );
};
