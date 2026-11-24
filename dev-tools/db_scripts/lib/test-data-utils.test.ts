import { describe, test, expect } from 'vitest';
import {
  fakeUsPhoneNumber,
  createDebtor,
  createJointDebtor,
  createTrusteeBase,
  createCaseDocument,
  validators,
} from './test-data-utils.js';

// A TRUSTEE_MATCH_VERIFICATION seed doc whose one candidate's scores are all backed by data on
// both the source record and the candidate. Typed loosely so tests can remove fields.
type FindingsDoc = Parameters<typeof validators.assertTrusteeMatchFindingsValid>[0];

function validFindingsDoc(): FindingsDoc & {
  findings: NonNullable<FindingsDoc['findings']> & {
    candidates: { camsRaw: Record<string, unknown>; scores: Record<string, unknown> }[];
  };
} {
  return {
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    source: 'DXTR',
    findings: {
      sourceRaw: {
        legacy: {
          address1: '1 Main St',
          cityStateZipCountry: 'New York NY 10001',
          phone: '212-555-0100',
          parsedCityStateZip: { city: 'New York', state: 'NY', zipCode: '10001' },
        },
      },
      candidates: [
        {
          camsRaw: {
            trusteeId: 'trustee-001',
            name: 'Jane Smith',
            address: { address1: '1 Main St', city: 'New York', state: 'NY', zipCode: '10001' },
            phone: { number: '212-555-0100' },
          },
          scores: {
            doesNameMatch: { pass: true },
            doesPhoneMatch: { pass: true },
            doesAddressMatch: { pass: true, streetCloseness: 1 },
            doesCityMatch: { pass: true },
            doesStateMatch: { pass: true },
            doesZipCodeMatch: { pass: true },
          },
        },
      ],
    },
  };
}

describe('fakeUsPhoneNumber', () => {
  test('generates phone number in ###-###-#### format', () => {
    const phone = fakeUsPhoneNumber();
    expect(phone).toMatch(/^\d{3}-\d{3}-\d{4}$/);
  });
});

describe('createDebtor', () => {
  test('creates debtor with name and phoneticTokens', () => {
    const debtor = createDebtor('Smith, John');

    expect(debtor.name).toBe('Smith, John');
    expect(debtor.phoneticTokens).toBeDefined();
    expect(Array.isArray(debtor.phoneticTokens)).toBe(true);
    expect(debtor.phoneticTokens!.length).toBeGreaterThan(0);
  });

  test('includes phonetic tokens for the name', () => {
    const debtor = createDebtor('Smith, John');

    // Should include bigrams and phonetic codes
    expect(debtor.phoneticTokens).toContain('sm'); // bigram from "smith"
    expect(debtor.phoneticTokens).toContain('jo'); // bigram from "john"
  });

  test('creates debtor with full address details', () => {
    const debtor = createDebtor('Acme Corporation', {
      address1: '123 Main St',
      address2: 'Suite 200',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      taxId: '12-3456789',
      ssn: '123-45-6789',
      phone: '212-555-0100',
      email: 'contact@acme.com',
    });

    expect(debtor.name).toBe('Acme Corporation');
    expect(debtor.address1).toBe('123 Main St');
    expect(debtor.address2).toBe('Suite 200');
    expect(debtor.cityStateZipCountry).toBe('New York, NY 10001');
    expect(debtor.taxId).toBe('12-3456789');
    expect(debtor.ssn).toBe('123-45-6789');
    expect(debtor.phone).toBe('212-555-0100');
    expect(debtor.email).toBe('contact@acme.com');
  });

  test('creates debtor with minimal info', () => {
    const debtor = createDebtor('Test Debtor');

    expect(debtor.name).toBe('Test Debtor');
    expect(debtor.phoneticTokens).toBeDefined();
    expect(debtor.address1).toBeUndefined();
    expect(debtor.cityStateZipCountry).toBeUndefined();
  });

  test('handles city/state without zip', () => {
    const debtor = createDebtor('Test Debtor', {
      city: 'Buffalo',
      state: 'NY',
    });

    expect(debtor.cityStateZipCountry).toBe('Buffalo, NY');
  });
});

describe('createJointDebtor', () => {
  test('builds the same debtor as createDebtor', () => {
    const opts = { address1: '456 Oak Ave', city: 'Manhattan', state: 'NY', zip: '10002' };

    expect(createJointDebtor('Smith, Jane', opts)).toEqual(createDebtor('Smith, Jane', opts));
  });
});

