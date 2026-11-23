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
 * - Optional: middleName, internal, banks, softwareId, zoomInfo, staff, legacy, updatedOn, updatedBy
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
 * Creates a SYNCED_CASE document linked to DXTR, with phoneticTokens for the debtor (and joint
 * debtor, when named).
 *
 * IMPORTANT: every case must link to DXTR. dxtrId is either a real DXTR CS_CASEID (numeric) or a
 * SEED##### id from ensureDxtrCase; validators.assertCaseHasDxtrLink checks the format.
 *
 * @param opts - Case document details
 * @returns SYNCED_CASE document ready for seeding
 * @example
 * const { caseInfo } = await ensureDxtrCase(ctx, {...});
 * createCaseDocument({
 *   dxtrId: caseInfo.csCaseId,
 *   caseId: caseInfo.caseId,
 *   caseNumber: '26-63921',
 *   chapter: '7',
 *   debtorName: 'Smith, John',
 *   // ...
 * })
 */
export function createCaseDocument(opts: {
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

type FindingsCandidateLike = {
  camsRaw?: {
    trusteeId?: string;
    name?: string;
    address?: { address1?: string; city?: string; state?: string; zipCode?: string };
    phone?: { number?: string };
    email?: string;
  };
  scores?: Record<string, { pass?: boolean; streetCloseness?: number } | undefined>;
};

type TrusteeMatchVerificationLike = {
  id?: string;
  documentType?: string;
  source?: string;
  findings?: {
    sourceRaw?: {
      legacy?: {
        address1?: string;
        phone?: string;
        email?: string;
        cityStateZipCountry?: string;
        parsedCityStateZip?: unknown;
      };
    };
    candidates?: FindingsCandidateLike[];
  };
};

type BankruptcySoftwareLike = {
  id?: string;
  documentType?: string;
  name?: string;
  contact?: { phones?: { number?: string }[]; emails?: string[] };
};

type NotificationRoutingLike = {
  id?: string;
  documentType?: string;
  displayName?: string;
  recipientAddresses?: string[];
};

type SeedOperationLike = {
  db?: string;
  collectionOrTable?: string;
  data?: Array<
    | CaseLike
    | TrusteeAppointmentLike
    | TrusteeMatchVerificationLike
    | BankruptcySoftwareLike
    | NotificationRoutingLike
    | { trusteeId?: string; id?: string }
  >;
};

const PHONE_FORMAT = /^\d{3}-\d{3}-\d{4}$/;

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
    if (debtor.phone && !PHONE_FORMAT.test(debtor.phone)) {
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
    if (attorney.phone && !PHONE_FORMAT.test(attorney.phone)) {
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
    if (phoneNumber && !PHONE_FORMAT.test(phoneNumber)) {
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
   * Validates a TRUSTEE_MATCH_VERIFICATION seed document's findings against its own data: every
   * comparison a candidate's scores record must have a value on both the source record and the
   * candidate. A scorer record with nothing behind it renders a false "differs" marker in the
   * Data Verification comparison table - the findings-era form of the CAMS-871 bug class, where
   * hand-written scores were unbacked by the fixture's own data.
   * @param doc - The TRUSTEE_MATCH_VERIFICATION document to validate
   * @param context - Context string for error messages
   * @throws Error if validation fails with specific issue description
   */
  assertTrusteeMatchFindingsValid(doc: TrusteeMatchVerificationLike, context: string): void {
    if (!doc.source) {
      throw new Error(`${context}: missing source`);
    }
    const findings = doc.findings;
    if (!findings?.sourceRaw || !Array.isArray(findings.candidates)) {
      throw new Error(`${context}: missing findings (sourceRaw and candidates)`);
    }

    const legacy = findings.sourceRaw.legacy;
    const sourceHas: Record<string, boolean> = {
      phone: !!legacy?.phone,
      email: !!legacy?.email,
      street: !!legacy?.address1,
      // The raw line, not parsedCityStateZip: the pipeline also recovers a zipless "CITY ST" line
      // that the sync's strict parser records as null.
      'city, state or zip': !!legacy?.cityStateZipCountry,
    };
    const comparedField: Record<string, string> = {
      doesPhoneMatch: 'phone',
      doesEmailMatch: 'email',
      doesCityMatch: 'city, state or zip',
      doesStateMatch: 'city, state or zip',
      doesZipCodeMatch: 'city, state or zip',
    };

    for (const candidate of findings.candidates) {
      const cams = candidate.camsRaw ?? {};
      const scores = candidate.scores ?? {};
      const name = cams.name || cams.trusteeId || 'unknown';
      const camsHas: Record<string, boolean> = {
        phone: !!cams.phone?.number,
        email: !!cams.email,
        street: !!cams.address?.address1,
        'city, state or zip': !!(
          cams.address?.city ||
          cams.address?.state ||
          cams.address?.zipCode
        ),
      };

      if (!scores.doesNameMatch) {
        throw new Error(`${context}: candidate "${name}" has no doesNameMatch score`);
      }
      const compared = Object.entries(comparedField)
        .filter(([scorer]) => scores[scorer])
        .map(([scorer, field]) => [scorer, field]);
      if (scores.doesAddressMatch?.streetCloseness !== undefined) {
        compared.push(['doesAddressMatch.streetCloseness', 'street']);
      }
      for (const [scorer, field] of compared) {
        if (!sourceHas[field] || !camsHas[field]) {
          throw new Error(
            `${context}: candidate "${name}" records ${scorer} but the source record or candidate has no ${field} to compare`,
          );
        }
      }
    }
  },

  /**
   * Validates every document the seed validator knows how to check, and counts the ones it checked.
   * Documents in other collections, or of other types within a checked collection, are skipped and
   * not counted, so a checkedCount of 0 means nothing was validated.
   */
  checkSeedOperations(ops: SeedOperationLike[]): { errors: string[]; checkedCount: number } {
    const errors: string[] = [];
    let checkedCount = 0;
    for (const op of ops) {
      const check = DOCUMENT_CHECKS.get(op.collectionOrTable ?? '');
      if (!check || !op.data) continue;
      for (const doc of op.data) {
        if (!check.appliesTo(doc)) continue;
        checkedCount++;
        errors.push(...check.errors(doc));
      }
    }
    return { errors, checkedCount };
  },

  /** The error messages from checkSeedOperations: empty when every checked document is valid. */
  validateAllSeedOperations(ops: SeedOperationLike[]): string[] {
    return validators.checkSeedOperations(ops).errors;
  },
};

type SeedDocument = NonNullable<SeedOperationLike['data']>[number];

/** Which documents in a collection get checked, and the problems found in one of them. */
type DocumentCheck = {
  appliesTo: (doc: SeedDocument) => boolean;
  errors: (doc: SeedDocument) => string[];
};

function documentTypeOf(doc: SeedDocument): string | undefined {
  return (doc as { documentType?: string }).documentType;
}

function ofType(documentType: string) {
  return (doc: SeedDocument) => documentTypeOf(doc) === documentType;
}

/** Runs a validator that throws and returns its message as a list: empty when it passes. */
function errorsFrom(validate: () => void): string[] {
  try {
    validate();
    return [];
  } catch (e) {
    return [(e as Error).message];
  }
}

/** The DXTR link, debtors and attorneys on a SYNCED_CASE or on a TRANSFER_ORDER's case snapshot. */
function caseSnapshotErrors(doc: CaseLike, linkContext: string, partyContext: string): string[] {
  return [
    ...errorsFrom(() => validators.assertCaseHasDxtrLink(doc, linkContext)),
    ...errorsFrom(() => validators.assertDebtorValid(doc.debtor, `${partyContext} debtor`)),
    ...errorsFrom(() =>
      validators.assertDebtorValid(doc.jointDebtor, `${partyContext} jointDebtor`),
    ),
    ...errorsFrom(() =>
      validators.assertAttorneyValid(doc.debtorAttorney, `${partyContext} debtorAttorney`),
    ),
    ...errorsFrom(() =>
      validators.assertAttorneyValid(
        doc.jointDebtorAttorney,
        `${partyContext} jointDebtorAttorney`,
      ),
    ),
  ];
}

function syncedCaseErrors(doc: SeedDocument): string[] {
  const caseDoc = doc as CaseLike;
  const context = `Case ${caseDoc.caseId || caseDoc.id || 'unknown'}`;
  const missingDebtor = caseDoc.debtor ? [] : [`${context}: SYNCED_CASE has no debtor`];
  return [...missingDebtor, ...caseSnapshotErrors(caseDoc, context, context)];
}

function transferOrderErrors(doc: SeedDocument): string[] {
  const orderDoc = doc as CaseLike;
  const orderId = orderDoc.id || 'unknown';
  return caseSnapshotErrors(
    orderDoc,
    `Order ${orderId} case data`,
    `Order ${orderId} case ${orderDoc.caseId || 'unknown'}`,
  );
}

/**
 * Every malformed phone and email on a BANKRUPTCY_SOFTWARE contact, including a phone entry with
 * no number. A document with no contact has nothing to check.
 */
function bankruptcySoftwareErrors(doc: SeedDocument): string[] {
  const software = doc as BankruptcySoftwareLike;
  const label = `BankruptcySoftware ${software.id || 'unknown'}: "${software.name || 'unknown'}"`;
  const phoneErrors = (software.contact?.phones ?? []).flatMap(({ number }) => {
    if (!number) return [`${label} has a phone with no number`];
    return PHONE_FORMAT.test(number)
      ? []
      : [`${label} phone "${number}" not in ###-###-#### format`];
  });
  const emailErrors = (software.contact?.emails ?? [])
    .filter((email) => !email.includes('@'))
    .map((email) => `${label} email "${email}" is not a valid email format`);
  return [...phoneErrors, ...emailErrors];
}

/**
 * The problems with a NOTIFICATION_ROUTING document: no recipients (the notification would go
 * nowhere), or a recipient that isn't an email address.
 */
function notificationRoutingErrors(doc: SeedDocument): string[] {
  const routing = doc as NotificationRoutingLike;
  const label = `NotificationRouting ${routing.id || 'unknown'}: "${routing.displayName || 'unknown'}"`;
  const recipients = routing.recipientAddresses ?? [];
  if (recipients.length === 0) return [`${label} has no recipientAddresses`];
  return recipients
    .filter((address) => !address.includes('@'))
    .map((address) => `${label} recipient "${address}" is not a valid email format`);
}

/** The only list of what the seed validator checks: collection, document types, and the check. */
const DOCUMENT_CHECKS = new Map<string, DocumentCheck>([
  ['cases', { appliesTo: ofType('SYNCED_CASE'), errors: syncedCaseErrors }],
  // TRANSFER_ORDER documents carry a case snapshot; consolidation orders don't.
  ['orders', { appliesTo: ofType('TRANSFER_ORDER'), errors: transferOrderErrors }],
  [
    'trustees',
    {
      // TRUSTEE documents, or legacy ones with no documentType; not TRUSTEE_STAFF and the like.
      appliesTo: (doc) => [undefined, 'TRUSTEE'].includes(documentTypeOf(doc)),
      errors: (doc) => {
        const trustee = doc as TrusteeLike & { trusteeId?: string };
        return errorsFrom(() =>
          validators.assertTrusteeValid(
            trustee,
            `Trustee ${trustee.trusteeId || trustee.id || 'unknown'}`,
          ),
        );
      },
    },
  ],
  [
    'trustee-appointments',
    {
      appliesTo: ofType('TRUSTEE_APPOINTMENT'),
      errors: (doc) => {
        const appointment = doc as TrusteeAppointmentLike;
        return errorsFrom(() =>
          validators.assertTrusteeAppointmentValid(
            appointment,
            `TrusteeAppointment ${appointment.id || 'unknown'}`,
          ),
        );
      },
    },
  ],
  [
    'trustee-match-verification',
    {
      appliesTo: ofType('TRUSTEE_MATCH_VERIFICATION'),
      errors: (doc) => {
        const verification = doc as TrusteeMatchVerificationLike;
        return errorsFrom(() =>
          validators.assertTrusteeMatchFindingsValid(
            verification,
            `TrusteeMatchVerification ${verification.id || 'unknown'}`,
          ),
        );
      },
    },
  ],
  [
    'bankruptcy-software',
    { appliesTo: ofType('BANKRUPTCY_SOFTWARE'), errors: bankruptcySoftwareErrors },
  ],
  [
    'notification-routing',
    { appliesTo: ofType('NOTIFICATION_ROUTING'), errors: notificationRoutingErrors },
  ],
]);
