import { PropsWithChildren, useEffect, useState } from 'react';
import Button from '@/lib/components/uswds/Button';
import LocalStorage from '@/lib/utils/local-storage';
import { BlankPage } from './BlankPage';
import './AuthorizedUseOnly.scss';
import { Card, CardBody, CardFooter, CardHeading } from '@/lib/components/uswds/Card';

type AuthorizedUseOnlyProps = PropsWithChildren & {
  skip?: boolean;
};

export function AuthorizedUseOnly(props: AuthorizedUseOnlyProps) {
  const [acknowledged, setAcknowledged] = useState<boolean>(!!props.skip);
  const [isStoredInLocalStorage, setIsStoredInLocalStorage] = useState<boolean>(false);

  function onConfirm() {
    setAcknowledged(true);
  }

  useEffect(() => {
    LocalStorage.setAck(acknowledged);
    setIsStoredInLocalStorage(true);
  }, [acknowledged]);

  useEffect(() => {
    if (!props.skip) {
      setAcknowledged(LocalStorage.getAck());
    }
  }, []);

  if (acknowledged && isStoredInLocalStorage) {
    return props.children;
  }

  return (
    <BlankPage>
      <div className="authorized-use-only">
        <Card headingLevel="h1">
          <CardHeading>Warning</CardHeading>
          <CardBody>
            <div className="grid-container">
              <div className="grid-row">
                <div className="grid-col">
                  <p>
                    You are accessing a U.S. Government information system, which includes: (1) This
                    computer. (2) This computer network. (3) All computers connected to this
                    network. (4) All devices and storage media attached to this network or to a
                    computer on this network.
                  </p>
                  <p>
                    Any communications transmitted through or data stored on this information system
                    may be disclosed or used for any U.S. Government-authorized purpose. For further
                    information see the Department order on Use and Monitoring of Department
                    Computers and Computer Systems. (NIST 800-53)
                  </p>
                </div>
                <div className="grid-col">
                  <p>
                    This information system is provided for U.S. Government-authorized use only.
                    Unauthorized or improper use of this system may result in disciplinary action,
                    and civil and criminal penalties. By using this information system, you
                    understand and consent to the following:
                  </p>
                  <ul>
                    <li>
                      YOU HAVE NO REASONABLE EXPECTATION OF PRIVACY regarding any communications
                      transmitted through or data stored on this information system.
                    </li>
                    <li>
                      AT ANY TIME, THE GOVERNMENT MAY MONITOR, INTERCEPT, SEARCH AND\OR SEIZE data
                      transiting or stored on this information system.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <Button id="auo-confirm" onClick={onConfirm}>
              Confirm
            </Button>
          </CardFooter>
        </Card>
      </div>
    </BlankPage>
  );
}
