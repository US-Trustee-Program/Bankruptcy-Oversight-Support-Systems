export type Person = {
  firstName: string;
  lastName: string;
  middleName?: string;
  generation?: string;
};

export type PhoneNumber = {
  number: string;
  extension?: string;
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

export type ContactInformation = {
  address: Address;
  phone?: PhoneNumber;
  email?: string;
  website?: string;
  companyName?: string;
};
