import { vi } from 'vitest';
import {
  escapeRegex,
  normalizeName,
  matchTrusteeByName,
  calculateAddressScore,
  calculateDistrictDivisionScore,
  calculateChapterScore,
  normalizeChapter,
  calculateCandidateScore,
  calculateNameScore,
  calculatePhoneScore,
  calculateEmailScore,
  calculateTotalScore,
  resolveNameCollisionByScoring,
  isAppointmentMatch,
  findInactivePerfectMatch,
  stripParentheticalAnnotations,
  stripTrusteeRoleSuffix,
  stripChapterAnnotation,
  stripSourceSystemArtifacts,
  normalizeGenerationalSuffix,
  stripGenerationalSuffix,
  stripNamePunctuation,
  normalizeNameForMatching,
  normalizeNameForMatchingWithoutGeneration,
} from './trustee-match.helpers';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { LegacyAddress } from '@common/cams/parties';
import { Address, PhoneNumber } from '@common/cams/contact';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import {
  DxtrTrusteeParty,
  TrusteeAppointmentSyncEvent,
  UNSCORED,
} from '@common/cams/dataflow-events';
import { AppointmentChapterType, Trustee } from '@common/cams/trustees';
import factory from '../../factory';
import { TrusteesRepository, TrusteeAppointmentsRepository } from '../gateways.types';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';

