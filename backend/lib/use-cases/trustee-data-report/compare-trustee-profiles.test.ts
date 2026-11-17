import { describe, expect, test } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { Trustee } from '@common/cams/trustees';
import { TrusteeDataDifference } from '@common/cams/trustee-data-report';
import { AtsTrusteeRecord } from '../../adapters/types/ats.types';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/cleansing/ats-mappings';
import {
  compareTrusteeProfile,
  findCamsOnly,
  findTodOnly,
  normalizeForComparison,
  summarize,
} from './compare-trustee-profiles';

function todRecord(override: Partial<AtsTrusteeRecord> = {}): AtsTrusteeRecord {
  return {
    ID: 101,
    FIRST_NAME: 'Pat',
    MIDDLE: 'Q',
    LAST_NAME: 'Example',
    COMPANY: 'Example Trustee Services',
    STREET: '100 Main St',
    STREET1: 'Suite 200',
    CITY: 'Springfield',
    STATE: 'IL',
    ZIP: '62701',
    STREET_A2: '200 Back St',
    CITY_A2: 'Springfield',
    STATE_A2: 'IL',
    ZIP_A2: '62702',
    TELEPHONE: '555-010-0100',
    EMAIL_ADDRESS: 'pat@example.com',
    ...override,
  };
}

/** A CAMS trustee exactly as the migration would have built it from the given TOD records' primary. */
function migratedTrustee(
  primary: AtsTrusteeRecord,
  truIds: string[],
  override: Partial<Trustee> = {},
) {
  const input = transformTrusteeRecord(primary);
  return MockData.getTrustee({
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    name: input.name,
    public: input.public,
    internal: input.internal,
    legacy: { truIds },
    ...override,
  });
}

describe('compareTrusteeProfile', () => {
  test('should report no differences when CAMS matches the TOD record', () => {
    const tod = todRecord();
    expect(compareTrusteeProfile(migratedTrustee(tod, ['101']), [tod])).toEqual([]);
  });

  test.each([
    {
      field: 'name',
      camsChange: { name: 'Pat Q Changed' },
      camsValue: 'Pat Q Changed',
      todValue: 'Pat Q Example',
    },
    {
      field: 'companyName',
      camsChange: { public: { companyName: 'New Co' } },
      camsValue: 'New Co',
      todValue: 'Example Trustee Services',
    },
    {
      field: 'publicAddress',
      camsChange: {
        public: {
          address: {
            address1: '999 Other Rd',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            countryCode: 'US',
          },
        },
      },
      camsValue: '999 Other Rd, Springfield, IL, 62701',
      todValue: '100 Main St, Suite 200, Springfield, IL, 62701',
    },
    {
      field: 'internalAddress',
      camsChange: {
        internal: {
          address: {
            address1: '1 New Way',
            city: 'Peoria',
            state: 'IL',
            zipCode: '61602',
            countryCode: 'US',
          },
        },
      },
      camsValue: '1 New Way, Peoria, IL, 61602',
      todValue: '200 Back St, Springfield, IL, 62702',
    },
    {
      field: 'phone',
      camsChange: { public: { phone: { number: '555-010-0199' } } },
      camsValue: '555-010-0199',
      todValue: '555-010-0100',
    },
    {
      field: 'email',
      camsChange: { public: { email: 'pat.new@example.com' } },
      camsValue: 'pat.new@example.com',
      todValue: 'pat@example.com',
    },
  ])(
    'should report a $field difference with original display values',
    ({ field, camsChange, camsValue, todValue }) => {
      const tod = todRecord();
      const base = migratedTrustee(tod, ['101']);
      const change = camsChange as Partial<Trustee>;
      const cams: Trustee = {
        ...base,
        ...change,
        public: { ...base.public, ...change.public },
      };

      expect(compareTrusteeProfile(cams, [tod])).toEqual<TrusteeDataDifference[]>([
        {
          kind: 'field',
          camsTrusteeId: cams.trusteeId,
          todIds: ['101'],
          trusteeName: cams.name,
          field: field as TrusteeDataDifference['field'],
          camsValue,
          todValue,
        },
      ]);
    },
  );

  test('should report nothing for case, whitespace, phone-punctuation and email-case differences', () => {
    const tod = todRecord();
    const base = migratedTrustee(tod, ['101']);
    const cams: Trustee = {
      ...base,
      name: '  pat   q EXAMPLE ',
      public: {
        ...base.public,
        companyName: 'EXAMPLE trustee  services',
        address: { ...base.public.address, address1: '100 MAIN  ST ' },
        phone: { number: '(555) 010.0100' },
        email: 'PAT@Example.COM',
      },
    };

    expect(compareTrusteeProfile(cams, [tod])).toEqual([]);
  });

  test('should report nothing for a TOD value the original load cleaned up', () => {
    // transformTrusteeRecord trims names and formats raw phone and zip values
    const tod = todRecord({ FIRST_NAME: '  Pat ', TELEPHONE: '15550100100', ZIP: '627011234' });
    expect(compareTrusteeProfile(migratedTrustee(tod, ['101']), [tod])).toEqual([]);
  });

  test('should treat empty, null and undefined as equal', () => {
    const tod = todRecord({
      COMPANY: undefined,
      STREET_A2: undefined,
      CITY_A2: undefined,
      STATE_A2: undefined,
      ZIP_A2: undefined,
    });
    const base = migratedTrustee(tod, ['101']);
    const cams: Trustee = {
      ...base,
      public: { ...base.public, companyName: '' },
      internal: undefined,
    };

    expect(compareTrusteeProfile(cams, [tod])).toEqual([]);
  });

  test('should compare a merged CAMS trustee against the primary record selectPrimaryRecord chooses', () => {
    const incomplete = todRecord({ ID: 101, STREET: undefined, EMAIL_ADDRESS: 'old@example.com' });
    const complete = todRecord({ ID: 102 });
    const cams = migratedTrustee(complete, ['101', '102']);

    expect(compareTrusteeProfile(cams, [incomplete, complete])).toEqual([]);

    const differences = compareTrusteeProfile(
      { ...cams, public: { ...cams.public, email: 'x@example.com' } },
      [incomplete, complete],
    );
    expect(differences).toEqual([
      expect.objectContaining({
        field: 'email',
        todIds: ['101', '102'],
        todValue: 'pat@example.com',
      }),
    ]);
  });
});

