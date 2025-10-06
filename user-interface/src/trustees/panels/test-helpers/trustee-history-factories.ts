import {
  TrusteePublicContactHistory,
  TrusteeNameHistory,
  TrusteeInternalContactHistory,
} from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

/**
 * Factory functions for creating trustee history mock data with sensible defaults
 * and easy overrides. Supports undefined/null values for edge case testing.
 */

// Base contact information templates
const BASE_PUBLIC_CONTACT: ContactInformation = {
  email: 'test@example.com',
  phone: { number: '555-123-4567', extension: '123' },
  address: {
    address1: '123 Test St',
    address2: 'Suite 100',
    address3: '',
    city: 'Test City',
    state: 'NY',
    zipCode: '12345',
    countryCode: 'US',
  },
};

const BASE_INTERNAL_CONTACT: ContactInformation = {
  email: 'internal@example.com',
  phone: { number: '555-111-2222' },
  address: {
    address1: '789 Internal St',
    address2: '',
    address3: '',
    city: 'Internal City',
    state: 'TX',
    zipCode: '78901',
    countryCode: 'US',
  },
};

// Counter for unique IDs in tests
let mockIdCounter = 1;

/**
 * Creates a TrusteeNameHistory object with sensible defaults
 */
export function createMockNameHistory(
  overrides: Partial<TrusteeNameHistory> = {},
): TrusteeNameHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_NAME',
    before: 'John Smith',
    after: 'John Doe',
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    ...overrides,
  };
}

/**
 * Creates a TrusteePublicContactHistory object with sensible defaults
 * Use `before: undefined` or `after: undefined` to test edge cases
 */
export function createMockPublicContactHistory(
  overrides: Partial<TrusteePublicContactHistory> = {},
): TrusteePublicContactHistory {
  const id = mockIdCounter++;
  const base: TrusteePublicContactHistory = {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_PUBLIC_CONTACT',
    before: { ...BASE_PUBLIC_CONTACT },
    after: {
      ...BASE_PUBLIC_CONTACT,
      email: 'updated@example.com',
      address: {
        ...BASE_PUBLIC_CONTACT.address,
        address1: '456 Updated St',
        city: 'Updated City',
      },
    },
    updatedOn: '2024-01-16T11:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  return { ...base, ...overrides };
}

/**
 * Creates a TrusteeInternalContactHistory object with sensible defaults
 */
export function createMockInternalContactHistory(
  overrides: Partial<TrusteeInternalContactHistory> = {},
): TrusteeInternalContactHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_INTERNAL_CONTACT',
    before: undefined,
    after: { ...BASE_INTERNAL_CONTACT },
    updatedOn: '2024-01-17T12:00:00Z',
    updatedBy: {
      id: 'user-456',
      name: 'Jane Admin',
    },
    ...overrides,
  };
}

/**
 * Helper function to create partial contact information for edge case testing
 * This replaces the existing createPartialContactInfo function
 */
export function createPartialContactInfo(fields: Partial<ContactInformation>): ContactInformation {
  const base: ContactInformation = {
    address: {
      address1: '',
      city: '',
      state: '',
      zipCode: '',
      countryCode: 'US',
    },
  };

  if (fields.address) {
    base.address = { ...base.address, ...fields.address };
  }
  if (fields.phone) {
    base.phone = fields.phone;
  }
  if (fields.email) {
    base.email = fields.email;
  }

  return base;
}

/**
 * Common test scenarios as factory functions
 */
export const TestScenarios = {
  /**
   * Contact history with only email (no phone or address)
   */
  emailOnly: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        email: 'email@example.com',
      }),
      after: createPartialContactInfo({
        phone: { number: '555-123-4567' },
      }),
    }),

  /**
   * Contact history with undefined address
   */
  undefinedAddress: () =>
    createMockPublicContactHistory({
      before: {
        email: 'test@example.com',
        phone: { number: '555-123-4567' },
      } as ContactInformation,
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact history with phone but no extension
   */
  phoneNoExtension: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        phone: { number: '555-123-4567' },
      }),
      after: createPartialContactInfo({
        phone: { number: '555-987-6543' },
      }),
    }),

  /**
   * Completely empty contact information
   */
  emptyContact: () =>
    createMockPublicContactHistory({
      before: undefined,
      after: undefined,
    }),

  /**
   * Name history with undefined values
   */
  emptyName: () =>
    createMockNameHistory({
      before: undefined,
      after: undefined,
    }),

  /**
   * Name history with empty strings
   */
  emptyStringName: () =>
    createMockNameHistory({
      before: '',
      after: '',
    }),

  /**
   * Contact with only address1 and zipCode
   */
  addressPartial: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        address: {
          address1: '123 Main St',
          city: '',
          state: '',
          zipCode: '12345',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact with all address fields (address1, address2, address3)
   */
  addressComplete: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        address: {
          address1: '123 Main St',
          address2: 'Suite 200',
          address3: 'Building A',
          city: 'Test City',
          state: 'TX',
          zipCode: '78901',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact with only city and state
   */
  cityAndState: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        address: {
          address1: '',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact with only state
   */
  stateOnly: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        address: {
          address1: '',
          city: '',
          state: 'FL',
          zipCode: '',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact with only city
   */
  cityOnly: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        address: {
          address1: '',
          city: 'Chicago',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact with undefined phone
   */
  undefinedPhone: () =>
    createMockPublicContactHistory({
      before: {
        email: 'test@example.com',
        phone: undefined,
        address: {
          address1: '123 Test St',
          city: 'Test City',
          state: 'TX',
          zipCode: '12345',
          countryCode: 'US',
        },
      } as ContactInformation,
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact with phone number but undefined extension
   */
  phoneNoExtensionUndefined: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        phone: { number: '555-999-8888', extension: undefined },
      }),
      after: createPartialContactInfo({}),
    }),
};

/**
 * Reset the mock ID counter (useful for test isolation)
 */
export function resetMockIdCounter(): void {
  mockIdCounter = 1;
}
