import { Auditable } from './auditable';
import { Identifiable } from './document';

// Chapter types supported for trustee assignments
export type ChapterType = '7' | '7-panel' | '7-non-panel' | '11' | '11-subchapter-v' | '12' | '13';

// Trustee status enumeration
export type TrusteeStatus = 'active' | 'not active' | 'suspended';
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
    extension?: string;
    email?: string;
    address?: Address;
  };

export type Debtor = Party;

export type DebtorAttorney = Party & {
  office?: string;
};

export type Trustee = Auditable &
  Identifiable &
  Party & {
    districts?: string[];
    chapters?: ChapterType[];
    status?: TrusteeStatus;
    assistant?: TrusteeAssistant;
  };

export type TrusteeInput = Omit<Trustee, keyof Auditable | keyof Identifiable>;

export type TrusteeAssistant = Party;

export function isValidChapterType(chapter: string): chapter is ChapterType {
  return ['7', '7-panel', '7-non-panel', '11', '11-subchapter-v', '12', '13'].includes(chapter);
}

export function isValidTrusteeStatus(status: string): status is TrusteeStatus {
  return ['active', 'not active', 'suspended'].includes(status);
}

export function validateTrusteeCreationFields(trustee: Partial<TrusteeInput>): string[] {
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

// Address validation functions
export function isValidZipCode(zipCode: string): boolean {
  // US ZIP code should be exactly 5 digits or 9 digits with a dash
  return /^(\d{5}|\d{5}-\d{4})$/.test(zipCode.trim());
}

export function validateTrusteeAddress(address: Partial<Address>): string[] {
  const errors: string[] = [];

  if (!address.address1 || address.address1.trim() === '') {
    errors.push('Address line 1 is required');
  }

  if (!address.city || address.city.trim() === '') {
    errors.push('City is required');
  }

  if (!address.state || address.state.trim() === '') {
    errors.push('State is required');
  }

  if (!address.zipCode || address.zipCode.trim() === '') {
    errors.push('ZIP code is required');
  } else if (!isValidZipCode(address.zipCode.trim())) {
    errors.push('ZIP code must be exactly 5 digits');
  }

  return errors;
}

export function validateTrusteeCreationInput(input: Partial<TrusteeInput>): string[] {
  const errors: string[] = [];

  // Validate basic trustee fields
  const trusteeErrors = validateTrusteeCreationFields(input);
  errors.push(...trusteeErrors);

  // Validate address if provided
  if (input.address) {
    const addressErrors = validateTrusteeAddress(input.address);
    errors.push(...addressErrors);
  } else {
    errors.push('Address is required');
  }

  return errors;
}