describe('createTrusteeBase', () => {
  test('creates trustee with required fields', () => {
    const trustee = createTrusteeBase({
      id: 'trustee-001',
      firstName: 'John',
      lastName: 'Doe',
      status: 'active',
      city: 'New York',
      state: 'NY',
    });

    expect(trustee.id).toBe('trustee-001');
    expect(trustee.documentType).toBe('TRUSTEE');
    expect(trustee.trusteeId).toBe('trustee-001');
    expect(trustee.name).toBe('John Doe');
    expect(trustee.firstName).toBe('John');
    expect(trustee.lastName).toBe('Doe');
    expect(trustee.status).toBe('active');
    expect(trustee.phoneticTokens).toBeDefined();
    expect(Array.isArray(trustee.phoneticTokens)).toBe(true);
  });

  test('includes phonetic tokens for full name', () => {
    const trustee = createTrusteeBase({
      id: 'trustee-002',
      firstName: 'Patricia',
      lastName: 'Manhattan',
      status: 'active',
      city: 'Buffalo',
      state: 'NY',
    });

    // Should include bigrams and phonetic codes from full name "Patricia Manhattan"
    expect(trustee.phoneticTokens).toContain('pa'); // bigram from "patricia"
    expect(trustee.phoneticTokens).toContain('ma'); // bigram from "manhattan"
  });

  test('creates trustee with middle name', () => {
    const trustee = createTrusteeBase({
      id: 'trustee-003',
      firstName: 'Jane',
      middleName: 'Marie',
      lastName: 'Smith',
      status: 'inactive',
      city: 'Albany',
      state: 'NY',
    });

    expect(trustee.name).toBe('Jane Marie Smith');
    expect(trustee.middleName).toBe('Marie');
    expect(trustee.phoneticTokens).toContain('ma'); // bigram from "marie"
  });

  test('creates trustee without middle name', () => {
    const trustee = createTrusteeBase({
      id: 'trustee-004',
      firstName: 'Bob',
      lastName: 'Johnson',
      status: 'active',
      city: 'Rochester',
      state: 'NY',
    });

    expect(trustee.name).toBe('Bob Johnson');
    expect(trustee.middleName).toBeUndefined();
  });

  test('creates trustee with public contact info', () => {
    const trustee = createTrusteeBase({
      id: 'trustee-005',
      firstName: 'Alice',
      lastName: 'Brown',
      status: 'active',
      address1: '789 Main St',
      city: 'Syracuse',
      state: 'NY',
      zipCode: '13201',
      phone: '315-555-0200',
      email: 'alice.brown@example.com',
    });

    expect(trustee.public).toBeDefined();
    expect(trustee.public.address).toEqual({
      address1: '789 Main St',
      city: 'Syracuse',
      state: 'NY',
      zipCode: '13201',
      countryCode: 'US',
    });
    expect(trustee.public.phone).toEqual({
      number: '315-555-0200',
    });
    expect(trustee.public.email).toBe('alice.brown@example.com');
  });

  test('generates fake contact info when not provided', () => {
    const trustee = createTrusteeBase({
      id: 'trustee-006',
      firstName: 'Charlie',
      lastName: 'Davis',
      status: 'active',
      city: 'Yonkers',
      state: 'NY',
    });

    expect(trustee.public.address.address1).toBeDefined();
    expect(trustee.public.address.zipCode).toBeDefined();
    expect(trustee.public.phone.number).toMatch(/^\d{3}-\d{3}-\d{4}$/);
    expect(trustee.public.email).toContain('@');
  });
});

