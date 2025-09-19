import './FormattedAddress.scss';
import { ContactInformation } from '@common/cams/contact';
import { JSX } from 'react';
import EmailLink from './EmailLink';

export type FormattedAddressProps = {
  className?: string;
  contact?: ContactInformation;
  showLinks?: boolean;
  testIdPrefix?: string;
};

export default function FormattedAddress(props: Readonly<FormattedAddressProps>): JSX.Element {
  const { contact, className, showLinks = true, testIdPrefix } = props;

  const getTestId = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined);

  if (!contact) {
    return <>(none)</>;
  }

  const parts: React.ReactNode[] = [];

  if (contact.address) {
    const addressParts: React.ReactNode[] = [];
    const { address } = contact;
    if (address.address1) {
      addressParts.push(
        <div key="address1" className="address1" data-testid={getTestId('street-address')}>
          {address.address1}
        </div>,
      );
    }
    if (address.address2) {
      addressParts.push(
        <div key="address2" className="address2" data-testid={getTestId('street-address-line-2')}>
          {address.address2}
        </div>,
      );
    }
    if (address.address3) {
      addressParts.push(
        <div key="address3" className="address3" data-testid={getTestId('street-address-line-3')}>
          {address.address3}
        </div>,
      );
    }
    if (address.city || address.state || address.zipCode) {
      addressParts.push(
        <div key="city-state-zip" className="city-state-zip">
          <span data-testid={getTestId('city')}>{address.city}</span>
          <span data-testid={getTestId('state')}>{address.state ? `, ${address.state}` : ''}</span>
          <span data-testid={getTestId('zip-code')}>
            {address.zipCode ? ` ${address.zipCode}` : ''}
          </span>
        </div>,
      );
    }
    parts.push(
      <div key="address" className="address">
        {addressParts}
      </div>,
    );
  }

  if (contact.phone?.number) {
    const phone = contact.phone.extension
      ? `${contact.phone.number} x${contact.phone.extension}`
      : contact.phone.number;
    parts.push(
      <div key="phone" className="phone" data-testid={getTestId('phone-number')}>
        {phone}
      </div>,
    );
  }

  if (contact.email) {
    if (showLinks) {
      parts.push(
        <EmailLink
          key="email"
          email={contact.email}
          className="email"
          data-testid={getTestId('email')}
        />,
      );
    } else {
      parts.push(
        <div key="email" className="email" data-testid={getTestId('email')}>
          {contact.email}
        </div>,
      );
    }
  }

  return <div className={`${className ? className + ' ' : ''}formatted-address`}>{parts}</div>;
}
