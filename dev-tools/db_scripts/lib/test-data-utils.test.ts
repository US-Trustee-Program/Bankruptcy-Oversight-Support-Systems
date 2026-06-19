import { describe, test, expect } from 'vitest';
import {
  fakeUsPhoneNumber,
  createDebtor,
  createJointDebtor,
  createTrusteeBase,
  createCaseDocument,
  validators,
} from './test-data-utils.js';

describe('fakeUsPhoneNumber', () => {
  test('generates phone number in ###-###-#### format', () => {
    const phone = fakeUsPhoneNumber();
    expect(phone).toMatch(/^\d{3}-\d{3}-\d{4}$/);
  });

  test('generates different phone numbers on each call', () => {
    const phone1 = fakeUsPhoneNumber();
    const phone2 = fakeUsPhoneNumber();
    // Very unlikely to be the same
    expect(phone1).not.toBe(phone2);
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
  test('creates joint debtor with name and phoneticTokens', () => {
    const jointDebtor = createJointDebtor('Rodriguez, Patricia');

    expect(jointDebtor.name).toBe('Rodriguez, Patricia');
    expect(jointDebtor.phoneticTokens).toBeDefined();
    expect(Array.isArray(jointDebtor.phoneticTokens)).toBe(true);
    expect(jointDebtor.phoneticTokens!.length).toBeGreaterThan(0);
  });

  test('includes phonetic tokens for the name', () => {
    const jointDebtor = createJointDebtor('Williams, Jane');

    // Should include bigrams and phonetic codes
    expect(jointDebtor.phoneticTokens).toContain('wi'); // bigram from "williams"
    expect(jointDebtor.phoneticTokens).toContain('ja'); // bigram from "jane"
  });

  test('creates joint debtor with address details', () => {
    const jointDebtor = createJointDebtor('Smith, Jane', {
      address1: '456 Oak Ave',
      city: 'Manhattan',
      state: 'NY',
      zip: '10002',
    });

    expect(jointDebtor.name).toBe('Smith, Jane');
    expect(jointDebtor.address1).toBe('456 Oak Ave');
    expect(jointDebtor.cityStateZipCountry).toBe('Manhattan, NY 10002');
  });

  test('has same structure as debtor', () => {
    const debtor = createDebtor('Smith, John');
    const jointDebtor = createJointDebtor('Smith, Jane');

    // Both should have the same keys (minus values)
    expect(Object.keys(debtor).sort()).toEqual(Object.keys(jointDebtor).sort());
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
  test('creates case with real DXTR strategy', () => {
    const caseDoc = createCaseDocument({
      dxtrStrategy: 'real',
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
    });

    expect(caseDoc.documentType).toBe('SYNCED_CASE');
    expect(caseDoc.dxtrId).toBe('318723');
    expect(caseDoc.caseId).toBe('081-26-63921');
    expect(caseDoc.debtor).toBeDefined();

    const debtor = caseDoc.debtor as { name: string; phoneticTokens: string[] };
    expect(debtor.name).toBe('Smith, John');
    expect(debtor.phoneticTokens).toBeDefined();
    expect(Array.isArray(debtor.phoneticTokens)).toBe(true);
  });

  test('creates case with generated DXTR strategy', () => {
    const caseDoc = createCaseDocument({
      dxtrStrategy: 'generated',
      dxtrId: 'SEED90001',
      caseId: '081-25-90001',
      caseNumber: '25-90001',
      chapter: '11',
      caseTitle: 'Acme Corporation',
      dateFiled: '2026-01-20',
      officeName: 'Buffalo',
      officeCode: 'USTP_CAMS_Region_2_Office_091',
      courtId: '0209',
      courtName: 'U.S. Bankruptcy Court Western District of New York',
      courtDivisionCode: '091',
      courtDivisionName: 'Buffalo',
      groupDesignator: 'NY',
      regionId: '02',
      regionName: 'NEW YORK',
      debtorName: 'Acme Corporation',
    });

    expect(caseDoc.dxtrId).toBe('SEED90001');

    const debtor = caseDoc.debtor as { name: string; phoneticTokens: string[] };
    expect(debtor.name).toBe('Acme Corporation');
    expect(debtor.phoneticTokens).toBeDefined();
  });

  test('creates case with joint debtor', () => {
    const caseDoc = createCaseDocument({
      dxtrStrategy: 'real',
      dxtrId: '318723',
      caseId: '081-26-63921',
      caseNumber: '26-63921',
      chapter: '7',
      caseTitle: 'Smith, John and Smith, Jane',
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
      jointDebtorName: 'Smith, Jane',
    });

    expect(caseDoc.jointDebtor).toBeDefined();

    const jointDebtor = caseDoc.jointDebtor as { name: string; phoneticTokens: string[] };
    expect(jointDebtor.name).toBe('Smith, Jane');
    expect(jointDebtor.phoneticTokens).toBeDefined();
    expect(Array.isArray(jointDebtor.phoneticTokens)).toBe(true);
  });

  test('automatically generates phoneticTokens for debtor', () => {
    const caseDoc = createCaseDocument({
      dxtrStrategy: 'real',
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
      debtorName: 'Williams, Jane',
    });

    const debtor = caseDoc.debtor as { phoneticTokens: string[] };
    expect(debtor.phoneticTokens).toContain('wi'); // bigram from "williams"
    expect(debtor.phoneticTokens).toContain('ja'); // bigram from "jane"
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

    test('allows null/undefined case', () => {
      expect(() =>
        validators.assertCaseHasDxtrLink(null as unknown as { caseId: string }, 'Test'),
      ).not.toThrow();
      expect(() =>
        validators.assertCaseHasDxtrLink(undefined as unknown as { caseId: string }, 'Test'),
      ).not.toThrow();
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

    test('skips non-TRUSTEE_APPOINTMENT docs in trustee-appointments collection', () => {
      const ops = [
        {
          db: 'cams',
          collectionOrTable: 'trustee-appointments',
          data: [
            {
              id: 'case-appt-001',
              documentType: 'CASE_APPOINTMENT',
              trusteeId: 'trustee-001',
              caseId: '081-26-12345',
            },
          ],
        },
      ];

      const errors = validators.validateAllSeedOperations(ops);
      expect(errors).toEqual([]);
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
});
