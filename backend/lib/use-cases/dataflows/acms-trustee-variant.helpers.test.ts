import { computeFingerprint } from './trustee-variant.helpers';
import { buildAcmsVariant, formatAcmsZip } from './acms-trustee-variant.helpers';
import { AcmsTrusteeProfessionalDetailRecord } from '../gateways.types';

describe('acms-trustee-variant.helpers', () => {
  const origin: AcmsTrusteeProfessionalDetailRecord = {
    acmsProfessionalId: 'NY-00063',
    ustProfCode: 63,
    firstName: 'John',
    lastName: 'Smith',
    middleInitial: 'Q',
    address1: '500 Fingerprint Ln',
    address2: '',
    city: 'Springfield',
    state: 'IL',
    zip: 627010000,
    phone: '2175550100',
    fax: '',
  };

  test('produces the same fingerprint as a byte-identical DXTR trustee for the same person', () => {
    const dxtrShapedVariant = JSON.stringify({
      firstName: 'John',
      middleName: 'Q',
      lastName: 'Smith',
      generation: '',
      address1: '500 Fingerprint Ln',
      address2: '',
      address3: '',
      cityStateZipCountry: 'Springfield IL 62701-0000',
      phone: '2175550100',
      fax: '',
      email: '',
    });

    const acmsFingerprint = computeFingerprint(buildAcmsVariant(origin));
    const dxtrFingerprint = computeFingerprint(dxtrShapedVariant);

    expect(acmsFingerprint).toBe(dxtrFingerprint);
  });

  test('excludes ustProfCode from the fingerprint, since it is a pagination cursor, not demographic data', () => {
    const withDifferentCursor: AcmsTrusteeProfessionalDetailRecord = {
      ...origin,
      ustProfCode: 999,
    };

    const originFingerprint = computeFingerprint(buildAcmsVariant(origin));
    const differentCursorFingerprint = computeFingerprint(buildAcmsVariant(withDifferentCursor));

    expect(differentCursorFingerprint).toBe(originFingerprint);
  });

  test('collapses extra whitespace in the composed city/state/zip segment (via formatCityStateZipCountry)', () => {
    const messy: AcmsTrusteeProfessionalDetailRecord = {
      ...origin,
      city: '  Springfield  ',
      state: ' IL',
    };

    const originFingerprint = computeFingerprint(buildAcmsVariant(origin));
    const messyFingerprint = computeFingerprint(buildAcmsVariant(messy));

    expect(messyFingerprint).toBe(originFingerprint);
  });

  test('does not collapse a genuinely different demographic record', () => {
    const differentPerson: AcmsTrusteeProfessionalDetailRecord = {
      ...origin,
      address1: '900 Decoy Blvd',
      city: 'Portland',
      state: 'OR',
      zip: 972010000,
      phone: '5035550199',
    };

    const originFingerprint = computeFingerprint(buildAcmsVariant(origin));
    const differentFingerprint = computeFingerprint(buildAcmsVariant(differentPerson));

    expect(differentFingerprint).not.toBe(originFingerprint);
  });

  test('substitutes empty string for every absent optional field', () => {
    const sparse: AcmsTrusteeProfessionalDetailRecord = {
      acmsProfessionalId: 'NY-00099',
      ustProfCode: 99,
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const shape = JSON.parse(buildAcmsVariant(sparse));

    expect(shape).toEqual({
      firstName: 'Jane',
      middleName: '',
      lastName: 'Doe',
      generation: '',
      address1: '',
      address2: '',
      address3: '',
      cityStateZipCountry: '',
      phone: '',
      fax: '',
      email: '',
    });
  });
});

describe('formatAcmsZip', () => {
  test('splits a 9-digit value into NNNNN-NNNN', () => {
    expect(formatAcmsZip(627010000)).toBe('62701-0000');
  });

  test('zero-pads a value that lost its leading zero (New Haven CT: 065110000 -> 65110000)', () => {
    expect(formatAcmsZip(65110000)).toBe('06511-0000');
  });

  test.each([
    ['is 0 (PROF_ZIP default, meaning no zip was ever recorded)', 0],
    ['is undefined', undefined],
  ])('returns undefined when the raw value %s', (_desc, zip) => {
    expect(formatAcmsZip(zip)).toBeUndefined();
  });
});
