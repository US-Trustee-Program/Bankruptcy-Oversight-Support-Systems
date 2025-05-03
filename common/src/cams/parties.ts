export type Debtor = Party;

export type DebtorAttorney = Omit<Party, 'ssn' | 'taxId'> & {
  email?: string;
  office?: string;
  phone?: string;
};

export type Party = {
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  name: string;
  ssn?: string;
  taxId?: string;
};

export type Person = {
  firstName: string;
  generation?: string;
  lastName: string;
  middleName?: string;
};