// Centralized test fixture builders
const makeAppointment = (overrides: Partial<TrusteeAppointment> = {}): TrusteeAppointment => ({
  id: 'appointment-1',
  trusteeId: 'trustee-1',
  chapter: '7',
  courtId: '081',
  divisionCode: '1',
  appointmentType: 'panel',
  status: 'active',
  appointedDate: '2024-01-01',
  effectiveDate: '2024-01-01',
  createdBy: { id: 'system', name: 'System' },
  createdOn: '2024-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
  updatedOn: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee => ({
  id: 'trustee-1',
  trusteeId: 'trustee-1',
  firstName: 'John',
  lastName: 'Doe',
  name: 'John Doe',
  status: 'active',
  public: {
    address: {
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
  },
  createdBy: { id: 'system', name: 'System' },
  createdOn: '2024-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
  updatedOn: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeDxtrTrustee = (cityStateZip?: string): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  legacy: cityStateZip ? { cityStateZipCountry: cityStateZip } : undefined,
});

const makeEvent = (
  overrides: Partial<TrusteeAppointmentSyncEvent> = {},
): TrusteeAppointmentSyncEvent => ({
  caseId: '24-12345',
  courtId: '081',
  courtDivisionCode: '1',
  chapter: '7',
  dxtrTrustee: {
    fullName: 'John Doe',
    legacy: {
      cityStateZipCountry: 'New York, NY 10001',
    },
  },
  ...overrides,
});

describe('normalizeName', () => {
  test('should trim leading and trailing whitespace', () => {
    expect(normalizeName('  John Doe  ')).toBe('John Doe');
  });

  test('should collapse multiple internal spaces to a single space', () => {
    expect(normalizeName('John   Q.   Smith')).toBe('John Q. Smith');
  });

  test('should handle tabs and mixed whitespace', () => {
    expect(normalizeName('John\t  Doe')).toBe('John Doe');
  });

  test('should return empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('');
  });

  test('should return name unchanged if already normalized', () => {
    expect(normalizeName('John Doe')).toBe('John Doe');
  });
});

describe('escapeRegex', () => {
  test('should escape all special regex characters', () => {
    expect(escapeRegex('a.b*c+d?e^f$g{h}i(j)k[l]m\\n|o')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\[l\\]m\\\\n\\|o',
    );
  });

  test('should return unchanged string when no special characters', () => {
    expect(escapeRegex('John Doe')).toBe('John Doe');
  });
});

describe('stripParentheticalAnnotations', () => {
  test('should strip a trailing role marker, e.g. "(TR)"', () => {
    expect(stripParentheticalAnnotations('John Doe (TR)')).toBe('John Doe');
  });

  test('should strip a trailing court-office code, e.g. "(MON)"', () => {
    expect(stripParentheticalAnnotations('John Doe (MON)')).toBe('John Doe');
  });

  test('should strip two parenthetical groups in the same name', () => {
    expect(stripParentheticalAnnotations('John (SV) R Doe (TR)')).toBe('John R Doe');
  });

  test('should strip a mid-name nickname group', () => {
    expect(stripParentheticalAnnotations('John (Johnny) Doe Jr.')).toBe('John Doe Jr.');
  });

  test('should leave a name with no parenthetical group unchanged', () => {
    expect(stripParentheticalAnnotations('John Doe')).toBe('John Doe');
  });
});

describe('stripTrusteeRoleSuffix', () => {
  test('should strip a trailing " Trustee"', () => {
    expect(stripTrusteeRoleSuffix('John Doe Trustee')).toBe('John Doe');
  });

  test('should strip a trailing "-Trustee"', () => {
    expect(stripTrusteeRoleSuffix('John Doe-Trustee')).toBe('John Doe');
  });

  test('should leave a name with no role suffix unchanged', () => {
    expect(stripTrusteeRoleSuffix('John Doe')).toBe('John Doe');
  });

  // Deliberately NOT stripped - see stripTrusteeRoleSuffix's doc comment. A bare trailing "tr"/
  // "Tr" is indistinguishable from a real name ending in a similar-looking token, and stripping
  // it caused a verified false-positive risk (e.g. "Charles Li Tr" -> "Charles Li").
  test('should leave a bare trailing "tr" unchanged', () => {
    expect(stripTrusteeRoleSuffix('John Doe tr')).toBe('John Doe tr');
  });
});

describe('stripChapterAnnotation', () => {
  test('should strip a "- Ch 11 SubV" annotation', () => {
    expect(stripChapterAnnotation('John Doe - Ch 11 SubV')).toBe('John Doe');
  });

  test('should strip a "-SBRA V" annotation', () => {
    expect(stripChapterAnnotation('John Doe -SBRA V')).toBe('John Doe');
  });

  test('should leave a name with no chapter annotation unchanged', () => {
    expect(stripChapterAnnotation('John Doe')).toBe('John Doe');
  });
});

describe('stripSourceSystemArtifacts', () => {
  test('should strip a trailing "_<digits>" artifact', () => {
    expect(stripSourceSystemArtifacts('John Doe_13')).toBe('John Doe');
  });

  test('should strip a trailing bare apostrophe', () => {
    expect(stripSourceSystemArtifacts("John Doe'")).toBe('John Doe');
  });

  test('should leave a name with no artifact unchanged', () => {
    expect(stripSourceSystemArtifacts('John Doe')).toBe('John Doe');
  });
});

describe('normalizeGenerationalSuffix', () => {
  test('should normalize "Jr." with no comma', () => {
    expect(normalizeGenerationalSuffix('John Doe Jr.')).toBe('John Doe Jr');
  });

  test('should normalize ", Jr." with a comma', () => {
    expect(normalizeGenerationalSuffix('John Doe, Jr.')).toBe('John Doe Jr');
  });

  test('should normalize "III" with no comma', () => {
    expect(normalizeGenerationalSuffix('John Doe III')).toBe('John Doe III');
  });

  test('should normalize ", III" with a comma', () => {
    expect(normalizeGenerationalSuffix('John Doe, III')).toBe('John Doe III');
  });

  test('should leave a name with no generational suffix unchanged', () => {
    expect(normalizeGenerationalSuffix('John Doe')).toBe('John Doe');
  });

  test('should make comma and no-comma forms compare equal', () => {
    expect(normalizeGenerationalSuffix('John Doe Jr.')).toBe(
      normalizeGenerationalSuffix('John Doe, Jr.'),
    );
  });
});

describe('stripGenerationalSuffix', () => {
  test('should remove a trailing "Jr." entirely', () => {
    expect(stripGenerationalSuffix('John Doe Jr.')).toBe('John Doe');
  });

  test('should remove a trailing ", Jr." entirely', () => {
    expect(stripGenerationalSuffix('John Doe, Jr.')).toBe('John Doe');
  });

  test('should remove a trailing "Sr." entirely', () => {
    expect(stripGenerationalSuffix('John Doe Sr.')).toBe('John Doe');
  });

  test('should remove a trailing "III" entirely', () => {
    expect(stripGenerationalSuffix('John Doe III')).toBe('John Doe');
  });

  test('should leave a name with no generational suffix unchanged', () => {
    expect(stripGenerationalSuffix('John Doe')).toBe('John Doe');
  });

  test('should make a suffixed and unsuffixed form compare equal once stripped', () => {
    expect(stripGenerationalSuffix('John Doe')).toBe(stripGenerationalSuffix('John Doe, Jr.'));
  });
});

describe('stripNamePunctuation', () => {
  test('should drop an apostrophe', () => {
    expect(stripNamePunctuation("John R O'Doe")).toBe('john r odoe');
  });

  test('should convert a hyphen to a space', () => {
    expect(stripNamePunctuation('John-Rae Doe')).toBe('john rae doe');
  });

  test('should make unspaced and spaced double initials compare equal', () => {
    expect(stripNamePunctuation('John A.R. Doe')).toBe(stripNamePunctuation('John A. R. Doe'));
  });

  test('should convert a hyphen within a compound surname to a space', () => {
    expect(stripNamePunctuation('John Doe-Ashe')).toBe('john doe ashe');
  });

  test('should drop an apostrophe within a compound surname', () => {
    expect(stripNamePunctuation("John O'Doe")).toBe('john odoe');
  });
});

describe('normalizeNameForMatching', () => {
  test('should compose stripping a role marker with the rest of the pipeline', () => {
    expect(normalizeNameForMatching('John Doe (TR)')).toBe('john doe');
  });

  test('should compose stripping a chapter annotation with the rest of the pipeline', () => {
    expect(normalizeNameForMatching('John R. Doe -SBRA V')).toBe('john r doe');
  });

  test('should make differently-formatted generational suffixes compare equal', () => {
    expect(normalizeNameForMatching('John Doe Jr.')).toBe(
      normalizeNameForMatching('John Doe, Jr.'),
    );
  });

  test('should make a punctuation-only variant compare equal to its plain form', () => {
    expect(normalizeNameForMatching('John R Doe')).toBe(normalizeNameForMatching('John R. Doe'));
  });

  test('should make a hyphenated compound surname compare equal to its space-separated form', () => {
    expect(normalizeNameForMatching('John Doe-Ashe')).toBe(
      normalizeNameForMatching('John Doe Ashe'),
    );
  });

  // Edge case, not a bug: a dropped/added middle initial is a genuine content difference, not a
  // punctuation gap - stripSourceSystemArtifacts removes the "_<digits>" artifact, but the
  // remaining names still correctly compare unequal so the record falls through to human
  // verification instead of being force-matched. Real-world example: a DXTR name like
  // "John M. Doe_13" vs a CAMS record "John Doe" (no middle initial) - it's fine for this to stay
  // a no-match.
  test('should leave a source-system artifact intentionally unresolved when a middle initial also differs', () => {
    expect(normalizeNameForMatching('John R. Doe_13')).not.toBe(
      normalizeNameForMatching('John Doe'),
    );
  });

  // Edge case, not a bug: a generational suffix present on only one side is a genuine content
  // difference the main pipeline intentionally does not bridge (see stripGenerationalSuffix's
  // doc comment for why) - normalizeNameForMatchingWithoutGeneration is the narrower, opt-in
  // second pass matchTrusteeByName uses for exactly this case.
  test('should leave a generational suffix present on only one side intentionally unresolved', () => {
    expect(normalizeNameForMatching('John Doe')).not.toBe(
      normalizeNameForMatching('John Doe, Jr.'),
    );
  });
});

describe('normalizeNameForMatchingWithoutGeneration', () => {
  test('should make a suffixed and unsuffixed form compare equal', () => {
    expect(normalizeNameForMatchingWithoutGeneration('John Doe')).toBe(
      normalizeNameForMatchingWithoutGeneration('John Doe, Jr.'),
    );
  });

  test('should still compose the rest of the pipeline (parenthetical, punctuation)', () => {
    expect(normalizeNameForMatchingWithoutGeneration('John R. Doe (TR) Jr.')).toBe('john r doe');
  });

  test('should leave a middle-initial difference unresolved even with the suffix discarded', () => {
    expect(normalizeNameForMatchingWithoutGeneration('John R. Doe Jr.')).not.toBe(
      normalizeNameForMatchingWithoutGeneration('John Doe'),
    );
  });
});

describe('matchTrusteeByName', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('should return a resolved outcome when exactly one trustee matches', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([trustee]);

    const result = await matchTrusteeByName(context, trustee.name);

    expect(result).toEqual({ kind: 'resolved', trusteeId: trustee.trusteeId });
  });

  test('should return a no-match outcome when no trustees match', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);

    const result = await matchTrusteeByName(context, 'Nonexistent Trustee');

    expect(result).toEqual({ kind: 'no-match' });
  });

  test('should return an ambiguous outcome with matchCandidates when multiple trustees match', async () => {
    const trustee1 = MockData.getTrustee();
    const trustee2 = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
      trustee1,
      trustee2,
    ]);

    const result = await matchTrusteeByName(context, trustee1.name);

    expect(result).toEqual({
      kind: 'ambiguous',
      matchCandidates: expect.arrayContaining([
        expect.objectContaining({ trusteeId: trustee1.trusteeId }),
        expect.objectContaining({ trusteeId: trustee2.trusteeId }),
      ]),
    });
  });

  test('should normalize the name before querying', async () => {
    const trustee = MockData.getTrustee();
    const findSpy = vi
      .spyOn(MockMongoRepository.prototype, 'findTrusteesByName')
      .mockResolvedValue([trustee]);

    await matchTrusteeByName(context, '  ' + trustee.name + '  ');

    expect(findSpy).toHaveBeenCalledWith(trustee.name);
  });

  test('should not call the fuzzy fallback when the exact-match path finds a result', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([trustee]);
    const scoredSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored');

    await matchTrusteeByName(context, trustee.name);

    expect(scoredSpy).not.toHaveBeenCalled();
  });

  test('should fall back to the scored search and resolve when normalization bridges a punctuation gap', async () => {
    const trustee = MockData.getTrustee({ name: 'John Doe, Jr.' });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    const scoredSpy = vi
      .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
      .mockResolvedValue([trustee]);

    const result = await matchTrusteeByName(context, 'John Doe Jr.');

    expect(scoredSpy).toHaveBeenCalledWith('John Doe Jr.');
    expect(result).toEqual({ kind: 'resolved', trusteeId: trustee.trusteeId });
  });

  // Each case is a distinct way matchTrusteeByName's fallback tiers can still find nothing:
  // no candidates at all; a candidate present but not normalize-matching; a candidate differing
  // by more than punctuation (a middle-initial content gap alongside a source-system artifact -
  // real-world pattern: DXTR "John M. Doe_13" vs CAMS "John Doe"); and a candidate that only
  // fails to match even after the generational-suffix-discarding second pass.
  test.each([
    ['no scored candidates at all', [], 'John Doe'],
    ['a scored candidate that does not normalize-match', [{ name: 'Jane Roe' }], 'John Doe Jr.'],
    [
      'a scored candidate differing by more than punctuation (dropped middle initial)',
      [{ name: 'John Doe' }],
      'John M. Doe_13',
    ],
    [
      'a scored candidate that still does not match after discarding a generational suffix',
      [{ name: 'Jane Roe' }],
      'John Doe',
    ],
  ])('should return no-match when %s', async (_description, trusteeOverrides, queryName) => {
    const trustees = trusteeOverrides.map((overrides) => MockData.getTrustee(overrides));
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue(
      trustees,
    );

    const result = await matchTrusteeByName(context, queryName);

    expect(result).toEqual({ kind: 'no-match' });
  });

  test('should return ambiguous with UNSCORED candidates when multiple fuzzy candidates normalize-match', async () => {
    const trustee1 = MockData.getTrustee({ name: 'John Doe Jr.' });
    const trustee2 = MockData.getTrustee({ name: 'John Doe, Jr.' });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([
      trustee1,
      trustee2,
    ]);

    const result = await matchTrusteeByName(context, 'John Doe Jr');

    expect(result).toEqual({
      kind: 'ambiguous',
      matchCandidates: expect.arrayContaining([
        expect.objectContaining({ trusteeId: trustee1.trusteeId, totalScore: UNSCORED }),
        expect.objectContaining({ trusteeId: trustee2.trusteeId, totalScore: UNSCORED }),
      ]),
    });
  });

  test('should resolve via the generational-suffix-discarding second pass when the suffix is present on only one side', async () => {
    const trustee = MockData.getTrustee({ name: 'John Doe, Jr.' });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    const scoredSpy = vi
      .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
      .mockResolvedValue([trustee]);

    const result = await matchTrusteeByName(context, 'John Doe');

    expect(scoredSpy).toHaveBeenCalledWith('John Doe');
    expect(result).toEqual({ kind: 'resolved', trusteeId: trustee.trusteeId });
  });

  // Real CAMS trustees.json contains genuine father/son (or namesake) pairs distinguished only
  // by a generational suffix, e.g. "Perry A. Stacks" and "Perry A. Stacks, Jr." — discarding the
  // suffix must not silently pick one. The DXTR name here ("... Sr.") matches NEITHER candidate
  // at the first-pass tier (reformats but never discards a suffix), so both only converge once
  // the second pass discards suffixes entirely — that's new ambiguity the second pass
  // introduces, not present at the first tier, and it must surface for human review rather than
  // silently resolving to either real trustee.
  test('should return ambiguous (not silently pick one) when discarding the suffix creates a new collision between two real trustees', async () => {
    const trusteeWithoutSuffix = MockData.getTrustee({ name: 'Perry A. Stacks' });
    const trusteeWithSuffix = MockData.getTrustee({ name: 'Perry A. Stacks, Jr.' });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([
      trusteeWithoutSuffix,
      trusteeWithSuffix,
    ]);

    const result = await matchTrusteeByName(context, 'Perry A. Stacks, Sr.');

    expect(result).toEqual({
      kind: 'ambiguous',
      matchCandidates: expect.arrayContaining([
        expect.objectContaining({
          trusteeId: trusteeWithoutSuffix.trusteeId,
          totalScore: UNSCORED,
        }),
        expect.objectContaining({ trusteeId: trusteeWithSuffix.trusteeId, totalScore: UNSCORED }),
      ]),
    });
  });
});

