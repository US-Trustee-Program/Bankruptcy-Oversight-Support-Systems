import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import { useNavigate } from 'react-router-dom';
import { LOGIN_PATH } from './login-library';
import Button from '@/lib/components/uswds/Button';

const DEFAULT_MESSAGE = 'Access to this application is denied without successful authentication.';

export type AccessDeniedProps = {
  message?: string;
};

export function AccessDenied(props: AccessDeniedProps) {
  const navigate = useNavigate();

  function handleLoginRedirect() {
    navigate(LOGIN_PATH);
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
        <Button onClick={handleLoginRedirect}>Login</Button>
      </div>
    </BlankPage>
  );
}
