import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import { LOGIN_PATH } from './login-library';
import Button from '@/lib/components/uswds/Button';

const DEFAULT_MESSAGE = 'Access to this application is denied without successful authentication.';

export type AccessDeniedProps = {
  message?: string;
};

export function AccessDenied(props: AccessDeniedProps) {
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
        title="Access Denied"
        message={props.message ?? DEFAULT_MESSAGE}
      ></Alert>
      <div>
        <Button id="return-to-login" onClick={handleLoginRedirect}>
          Login
        </Button>
      </div>
    </BlankPage>
  );
}