describe('createCaseDocument', () => {
  const baseCase = {
    dxtrId: '318723',
    caseId: '081-26-63921',
    caseNumber: '26-63921',
    chapter: '7',
    caseTitle: 'Smith, John',
    dateFiled: '2026-01-15',
    officeName: 'Manhattan',
    officeCode: 'USTP_CAMS_Region_2_Office_081',
    courtId: '0208',
    courtName: 'U.S. Bankruptcy Court Southern District of New York',
    courtDivisionCode: '081',
    courtDivisionName: 'Manhattan',
    groupDesignator: 'NY',
    regionId: '02',
    regionName: 'NEW YORK',
    debtorName: 'Smith, John',
  };
  type PartyOnCase = { name: string; phoneticTokens: string[]; cityStateZipCountry?: string };

  test('creates a SYNCED_CASE linked to its DXTR case', () => {
    const caseDoc = createCaseDocument(baseCase);

    expect(caseDoc).toMatchObject({
      documentType: 'SYNCED_CASE',
      dxtrId: '318723',
      caseId: '081-26-63921',
    });
    expect((caseDoc.debtor as PartyOnCase).name).toBe('Smith, John');
  });

  test('generates phoneticTokens for the debtor', () => {
    const caseDoc = createCaseDocument({ ...baseCase, debtorName: 'Williams, Jane' });

    const debtor = caseDoc.debtor as PartyOnCase;
    expect(debtor.phoneticTokens).toContain('wi'); // bigram from "williams"
    expect(debtor.phoneticTokens).toContain('ja'); // bigram from "jane"
  });

  test('adds a joint debtor with phoneticTokens only when one is named', () => {
    expect(createCaseDocument(baseCase).jointDebtor).toBeUndefined();

    const jointDebtor = createCaseDocument({ ...baseCase, jointDebtorName: 'Smith, Jane' })
      .jointDebtor as PartyOnCase;
    expect(jointDebtor.name).toBe('Smith, Jane');
    expect(jointDebtor.phoneticTokens).toContain('ja');
  });

  test.each([
    ['city, state and zip', { city: 'Buffalo', state: 'NY', zip: '14202' }, 'Buffalo, NY 14202'],
    ['no zip', { city: 'Buffalo', state: 'NY' }, 'Buffalo, NY'],
    ['no city', { state: 'NY', zip: '14202' }, undefined],
  ])('formats a debtor and joint debtor address with %s', (_label, address, expected) => {
    const caseDoc = createCaseDocument({
      ...baseCase,
      debtorAddress: address,
      jointDebtorName: 'Smith, Jane',
      jointDebtorAddress: address,
    });

    expect((caseDoc.debtor as PartyOnCase).cityStateZipCountry).toBe(expected);
    expect((caseDoc.jointDebtor as PartyOnCase).cityStateZipCountry).toBe(expected);
  });
});

