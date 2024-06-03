import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';

export function SessionEnd() {
  return (
    <BlankPage>
      <Alert
        show={true}
        inline={true}
        type={UswdsAlertStyle.Info}
        title="Logout"
        message="You are now logged out of the application."
      ></Alert>
      <a href="/login">Login</a>
    </BlankPage>
  );
}