describe('normalizeForComparison', () => {
  test.each([
    ['name', '  Pat   Q  Example ', 'pat q example'],
    ['phone', '(555) 010-0100', '5550100100'],
    ['email', ' PAT@Example.COM ', 'pat@example.com'],
    ['name', null, ''],
    ['email', undefined, ''],
  ] as const)('should normalize %s %j to %j', (field, value, expected) => {
    expect(normalizeForComparison(field, value)).toBe(expected);
  });
});

describe('findTodOnly', () => {
  test('should list only in-scope TOD records that no CAMS trustee links to', () => {
    const records = [
      { record: todRecord({ ID: 1 }), inScope: true },
      { record: todRecord({ ID: 2 }), inScope: true },
      { record: todRecord({ ID: 3 }), inScope: false },
    ];

    expect(findTodOnly(records, new Set(['2']))).toEqual<TrusteeDataDifference[]>([
      { kind: 'tod-only', todIds: ['1'], trusteeName: 'Pat Q Example' },
    ]);
  });
});

describe('findCamsOnly', () => {
  test('should list CAMS trustees with no truIds or with no truId that exists in TOD', () => {
    const noTruIds = MockData.getTrustee({ legacy: undefined });
    const emptyTruIds = MockData.getTrustee({ legacy: { truIds: [] } });
    const unmatched = MockData.getTrustee({ legacy: { truIds: ['9'] } });
    const matched = MockData.getTrustee({ legacy: { truIds: ['9', '1'] } });

    const result = findCamsOnly([noTruIds, emptyTruIds, unmatched, matched], new Set(['1']));

    expect(result).toEqual<TrusteeDataDifference[]>([
      {
        kind: 'cams-only',
        camsTrusteeId: noTruIds.trusteeId,
        todIds: [],
        trusteeName: noTruIds.name,
      },
      {
        kind: 'cams-only',
        camsTrusteeId: emptyTruIds.trusteeId,
        todIds: [],
        trusteeName: emptyTruIds.name,
      },
      {
        kind: 'cams-only',
        camsTrusteeId: unmatched.trusteeId,
        todIds: ['9'],
        trusteeName: unmatched.name,
      },
    ]);
  });
});

describe('summarize', () => {
  test('should count differences by kind and field without names or contact details', () => {
    const differences: TrusteeDataDifference[] = [
      { kind: 'tod-only', todIds: ['1'], trusteeName: 'A' },
      { kind: 'cams-only', todIds: [], trusteeName: 'B' },
      { kind: 'cams-only', todIds: [], trusteeName: 'C' },
      {
        kind: 'field',
        todIds: ['4'],
        trusteeName: 'D',
        field: 'email',
        camsValue: 'a',
        todValue: 'b',
      },
      {
        kind: 'field',
        todIds: ['4'],
        trusteeName: 'D',
        field: 'phone',
        camsValue: 'a',
        todValue: 'b',
      },
      {
        kind: 'field',
        todIds: ['5'],
        trusteeName: 'E',
        field: 'email',
        camsValue: 'a',
        todValue: 'b',
      },
    ];

    expect(summarize(differences, 10)).toEqual({
      trusteesCompared: 10,
      todOnly: 1,
      camsOnly: 2,
      fieldDifferences: 3,
      fieldDifferencesByField: {
        name: 0,
        companyName: 0,
        publicAddress: 0,
        internalAddress: 0,
        phone: 1,
        email: 2,
      },
    });
  });
});