describe('calculateAddressScore', () => {
  test.each([
    [
      'all fields match (city, state, zipCode)',
      'New York, NY 10001',
      { city: 'New York', state: 'NY', zipCode: '10001' },
      100,
    ],
    [
      'city and state match but zipCode differs',
      'New York, NY 10001',
      { city: 'New York', state: 'NY', zipCode: '10002' },
      40,
    ],
    [
      'zip matches but city differs',
      'Somewhere, NY 10001',
      { city: 'New York', state: 'NY', zipCode: '10001' },
      60,
    ],
    [
      'only state matches',
      'New York, NY 10001',
      { city: 'Brooklyn', state: 'NY', zipCode: '11201' },
      30,
    ],
    [
      'no fields match',
      'New York, NY 10001',
      { city: 'Los Angeles', state: 'CA', zipCode: '90001' },
      0,
    ],
  ])('should return correct score when %s', (_desc, cityStateZipCountry, camsFields, expected) => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry,
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: camsFields.city,
      state: camsFields.state,
      zipCode: camsFields.zipCode,
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(expected);
  });

  test.each([
    [
      'DXTR has a ZIP+4 extension CAMS lacks, same base ZIP5',
      'New York, NY 10001-1234',
      '10001',
      100,
    ],
    [
      'CAMS has a ZIP+4 extension DXTR lacks, same base ZIP5',
      'New York, NY 10001',
      '10001-5678',
      100,
    ],
    [
      'both sides have a ZIP+4 extension but they differ, same base ZIP5',
      'New York, NY 10001-1234',
      '10001-5678',
      100,
    ],
    [
      'the base ZIP5 itself genuinely differs despite a ZIP+4 on one side',
      'New York, NY 10002-1234',
      '10001',
      40,
    ],
  ])('should return correct score when %s', (_desc, cityStateZipCountry, camsZipCode, expected) => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry,
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: camsZipCode,
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(expected);
  });

  test.each([
    ['case-insensitive', 'NEW YORK, ny 10001', 'new york', 100],
    ['cityStateZipCountry is malformed', 'Invalid Format', 'New York', 0],
    ['cityStateZipCountry has a country suffix', 'New York, NY 10001 US', 'New York', 100],
  ])('should handle when %s', (_desc, cityStateZipCountry, city, expected) => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry,
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city,
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(expected);
  });

  test('should return 0 when DXTR address is undefined', () => {
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(undefined, camsAddress);
    expect(score).toBe(0);
  });

  test('should return 0 when cityStateZipCountry is malformed', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'Invalid Format',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(0);
  });

  test('should handle cityStateZipCountry with country suffix', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001 US',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(100);
  });

  test.each([
    ['a comma between every segment (real DXTR format)', 'Corinth, MS, 38834, USA'],
    ['space-only separators with no commas', 'Corinth MS 38834 USA'],
    ['mixed and extra whitespace/comma separator variants', 'Corinth,  MS,  38834,  USA'],
  ])('should return 100 when cityStateZipCountry has %s', (_desc, cityStateZipCountry) => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry,
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'Corinth',
      state: 'MS',
      zipCode: '38834',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(100);
  });
});

