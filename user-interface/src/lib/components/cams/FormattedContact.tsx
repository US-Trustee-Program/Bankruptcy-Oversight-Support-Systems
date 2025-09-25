import './FormattedContact.scss';
import React, { JSX } from 'react';
import { ContactInformation } from '@common/cams/contact';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';

const formatAddress = (
  contact: ContactInformation,
  _showLinks: boolean,
  getTestId: (s: string) => string | undefined,
): React.ReactNode | undefined => {
  const children: React.ReactNode[] = [];
  const { address } = contact;

  if (!address) {
    return;
  }

  if (address.address1) {
    children.push(
      <div key="address1" className="address1" data-testid={getTestId('street-address')}>
        {address.address1}
      </div>,
    );
  }
  if (address.address2) {
    children.push(
      <div key="address2" className="address2" data-testid={getTestId('street-address-line-2')}>
        {address.address2}
      </div>,
    );
  }
  if (address.address3) {
    children.push(
      <div key="address3" className="address3" data-testid={getTestId('street-address-line-3')}>
        {address.address3}
      </div>,
    );
  }
  if (address.city || address.state || address.zipCode) {
    children.push(
      <div key="city-state-zip" className="city-state-zip">
        <span data-testid={getTestId('city')}>{address.city}</span>
        <span data-testid={getTestId('state')}>{address.state ? `, ${address.state}` : ''}</span>
        <span data-testid={getTestId('zip-code')}>
          {address.zipCode ? ` ${address.zipCode}` : ''}
        </span>
      </div>,
    );
  }
  return (
    <div key="address" className="address">
      {children}
    </div>
  );
};

const formatPhone = (
  contact: ContactInformation,
  showLinks: boolean,
  getTestId: (s: string) => string | undefined,
): React.ReactNode | undefined => {
  if (contact.phone?.number) {
    let child;
    if (showLinks) {
      child = <CommsLink contact={contact} mode={'phone-dialer'} />;
    } else {
      child = contact.phone?.extension
        ? `${contact.phone.number}, ext. ${contact.phone.extension}`
        : contact.phone.number;
    }
    return (
      <div key="phone" className="phone" data-testid={getTestId('phone-number')}>
        {child}
      </div>
    );
  }
};

const formatEmail = (
  contact: ContactInformation,
  showLinks: boolean,
  getTestId: (s: string) => string | undefined,
): React.ReactNode | undefined => {
  if (contact.email) {
    return (
      <div key="email" className="email" data-testid={getTestId('email')}>
        {showLinks ? <CommsLink contact={contact} mode={'email'} /> : contact.email}
      </div>
    );
  }
};

export type FormattedContactProps = {
  className?: string;
  contact?: ContactInformation;
  showLinks?: boolean;
  testIdPrefix?: string;
};

export default function FormattedContact(props: Readonly<FormattedContactProps>): JSX.Element {
  const { contact, className, showLinks = true, testIdPrefix } = props;

  if (!contact) {
    return <>(none)</>;
  }

  const formatters = [formatAddress, formatPhone, formatEmail];
  const getTestId = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined);

  const children = formatters.reduce((acc, formatter) => {
    const element = formatter(contact, showLinks, getTestId);
    if (element) {
      acc.push(element);
    }
    return acc;
  }, [] as React.ReactNode[]);

  return <div className={`${className ? className + ' ' : ''}formatted-address`}>{children}</div>;
}
