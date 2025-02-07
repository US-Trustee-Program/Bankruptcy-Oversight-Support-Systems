import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import { LOGIN_PATH } from './login-library';
import Button from '@/lib/components/uswds/Button';

const DEFAULT_MESSAGE = 'Access to this application is denied without successful authentication.';

export type UnknownAuthErrorProps = {
  message?: string;
};

export function UnknownAuthError(props: UnknownAuthErrorProps) {
  function handleLoginRedirect() {
    const { host, protocol } = window.location;
    const loginUri = protocol + '//' + host + LOGIN_PATH;
    window.location.assign(loginUri);
  }

  return (
    <BlankPage>
      <Alert
        show={true}
        inline={true}
        type={UswdsAlertStyle.Error}
        title="Unknown Authentication Error"
        message={`${props.message ?? DEFAULT_MESSAGE} Contact Authentication Provider for more information.`}
      ></Alert>
      <div>
        <Button id="return-to-login" onClick={handleLoginRedirect}>
          Login
        </Button>
      </div>
    </BlankPage>
  );
}