describe('normalizeChapter', () => {
  test('should remove leading zeros from single-digit chapters', () => {
    expect(normalizeChapter('07')).toBe('7');
    expect(normalizeChapter('013')).toBe('13');
  });

  test('should keep double-digit chapters as-is', () => {
    expect(normalizeChapter('11')).toBe('11');
    expect(normalizeChapter('12')).toBe('12');
    expect(normalizeChapter('13')).toBe('13');
  });

  test('should normalize chapter with subchapter suffix', () => {
    expect(normalizeChapter('11-subchapter-v')).toBe('11');
    expect(normalizeChapter('7-subchapter-b')).toBe('7');
  });

  test('should handle already normalized chapters', () => {
    expect(normalizeChapter('7')).toBe('7');
    expect(normalizeChapter('11')).toBe('11');
  });

  test('should be case-insensitive', () => {
    expect(normalizeChapter('11-SUBCHAPTER-V')).toBe('11');
  });

  test('should lowercase and return as-is when the chapter has no leading digits', () => {
    expect(normalizeChapter('ABC')).toBe('abc');
    expect(normalizeChapter('')).toBe('');
  });
});

describe('calculateDistrictDivisionScore', () => {
  test('should return 100 when exact court and division match with active appointment', () => {
    const appointments = [makeAppointment({ courtId: '081', divisionCode: '1', status: 'active' })];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(100);
  });

  test('should return 50 when same court but different division', () => {
    const appointments = [makeAppointment({ courtId: '081', divisionCode: '2', status: 'active' })];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(50);
  });

  test('should return 0 when no matching court', () => {
    const appointments = [makeAppointment({ courtId: '082', divisionCode: '1', status: 'active' })];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when matching appointment is not active', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', status: 'inactive' }),
    ];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when appointments array is empty', () => {
    const score = calculateDistrictDivisionScore('081', '1', []);
    expect(score).toBe(0);
  });

  test('should return highest score when multiple appointments exist', () => {
    const appointments = [
      makeAppointment({ courtId: '082', divisionCode: '1', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '2', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '1', status: 'active' }),
    ];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(100);
  });

  test('should return 100 when case division is included in a multi-division divisionCodes array', () => {
    const appointments = [
      makeAppointment({
        courtId: '081',
        divisionCode: undefined,
        divisionCodes: ['235', '236', '237'],
        status: 'active',
      }),
    ];
    const score = calculateDistrictDivisionScore('081', '237', appointments);
    expect(score).toBe(100);
  });

  test('should return 50 when case division is not in the divisionCodes array but court matches', () => {
    const appointments = [
      makeAppointment({
        courtId: '081',
        divisionCode: undefined,
        divisionCodes: ['235', '236'],
        status: 'active',
      }),
    ];
    const score = calculateDistrictDivisionScore('081', '237', appointments);
    expect(score).toBe(50);
  });
});

describe('calculateChapterScore', () => {
  test.each<[string, AppointmentChapterType, string]>([
    ['exact chapter match with active appointment', '7', '7'],
    ['chapter matches after normalization', '7', '07'],
    ['chapter with subchapter matches', '11', '11-subchapter-v'],
  ])('should return 100 when %s', (_desc, appointmentChapter, queryChapter) => {
    const appointments = [makeAppointment({ chapter: appointmentChapter, status: 'active' })];
    const score = calculateChapterScore(queryChapter, appointments);
    expect(score).toBe(100);
  });

  test('should return 0 when no matching chapter', () => {
    const appointments = [makeAppointment({ chapter: '11', status: 'active' })];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when matching appointment is not active', () => {
    const appointments = [makeAppointment({ chapter: '7', status: 'inactive' })];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when appointments array is empty', () => {
    const score = calculateChapterScore('7', []);
    expect(score).toBe(0);
  });

  test('should return 100 when multiple appointments and one matches', () => {
    const appointments = [
      makeAppointment({ chapter: '11', status: 'active' }),
      makeAppointment({ chapter: '7', status: 'active' }),
      makeAppointment({ chapter: '13', status: 'active' }),
    ];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(100);
  });
});

