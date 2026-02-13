import './FormattedContact.scss';
import { LegacyAddress } from '@common/cams/parties';
import { JSX } from 'react';
import EmailLink from './EmailLink';
import CommsLink from './CommsLink/CommsLink';
import { parsePhoneNumber } from '@common/phone-helper';

export type LegacyFormattedContactProps = {
  className?: string;
  legacy?: LegacyAddress & {
    phone?: string;
    email?: string;
  };
  emailAsLink?: boolean;
  testIdPrefix?: string;
  emailSubject?: string;
};

export default function LegacyFormattedContact(props: LegacyFormattedContactProps): JSX.Element {
  const { legacy, className, emailAsLink = true, testIdPrefix, emailSubject } = props;

  const getTestId = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined);

  if (!legacy) {
    return <>(none)</>;
  }

  const parts: React.ReactNode[] = [];

  // Handle legacy address format
  if (legacy.address1 || legacy.address2 || legacy.address3 || legacy.cityStateZipCountry) {
    const addressParts: React.ReactNode[] = [];

    if (legacy.address1) {
      addressParts.push(
        <div key="address1" className="address1" data-testid={getTestId('address1')}>
          {legacy.address1}
        </div>,
      );
    }
    if (legacy.address2) {
      addressParts.push(
        <div key="address2" className="address2" data-testid={getTestId('address2')}>
          {legacy.address2}
        </div>,
      );
    }
    if (legacy.address3) {
      addressParts.push(
        <div key="address3" className="address3" data-testid={getTestId('address3')}>
          {legacy.address3}
        </div>,
      );
    }
    if (legacy.cityStateZipCountry) {
      addressParts.push(
        <div
          key="city-state-zip"
          className="city-state-zip"
          data-testid={getTestId('city-state-zip')}
        >
          {legacy.cityStateZipCountry}
        </div>,
      );
    }
    parts.push(
      <div key="address" className="address">
        {addressParts}
      </div>,
    );
  }

  // Handle legacy phone format (simple string)
  if (legacy.phone) {
    const parsedPhone = parsePhoneNumber(legacy.phone);
    parts.push(
      <div key="phone" className="phone" data-testid={getTestId('phone-number')}>
        <CommsLink contact={{ phone: parsedPhone }} mode="phone-dialer" />
      </div>,
    );
  }

  // Handle email
  if (legacy.email) {
    if (emailAsLink) {
      parts.push(
        <EmailLink
          key="email"
          email={legacy.email}
          className="email"
          data-testid={getTestId('email')}
          subject={emailSubject}
        />,
      );
    } else {
      parts.push(
        <div key="email" className="email" data-testid={getTestId('email')}>
          {legacy.email}
        </div>,
      );
    }
  }

  return <div className={`${className ? className + ' ' : ''}formatted-address`}>{parts}</div>;
}
