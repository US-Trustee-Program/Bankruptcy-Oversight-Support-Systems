import './FormattedContact.scss';
import React, { JSX } from 'react';
import {
  ContactWithPartialPhoneAndAddress,
  getPhonesToDisplay,
  normalizeContactPhones,
  PhoneNumber,
  PHONE_TYPE_LABELS,
  PhoneType,
} from '@common/cams/contact';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';

export type FormattedPhone = Partial<PhoneNumber> & { type?: PhoneType };

const formatCompanyName = (
  contact: ContactWithPartialPhoneAndAddress,
  _showLinks: boolean,
  getTestId: (s: string) => string | undefined,
): React.ReactNode | undefined => {
  const trimmedCompanyName = contact.companyName?.trim();
  if (trimmedCompanyName) {
    return (
      <div className="company-name" data-testid={getTestId('company-name')}>
        {trimmedCompanyName}
      </div>
    );
  }
};

const formatAddress = (
  contact: ContactWithPartialPhoneAndAddress,
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

const formatPhoneChild = (
  phone: FormattedPhone,
  showLinks: boolean,
  breakBeforeExtension: boolean,
): React.ReactNode => {
  if (showLinks) {
    return (
      <CommsLink
        contact={{ phone }}
        mode={'phone-dialer'}
        forceExtensionLineBreak={breakBeforeExtension}
      />
    );
  }
  if (!phone.extension) {
    return phone.number;
  }
  return breakBeforeExtension
    ? `${phone.number},\next. ${phone.extension}`
    : `${phone.number}, ext. ${phone.extension}`;
};

const formatPhones = (
  phones: FormattedPhone[],
  showLinks: boolean,
  getTestId: (s: string) => string | undefined,
  showPhoneTypeLabel: boolean,
): React.ReactNode | undefined => {
  const withNumbers = phones.filter((phone) => !!phone.number);

  if (withNumbers.length === 0) {
    return undefined;
  }

  const renderPhone = (phone: FormattedPhone) => {
    const breakBeforeExtension = showPhoneTypeLabel && !!phone.type;
    return (
      <>
        {formatPhoneChild(phone, showLinks, breakBeforeExtension)}
        {showPhoneTypeLabel && phone.type && <span>{`(${PHONE_TYPE_LABELS[phone.type]})`}</span>}
      </>
    );
  };

  if (withNumbers.length === 1) {
    const phone = withNumbers[0];
    return (
      <div key="phone" className="phone" data-testid={getTestId('phone-number')}>
        {renderPhone(phone)}
      </div>
    );
  }

  return (
    <div key="phones" className="phones" data-testid={getTestId('phones')}>
      {withNumbers.map((phone, idx) => (
        <div key={idx} className="phone" data-testid={getTestId(`phone-${idx}`)}>
          {renderPhone(phone)}
        </div>
      ))}
    </div>
  );
};

const formatEmail = (
  contact: ContactWithPartialPhoneAndAddress,
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

const formatWebsite = (
  contact: ContactWithPartialPhoneAndAddress,
  showLinks: boolean,
  getTestId: (s: string) => string | undefined,
): React.ReactNode | undefined => {
  if (contact.website) {
    return (
      <div key="website" className="website" data-testid={getTestId('website')}>
        {showLinks ? <CommsLink contact={contact} mode={'website'} /> : contact.website}
      </div>
    );
  }
};

function resolvePhones(
  phonesProp: FormattedPhone[] | undefined,
  contact: ContactWithPartialPhoneAndAddress | undefined,
  typedPhonesEnabled: boolean | undefined,
): FormattedPhone[] {
  if (phonesProp !== undefined) return phonesProp;
  if (typedPhonesEnabled !== undefined) {
    return getPhonesToDisplay(typedPhonesEnabled, normalizeContactPhones(contact));
  }
  return [];
}

export type FormattedContactProps = {
  className?: string;
  contact?: ContactWithPartialPhoneAndAddress;
  phones?: FormattedPhone[];
  typedPhonesEnabled?: boolean;
  showLinks?: boolean;
  showPhoneTypeLabel?: boolean;
  testIdPrefix?: string;
};

export default function FormattedContact(props: Readonly<FormattedContactProps>): JSX.Element {
  const {
    contact,
    phones: phonesProp,
    typedPhonesEnabled,
    className,
    showLinks = true,
    showPhoneTypeLabel = false,
    testIdPrefix,
  } = props;
  const getTestId = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined);

  const phones: FormattedPhone[] = resolvePhones(phonesProp, contact, typedPhonesEnabled);

  const hasPhones = !!phones?.some((phone) => phone.number);
  if (!contact && !hasPhones) {
    return <span data-testid={getTestId('no-contact-info')}>(none)</span>;
  }

  const children: React.ReactNode[] = [];
  if (contact) {
    const formatters = [formatCompanyName, formatAddress];
    formatters.forEach((formatter) => {
      const element = formatter(contact, showLinks, getTestId);
      if (element) {
        children.push(element);
      }
    });
  }

  const phonesElement = formatPhones(phones, showLinks, getTestId, showPhoneTypeLabel);
  if (phonesElement) {
    children.push(phonesElement);
  }

  if (contact) {
    const formatters = [formatEmail, formatWebsite];
    formatters.forEach((formatter) => {
      const element = formatter(contact, showLinks, getTestId);
      if (element) {
        children.push(element);
      }
    });
  }

  return <div className={`${className ? className + ' ' : ''}formatted-contact`}>{children}</div>;
}