describe('calculateCandidateScore', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should return totalScore 100 when all scores are 100', () => {
    const score = calculateCandidateScore(
      context,
      { ...makeDxtrTrustee('New York, NY 10001'), firstName: 'John', lastName: 'Doe' },
      '081',
      '1',
      '7',
      makeTrustee(),
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
    );

    expect(score.trusteeId).toBe('trustee-1');
    expect(score.trusteeName).toBe('John Doe');
    expect(score.addressScore).toBe(100);
    expect(score.nameScore).toBe(100);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(100);
    // phone/email are null (fixture sets no phone/email on either side), so their weight
    // is excluded and redistributed: applicableWeight = 0.05 + 0.25 + 0.3 + 0.3 = 0.9
    // weightedSum = 100*0.05 + 100*0.25 + 100*0.3 + 100*0.3 = 5 + 25 + 30 + 30 = 90
    // 90 / 0.9 = 100 (toBeCloseTo guards against floating-point division noise)
    expect(score.totalScore).toBeCloseTo(100, 10);
  });

  test('should apply weighted scoring correctly (address 5% / name 25% / district 30% / chapter 30%, phone/email null)', () => {
    const score = calculateCandidateScore(
      context,
      { ...makeDxtrTrustee('New York, NY 10001'), firstName: 'John', lastName: 'Doe' },
      '081',
      '1',
      '7',
      makeTrustee({
        public: {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10002',
            countryCode: 'US',
          },
        },
      }),
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '2', status: 'active' })],
    );

    expect(score.addressScore).toBe(40); // City + state match (different zip)
    expect(score.nameScore).toBe(100); // First and last name match
    expect(score.districtDivisionScore).toBe(50); // Same court, different division
    expect(score.chapterScore).toBe(100); // Chapter matches
    // phone/email null (no phone/email on either side) -> applicableWeight = 0.9
    // weightedSum = 40*0.05 + 100*0.25 + 50*0.3 + 100*0.3 = 2 + 25 + 15 + 30 = 72
    // 72 / 0.9 = 80
    expect(score.totalScore).toBeCloseTo(80, 10);
  });

  test('should return totalScore ~5.56 when only address matches (phone/email null)', () => {
    const score = calculateCandidateScore(
      context,
      makeDxtrTrustee('New York, NY 10001'), // No firstName/lastName - nameScore is 0
      '082',
      '1',
      '11',
      makeTrustee(),
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
    );

    expect(score.addressScore).toBe(100);
    expect(score.nameScore).toBe(0);
    expect(score.districtDivisionScore).toBe(0);
    expect(score.chapterScore).toBe(0);
    // phone/email null -> applicableWeight = 0.05 + 0.25 + 0.3 + 0.3 = 0.9
    // weightedSum = 100*0.05 + 0*0.25 + 0*0.3 + 0*0.3 = 5
    // 5 / 0.9 = 5.5556
    expect(score.totalScore).toBeCloseTo(5.5556, 4);
  });

  test('should return totalScore ~33.33 when only district matches (phone/email null)', () => {
    const score = calculateCandidateScore(
      context,
      makeDxtrTrustee(), // No address, no firstName/lastName - nameScore is 0
      '081',
      '1',
      '11',
      makeTrustee(),
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
    );

    expect(score.addressScore).toBe(0);
    expect(score.nameScore).toBe(0);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(0);
    // phone/email null -> applicableWeight = 0.9
    // weightedSum = 0*0.05 + 0*0.25 + 100*0.3 + 0*0.3 = 30
    // 30 / 0.9 = 33.3333
    expect(score.totalScore).toBeCloseTo(33.3333, 4);
  });

  test('should return totalScore ~33.33 when only chapter matches (phone/email null)', () => {
    const score = calculateCandidateScore(
      context,
      makeDxtrTrustee(), // No address, no firstName/lastName - nameScore is 0
      '082',
      '1',
      '7',
      makeTrustee(),
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
    );

    expect(score.addressScore).toBe(0);
    expect(score.nameScore).toBe(0);
    expect(score.districtDivisionScore).toBe(0);
    expect(score.chapterScore).toBe(100);
    // phone/email null -> applicableWeight = 0.9
    // weightedSum = 0*0.05 + 0*0.25 + 0*0.3 + 100*0.3 = 30
    // 30 / 0.9 = 33.3333
    expect(score.totalScore).toBeCloseTo(33.3333, 4);
  });

  test('should populate phoneScore/emailScore as null when DXTR has no phone/email', () => {
    const score = calculateCandidateScore(
      context,
      { ...makeDxtrTrustee('New York, NY 10001'), firstName: 'John', lastName: 'Doe' },
      '081',
      '1',
      '7',
      makeTrustee({
        public: {
          address: {
            address1: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            countryCode: 'US',
          },
          phone: { number: '662-286-9796' },
          email: 'john.doe@example.com',
        },
      }),
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
    );

    // DXTR trustee has no legacy.phone/legacy.email, so both are not comparable.
    expect(score.phoneScore).toBeNull();
    expect(score.emailScore).toBeNull();
  });
});

