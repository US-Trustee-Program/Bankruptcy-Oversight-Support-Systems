import { PropsWithChildren, useEffect, useState } from 'react';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import Button from '@/lib/components/uswds/Button';
import { LOGIN_LOCAL_STORAGE_ACK_KEY } from './login-helpers';
import './AuthorizedUseOnly.scss';

export type AuthorizedUseOnlyProps = PropsWithChildren & {
  skip?: boolean;
};

export function AuthorizedUseOnly(props: AuthorizedUseOnlyProps) {
  const [acknowledged, setAcknowledged] = useState<boolean>(!!props.skip);
  const [isStoredInLocalStorage, setIsStoredInLocalStorage] = useState<boolean>(false);

  function onConfirm() {
    setAcknowledged(true);
  }

  useEffect(() => {
    if (window.localStorage && acknowledged) {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_ACK_KEY, 'true');
    }
    setIsStoredInLocalStorage(true);
  }, [acknowledged]);

  useEffect(() => {
    if (window.localStorage) {
      const value = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
      if (value === 'true') {
        setAcknowledged(true);
      }
    }
  }, []);

  if (acknowledged && isStoredInLocalStorage) return props.children;

  return (
    <BlankPage>
      <Alert
        data-testid="authorized-use-only-alert"
        className="measure-6"
        show={true}
        inline={true}
        type={UswdsAlertStyle.Warning}
        title="WARNING"
      >
        <p>You are accessing a U.S. Government information system, which includes:</p>
        <ol className="parenthesized">
          <li>This computer.</li>
          <li>This computer network.</li>
          <li>All computers connected to this network.</li>
          <li>
            All devices and storage media attached to this network or to a computer on this network.
          </li>
        </ol>
        <p>
          This information system is provided for U.S. Government-authorized use only. Unauthorized
          or improper use of this system may result in disciplinary action, and civil and criminal
          penalties. By using this information system, you understand and consent to the following:
        </p>
        <p>
          - YOU HAVE NO REASONABLE EXPECTATION OF PRIVACY regarding any communications transmitted
          through or data stored on this information system.
        </p>
        <p>
          - AT ANY TIME, THE GOVERNMENT MAY MONITOR, INTERCEPT, SEARCH AND\OR SEIZE data transiting
          or stored on this information system.
        </p>
        <p>
          Any communications transmitted through or data stored on this information system may be
          disclosed or used for any U.S. Government-authorized purpose. For further information see
          the Department order on Use and Monitoring of Department Computers and Computer Systems.
          (NIST 800-53)
        </p>
      </Alert>
      <div>
        <Button onClick={onConfirm}>Confirm</Button>
      </div>
    </BlankPage>
  );
}
