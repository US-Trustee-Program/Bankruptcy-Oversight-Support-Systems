import {
  ProjectedTrustee,
  ScoreByScorer,
  SerializedCandidate,
  TrusteeSerializedState,
} from '@common/cams/trustee-match-pipeline';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import {
  buildTrusteeComparison,
  candidateAddress,
  ComparisonRowKey,
  formatAddress,
  selectedTrusteeFromSearch,
  sourceAddress,
} from './trustee-comparison';

function candidate(
  trusteeId: string,
  scores: ScoreByScorer,
  overrides: Partial<ProjectedTrustee> = {},
  origin = 'recallBySurnameExact',
): SerializedCandidate<ProjectedTrustee> {
  return {
    camsRaw: {
      trusteeId,
      firstName: 'Trustee',
      lastName: trusteeId,
      name: `Trustee ${trusteeId}`,
      address: {
        address1: '1 Main St',
        city: 'Albany',
        state: 'NY',
        zipCode: '12207',
        countryCode: 'US',
      },
      phone: { number: '518-555-0100' },
      email: `${trusteeId}@example.com`,
      ...overrides,
    },
    camsNormalized: {},
    memo: {},
    scores,
    origin,
  };
}

function findings(
  candidates: SerializedCandidate<ProjectedTrustee>[],
  overrides: Partial<TrusteeSerializedState> = {},
): TrusteeSerializedState {
  return {
    sourceRaw: {
      fullName: 'Jane Q. Doe',
      legacy: {
        address1: '1 Main St',
        address2: 'Suite 2',
        cityStateZipCountry: 'Albany NY 12207',
        phone: '518-555-0100',
        email: 'jane@example.com',
        parsedCityStateZip: { city: 'Albany', state: 'NY', zipCode: '12207' },
      },
    },
    sourceNormalized: {},
    memo: {},
    candidates,
    match: null,
    skip: false,
    error: null,
    ...overrides,
  };
}

const allExact: ScoreByScorer = {
  doesNameMatch: { pass: true, quality: 'exact' },
  doesPhoneMatch: { pass: true, quality: 'exact' },
  doesAddressMatch: { pass: true, quality: 'exact', points: 6, streetCloseness: 1 },
  doesCityMatch: { pass: true },
  doesStateMatch: { pass: true },
  doesZipCodeMatch: { pass: true },
  doesEmailMatch: { pass: true },
};

function differingRows(scores: ScoreByScorer): ComparisonRowKey[] {
  const comparison = buildTrusteeComparison(findings([candidate('t1', scores)]), 'DXTR');
  const column = comparison.candidates[0];
  return comparison.rows.map((row) => row.key).filter((key) => column.cells[key].differs);
}