describe('calculateNameScore', () => {
  test('should return 100 when first and last match and neither side has a middle name', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should return 100 when middle name is present on one side only', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'Quincy',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should return 100 when both middle names are present and identical', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Quincy Doe',
      firstName: 'John',
      middleName: 'Quincy',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Quincy', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should return 85 when dxtr middle name is a single initial matching cams middle name first letter', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John L Doe',
      firstName: 'John',
      middleName: 'L',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Lee', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should return 85 when cams middle name is a single initial matching dxtr middle name first letter', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Lee Doe',
      firstName: 'John',
      middleName: 'Lee',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'L', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should return 15 when both middle names are present but genuinely differ', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Quincy Doe',
      firstName: 'John',
      middleName: 'Quincy',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Robert', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(15);
  });

  test('should return 0 when first name does not match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should return 0 when last name does not match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Smith',
      firstName: 'John',
      lastName: 'Smith',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should return 0 when both first and last name do not match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jane Smith',
      firstName: 'Jane',
      lastName: 'Smith',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should match first and last names case-insensitively', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'JOHN DOE',
      firstName: 'JOHN',
      lastName: 'DOE',
    };
    const camsTrustee = makeTrustee({ firstName: 'john', lastName: 'doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should normalize punctuation and whitespace when matching first and last names', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: "John O'Brien",
      firstName: 'John ',
      lastName: "O'Brien",
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'OBrien' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should recognize a middle-name initial with trailing punctuation, not a genuine conflict', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John L. Doe',
      firstName: 'John',
      middleName: 'L.',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Lee', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });
});

describe('calculatePhoneScore', () => {
  test('should return 100 when 10-digit numbers match', () => {
    const camsPhone: PhoneNumber = { number: '662-286-9796' };
    expect(calculatePhoneScore('6622869796', camsPhone)).toBe(100);
  });

  test('should return 0 when 10-digit numbers do not match', () => {
    const camsPhone: PhoneNumber = { number: '662-286-9797' };
    expect(calculatePhoneScore('6622869796', camsPhone)).toBe(0);
  });

  test('should return null when DXTR phone is missing', () => {
    const camsPhone: PhoneNumber = { number: '662-286-9796' };
    expect(calculatePhoneScore(undefined, camsPhone)).toBeNull();
  });

  test('should return null when CAMS phone is missing', () => {
    expect(calculatePhoneScore('6622869796', undefined)).toBeNull();
  });

  test('should return null when both sides are missing', () => {
    expect(calculatePhoneScore(undefined, undefined)).toBeNull();
  });

  test('should match numbers that differ only by a leading country code digit', () => {
    const camsPhone: PhoneNumber = { number: '6622869796' };
    expect(calculatePhoneScore('16622869796', camsPhone)).toBe(100);
  });

  test('should return null when normalized digits are fewer than 10 (garbled data)', () => {
    const camsPhone: PhoneNumber = { number: '662-286-9796' };
    expect(calculatePhoneScore('12345', camsPhone)).toBeNull();
  });
});

describe('calculateEmailScore', () => {
  test('should return 100 for case/whitespace-insensitive exact matches', () => {
    expect(calculateEmailScore('  John.Doe@Example.com ', 'john.doe@example.com')).toBe(100);
  });

  test('should return 0 for mismatched emails', () => {
    expect(calculateEmailScore('john.doe@example.com', 'jane.doe@example.com')).toBe(0);
  });

  test('should return null when DXTR email is missing', () => {
    expect(calculateEmailScore(undefined, 'john.doe@example.com')).toBeNull();
  });

  test('should return null when CAMS email is missing', () => {
    expect(calculateEmailScore('john.doe@example.com', undefined)).toBeNull();
  });

  test('should return null when both sides are missing', () => {
    expect(calculateEmailScore(undefined, undefined)).toBeNull();
  });

  test('should return null when either side is empty/whitespace-only', () => {
    expect(calculateEmailScore('   ', 'john.doe@example.com')).toBeNull();
  });
});

describe('calculateTotalScore', () => {
  test('should weight all six dimensions correctly when none are null', () => {
    const total = calculateTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: 100,
      emailScore: 100,
      districtDivisionScore: 100,
      chapterScore: 100,
    });
    // All dimensions perfect, so weights sum to 1 regardless of individual values.
    expect(total).toBe(100);
  });

  test('should return exactly 100 for perfect address/name/district/chapter with null phone/email', () => {
    const total = calculateTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: null,
      emailScore: null,
      districtDivisionScore: 100,
      chapterScore: 100,
    });
    // Floating-point division of 90/0.9 introduces sub-epsilon imprecision;
    // toBeCloseTo verifies the value is effectively 100.
    expect(total).toBeCloseTo(100, 10);
  });

  test('should redistribute correctly when only phone is null', () => {
    const total = calculateTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: null,
      emailScore: 100,
      districtDivisionScore: 100,
      chapterScore: 100,
    });
    // Only phoneScore (weight 0.05) is excluded; all applicable scores are 100.
    expect(total).toBe(100);
  });

  test('should redistribute correctly when only email is null', () => {
    const total = calculateTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: 100,
      emailScore: null,
      districtDivisionScore: 100,
      chapterScore: 100,
    });
    expect(total).toBe(100);
  });

  test('should drag down the total when phone is a genuine mismatch (scored 0), not excluded like null', () => {
    const total = calculateTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: 0,
      emailScore: null,
      districtDivisionScore: 100,
      chapterScore: 100,
    });
    // applicableWeight = 0.05 (address) + 0.25 (name) + 0.05 (phone) + 0.3 (district) + 0.3 (chapter) = 0.95
    // weightedSum = 100*0.05 + 100*0.25 + 0*0.05 + 100*0.3 + 100*0.3 = 5 + 25 + 0 + 30 + 30 = 90
    // 90 / 0.95 = 94.7368...
    expect(total).toBeCloseTo(94.7368, 4);
  });
});

describe('isAppointmentMatch', () => {
  test('should return true when active appointment matches court, division, and chapter', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'active' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(true);
  });

  test('should return false when appointments array is empty', () => {
    expect(isAppointmentMatch([], '081', '1', '7')).toBe(false);
  });

  test('should return false when matching appointment has status inactive', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'inactive' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(false);
  });

  test('should return false when matching appointment has status voluntarily-suspended', () => {
    const appointments = [
      makeAppointment({
        courtId: '081',
        divisionCode: '1',
        chapter: '7',
        status: 'voluntarily-suspended',
      }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(false);
  });

  test('should return false when court and division match but chapter does not', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '13', status: 'active' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(false);
  });

  test('should return false when chapter matches but court does not', () => {
    const appointments = [
      makeAppointment({ courtId: '082', divisionCode: '1', chapter: '7', status: 'active' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(false);
  });

  test('should return false when court and chapter match on different appointments', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '13', status: 'active' }),
      makeAppointment({ courtId: '082', divisionCode: '2', chapter: '7', status: 'active' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(false);
  });

  test('should return true with chapter normalization: case "07" matches appointment "7"', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'active' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '07')).toBe(true);
  });

  test('should return true with chapter normalization: case "11-subchapter-v" matches appointment "11"', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '11', status: 'active' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '11-subchapter-v')).toBe(true);
  });

  test('should return true when multiple appointments exist and one is a perfect match', () => {
    const appointments = [
      makeAppointment({ courtId: '082', divisionCode: '2', chapter: '13', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'active' }),
      makeAppointment({ courtId: '083', divisionCode: '3', chapter: '11', status: 'inactive' }),
    ];
    expect(isAppointmentMatch(appointments, '081', '1', '7')).toBe(true);
  });

  test('should return true when case division is included in a multi-division divisionCodes array', () => {
    const appointments = [
      makeAppointment({
        courtId: '081',
        divisionCode: undefined,
        divisionCodes: ['235', '236', '237'],
        chapter: '7',
        status: 'active',
      }),
    ];
    expect(isAppointmentMatch(appointments, '081', '237', '7')).toBe(true);
  });

  test('should return false when case division is not in the divisionCodes array', () => {
    const appointments = [
      makeAppointment({
        courtId: '081',
        divisionCode: undefined,
        divisionCodes: ['235', '236'],
        chapter: '7',
        status: 'active',
      }),
    ];
    expect(isAppointmentMatch(appointments, '081', '237', '7')).toBe(false);
  });
});

