import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button from '@/lib/components/uswds/Button';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';

import { BlankPage } from './BlankPage';
import { LOGIN_PATH } from './login-library';

const DEFAULT_MESSAGE = 'Access to this application is denied without successful authentication.';

export type AccessDeniedProps = {
  message?: string;
};

export function AccessDenied(props: AccessDeniedProps) {
  const navigator = useCamsNavigator();

  function handleLoginRedirect() {
    const { host, protocol } = window.location;
    const loginUri = protocol + '//' + host + LOGIN_PATH;
    navigator.redirectTo(loginUri);
  }

  return (
    <BlankPage>
      <Alert
        inline={true}
        message={props.message ?? DEFAULT_MESSAGE}
        show={true}
        title="Access Denied"
        type={UswdsAlertStyle.Error}
      ></Alert>
      <div>
        <Button id="return-to-login" onClick={handleLoginRedirect}>
          Login
        </Button>
      </div>
    </BlankPage>
  );
}
