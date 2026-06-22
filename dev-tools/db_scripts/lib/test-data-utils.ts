/**
 * Shared utilities for test data generation across scenario scripts
 */

import { faker } from '@faker-js/faker';
import { generateSearchTokens } from './phonetic-tokens.js';

/**
 * Type alias for Debtor matching common/src/cams/parties.ts -> Debtor
 * Used for return type annotations without needing to import from common
 */
type DebtorType = {
  name: string;
  phoneticTokens?: string[];
  address1?: string;
  address2?: string;
  address3?: string;
  cityStateZipCountry?: string;
  taxId?: string;
  ssn?: string;
  phone?: string;
  email?: string;
};

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
 * Internal helper to build a debtor object with phoneticTokens
 * @internal - Use createDebtor() or createJointDebtor() instead
 */
function buildDebtor(
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
): DebtorType {
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
): DebtorType {
  return buildDebtor(name, opts);
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
): DebtorType {
  return buildDebtor(name, opts);
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
}): Record<string, unknown> & {
  id: string;
  trusteeId: string;
  name: string;
  phoneticTokens: string[];
  firstName: string;
  lastName: string;
  public: {
    address: {
      address1: string;
      city: string;
      state: string;
      zipCode: string;
      countryCode: string;
    };
    phone: { number: string };
    email: string;
  };
} {
  const name = opts.middleName
    ? `${opts.firstName} ${opts.middleName} ${opts.lastName}`
    : `${opts.firstName} ${opts.lastName}`;

  const trustee: Record<string, unknown> & {
    id: string;
    trusteeId: string;
    name: string;
    phoneticTokens: string[];
    firstName: string;
    lastName: string;
    public: {
      address: {
        address1: string;
        city: string;
        state: string;
        zipCode: string;
        countryCode: string;
      };
      phone: { number: string };
      email: string;
    };
  } = {
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

/**
 * Creates a SYNCED_CASE document with enforced DXTR strategy
 * Use this helper when creating case documents to ensure DXTR linkage is explicit
 *
 * IMPORTANT: All cases MUST be linked to DXTR (either real or generated IDs).
 * This helper enforces explicit documentation of the DXTR strategy.
 *
 * Type: SYNCED_CASE document for Cosmos DB
 * - Requires: dxtrStrategy, dxtrId, caseId, debtorName
 * - Automatically: generates phoneticTokens for debtor
 *
 * @param opts - Case document details with explicit DXTR strategy
 * @returns SYNCED_CASE document ready for seeding
 * @example
 * // Strategy 1: Real DXTR case (from existing data)
 * createCaseDocument({
 *   dxtrStrategy: 'real',
 *   dxtrId: '318723',  // Actual DXTR CS_CASEID
 *   caseId: '081-26-63921',
 *   caseNumber: '26-63921',
 *   chapter: '7',
 *   debtorName: 'Smith, John',
 *   officeName: 'Manhattan',
 *   // ...
 * })
 *
 * // Strategy 2: Generated via ensureDxtrCase (creates if needed)
 * const { caseInfo } = await ensureDxtrCase(ctx, {...});
 * createCaseDocument({
 *   dxtrStrategy: 'generated',
 *   dxtrId: caseInfo.csCaseId,  // SEED##### format
 *   caseId: caseInfo.caseId,
 *   // ...
 * })
 */
export function createCaseDocument(opts: {
  dxtrStrategy: 'real' | 'generated';
  dxtrId: string;
  caseId: string;
  caseNumber: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  officeName: string;
  officeCode: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  debtorName: string;
  debtorAddress?: {
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  jointDebtorName?: string;
  jointDebtorAddress?: {
    address1?: string;
    address2?: string;
    address3?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  updatedOn?: string;
  updatedBy?: { id: string; name: string };
}) {
  const cityStateZip = opts.debtorAddress?.city
    ? `${opts.debtorAddress.city}, ${opts.debtorAddress.state || ''} ${opts.debtorAddress.zip || ''}`.trim()
    : undefined;

  const caseDoc: Record<string, unknown> = {
    id: opts.caseId,
    documentType: 'SYNCED_CASE',
    dxtrId: opts.dxtrId,
    caseId: opts.caseId,
    caseNumber: opts.caseNumber,
    chapter: opts.chapter,
    caseTitle: opts.caseTitle,
    dateFiled: opts.dateFiled,
    officeName: opts.officeName,
    officeCode: opts.officeCode,
    courtId: opts.courtId,
    courtName: opts.courtName,
    courtDivisionCode: opts.courtDivisionCode,
    courtDivisionName: opts.courtDivisionName,
    groupDesignator: opts.groupDesignator,
    regionId: opts.regionId,
    regionName: opts.regionName,
    consolidation: [],
    debtor: {
      name: opts.debtorName,
      phoneticTokens: generateSearchTokens(opts.debtorName),
      address1: opts.debtorAddress?.address1,
      address2: opts.debtorAddress?.address2,
      address3: opts.debtorAddress?.address3,
      cityStateZipCountry: cityStateZip,
      taxId: undefined,
      ssn: undefined,
    },
    updatedOn: opts.updatedOn || new Date().toISOString(),
    updatedBy: opts.updatedBy || { id: 'SEED', name: 'Test Data Seeder' },
  };

  // Add joint debtor if provided
  if (opts.jointDebtorName) {
    const jointCityStateZip = opts.jointDebtorAddress?.city
      ? `${opts.jointDebtorAddress.city}, ${opts.jointDebtorAddress.state || ''} ${opts.jointDebtorAddress.zip || ''}`.trim()
      : undefined;

    caseDoc.jointDebtor = {
      name: opts.jointDebtorName,
      phoneticTokens: generateSearchTokens(opts.jointDebtorName),
      address1: opts.jointDebtorAddress?.address1,
      address2: opts.jointDebtorAddress?.address2,
      address3: opts.jointDebtorAddress?.address3,
      cityStateZipCountry: jointCityStateZip,
      taxId: undefined,
      ssn: undefined,
    };
  }

  return caseDoc;
}

/**
 * Type definitions for validation
 */
type DebtorLike = {
  name?: string;
  phoneticTokens?: unknown;
  phone?: string;
};

type AttorneyLike = {
  name?: string;
  phone?: string;
  email?: string;
};

type TrusteeLike = {
  name?: string;
  id?: string;
  phoneticTokens?: unknown;
  public?: {
    phone?: { number?: string };
    email?: string;
  };
};

type CaseLike = {
  caseId?: string;
  id?: string;
  dxtrId?: string;
  documentType?: string;
  debtor?: DebtorLike;
  jointDebtor?: DebtorLike;
  debtorAttorney?: AttorneyLike;
  jointDebtorAttorney?: AttorneyLike;
};

type TrusteeAppointmentLike = {
  id?: string;
  documentType?: string;
  trusteeId?: string;
  chapter?: string;
  appointmentType?: string;
  courtId?: string;
  divisionCode?: string;
  divisionCodes?: string[];
  status?: string;
};

type SeedOperationLike = {
  db?: string;
  collectionOrTable?: string;
  data?: Array<CaseLike | TrusteeAppointmentLike | { trusteeId?: string; id?: string }>;
};

/**
 * Validation helpers to ensure test data meets quality standards.
 * Use these in tests, runtime validation, and debugging.
 */
export const validators = {
  /**
   * Validates that a debtor object has required phoneticTokens array and proper phone format
   * @param debtor - The debtor object to validate
   * @param context - Context string for error messages (e.g., "Case 081-26-12345")
   * @throws Error if validation fails with specific issue description
   */
  assertDebtorValid(debtor: DebtorLike | null | undefined, context: string): void {
    if (!debtor) return; // null/undefined debtors are optional

    const name = debtor.name || 'unknown';

    if (!debtor.phoneticTokens) {
      throw new Error(`${context}: debtor "${name}" missing phoneticTokens field`);
    }

    if (!Array.isArray(debtor.phoneticTokens)) {
      throw new Error(
        `${context}: debtor "${name}" phoneticTokens must be an array, got ${typeof debtor.phoneticTokens}`,
      );
    }

    if (debtor.phoneticTokens.length === 0) {
      throw new Error(`${context}: debtor "${name}" phoneticTokens array is empty`);
    }

    // Check phone number format (if present)
    if (debtor.phone && !debtor.phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
      throw new Error(
        `${context}: debtor "${name}" phone "${debtor.phone}" not in ###-###-#### format`,
      );
    }
  },

  /**
   * Validates that an attorney object has proper phone and email format
   * @param attorney - The attorney object to validate
   * @param context - Context string for error messages (e.g., "Case 081-26-12345 debtorAttorney")
   * @throws Error if validation fails with specific issue description
   */
  assertAttorneyValid(attorney: AttorneyLike | null | undefined, context: string): void {
    if (!attorney) return; // null/undefined attorneys are optional

    const name = attorney.name || 'unknown';

    // Check phone number format (if present)
    if (attorney.phone && !attorney.phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
      throw new Error(
        `${context}: attorney "${name}" phone "${attorney.phone}" not in ###-###-#### format`,
      );
    }

    // Check email format (if present)
    if (attorney.email && !attorney.email.includes('@')) {
      throw new Error(
        `${context}: attorney "${name}" email "${attorney.email}" is not a valid email format`,
      );
    }
  },

  /**
   * Validates that a case has proper DXTR linkage
   * @param caseDoc - The case document to validate
   * @param context - Context string for error messages (e.g., "Case 081-26-12345")
   * @throws Error if validation fails with specific issue description
   */
  assertCaseHasDxtrLink(caseDoc: CaseLike, context: string): void {
    if (!caseDoc) return;

    const caseId = caseDoc.caseId || caseDoc.id || 'unknown';

    // Check dxtrId exists
    if (!caseDoc.dxtrId) {
      throw new Error(`${context}: case "${caseId}" missing dxtrId field (must link to DXTR)`);
    }

    // Validate dxtrId format
    // Real DXTR IDs: numeric (e.g., "318723")
    // Generated IDs: SEED##### format (e.g., "SEED90001")
    const isNumeric = /^\d+$/.test(caseDoc.dxtrId);
    const isSeed = /^SEED\d{5}$/.test(caseDoc.dxtrId);

    if (!isNumeric && !isSeed) {
      throw new Error(
        `${context}: case "${caseId}" dxtrId "${caseDoc.dxtrId}" invalid format. ` +
          `Must be numeric (real DXTR) or SEED##### (generated via ensureDxtrCase)`,
      );
    }
  },

  /**
   * Validates that a trustee object has required phoneticTokens and proper contact formatting
   * @param trustee - The trustee object to validate
   * @param context - Context string for error messages (e.g., "Trustee trustee-001")
   * @throws Error if validation fails with specific issue description
   */
  assertTrusteeValid(trustee: TrusteeLike | null | undefined, context: string): void {
    if (!trustee) return;

    const name = trustee.name || trustee.id || 'unknown';

    // Check phoneticTokens
    if (!trustee.phoneticTokens) {
      throw new Error(`${context}: trustee "${name}" missing phoneticTokens field`);
    }

    if (!Array.isArray(trustee.phoneticTokens)) {
      throw new Error(
        `${context}: trustee "${name}" phoneticTokens must be an array, got ${typeof trustee.phoneticTokens}`,
      );
    }

    if (trustee.phoneticTokens.length === 0) {
      throw new Error(`${context}: trustee "${name}" phoneticTokens array is empty`);
    }

    // Check phone number format (if present)
    const phoneNumber = trustee.public?.phone?.number;
    if (phoneNumber && !phoneNumber.match(/^\d{3}-\d{3}-\d{4}$/)) {
      throw new Error(
        `${context}: trustee "${name}" phone "${phoneNumber}" not in ###-###-#### format`,
      );
    }

    // Check email format (if present)
    const email = trustee.public?.email;
    if (email && !email.includes('@')) {
      throw new Error(`${context}: trustee "${name}" email "${email}" is not a valid email format`);
    }
  },

  /**
   * Validates that a TRUSTEE_APPOINTMENT document has required fields and valid division codes
   * @param appt - The appointment document to validate
   * @param context - Context string for error messages
   * @throws Error if validation fails with specific issue description
   */
  assertTrusteeAppointmentValid(
    appt: TrusteeAppointmentLike | null | undefined,
    context: string,
  ): void {
    if (!appt) return;

    const id = appt.id || 'unknown';

    if (!appt.trusteeId) {
      throw new Error(`${context}: appointment "${id}" missing trusteeId`);
    }

    if (!appt.chapter) {
      throw new Error(`${context}: appointment "${id}" missing chapter`);
    }

    if (!appt.appointmentType) {
      throw new Error(`${context}: appointment "${id}" missing appointmentType`);
    }

    if (!appt.courtId) {
      throw new Error(`${context}: appointment "${id}" missing courtId`);
    }

    if (!appt.status) {
      throw new Error(`${context}: appointment "${id}" missing status`);
    }

    const hasLegacyDivision =
      typeof appt.divisionCode === 'string' && appt.divisionCode.trim().length > 0;
    const hasNewDivision = (appt.divisionCodes?.filter((c) => !!c?.trim()) ?? []).length > 0;

    if (!hasLegacyDivision && !hasNewDivision) {
      throw new Error(
        `${context}: appointment "${id}" missing divisionCode/divisionCodes — at least one division must be specified`,
      );
    }
  },

  /**
   * Validates all seed operations for data quality issues
   * @param ops - Array of seed operations to validate
   * @returns Array of error messages (empty if all valid)
   */
  validateAllSeedOperations(ops: SeedOperationLike[]): string[] {
    const errors: string[] = [];

    for (const op of ops) {
      if (!op.data) continue;

      // Validate cases collection (SYNCED_CASE documents)
      if (op.collectionOrTable === 'cases') {
        for (const doc of op.data) {
          const caseDoc = doc as CaseLike;
          const caseId = caseDoc.caseId || caseDoc.id || 'unknown';

          // Validate DXTR linkage (only for SYNCED_CASE documents)
          if (caseDoc.documentType === 'SYNCED_CASE') {
            try {
              validators.assertCaseHasDxtrLink(caseDoc, `Case ${caseId}`);
            } catch (e) {
              errors.push((e as Error).message);
            }

            // Validate primary debtor
            try {
              validators.assertDebtorValid(caseDoc.debtor, `Case ${caseId} debtor`);
            } catch (e) {
              errors.push((e as Error).message);
            }

            // Validate joint debtor (if present)
            if (caseDoc.jointDebtor) {
              try {
                validators.assertDebtorValid(caseDoc.jointDebtor, `Case ${caseId} jointDebtor`);
              } catch (e) {
                errors.push((e as Error).message);
              }
            }

            // Validate debtor attorney (if present)
            if (caseDoc.debtorAttorney) {
              try {
                validators.assertAttorneyValid(
                  caseDoc.debtorAttorney,
                  `Case ${caseId} debtorAttorney`,
                );
              } catch (e) {
                errors.push((e as Error).message);
              }
            }

            // Validate joint debtor attorney (if present)
            if (caseDoc.jointDebtorAttorney) {
              try {
                validators.assertAttorneyValid(
                  caseDoc.jointDebtorAttorney,
                  `Case ${caseId} jointDebtorAttorney`,
                );
              } catch (e) {
                errors.push((e as Error).message);
              }
            }
          }
        }
      }

      // Validate orders collection (TRANSFER_ORDER documents with case data)
      if (op.collectionOrTable === 'orders') {
        for (const doc of op.data) {
          const orderDoc = doc as CaseLike & { documentType?: string };

          // Only validate TRANSFER_ORDER documents (they contain case snapshots)
          if (orderDoc.documentType === 'TRANSFER_ORDER') {
            const orderId = orderDoc.id || 'unknown';
            const caseId = orderDoc.caseId || 'unknown';

            // Validate DXTR linkage
            try {
              validators.assertCaseHasDxtrLink(orderDoc, `Order ${orderId} case data`);
            } catch (e) {
              errors.push((e as Error).message);
            }

            // Validate primary debtor in the order's case snapshot
            try {
              validators.assertDebtorValid(
                orderDoc.debtor,
                `Order ${orderId} case ${caseId} debtor`,
              );
            } catch (e) {
              errors.push((e as Error).message);
            }

            // Validate joint debtor (if present)
            if (orderDoc.jointDebtor) {
              try {
                validators.assertDebtorValid(
                  orderDoc.jointDebtor,
                  `Order ${orderId} case ${caseId} jointDebtor`,
                );
              } catch (e) {
                errors.push((e as Error).message);
              }
            }

            // Validate debtor attorney (if present)
            if (orderDoc.debtorAttorney) {
              try {
                validators.assertAttorneyValid(
                  orderDoc.debtorAttorney,
                  `Order ${orderId} case ${caseId} debtorAttorney`,
                );
              } catch (e) {
                errors.push((e as Error).message);
              }
            }

            // Validate joint debtor attorney (if present)
            if (orderDoc.jointDebtorAttorney) {
              try {
                validators.assertAttorneyValid(
                  orderDoc.jointDebtorAttorney,
                  `Order ${orderId} case ${caseId} jointDebtorAttorney`,
                );
              } catch (e) {
                errors.push((e as Error).message);
              }
            }
          }
        }
      }

      // Validate trustees collection (only TRUSTEE documents, skip TRUSTEE_ASSISTANT)
      if (op.collectionOrTable === 'trustees') {
        for (const doc of op.data) {
          const docWithType = doc as { documentType?: string; trusteeId?: string; id?: string };

          // Skip non-TRUSTEE documents (e.g., TRUSTEE_ASSISTANT, TRUSTEE_OVERSIGHT_ASSIGNMENT)
          if (docWithType.documentType && docWithType.documentType !== 'TRUSTEE') {
            continue;
          }

          const trusteeId = docWithType.trusteeId || docWithType.id || 'unknown';
          try {
            validators.assertTrusteeValid(doc as TrusteeLike, `Trustee ${trusteeId}`);
          } catch (e) {
            errors.push((e as Error).message);
          }
        }
      }

      // Validate trustee-appointments collection (TRUSTEE_APPOINTMENT documents)
      if (op.collectionOrTable === 'trustee-appointments') {
        for (const doc of op.data) {
          const apptDoc = doc as TrusteeAppointmentLike;

          if (apptDoc.documentType !== 'TRUSTEE_APPOINTMENT') continue;

          const apptId = apptDoc.id || 'unknown';
          try {
            validators.assertTrusteeAppointmentValid(apptDoc, `TrusteeAppointment ${apptId}`);
          } catch (e) {
            errors.push((e as Error).message);
          }
        }
      }
    }

    return errors;
  },
};
