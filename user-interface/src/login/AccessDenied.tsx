import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import { useNavigate } from 'react-router-dom';
import { LOGIN_PATH } from './login-helpers';
import Button from '@/lib/components/uswds/Button';

export function AccessDenied() {
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
        message="Access to this application is denied without successful authentication."
      ></Alert>
      <div>
        <Button onClick={handleLoginRedirect}>Login</Button>
      </div>
    </BlankPage>
  );
}