describe('resolveNameCollisionByScoring', () => {
  let context: ApplicationContext;
  let mockTrusteesRepo: Partial<TrusteesRepository>;
  let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockTrusteesRepo = {
      read: vi.fn(),
      release: vi.fn(),
    };

    mockAppointmentsRepo = {
      getTrusteeAppointments: vi.fn(),
      release: vi.fn(),
    };

    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      mockTrusteesRepo as TrusteesRepository,
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      mockAppointmentsRepo as TrusteeAppointmentsRepository,
    );
  });

  test('should return trusteeId when clear winner found (>75% and 5+ gap)', async () => {
    const event = makeEvent({
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001' },
      },
    });
    const winner = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe Winner',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const loser = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe Loser',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });

    // Winner: perfect match (100 points)
    const winnerAppointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-01',
        effectiveDate: '2024-01-01',
      }),
    ];
    // Loser: only state match (30 points address, 0 district, 0 chapter = 6 total)
    const loserAppointments = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '11',
        courtId: '082',
        divisionCode: '2',
        appointedDate: '2024-01-01',
        effectiveDate: '2024-01-01',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(winner)
      .mockResolvedValueOnce(loser);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(winnerAppointments)
      .mockResolvedValueOnce(loserAppointments);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') throw new Error('expected resolved outcome');
    expect(result.trusteeId).toBe('trustee-1');
    expect(result.candidateScores).toHaveLength(2);
  });

  test('does not resolve a single candidate at exactly the 75-point threshold (boundary: > not >=)', async () => {
    // name=100 (25%), phone=100/email=0 (5%/5%), district=50/same-court-different-division
    // (30%), chapter=100 (30%), address=0 (5%) => weighted total = exactly 75. meetsThreshold
    // requires totalScore > FUZZY_MATCH_SCORE_THRESHOLD (75), so this must NOT auto-resolve.
    const event = makeEvent({
      courtId: '081',
      courtDivisionCode: '1',
      chapter: '7',
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { phone: '5555551234', email: 'dxtr@example.com' },
      },
    });
    const candidate = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: undefined,
        phone: { number: '5555551234' },
        email: 'cams@example.com',
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '2', // same court, different division => districtDivisionScore 50
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue(candidate);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointments,
    );

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1']);

    expect(result.kind).toBe('unresolved');
    if (result.kind !== 'unresolved') throw new Error('expected unresolved outcome');
    expect(result.candidateScores[0].totalScore).toBe(75);
  });

  test('resolves when the winner/runner-up gap is exactly the 5-point minimum (boundary: >= not >)', async () => {
    // Both candidates: address=0 (no dxtr cityStateZipCountry), name=100, phone=0 (mismatched,
    // comparable), district=100, chapter=100 (same-appointment match on both) — differing only on
    // email: winner matches (100) => total 90, runner-up mismatches (0) => total 85. Gap is
    // exactly 5 == FUZZY_MATCH_MIN_GAP, which hasSignificantGap requires via >=, so this must
    // resolve.
    const event = makeEvent({
      courtId: '081',
      courtDivisionCode: '1',
      chapter: '7',
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { phone: '5555550000', email: 'shared@example.com' },
      },
    });
    const winner = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: undefined,
        phone: { number: '5555559999' },
        email: 'shared@example.com',
      },
    });
    const runnerUp = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe',
      public: {
        address: undefined,
        phone: { number: '5555559999' },
        email: 'different@example.com',
      },
    });
    const winnerAppointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
      }),
    ];
    const runnerUpAppointments = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(winner)
      .mockResolvedValueOnce(runnerUp);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(winnerAppointments)
      .mockResolvedValueOnce(runnerUpAppointments);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') throw new Error('expected resolved outcome');
    expect(result.trusteeId).toBe('trustee-1');
    expect(result.candidateScores.find((c) => c.trusteeId === 'trustee-1')?.totalScore).toBe(90);
    expect(result.candidateScores.find((c) => c.trusteeId === 'trustee-2')?.totalScore).toBe(85);
  });

  test('should return an unresolved outcome when no candidate scores >75%', async () => {
    const event = makeEvent();
    const candidate1 = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe 1',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const candidate2 = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe 2',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Queens',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });

    // Both candidates score low (only state match = 30 address * 0.2 = 6 points)
    const appointments1 = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '11',
        courtId: '082',
        divisionCode: '2',
      }),
    ];
    const appointments2 = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '12',
        courtId: '082',
        divisionCode: '3',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(candidate1)
      .mockResolvedValueOnce(candidate2);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(appointments1)
      .mockResolvedValueOnce(appointments2);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result).toEqual({
      kind: 'unresolved',
      candidateScores: expect.arrayContaining([
        expect.objectContaining({ trusteeId: 'trustee-1' }),
        expect.objectContaining({ trusteeId: 'trustee-2' }),
      ]),
    });
  });

  test('should return an unresolved outcome when top scores within 5 points', async () => {
    const event = makeEvent();
    const candidate1 = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe 1',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const candidate2 = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe 2',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });

    // Both score 80 (perfect address + court match = 20 + 40 = 60, then chapter 50% match = 20, total 80)
    const appointments1 = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '2',
      }),
    ];
    const appointments2 = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '7',
        courtId: '081',
        divisionCode: '3',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(candidate1)
      .mockResolvedValueOnce(candidate2);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(appointments1)
      .mockResolvedValueOnce(appointments2);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result).toEqual({
      kind: 'unresolved',
      candidateScores: expect.any(Array),
    });
  });

  test('should return winner when single candidate meets 75% threshold', async () => {
    const event = makeEvent({
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001' },
      },
    });
    const candidate = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
      }),
    ]; // court + division + chapter all match on this single appointment

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue(candidate);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointments,
    );

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1']);

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') throw new Error('expected resolved outcome');
    expect(result.trusteeId).toBe('trustee-1');
    expect(result.candidateScores).toHaveLength(1);
  });

  test('does not auto-resolve when district/division and chapter scores each come from a different active appointment', async () => {
    // Trustee holds two active appointments: one matches the case's division (different
    // chapter), the other matches the case's chapter (different division). Neither appointment
    // alone matches court + division + chapter, so isAppointmentMatch is false for both — but
    // districtDivisionScore and chapterScore are each computed independently via .some() across
    // all appointments, so the combined score can still clear the auto-match threshold. This
    // must fall through to 'unresolved' (human review) rather than auto-linking.
    const event = makeEvent({
      courtId: '081',
      courtDivisionCode: '2',
      chapter: '7',
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001' },
      },
    });
    const candidate = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-division-match',
        trusteeId: 'trustee-1',
        chapter: '13',
        courtId: '081',
        divisionCode: '2',
      }),
      makeAppointment({
        id: 'appointment-chapter-match',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue(candidate);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointments,
    );

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1']);

    expect(result.kind).toBe('unresolved');
  });

  test('should lazy-load trustee and appointment data', async () => {
    const event = makeEvent({
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001' },
      },
    });
    const trustee = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-01',
        effectiveDate: '2024-01-01',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue(trustee);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointments,
    );

    await resolveNameCollisionByScoring(context, event, ['trustee-1']);

    expect(mockTrusteesRepo.read).toHaveBeenCalledWith('trustee-1');
    expect(mockAppointmentsRepo.getTrusteeAppointments).toHaveBeenCalledWith('trustee-1');
  });

  test('should skip a candidate whose repository lookup fails and score the rest', async () => {
    const event = makeEvent({
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001' },
      },
    });

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('trustee-1 not found'))
      .mockResolvedValueOnce(makeTrustee({ trusteeId: 'trustee-2', name: 'John Doe 2' }));
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeAppointment({
          trusteeId: 'trustee-2',
          chapter: '7',
          courtId: '081',
          divisionCode: '1',
        }),
      ]);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') throw new Error('expected resolved outcome');
    expect(result.trusteeId).toBe('trustee-2');
    expect(result.candidateScores).toHaveLength(1);
  });

  test('should return a no-match outcome when repository fetch throws an Error for every candidate', async () => {
    const event = makeEvent();

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database connection failed'),
    );
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1']);

    expect(result).toEqual({ kind: 'no-match' });
  });

  test('should return a no-match outcome when repository fetch throws a non-Error value for every candidate', async () => {
    const event = makeEvent();

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockRejectedValue('timeout');
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1']);

    expect(result).toEqual({ kind: 'no-match' });
  });

  test.each([
    ['TooManyRequestsError', new TooManyRequestsError('TEST', { message: 'Throttled.' })],
    ['GatewayTimeoutError', new GatewayTimeoutError('TEST', { message: 'Timed out.' })],
  ])(
    'should reject (not resolve with a truncated candidate set) when a candidate lookup fails with a transient error (%s)',
    async (_label, transientError) => {
      const event = makeEvent();

      (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(makeTrustee({ trusteeId: 'trustee-2', name: 'John Doe 2' }));
      (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          makeAppointment({
            trusteeId: 'trustee-2',
            chapter: '7',
            courtId: '081',
            divisionCode: '1',
          }),
        ]);

      await expect(
        resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']),
      ).rejects.toBe(transientError);
    },
  );

  test('should still skip a candidate and continue scoring the rest when the failure is non-transient (regression guard)', async () => {
    const event = makeEvent({
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001' },
      },
    });

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('trustee-1 not found'))
      .mockResolvedValueOnce(makeTrustee({ trusteeId: 'trustee-2', name: 'John Doe 2' }));
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeAppointment({
          trusteeId: 'trustee-2',
          chapter: '7',
          courtId: '081',
          divisionCode: '1',
        }),
      ]);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') throw new Error('expected resolved outcome');
    expect(result.trusteeId).toBe('trustee-2');
    expect(result.candidateScores).toHaveLength(1);
  });
});

