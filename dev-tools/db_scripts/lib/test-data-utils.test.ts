import { describe, test, expect } from 'vitest';
import {
  fakeUsPhoneNumber,
  createDebtor,
  createJointDebtor,
  createTrusteeBase,
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