describe('buildTrusteeComparison', () => {
  test('lists the rows Name, Phone, Street, City, State, Zip, Email for a DXTR source', () => {
    const comparison = buildTrusteeComparison(findings([]), 'DXTR');

    expect(comparison.rows.map((row) => row.label)).toEqual([
      'Name',
      'Phone',
      'Street',
      'City',
      'State',
      'Zip',
      'Email',
    ]);
  });

  test('omits the Email row for an ACMS source', () => {
    const comparison = buildTrusteeComparison(findings([]), 'ACMS');

    expect(comparison.rows.map((row) => row.key)).not.toContain('email');
  });

  test('reads the source column from the stored source record', () => {
    const comparison = buildTrusteeComparison(findings([]), 'DXTR');

    expect(comparison.source).toEqual({
      name: 'Jane Q. Doe',
      phone: '518-555-0100',
      street: '1 Main St, Suite 2',
      city: 'Albany',
      state: 'NY',
      zip: '12207',
      email: 'jane@example.com',
    });
  });

  test('prefers the city, state and zip the pipeline parsed and compared', () => {
    const comparison = buildTrusteeComparison(
      findings([], {
        sourceNormalized: { address: { city: 'Troy', state: 'NY', zipCode: '12180' } },
      }),
      'DXTR',
    );

    expect(comparison.source).toMatchObject({ city: 'Troy', state: 'NY', zip: '12180' });
  });

  test('reads each candidate column from the stored CAMS record', () => {
    const comparison = buildTrusteeComparison(
      findings([
        candidate('t1', allExact, {
          phone: { number: '518-555-0100', extension: '12' },
          address: {
            address1: '9 Elm St',
            address2: 'Floor 3',
            city: 'Troy',
            state: 'NY',
            zipCode: '12180',
            countryCode: 'US',
          },
        }),
      ]),
      'DXTR',
    );

    const [column] = comparison.candidates;
    expect(column.trusteeId).toBe('t1');
    expect(column.trusteeName).toBe('Trustee t1');
    expect(Object.fromEntries(Object.entries(column.cells).map(([k, c]) => [k, c.value]))).toEqual({
      name: 'Trustee t1',
      phone: '518-555-0100 x12',
      street: '9 Elm St, Floor 3',
      city: 'Troy',
      state: 'NY',
      zip: '12180',
      email: 't1@example.com',
    });
  });

  test('marks nothing as differing when every field matches exactly', () => {
    expect(differingRows(allExact)).toEqual([]);
  });

  test('marks every field that does not match exactly as differing', () => {
    expect(
      differingRows({
        doesNameMatch: { pass: true, quality: 'strong' },
        doesPhoneMatch: { pass: true, quality: 'strong', phoneDigitDistance: 1 },
        doesAddressMatch: { pass: true, quality: 'strong', points: 5.4, streetCloseness: 0.8 },
        doesCityMatch: { pass: false },
        doesStateMatch: { pass: false },
        doesZipCodeMatch: { pass: false },
        doesEmailMatch: { pass: false },
      }),
    ).toEqual(['name', 'phone', 'street', 'city', 'state', 'zip', 'email']);
  });

  test('treats a weak or failed name match as differing', () => {
    expect(differingRows({ ...allExact, doesNameMatch: { pass: true, quality: 'weak' } })).toEqual([
      'name',
    ]);
    expect(differingRows({ ...allExact, doesNameMatch: { pass: false } })).toEqual(['name']);
  });

  test('does not mark a field the pipeline could not compare', () => {
    expect(differingRows({ doesNameMatch: { pass: true, quality: 'exact' } })).toEqual([]);
    expect(
      differingRows({
        ...allExact,
        doesAddressMatch: { pass: true, quality: 'moderate', points: 3 },
      }),
    ).toEqual([]);
  });

  test('orders candidates by address points, then name quality', () => {
    const comparison = buildTrusteeComparison(
      findings([
        candidate('weak-name', {
          doesNameMatch: { pass: true, quality: 'weak' },
          doesAddressMatch: { pass: true, quality: 'moderate', points: 3 },
        }),
        candidate('far', {
          doesNameMatch: { pass: true, quality: 'exact' },
          doesAddressMatch: { pass: true, quality: 'weak', points: 1 },
        }),
        candidate('exact-name', {
          doesNameMatch: { pass: true, quality: 'exact' },
          doesAddressMatch: { pass: true, quality: 'moderate', points: 3 },
        }),
      ]),
      'DXTR',
    );

    expect(comparison.candidates.map((c) => c.trusteeId)).toEqual([
      'exact-name',
      'weak-name',
      'far',
    ]);
  });

  test('leaves a missing value undefined so the table can show "Not Provided"', () => {
    const comparison = buildTrusteeComparison(
      findings([
        candidate('t1', allExact, { phone: undefined, email: undefined, address: undefined }),
      ]),
      'DXTR',
    );

    const { cells } = comparison.candidates[0];
    expect([cells.phone.value, cells.street.value, cells.city.value, cells.email.value]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('selectedTrusteeFromSearch', () => {
  const searchResult: TrusteeSearchResult = {
    trusteeId: 'searched-1',
    name: 'Sam Searched',
    address: {
      address1: '9 Elm St',
      address2: 'Floor 3',
      city: 'Utica',
      state: 'NY',
      zipCode: '13501',
      countryCode: 'US',
    },
    phone: { number: '315-555-0100', extension: '12' },
    email: 'sam@example.com',
    appointments: [],
    matchType: 'exact',
  };

  test("reuses a candidate's stored cells when the searched trustee is a candidate", () => {
    const { candidates } = buildTrusteeComparison(
      findings([candidate('t1', { ...allExact, doesStateMatch: { pass: false } })]),
      'DXTR',
    );

    const selected = selectedTrusteeFromSearch(
      { ...searchResult, trusteeId: 't1', name: 'Trustee t1' },
      candidates,
    );

    expect(selected).toEqual({
      trusteeId: 't1',
      trusteeName: 'Trustee t1',
      cells: candidates[0].cells,
    });
  });

  test("shows a trustee the pipeline never scored with the search result's values and no differences", () => {
    const selected = selectedTrusteeFromSearch(searchResult, []);

    expect(selected.trusteeId).toBe('searched-1');
    expect(selected.trusteeName).toBe('Sam Searched');
    expect(selected.cells).toEqual({
      name: { value: 'Sam Searched', differs: false },
      phone: { value: '315-555-0100 x12', differs: false },
      street: { value: '9 Elm St, Floor 3', differs: false },
      city: { value: 'Utica', differs: false },
      state: { value: 'NY', differs: false },
      zip: { value: '13501', differs: false },
      email: { value: 'sam@example.com', differs: false },
    });
  });

  test('leaves missing search result values undefined', () => {
    const selected = selectedTrusteeFromSearch(
      { trusteeId: 'searched-2', name: 'Pat Sparse', appointments: [], matchType: 'phonetic' },
      [],
    );

    const { cells } = selected;
    expect([
      cells.phone.value,
      cells.street.value,
      cells.city.value,
      cells.state.value,
      cells.zip.value,
      cells.email.value,
    ]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });
});

describe('formatAddress', () => {
  test('puts the street on its own line and city/state/zip on a second line', () => {
    expect(formatAddress('1 Main St', 'Albany', 'NY', '12207')).toEqual([
      '1 Main St',
      'Albany, NY 12207',
    ]);
  });

  test('omits a missing street line entirely', () => {
    expect(formatAddress(undefined, 'Albany', 'NY', '12207')).toEqual(['Albany, NY 12207']);
  });

  test('omits the city/state/zip line when all three are missing', () => {
    expect(formatAddress('1 Main St', undefined, undefined, undefined)).toEqual(['1 Main St']);
  });

  test('still joins city and state when zip is missing', () => {
    expect(formatAddress('1 Main St', 'Albany', 'NY', undefined)).toEqual([
      '1 Main St',
      'Albany, NY',
    ]);
  });

  test('returns no lines when every part is missing', () => {
    expect(formatAddress(undefined, undefined, undefined, undefined)).toEqual([]);
  });
});

describe('sourceAddress', () => {
  test('formats the source record street and city/state/zip', () => {
    const comparison = buildTrusteeComparison(findings([]), 'DXTR');

    expect(sourceAddress(comparison.source)).toEqual(['1 Main St, Suite 2', 'Albany, NY 12207']);
  });
});

describe('candidateAddress', () => {
  test('formats a candidate street and city/state/zip and is not marked as differing by default', () => {
    const comparison = buildTrusteeComparison(findings([candidate('t1', allExact)]), 'DXTR');

    expect(candidateAddress(comparison.candidates[0].cells)).toEqual({
      lines: ['1 Main St', 'Albany, NY 12207'],
      differs: false,
    });
  });

  test('marks the address as differing when the street does not match', () => {
    const comparison = buildTrusteeComparison(
      findings([
        candidate('t1', {
          ...allExact,
          doesAddressMatch: { pass: true, quality: 'strong', points: 5, streetCloseness: 0.5 },
        }),
      ]),
      'DXTR',
    );

    expect(candidateAddress(comparison.candidates[0].cells).differs).toBe(true);
  });

  test('marks the address as differing when only the zip does not match', () => {
    const comparison = buildTrusteeComparison(
      findings([candidate('t1', { ...allExact, doesZipCodeMatch: { pass: false } })]),
      'DXTR',
    );

    expect(candidateAddress(comparison.candidates[0].cells).differs).toBe(true);
  });
});
