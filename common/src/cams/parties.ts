export type Person = {
  firstName: string;
  lastName: string;
  middleName?: string;
  generation?: string;
};

export type Party = {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  taxId?: string;
  ssn?: string;
};

export type Debtor = Party;

export type DebtorAttorney = Omit<Party, 'taxId' | 'ssn'> & {
  phone?: string;
  email?: string;
  office?: string;
};
