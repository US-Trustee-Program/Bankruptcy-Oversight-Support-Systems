/**
 * Shared utilities for test data generation across scenario scripts
 */

import { faker } from '@faker-js/faker';
import { generateSearchTokens } from './phonetic-tokens.js';

/**
 * Generates a fake US phone number in the format ###-###-####
 * Matches the PHONE_REGEX pattern required for clickable tel: links in the UI
 *
 * @returns A phone number string in format ###-###-####
 * @example
 * fakeUsPhoneNumber() // "212-555-0123"
 */
export function fakeUsPhoneNumber(): string {
  return `${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(4)}`;
}

/**
 * Creates a debtor object with phoneticTokens for fuzzy search support
 * Use this helper when creating SYNCED_CASE documents to ensure consistent debtor structure
 *
 * IMPORTANT: All debtors and jointDebtors MUST include phoneticTokens for fuzzy search to work.
 * Type: common/src/cams/parties.ts -> Debtor
 *
 * @param name - Full debtor name (e.g., "Smith, John" or "Acme Corporation")
 * @param opts - Optional debtor details (address, city, state, zip, taxId, ssn, phone, email)
 * @returns Debtor object with name, phoneticTokens, and address fields
 * @example
 * // Individual debtor with full address
 * createDebtor('Smith, John', {
 *   address1: '123 Main St',
 *   city: 'New York',
 *   state: 'NY',
 *   zip: '10001'
 * })
 *
 * // Corporate debtor with minimal info
 * createDebtor('Acme Corporation')
 */
export function createDebtor(
  name: string,
  opts?: {
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    zip?: string;
    taxId?: string;
    ssn?: string;
    phone?: string;
    email?: string;
  },
) {
  const cityStateZip =
    opts?.city && opts?.state && opts?.zip
      ? `${opts.city}, ${opts.state} ${opts.zip}`
      : opts?.city && opts?.state
        ? `${opts.city}, ${opts.state}`
        : undefined;

  return {
    name,
    phoneticTokens: generateSearchTokens(name),
    address1: opts?.address1,
    address2: opts?.address2,
    address3: opts?.address3,
    cityStateZipCountry: cityStateZip,
    taxId: opts?.taxId,
    ssn: opts?.ssn,
    phone: opts?.phone,
    email: opts?.email,
  };
}

/**
 * Creates a jointDebtor object with phoneticTokens for fuzzy search support
 * Use this helper when creating SYNCED_CASE documents with joint filers
 *
 * IMPORTANT: All jointDebtors MUST include phoneticTokens for fuzzy search to work.
 * Type: common/src/cams/parties.ts -> Debtor (jointDebtor is same type as debtor)
 *
 * @param name - Full joint debtor name (e.g., "Rodriguez, Patricia")
 * @param opts - Optional joint debtor details (same as createDebtor)
 * @returns Joint debtor object with name and phoneticTokens
 * @example
 * // Case with joint filers (husband and wife)
 * {
 *   debtor: createDebtor('Smith, John', { address1: '123 Main St', ... }),
 *   jointDebtor: createJointDebtor('Smith, Jane')
 * }
 *
 * // Case with different last names
 * {
 *   debtor: createDebtor('Williams, James', { ... }),
 *   jointDebtor: createJointDebtor('Rodriguez, Patricia')
 * }
 */
export function createJointDebtor(
  name: string,
  opts?: {
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    zip?: string;
    taxId?: string;
    ssn?: string;
    phone?: string;
    email?: string;
  },
) {
  const cityStateZip =
    opts?.city && opts?.state && opts?.zip
      ? `${opts.city}, ${opts.state} ${opts.zip}`
      : opts?.city && opts?.state
        ? `${opts.city}, ${opts.state}`
        : undefined;

  return {
    name,
    phoneticTokens: generateSearchTokens(name),
    address1: opts?.address1,
    address2: opts?.address2,
    address3: opts?.address3,
    cityStateZipCountry: cityStateZip,
    taxId: opts?.taxId,
    ssn: opts?.ssn,
    phone: opts?.phone,
    email: opts?.email,
  };
}

/**
 * Creates a trustee object with phoneticTokens for fuzzy search support
 * Use this helper when creating TRUSTEE documents to ensure consistent structure
 *
 * IMPORTANT: All trustees MUST include phoneticTokens for fuzzy search to work.
 * Type: common/src/cams/trustees.ts -> Trustee
 * - Requires: documentType, trusteeId, name, phoneticTokens, firstName, lastName, status, public.address, public.phone, public.email
 * - Optional: middleName, internal, banks, softwareId, zoomInfo, assistants, legacy, updatedOn, updatedBy
 *
 * @param opts - Trustee details (id, firstName, middleName, lastName, status, address, contact info)
 * @returns Trustee object with name, phoneticTokens, and other required fields
 * @example
 * // Basic trustee with generated address/phone/email
 * createTrusteeBase({
 *   id: 'trustee-001',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   status: 'active',
 *   city: 'New York',
 *   state: 'NY'
 * })
 *
 * // Trustee with middle name and specific contact info
 * createTrusteeBase({
 *   id: 'trustee-002',
 *   firstName: 'Jane',
 *   middleName: 'Marie',
 *   lastName: 'Smith',
 *   status: 'active',
 *   address1: '123 Main St',
 *   city: 'Buffalo',
 *   state: 'NY',
 *   zipCode: '14201',
 *   phone: '716-555-0100',
 *   email: 'jane.smith@example.com'
 * })
 */
export function createTrusteeBase(opts: {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  status: 'active' | 'inactive';
  address1?: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  email?: string;
}) {
  const name = opts.middleName
    ? `${opts.firstName} ${opts.middleName} ${opts.lastName}`
    : `${opts.firstName} ${opts.lastName}`;

  const trustee: Record<string, unknown> = {
    id: opts.id,
    documentType: 'TRUSTEE',
    trusteeId: opts.id,
    name,
    phoneticTokens: generateSearchTokens(name),
    firstName: opts.firstName,
    lastName: opts.lastName,
    status: opts.status,
    public: {
      address: {
        address1: opts.address1 || faker.location.streetAddress(),
        city: opts.city,
        state: opts.state,
        zipCode: opts.zipCode || faker.location.zipCode(),
        countryCode: 'US',
      },
      phone: {
        number: opts.phone || fakeUsPhoneNumber(),
      },
      email: opts.email || faker.internet.email(),
    },
  };

  // Only include middleName if it's defined
  if (opts.middleName) {
    trustee.middleName = opts.middleName;
  }

  return trustee;
}
