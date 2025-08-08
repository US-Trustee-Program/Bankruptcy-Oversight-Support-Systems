export type Person = {
  firstName: string;
  lastName: string;
  middleName?: string;
  generation?: string;
};

export type Address = {
  address1: string;
  address2?: string;
  address3?: string;
  city: string;
  state: string;
  zipCode: string;
  countryCode: 'US';
};

// represents DXTR sourced addresses
export type FlexAddress = {
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
};

export type JustName = {
  name: string;
};

type PhoneNumber = string;

export type Phone = {
  phone: PhoneNumber;
};

type EmailAddress = string;

export type Email = {
  email: EmailAddress;
};

export type TaxIds = {
  taxId?: string;
  ssn?: string;
};

export type Party = JustName & FlexAddress & TaxIds;

export type Debtor = Party;

export type DebtorAttorney = JustName &
  FlexAddress &
  Phone &
  Email & {
    office?: string;
  };

export type Trustee = JustName &
  FlexAddress &
  Phone &
  Email & {
    assistant?: TrusteeAssistant;
  };

export type TrusteeAssistant = JustName & FlexAddress & Phone & Email;
