import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';

export function AccessDenied() {
  return (
    <BlankPage>
      <Alert
        data-testid="access-denied-alert"
        show={true}
        inline={true}
        type={UswdsAlertStyle.Error}
        title="Access Denied"
        message="You are not listed in Active Directory. Please try to login again."
      ></Alert>
      <a href="/login">Login</a>
    </BlankPage>
  );
}
