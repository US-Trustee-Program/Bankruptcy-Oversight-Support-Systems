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

export type ContactWithPartialPhoneAndAddress = Omit<
  Partial<ContactInformation>,
  'address' | 'phone'
> & {
  address?: Partial<Address>;
  phone?: Partial<PhoneNumber>;
};

export type PhoneType = 'direct' | 'fax' | 'home' | 'office' | 'personalMobile' | 'workMobile';
export type TypedPhoneNumber = PhoneNumber & { type: PhoneType };

export const MAX_PHONE_NUMBERS = 20;

export const PHONE_TYPES = [
  'direct',
  'fax',
  'home',
  'office',
  'personalMobile',
  'workMobile',
] as const satisfies PhoneType[];

export const PHONE_TYPE_LABELS: Record<PhoneType, string> = {
  direct: 'Direct',
  fax: 'Fax',
  home: 'Home',
  office: 'Office',
  personalMobile: 'Personal Mobile',
  workMobile: 'Work Mobile',
};

function compareTypedPhoneNumbers(a: TypedPhoneNumber, b: TypedPhoneNumber): number {
  const typeCompare = PHONE_TYPES.indexOf(a.type) - PHONE_TYPES.indexOf(b.type);
  if (typeCompare !== 0) return typeCompare;
  const numberCompare = a.number.localeCompare(b.number);
  if (numberCompare !== 0) return numberCompare;
  return (a.extension ?? '').localeCompare(b.extension ?? '');
}

export function sortTypedPhoneNumbers(phones: TypedPhoneNumber[]): TypedPhoneNumber[] {
  return [...phones].sort(compareTypedPhoneNumbers);
}