describe('findInactivePerfectMatch', () => {
  test('should return undefined when all matching appointments are active', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'active' }),
    ];
    expect(findInactivePerfectMatch(appointments, '081', '1', '7')).toBeUndefined();
  });

  test('should return undefined when appointments array is empty', () => {
    expect(findInactivePerfectMatch([], '081', '1', '7')).toBeUndefined();
  });

  test.each([
    'inactive',
    'voluntarily-suspended',
    'involuntarily-suspended',
    'deceased',
    'resigned',
    'terminated',
    'removed',
  ] as const)('should return appointment for non-active status: %s', (status) => {
    const appointment = makeAppointment({
      courtId: '081',
      divisionCode: '1',
      chapter: '7',
      status,
    });
    const result = findInactivePerfectMatch([appointment], '081', '1', '7');
    expect(result).toBe(appointment);
  });

  test('should return undefined when court does not match', () => {
    const appointments = [
      makeAppointment({ courtId: '082', divisionCode: '1', chapter: '7', status: 'inactive' }),
    ];
    expect(findInactivePerfectMatch(appointments, '081', '1', '7')).toBeUndefined();
  });

  test('should return undefined when division does not match', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '2', chapter: '7', status: 'inactive' }),
    ];
    expect(findInactivePerfectMatch(appointments, '081', '1', '7')).toBeUndefined();
  });

  test('should return undefined when chapter does not match', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '13', status: 'inactive' }),
    ];
    expect(findInactivePerfectMatch(appointments, '081', '1', '7')).toBeUndefined();
  });

  test('should normalize chapter before comparison', () => {
    const appointment = makeAppointment({
      courtId: '081',
      divisionCode: '1',
      chapter: '7',
      status: 'inactive',
    });
    const result = findInactivePerfectMatch([appointment], '081', '1', '07');
    expect(result).toBe(appointment);
  });

  test('should return the most recently created match when multiple inactive appointments exist', () => {
    const first = makeAppointment({
      id: 'first',
      courtId: '081',
      divisionCode: '1',
      chapter: '7',
      status: 'inactive',
      createdOn: '2024-01-01T00:00:00Z',
    });
    const second = makeAppointment({
      id: 'second',
      courtId: '081',
      divisionCode: '1',
      chapter: '7',
      status: 'resigned',
      createdOn: '2024-06-01T00:00:00Z',
    });
    const result = findInactivePerfectMatch([first, second], '081', '1', '7');
    expect(result).toBe(second);
  });

  test('should return inactive match even when active non-matching appointments exist', () => {
    const activeNonMatching = makeAppointment({
      courtId: '082',
      divisionCode: '2',
      chapter: '13',
      status: 'active',
    });
    const inactiveMatching = makeAppointment({
      courtId: '081',
      divisionCode: '1',
      chapter: '7',
      status: 'voluntarily-suspended',
    });
    const result = findInactivePerfectMatch([activeNonMatching, inactiveMatching], '081', '1', '7');
    expect(result).toBe(inactiveMatching);
  });

  test('should return appointment when case division is included in a multi-division divisionCodes array', () => {
    const appointment = makeAppointment({
      courtId: '081',
      divisionCode: undefined,
      divisionCodes: ['235', '236', '237'],
      chapter: '7',
      status: 'inactive',
    });
    const result = findInactivePerfectMatch([appointment], '081', '237', '7');
    expect(result).toBe(appointment);
  });

  test('should return undefined when case division is not in the divisionCodes array', () => {
    const appointment = makeAppointment({
      courtId: '081',
      divisionCode: undefined,
      divisionCodes: ['235', '236'],
      chapter: '7',
      status: 'inactive',
    });
    expect(findInactivePerfectMatch([appointment], '081', '237', '7')).toBeUndefined();
  });
});
