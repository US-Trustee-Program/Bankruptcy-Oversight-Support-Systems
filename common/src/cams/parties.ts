import { Auditable } from './auditable';

// Chapter types supported for trustee assignments
export type ChapterType = '7' | '11' | '12' | '13';

// Trustee status enumeration
export type TrusteeStatus = 'active' | 'inactive';
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
export type LegacyAddress = {
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
};

export type TaxIds = {
  taxId?: string;
  ssn?: string;
};

export type Party = LegacyAddress &
  TaxIds & {
    name: string;
    phone?: string;
    email?: string;
    address?: Address;
  };

export type Debtor = Party;

export type DebtorAttorney = Party & {
  office?: string;
};

export type TrusteeInput = Party & {
  districts?: string[];
  chapters?: ChapterType[];
  status?: TrusteeStatus;
};

export type Trustee = Auditable &
  TrusteeInput & {
    assistant?: TrusteeAssistant;
    id?: string;
  };

export type TrusteeAssistant = Party;

export function isValidChapterType(chapter: string): chapter is ChapterType {
  return ['7', '11', '12', '13'].includes(chapter);
}

export function isValidTrusteeStatus(status: string): status is TrusteeStatus {
  return ['active', 'inactive'].includes(status);
}

export function validateTrusteeCreationFields(trustee: Partial<Trustee>): string[] {
  const errors: string[] = [];

  if (!trustee.name || trustee.name.trim() === '') {
    errors.push('Trustee name is required');
  }

  if (trustee.chapters) {
    const invalidChapters = trustee.chapters.filter((chapter) => !isValidChapterType(chapter));
    if (invalidChapters.length > 0) {
      errors.push(`Invalid chapter types: ${invalidChapters.join(', ')}`);
    }
  }

  if (trustee.status && !isValidTrusteeStatus(trustee.status)) {
    errors.push(`Invalid trustee status: ${trustee.status}`);
  }

  if (trustee.districts && trustee.districts.length === 0) {
    errors.push('Districts array cannot be empty when provided');
  }

  return errors;
}

export function createDefaultTrusteeForCreation(name: string): Partial<Trustee> {
  return {
    name,
    status: 'active',
    districts: [],
    chapters: [],
  };
}
