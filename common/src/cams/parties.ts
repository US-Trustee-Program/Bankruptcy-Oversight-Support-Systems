/*
 * Party has a history of being influenced by the DXTR data model.
 */

// LegacyAddress represents DXTR sourced addresses
export type LegacyAddress = {
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
};

type TaxIds = {
  taxId?: string;
  ssn?: string;
};

export type Party = LegacyAddress & {
  name: string;
  phoneticTokens?: string[];
  phone?: string;
  extension?: string;
  email?: string;
};

export type Debtor = Party & TaxIds;

export type DebtorAttorney = Party & {
  office?: string;
};

export type LegacyTrustee = {
  name: string;
  legacy?: LegacyAddress & {
    phone?: string;
    email?: string;
  };
};
