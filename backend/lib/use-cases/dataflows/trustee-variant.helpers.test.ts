import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { buildVariant, computeFingerprint } from './trustee-variant.helpers';

describe('trustee-variant.helpers', () => {
  const origin: DxtrTrusteeParty = {
    firstName: 'John',
    middleName: 'Q',
    lastName: 'Smith',
    generation: '',
    fullName: 'John Q Smith',
    legacy: {
      address1: '500 Fingerprint Ln',
      address2: '',
      address3: '',
      cityStateZipCountry: 'Springfield, IL 62701, USA',
      phone: '217-555-0100',
      fax: '',
      email: 'john.smith@example.com',
    },
  };

  test('collapses whitespace and letter-case noise to the identical fingerprint', () => {
    const reformatted: DxtrTrusteeParty = {
      ...origin,
      firstName: 'JOHN',
      legacy: {
        ...origin.legacy,
        address1: '500  Fingerprint   Ln',
        cityStateZipCountry: 'SPRINGFIELD, IL 62701, USA',
        email: 'JOHN.SMITH@EXAMPLE.COM',
      },
    };

    const originFingerprint = computeFingerprint(buildVariant(origin));
    const reformattedFingerprint = computeFingerprint(buildVariant(reformatted));

    expect(reformattedFingerprint).toBe(originFingerprint);
  });

  test('does not collapse a genuinely different demographic record', () => {
    const differentPerson: DxtrTrusteeParty = {
      ...origin,
      legacy: {
        ...origin.legacy,
        address1: '900 Decoy Blvd',
        cityStateZipCountry: 'Portland, OR 97201, USA',
        phone: '503-555-0199',
        email: 'j.smith.other@example.com',
      },
    };

    const originFingerprint = computeFingerprint(buildVariant(origin));
    const differentFingerprint = computeFingerprint(buildVariant(differentPerson));

    expect(differentFingerprint).not.toBe(originFingerprint);
  });

  test('does not normalize punctuation differences (e.g. phone formatting)', () => {
    const punctuationVariant: DxtrTrusteeParty = {
      ...origin,
      legacy: { ...origin.legacy, phone: '2175550100' },
    };

    const originFingerprint = computeFingerprint(buildVariant(origin));
    const punctuationFingerprint = computeFingerprint(buildVariant(punctuationVariant));

    expect(punctuationFingerprint).not.toBe(originFingerprint);
  });

  test('is stable regardless of object key insertion order', () => {
    const reordered: DxtrTrusteeParty = {
      fullName: origin.fullName,
      lastName: origin.lastName,
      firstName: origin.firstName,
      middleName: origin.middleName,
      generation: origin.generation,
      legacy: {
        email: origin.legacy!.email,
        phone: origin.legacy!.phone,
        cityStateZipCountry: origin.legacy!.cityStateZipCountry,
        address1: origin.legacy!.address1,
        address2: origin.legacy!.address2,
        address3: origin.legacy!.address3,
        fax: origin.legacy!.fax,
      },
    };

    expect(buildVariant(reordered)).toBe(buildVariant(origin));
  });
});