describe('validators', () => {
  describe('assertCaseHasDxtrLink', () => {
    test('passes for case with numeric dxtrId (real)', () => {
      const caseDoc = { caseId: '081-26-12345', dxtrId: '318723', documentType: 'SYNCED_CASE' };
      expect(() => validators.assertCaseHasDxtrLink(caseDoc, 'Test')).not.toThrow();
    });

    test('passes for case with SEED dxtrId (generated)', () => {
      const caseDoc = { caseId: '081-25-90001', dxtrId: 'SEED90001', documentType: 'SYNCED_CASE' };
      expect(() => validators.assertCaseHasDxtrLink(caseDoc, 'Test')).not.toThrow();
    });

    test('throws if dxtrId missing', () => {
      const caseDoc = { caseId: '081-26-12345', documentType: 'SYNCED_CASE' };
      expect(() => validators.assertCaseHasDxtrLink(caseDoc, 'Test')).toThrow(
        'Test: case "081-26-12345" missing dxtrId field',
      );
    });

    test('throws if dxtrId has invalid format', () => {
      const caseDoc = { caseId: '081-26-12345', dxtrId: 'INVALID123', documentType: 'SYNCED_CASE' };
      expect(() => validators.assertCaseHasDxtrLink(caseDoc, 'Test')).toThrow(
        'dxtrId "INVALID123" invalid format',
      );
    });
  });

  describe('assertDebtorValid', () => {
    test('passes for valid debtor with phoneticTokens', () => {
      const debtor = createDebtor('Smith, John');
      expect(() => validators.assertDebtorValid(debtor, 'Test')).not.toThrow();
    });

    test('allows null/undefined debtor', () => {
      expect(() => validators.assertDebtorValid(null, 'Test')).not.toThrow();
      expect(() => validators.assertDebtorValid(undefined, 'Test')).not.toThrow();
    });

    test('throws if phoneticTokens field missing', () => {
      const debtor = { name: 'Smith, John' };
      expect(() => validators.assertDebtorValid(debtor, 'Test')).toThrow(
        'Test: debtor "Smith, John" missing phoneticTokens field',
      );
    });

    test('throws if phoneticTokens is not an array', () => {
      const debtor = { name: 'Smith, John', phoneticTokens: 'not-an-array' };
      expect(() => validators.assertDebtorValid(debtor, 'Test')).toThrow(
        'Test: debtor "Smith, John" phoneticTokens must be an array',
      );
    });

    test('throws if phoneticTokens array is empty', () => {
      const debtor = { name: 'Smith, John', phoneticTokens: [] };
      expect(() => validators.assertDebtorValid(debtor, 'Test')).toThrow(
        'Test: debtor "Smith, John" phoneticTokens array is empty',
      );
    });

    test('throws if phone number not in ###-###-#### format', () => {
      const debtor = {
        name: 'Smith, John',
        phoneticTokens: ['sm', 'jo'],
        phone: '5551234567',
      };
      expect(() => validators.assertDebtorValid(debtor, 'Test')).toThrow(
        'Test: debtor "Smith, John" phone "5551234567" not in ###-###-#### format',
      );
    });

    test('passes if phone is in correct format', () => {
      const debtor = {
        name: 'Smith, John',
        phoneticTokens: ['sm', 'jo'],
        phone: '212-555-0100',
      };
      expect(() => validators.assertDebtorValid(debtor, 'Test')).not.toThrow();
    });
  });

  describe('assertTrusteeValid', () => {
    test('passes for valid trustee with phoneticTokens', () => {
      const trustee = createTrusteeBase({
        id: 'trustee-001',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        city: 'New York',
        state: 'NY',
      });
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).not.toThrow();
    });

    test('allows null/undefined trustee', () => {
      expect(() => validators.assertTrusteeValid(null, 'Test')).not.toThrow();
      expect(() => validators.assertTrusteeValid(undefined, 'Test')).not.toThrow();
    });

    test('throws if phoneticTokens field missing', () => {
      const trustee = { name: 'John Doe', id: 'trustee-001' };
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).toThrow(
        'Test: trustee "John Doe" missing phoneticTokens field',
      );
    });

    test('throws if phoneticTokens is not an array', () => {
      const trustee = { name: 'John Doe', phoneticTokens: 'not-an-array' };
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).toThrow(
        'Test: trustee "John Doe" phoneticTokens must be an array',
      );
    });

    test('throws if phoneticTokens array is empty', () => {
      const trustee = { name: 'John Doe', phoneticTokens: [] };
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).toThrow(
        'Test: trustee "John Doe" phoneticTokens array is empty',
      );
    });

    test('throws if phone number not in ###-###-#### format', () => {
      const trustee = {
        name: 'John Doe',
        phoneticTokens: ['jo', 'do'],
        public: { phone: { number: '5551234567' } },
      };
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).toThrow(
        'Test: trustee "John Doe" phone "5551234567" not in ###-###-#### format',
      );
    });

    test('throws if email missing @ symbol', () => {
      const trustee = {
        name: 'John Doe',
        phoneticTokens: ['jo', 'do'],
        public: { email: 'notanemail' },
      };
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).toThrow(
        'Test: trustee "John Doe" email "notanemail" is not a valid email format',
      );
    });

    test('passes if phone and email are valid', () => {
      const trustee = {
        name: 'John Doe',
        phoneticTokens: ['jo', 'do'],
        public: {
          phone: { number: '212-555-0100' },
          email: 'john.doe@example.com',
        },
      };
      expect(() => validators.assertTrusteeValid(trustee, 'Test')).not.toThrow();
    });
  });

  describe('assertAttorneyValid', () => {
    test('allows null/undefined attorney', () => {
      expect(() => validators.assertAttorneyValid(null, 'Test')).not.toThrow();
      expect(() => validators.assertAttorneyValid(undefined, 'Test')).not.toThrow();
    });

    test('passes for valid attorney with proper phone and email', () => {
      const attorney = {
        name: 'Jane Attorney',
        phone: '212-555-0100',
        email: 'jane.attorney@example.com',
      };
      expect(() => validators.assertAttorneyValid(attorney, 'Test')).not.toThrow();
    });

    test('throws if phone number not in ###-###-#### format', () => {
      const attorney = {
        name: 'Jane Attorney',
        phone: '2125550100',
      };
      expect(() => validators.assertAttorneyValid(attorney, 'Test')).toThrow(
        'Test: attorney "Jane Attorney" phone "2125550100" not in ###-###-#### format',
      );
    });

    test('throws if email missing @ symbol', () => {
      const attorney = {
        name: 'Jane Attorney',
        email: 'notanemail',
      };
      expect(() => validators.assertAttorneyValid(attorney, 'Test')).toThrow(
        'Test: attorney "Jane Attorney" email "notanemail" is not a valid email format',
      );
    });

    test('passes if only phone is present and valid', () => {
      const attorney = {
        name: 'Jane Attorney',
        phone: '212-555-0100',
      };
      expect(() => validators.assertAttorneyValid(attorney, 'Test')).not.toThrow();
    });

    test('passes if only email is present and valid', () => {
      const attorney = {
        name: 'Jane Attorney',
        email: 'jane@example.com',
      };
      expect(() => validators.assertAttorneyValid(attorney, 'Test')).not.toThrow();
    });

    test('passes for attorney with no phone or email', () => {
      const attorney = {
        name: 'Jane Attorney',
      };
      expect(() => validators.assertAttorneyValid(attorney, 'Test')).not.toThrow();
    });
  });

  describe('validateAllSeedOperations', () => {
    test('returns empty array for valid operations', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
            },
          ],
        },
        {
          db: 'cams',
          collectionOrTable: 'trustees',
          data: [
            createTrusteeBase({
              id: 'trustee-001',
              firstName: 'Jane',
              lastName: 'Doe',
              status: 'active',
              city: 'New York',
              state: 'NY',
            }),
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toEqual([]);
    });

    test('catches missing dxtrId in SYNCED_CASE', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              // Missing dxtrId
              debtor: createDebtor('Smith, John'),
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Case 081-26-12345');
      expect(errors[0]).toContain('missing dxtrId field');
    });

    test('catches invalid dxtrId format', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: 'BADFORMAT',
              debtor: createDebtor('Smith, John'),
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('dxtrId "BADFORMAT" invalid format');
    });

    test('catches missing debtor phoneticTokens', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: { name: 'Smith, John' }, // Missing phoneticTokens
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Case 081-26-12345 debtor');
      expect(errors[0]).toContain('missing phoneticTokens field');
    });

    test('catches missing jointDebtor phoneticTokens', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
              jointDebtor: { name: 'Smith, Jane' }, // Missing phoneticTokens
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Case 081-26-12345 jointDebtor');
      expect(errors[0]).toContain('missing phoneticTokens field');
    });

    test('catches missing trustee phoneticTokens', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustees',
          data: [
            {
              trusteeId: 'trustee-001',
              name: 'John Doe',
              // Missing phoneticTokens
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Trustee trustee-001');
      expect(errors[0]).toContain('missing phoneticTokens field');
    });

    test('catches invalid phone format', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustees',
          data: [
            {
              trusteeId: 'trustee-001',
              name: 'John Doe',
              phoneticTokens: ['jo', 'do'],
              public: { phone: { number: '5551234567' } }, // Wrong format
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('not in ###-###-#### format');
    });

    test('collects multiple errors across operations', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: { name: 'Bad Debtor 1' },
            },
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12346',
              dxtrId: '318724',
              debtor: { name: 'Bad Debtor 2' },
            },
          ],
        },
        {
          db: 'cams',
          collectionOrTable: 'trustees',
          data: [{ trusteeId: 'trustee-001', name: 'Bad Trustee' }],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(3);
    });

    test('catches invalid debtorAttorney phone format', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
              debtorAttorney: {
                name: 'Jane Attorney',
                phone: '2125550100', // Wrong format
                email: 'jane@example.com',
              },
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Case 081-26-12345 debtorAttorney');
      expect(errors[0]).toContain('not in ###-###-#### format');
    });

    test('catches invalid debtorAttorney email format', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
              debtorAttorney: {
                name: 'Jane Attorney',
                phone: '212-555-0100',
                email: 'notanemail', // Missing @
              },
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Case 081-26-12345 debtorAttorney');
      expect(errors[0]).toContain('is not a valid email format');
    });

    test('catches invalid jointDebtorAttorney phone format', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
              jointDebtor: createJointDebtor('Smith, Jane'),
              jointDebtorAttorney: {
                name: 'Bob Attorney',
                phone: '3125550200', // Wrong format
                email: 'bob@example.com',
              },
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Case 081-26-12345 jointDebtorAttorney');
      expect(errors[0]).toContain('not in ###-###-#### format');
    });

    test('catches invalid attorney in TRANSFER_ORDER documents', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'orders',
          data: [
            {
              id: 'order-001',
              documentType: 'TRANSFER_ORDER',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
              debtorAttorney: {
                name: 'Jane Attorney',
                phone: '2125550100', // Wrong format
              },
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Order order-001 case 081-26-12345 debtorAttorney');
      expect(errors[0]).toContain('not in ###-###-#### format');
    });

    test('passes for valid attorney data', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [
            {
              documentType: 'SYNCED_CASE',
              caseId: '081-26-12345',
              dxtrId: '318723',
              debtor: createDebtor('Smith, John'),
              debtorAttorney: {
                name: 'Jane Attorney',
                phone: '212-555-0100',
                email: 'jane@example.com',
              },
              jointDebtorAttorney: {
                name: 'Bob Attorney',
                phone: '312-555-0200',
                email: 'bob@example.com',
              },
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toEqual([]);
    });

    test('passes for valid TRUSTEE_APPOINTMENT', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-appointments',
          data: [
            {
              id: 'appt-001',
              documentType: 'TRUSTEE_APPOINTMENT',
              trusteeId: 'trustee-001',
              chapter: '7',
              appointmentType: 'panel',
              courtId: '0208',
              divisionCode: '081',
              divisionCodes: ['081'],
              status: 'active',
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toEqual([]);
    });

    test('catches missing division on TRUSTEE_APPOINTMENT', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-appointments',
          data: [
            {
              id: 'appt-bad',
              documentType: 'TRUSTEE_APPOINTMENT',
              trusteeId: 'trustee-001',
              chapter: '7',
              appointmentType: 'panel',
              courtId: '0208',
              status: 'active',
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('appt-bad');
      expect(errors[0]).toContain('missing divisionCode/divisionCodes');
    });

    test('catches missing courtId on TRUSTEE_APPOINTMENT', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-appointments',
          data: [
            {
              id: 'appt-bad',
              documentType: 'TRUSTEE_APPOINTMENT',
              trusteeId: 'trustee-001',
              chapter: '7',
              appointmentType: 'panel',
              divisionCodes: ['081'],
              status: 'active',
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('appt-bad');
      expect(errors[0]).toContain('missing courtId');
    });

    test('catches missing trusteeId on TRUSTEE_APPOINTMENT', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-appointments',
          data: [
            {
              id: 'appt-bad',
              documentType: 'TRUSTEE_APPOINTMENT',
              chapter: '7',
              appointmentType: 'panel',
              courtId: '0208',
              divisionCodes: ['081'],
              status: 'active',
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('appt-bad');
      expect(errors[0]).toContain('missing trusteeId');
    });

    test('passes for a TRUSTEE_MATCH_VERIFICATION doc whose findings are backed by its data', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-match-verification',
          data: [{ id: 'match-good', ...validFindingsDoc() }],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toEqual([]);
    });

    test('catches a TRUSTEE_MATCH_VERIFICATION candidate that records a comparison with no data behind it', () => {
      const doc = validFindingsDoc();
      doc.findings.candidates[0].scores.doesEmailMatch = { pass: false };
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-match-verification',
          data: [{ id: 'match-bad', ...doc }],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('match-bad');
      expect(errors[0]).toContain('Jane Smith');
      expect(errors[0]).toContain('records doesEmailMatch');
    });

    function softwareOp(contact?: Record<string, unknown>) {
      return {
        db: 'cams',
        collectionOrTable: 'bankruptcy-software',
        data: [
          {
            id: 'software-001',
            documentType: 'BANKRUPTCY_SOFTWARE',
            name: 'BestCase Pro',
            ...(contact ? { contact } : {}),
          },
        ],
      };
    }

    test.each([
      [
        'a well-formed contact',
        { phones: [{ number: '212-555-0400' }], emails: ['support@example.com'] },
      ],
      ['no contact', undefined],
    ])('passes BANKRUPTCY_SOFTWARE with %s', (_label, contact) => {
      expect(validators.validateAllSeedOperations([softwareOp(contact)])).toEqual([]);
    });

    test('catches a BANKRUPTCY_SOFTWARE phone with no number', () => {
      const ops = [softwareOp({ phones: [{ number: '212-555-0400' }, {}] })];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'BankruptcySoftware software-001: "BestCase Pro" has a phone with no number',
      ]);
    });

    test('names a BANKRUPTCY_SOFTWARE document with no id or name "unknown"', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'bankruptcy-software',
          data: [{ documentType: 'BANKRUPTCY_SOFTWARE', contact: { emails: ['nobody'] } }],
        },
      ];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'BankruptcySoftware unknown: "unknown" email "nobody" is not a valid email format',
      ]);
    });

    test('catches a BANKRUPTCY_SOFTWARE phone not in ###-###-#### format', () => {
      const ops = [softwareOp({ phones: [{ number: '212-555-0400' }, { number: '2125550401' }] })];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'BankruptcySoftware software-001: "BestCase Pro" phone "2125550401" not in ###-###-#### format',
      ]);
    });

    test('catches a BANKRUPTCY_SOFTWARE email without @', () => {
      const ops = [softwareOp({ emails: ['support@example.com', 'support.example.com'] })];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'BankruptcySoftware software-001: "BestCase Pro" email "support.example.com" is not a valid email format',
      ]);
    });

    function routingOp(recipientAddresses?: string[]) {
      return {
        db: 'cams',
        collectionOrTable: 'notification-routing',
        data: [
          {
            id: 'chapter-7-oversight',
            documentType: 'NOTIFICATION_ROUTING',
            displayName: 'Chapter 7 Oversight',
            ...(recipientAddresses ? { recipientAddresses } : {}),
          },
        ],
      };
    }

    test('passes NOTIFICATION_ROUTING whose recipients are all email addresses', () => {
      const ops = [routingOp(['ch7@example.com', 'ch7-backup@example.com'])];

      expect(validators.validateAllSeedOperations(ops)).toEqual([]);
    });

    test('catches every NOTIFICATION_ROUTING recipient without @', () => {
      const ops = [routingOp(['ch7@example.com', 'ch7.example.com', 'nobody'])];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'NotificationRouting chapter-7-oversight: "Chapter 7 Oversight" recipient "ch7.example.com" is not a valid email format',
        'NotificationRouting chapter-7-oversight: "Chapter 7 Oversight" recipient "nobody" is not a valid email format',
      ]);
    });

    test.each([
      ['an empty recipientAddresses', []],
      ['no recipientAddresses field', undefined],
    ])('catches a NOTIFICATION_ROUTING document with %s', (_label, recipientAddresses) => {
      expect(validators.validateAllSeedOperations([routingOp(recipientAddresses)])).toEqual([
        'NotificationRouting chapter-7-oversight: "Chapter 7 Oversight" has no recipientAddresses',
      ]);
    });

    test('names a NOTIFICATION_ROUTING document with no id or displayName "unknown"', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'notification-routing',
          data: [{ documentType: 'NOTIFICATION_ROUTING', recipientAddresses: ['nobody'] }],
        },
      ];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'NotificationRouting unknown: "unknown" recipient "nobody" is not a valid email format',
      ]);
    });

    test('catches a SYNCED_CASE with no debtor', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'cases',
          data: [{ caseId: '081-26-12345', dxtrId: '318723', documentType: 'SYNCED_CASE' }],
        },
      ];

      expect(validators.validateAllSeedOperations(ops)).toEqual([
        'Case 081-26-12345: SYNCED_CASE has no debtor',
      ]);
    });
  });

  describe('checkSeedOperations', () => {
    const op = (collectionOrTable: string, doc: Record<string, unknown>) => ({
      db: 'cams',
      collectionOrTable,
      data: [doc],
    });
    const debtor = createDebtor('Smith, John');

    // One malformed document of every type the validator checks. Each must be counted and fail.
    test.each([
      ['cases', { caseId: 'c-1', documentType: 'SYNCED_CASE', debtor }],
      ['orders', { id: 'o-1', caseId: 'c-1', documentType: 'TRANSFER_ORDER', debtor }],
      ['trustees', { id: 't-1', documentType: 'TRUSTEE', name: 'No Tokens' }],
      ['trustees', { id: 't-2', name: 'No Tokens Or Type' }],
      ['trustee-appointments', { id: 'a-1', documentType: 'TRUSTEE_APPOINTMENT' }],
      [
        'trustee-match-verification',
        (() => {
          const doc = validFindingsDoc();
          doc.findings.candidates[0].scores.doesEmailMatch = { pass: false };
          return { id: 'm-1', ...doc };
        })(),
      ],
      [
        'bankruptcy-software',
        { id: 's-1', documentType: 'BANKRUPTCY_SOFTWARE', contact: { emails: ['x'] } },
      ],
      ['notification-routing', { id: 'r-1', documentType: 'NOTIFICATION_ROUTING' }],
    ])('checks a malformed %s document', (collection, doc) => {
      const result = validators.checkSeedOperations([op(collection, doc)]);

      expect(result.checkedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    // Document types that share a checked collection but that the validator doesn't inspect.
    test.each([
      ['cases', 'CASE_NOTE'],
      ['orders', 'CONSOLIDATION_TO'],
      ['trustees', 'TRUSTEE_STAFF'],
      ['trustees', 'TRUSTEE_OVERSIGHT_ASSIGNMENT'],
      ['trustee-appointments', 'CASE_APPOINTMENT'],
      ['trustee-match-verification', 'SOMETHING_ELSE'],
      ['bankruptcy-software', 'SOMETHING_ELSE'],
      ['notification-routing', 'SOMETHING_ELSE'],
    ])('skips a %s document of type %s', (collection, documentType) => {
      expect(validators.checkSeedOperations([op(collection, { id: 'x', documentType })])).toEqual({
        errors: [],
        checkedCount: 0,
      });
    });

    test.each(['banks', 'consolidations', 'AO_CS', 'user-role-assignments'])(
      'skips documents in the unchecked collection %s',
      (collection) => {
        expect(
          validators.checkSeedOperations([op(collection, { id: 'x', documentType: 'ANY' })]),
        ).toEqual({ errors: [], checkedCount: 0 });
      },
    );

    test('skips an operation with no data', () => {
      expect(validators.checkSeedOperations([{ db: 'cams', collectionOrTable: 'cases' }])).toEqual({
        errors: [],
        checkedCount: 0,
      });
    });

    test('validateAllSeedOperations returns the same errors', () => {
      const ops = [op('trustee-appointments', { id: 'a-1', documentType: 'TRUSTEE_APPOINTMENT' })];

      expect(validators.validateAllSeedOperations(ops)).toEqual(
        validators.checkSeedOperations(ops).errors,
      );
    });
  });

  describe('assertTrusteeAppointmentValid', () => {
    test('passes for valid appointment with divisionCode', () => {
      const appt = {
        id: 'appt-001',
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCode: '081',
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).not.toThrow();
    });

    test('passes for valid appointment with divisionCodes array', () => {
      const appt = {
        id: 'appt-001',
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['081'],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).not.toThrow();
    });

    test('allows null/undefined appointment', () => {
      expect(() => validators.assertTrusteeAppointmentValid(null, 'Test')).not.toThrow();
      expect(() => validators.assertTrusteeAppointmentValid(undefined, 'Test')).not.toThrow();
    });

    test('throws if trusteeId missing', () => {
      const appt = {
        id: 'appt-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['081'],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing trusteeId',
      );
    });

    test('throws if courtId missing', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        divisionCodes: ['081'],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing courtId',
      );
    });

    test('throws if neither divisionCode nor divisionCodes provided', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing divisionCode/divisionCodes',
      );
    });

    test('throws if divisionCodes is an empty array', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: [],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing divisionCode/divisionCodes',
      );
    });

    test('throws if divisionCodes contains only whitespace', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['   '],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing divisionCode/divisionCodes',
      );
    });

    test('throws if chapter missing', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['081'],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing chapter',
      );
    });

    test('throws if appointmentType missing', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        chapter: '7',
        courtId: '0208',
        divisionCodes: ['081'],
        status: 'active',
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing appointmentType',
      );
    });

    test('throws if status missing', () => {
      const appt = {
        id: 'appt-001',
        trusteeId: 'trustee-001',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCodes: ['081'],
      };
      expect(() => validators.assertTrusteeAppointmentValid(appt, 'Test')).toThrow(
        'Test: appointment "appt-001" missing status',
      );
    });
  });

  describe('assertTrusteeMatchFindingsValid', () => {
    test('passes when every recorded comparison has a value on both sides', () => {
      expect(() =>
        validators.assertTrusteeMatchFindingsValid(validFindingsDoc(), 'Test'),
      ).not.toThrow();
    });

    test('passes for findings with no candidates', () => {
      const doc = validFindingsDoc();
      doc.findings.candidates = [];
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).not.toThrow();
    });

    test('throws when source is missing', () => {
      const doc = { ...validFindingsDoc(), source: undefined };
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'Test: missing source',
      );
    });

    test('throws when findings are missing', () => {
      const doc = { ...validFindingsDoc(), findings: undefined };
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'Test: missing findings (sourceRaw and candidates)',
      );
    });

    test('throws when a candidate has no doesNameMatch score', () => {
      const doc = validFindingsDoc();
      delete doc.findings.candidates[0].scores.doesNameMatch;
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'Test: candidate "Jane Smith" has no doesNameMatch score',
      );
    });

    test('throws when a phone comparison is recorded but the source record has no phone', () => {
      const doc = validFindingsDoc();
      delete doc.findings.sourceRaw!.legacy!.phone;
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'Test: candidate "Jane Smith" records doesPhoneMatch but the source record or candidate has no phone to compare',
      );
    });

    test('throws when a state comparison is recorded but the candidate has no address', () => {
      const doc = validFindingsDoc();
      delete doc.findings.candidates[0].camsRaw.address;
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'records doesCityMatch but the source record or candidate has no city, state or zip to compare',
      );
    });

    test('passes when a zipless city line was compared, though the sync could not parse it', () => {
      // The pipeline recovers "CITY ST" without a zip; the sync's strict parser records null.
      const doc = validFindingsDoc();
      doc.findings.sourceRaw!.legacy!.cityStateZipCountry = 'Texarkana TX';
      doc.findings.sourceRaw!.legacy!.parsedCityStateZip = null;
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).not.toThrow();
    });

    test('throws when a city comparison is recorded but the source record has no city line', () => {
      const doc = validFindingsDoc();
      delete doc.findings.sourceRaw!.legacy!.cityStateZipCountry;
      delete doc.findings.sourceRaw!.legacy!.parsedCityStateZip;
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'records doesCityMatch but the source record or candidate has no city, state or zip to compare',
      );
    });

    test('throws when a street closeness is recorded but the source record has no street', () => {
      const doc = validFindingsDoc();
      delete doc.findings.sourceRaw!.legacy!.address1;
      expect(() => validators.assertTrusteeMatchFindingsValid(doc, 'Test')).toThrow(
        'records doesAddressMatch.streetCloseness but the source record or candidate has no street to compare',
      );
    });
  });
});
