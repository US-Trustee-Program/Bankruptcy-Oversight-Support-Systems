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
  stripNamePunctuation,
  normalizeNameForMatching,
  jaccardSimilarity,
  normalizeAddressLine,
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

// address1's default is intentionally kept equal to makeTrustee's default address1 ('123 Main
// St') so a test that doesn't care about the address dimension (only passing cityStateZip) still
// scores a full address match rather than an incidental partial one - callers that DO care about
// the address dimension should pass address1 explicitly rather than relying on this coincidence.
const makeDxtrTrustee = (cityStateZip?: string, address1 = '123 Main St'): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  legacy: cityStateZip ? { cityStateZipCountry: cityStateZip, address1 } : undefined,
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
  // difference the main pipeline intentionally does not bridge - matchTrusteeByName's
  // first-token-lastName search tier handles this case instead (see firstLastNameToken).
  test('should leave a generational suffix present on only one side intentionally unresolved', () => {
    expect(normalizeNameForMatching('John Doe')).not.toBe(
      normalizeNameForMatching('John Doe, Jr.'),
    );
  });
});

describe('matchTrusteeByName', () => {
  let context: ApplicationContext;

  const dxtrNamed = (
    fullName: string,
    overrides: Partial<DxtrTrusteeParty> = {},
  ): DxtrTrusteeParty => ({
    fullName,
    ...overrides,
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('should return a resolved outcome when exactly one trustee matches', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([trustee]);

    const result = await matchTrusteeByName(context, dxtrNamed(trustee.name));

    expect(result).toEqual({
      kind: 'resolved',
      trusteeId: trustee.trusteeId,
      nameScore: 100,
      nameMatchQuality: 'exact',
    });
  });

  test('should return a no-match outcome when no trustees match', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue([]);

    const result = await matchTrusteeByName(context, dxtrNamed('Nonexistent Trustee'));

    expect(result).toEqual({ kind: 'no-match' });
  });

  test('should return an ambiguous outcome with matchCandidates when multiple trustees match', async () => {
    const trustee1 = MockData.getTrustee();
    const trustee2 = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
      trustee1,
      trustee2,
    ]);

    const result = await matchTrusteeByName(context, dxtrNamed(trustee1.name));

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

    await matchTrusteeByName(context, dxtrNamed('  ' + trustee.name + '  '));

    expect(findSpy).toHaveBeenCalledWith(trustee.name);
  });

  test('should not call the fuzzy fallback when the exact-match path finds a result', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([trustee]);
    const scoredSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored');

    await matchTrusteeByName(context, dxtrNamed(trustee.name));

    expect(scoredSpy).not.toHaveBeenCalled();
  });

  test('should fall back to the scored search and resolve when normalization bridges a punctuation gap', async () => {
    const trustee = MockData.getTrustee({ name: 'John Doe, Jr.' });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    const scoredSpy = vi
      .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
      .mockResolvedValue([trustee]);

    const result = await matchTrusteeByName(context, dxtrNamed('John Doe Jr.'));

    expect(scoredSpy).toHaveBeenCalledWith('John Doe Jr.');
    expect(result).toEqual({
      kind: 'resolved',
      trusteeId: trustee.trusteeId,
      nameScore: 100,
      nameMatchQuality: 'fuzzy',
    });
  });

  // Each case is a distinct way matchTrusteeByName's fallback tiers can still find nothing:
  // no candidates at all; a candidate present but not normalize-matching; a candidate differing
  // by more than punctuation (a source-system artifact alongside content that isn't just a
  // middle-name gap - real-world pattern: DXTR "John M. Doe_13" vs CAMS "John Doe" with no
  // firstName/lastName set on the DXTR side here, so the first-token-lastName search tier has no
  // lastName to search on and correctly falls through); and no matching lastName token at all.
  test.each([
    ['no scored candidates at all', [], 'John Doe'],
    ['a scored candidate that does not normalize-match', [{ name: 'Jane Roe' }], 'John Doe Jr.'],
    [
      'a scored candidate differing by more than punctuation (dropped middle initial)',
      [{ name: 'John Doe' }],
      'John M. Doe_13',
    ],
  ])('should return no-match when %s', async (_description, trusteeOverrides, queryName) => {
    const trustees = trusteeOverrides.map((overrides) => MockData.getTrustee(overrides));
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored').mockResolvedValue(
      trustees,
    );

    const result = await matchTrusteeByName(context, dxtrNamed(queryName));

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

    const result = await matchTrusteeByName(context, dxtrNamed('John Doe Jr'));

    expect(result).toEqual({
      kind: 'ambiguous',
      matchCandidates: expect.arrayContaining([
        expect.objectContaining({ trusteeId: trustee1.trusteeId, totalScore: UNSCORED }),
        expect.objectContaining({ trusteeId: trustee2.trusteeId, totalScore: UNSCORED }),
      ]),
    });
  });

  // First-token-lastName search tier: neither composed-name tier above found a match, so this
  // tier searches CAMS by just the first token of DXTR's lastName (see firstLastNameToken) and
  // narrows results to trustees with an active appointment in the event's court - the same
  // courtId filter TrusteeSearchUseCase applies for the UI's manual search feature. Weaker
  // evidence than a full string match, so it always surfaces as 'ambiguous' even for a single
  // candidate, routing through resolveNameCollisionByScoring's scoring/appointment-match gate
  // rather than auto-resolving.
  describe('first-token-lastName search tier', () => {
    test('should surface a single candidate as ambiguous when found by first-token lastName search with a matching court appointment', async () => {
      const trustee = MockData.getTrustee({
        firstName: 'Richard',
        lastName: 'Marshack',
        name: 'Richard Marshack',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // full-name search (tiers 1-2)
        .mockResolvedValueOnce([trustee]); // first-token lastName search
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        { trusteeId: trustee.trusteeId, courtId: '081' },
      ]);

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Richard A Marshack (TR)', {
          firstName: 'Richard',
          middleName: 'A',
          lastName: 'Marshack (TR)',
        }),
        '081',
      );

      expect(result).toEqual({
        kind: 'ambiguous',
        matchCandidates: [expect.objectContaining({ trusteeId: trustee.trusteeId })],
      });
    });

    test('should search using only the first token of a lastName carrying trailing junk', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const scoredSpy = vi
        .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await matchTrusteeByName(
        context,
        dxtrNamed('Kc Cohen Trustee', { firstName: 'Kc', lastName: 'Cohen Trustee' }),
        '081',
      );

      expect(scoredSpy).toHaveBeenNthCalledWith(2, 'cohen');
    });

    test('should exclude a candidate with no active appointment in the event court', async () => {
      const trustee = MockData.getTrustee({
        firstName: 'Richard',
        lastName: 'Marshack',
        name: 'Richard Marshack',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([trustee]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        { trusteeId: trustee.trusteeId, courtId: '999' },
      ]);

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Richard Marshack (TR)', { firstName: 'Richard', lastName: 'Marshack (TR)' }),
        '081',
      );

      expect(result).toEqual({ kind: 'no-match' });
    });

    test('should surface every candidate sharing the lastName token and a matching court appointment', async () => {
      const trustee1 = MockData.getTrustee({ lastName: 'Cohen', name: 'Aaron Cohen' });
      const trustee2 = MockData.getTrustee({ lastName: 'Cohen', name: 'Merrill Cohen' });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([trustee1, trustee2]);
      vi.spyOn(MockMongoRepository.prototype, 'getAppointmentsByTrusteeIds').mockResolvedValue([
        { trusteeId: trustee1.trusteeId, courtId: '081' },
        { trusteeId: trustee2.trusteeId, courtId: '081' },
      ]);

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Kc Cohen Trustee', { firstName: 'Kc', lastName: 'Cohen Trustee' }),
        '081',
      );

      expect(result).toEqual({
        kind: 'ambiguous',
        matchCandidates: expect.arrayContaining([
          expect.objectContaining({ trusteeId: trustee1.trusteeId }),
          expect.objectContaining({ trusteeId: trustee2.trusteeId }),
        ]),
      });
    });

    test('should not apply this tier when the DXTR event carries no lastName', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const scoredSpy = vi
        .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]);

      const result = await matchTrusteeByName(context, dxtrNamed('John Quincy Doe'), '081');

      expect(scoredSpy).toHaveBeenCalledTimes(1); // only the tier-2 full-name search, no second call
      expect(result).toEqual({ kind: 'no-match' });
    });

    test('should not apply this tier when no courtId is provided', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const scoredSpy = vi
        .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]); // tier-2 full-name search finds nothing

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Kc Cohen Trustee', { firstName: 'Kc', lastName: 'Cohen Trustee' }),
      );

      expect(scoredSpy).toHaveBeenCalledTimes(1); // only the tier-2 full-name search
      expect(result).toEqual({ kind: 'no-match' });
    });
  });
});

describe('calculateAddressScore', () => {
  test.each([
    ['address lines, city, state, and zip all match exactly', '123 Main St', '123 Main St', 100],
    // CAMS-880 regression: this is the exact false-positive scenario the fix targets. Before the
    // fix, calculateAddressScore never read address1 at all, so two genuinely different offices
    // sharing a city/zip scored a full 100. Address lines are now 50% of the score, so a complete
    // mismatch there caps the total well below what locale-only agreement can reach on its own.
    // addressLinesScore=0 (50%) + zipScore=100 (30%) + cityStateScore=100 (20%) = 50
    [
      'city/state/zip match but address lines are completely different (CAMS-880)',
      '123 Main St',
      '456 Oak Ave',
      50,
    ],
    // normalizeAddressLine expands "St" -> "street" on the DXTR side, so both sides normalize to
    // the identical string "123 main street" - addressLinesScore=100 (50%) + zipScore=100 (30%)
    // + cityStateScore=100 (20%) = 100
    [
      'an abbreviation and its expanded form are treated as an exact address-line match',
      '123 Main St',
      '123 Main Street',
      100,
    ],
  ])('should return correct score when %s', (_desc, dxtrAddress1, camsAddress1, expected) => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: dxtrAddress1,
    };
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: camsAddress1,
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(expected);
  });

  test('should score zip match + address line mismatch + city mismatch below a full match', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'Somewhere, NY 10001',
      address1: '123 Main St',
    };
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Oak Ave',
      countryCode: 'US',
    };

    // addressLinesScore=0 (50%) + zipScore=100 (30%) + cityStateScore~15.38 (20%) ~= 33.08,
    // rounded to the nearest integer
    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(33);
  });

  test('should return 0 when address lines, city, state, and zip all differ', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: '123 Main St',
    };
    const camsAddress: Address = {
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      address1: '456 Oak Ave',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(0);
  });

  test('should be case-insensitive', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'NEW YORK, ny 10001',
      address1: '123 MAIN ST',
    };
    const camsAddress: Address = {
      city: 'new york',
      state: 'NY',
      zipCode: '10001',
      address1: '123 main st',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(100);
  });

  test.each([
    ['DXTR address is undefined', undefined, 0],
    [
      'cityStateZipCountry is malformed',
      { cityStateZipCountry: 'Invalid Format', address1: '123 Main St' },
      0,
    ],
    [
      'cityStateZipCountry has a country suffix',
      { cityStateZipCountry: 'New York, NY 10001 US', address1: '123 Main St' },
      100,
    ],
  ])('should handle when %s', (_desc, dxtrAddress, expected) => {
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '123 Main St',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(expected);
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
      address1: '123 Main St',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(100);
  });

  test.each([
    ['DXTR has a ZIP+4 extension CAMS lacks, same base ZIP5', 'New York, NY 10001-1234', '10001'],
    ['CAMS has a ZIP+4 extension DXTR lacks, same base ZIP5', 'New York, NY 10001', '10001-5678'],
    [
      'both sides have a ZIP+4 extension but they differ, same base ZIP5',
      'New York, NY 10001-1234',
      '10001-5678',
    ],
  ])('should return 100 when %s', (_desc, cityStateZipCountry, camsZipCode) => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry,
      address1: '123 Main St',
    };
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: camsZipCode,
      address1: '123 Main St',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(100);
  });

  test('should score lower when the base ZIP5 genuinely differs despite a ZIP+4 on one side', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10002-1234',
      address1: '123 Main St',
    };
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '123 Main St',
      countryCode: 'US',
    };

    // addressLinesScore=100 (50%) + zipScore=0 (30%) + cityStateScore=100 (20%) = 70
    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(70);
  });
});

describe('jaccardSimilarity', () => {
  test('should return 100 for identical bigram sets', () => {
    expect(jaccardSimilarity(['ab', 'bc', 'cd'], ['ab', 'bc', 'cd'])).toBe(100);
  });

  test('should return 0 for completely disjoint bigram sets', () => {
    expect(jaccardSimilarity(['ab', 'bc'], ['xy', 'yz'])).toBe(0);
  });

  test('should return a partial score proportional to overlap', () => {
    // intersection {ab, bc} = 2, union {ab, bc, cd, ef} = 4 -> 2/4 = 50
    expect(jaccardSimilarity(['ab', 'bc', 'cd'], ['ab', 'bc', 'ef'])).toBe(50);
  });

  test('should return 0 when both sets are empty', () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  test('should return 0 when only one set is empty', () => {
    expect(jaccardSimilarity(['ab'], [])).toBe(0);
    expect(jaccardSimilarity([], ['ab'])).toBe(0);
  });

  test('should treat duplicate bigrams within a set as a single member', () => {
    // intersection {ab} = 1, union {ab, bc} = 2 -> 1/2 = 50, duplicates don't inflate either set
    expect(jaccardSimilarity(['ab', 'ab', 'bc'], ['ab'])).toBe(50);
  });
});

describe('normalizeAddressLine', () => {
  test('should lowercase and strip punctuation', () => {
    expect(normalizeAddressLine('123 Main St., Suite #4')).toBe('123 main street suite 4');
  });

  test.each([
    ['St', 'Street'],
    ['St.', 'Street'],
    ['Ave', 'Avenue'],
    ['Blvd', 'Boulevard'],
    ['Dr', 'Drive'],
    ['Rd', 'Road'],
    ['Ln', 'Lane'],
    ['Ct', 'Court'],
    ['Pl', 'Place'],
    ['Ste', 'Suite'],
    ['Apt', 'Apartment'],
    ['Fl', 'Floor'],
    ['Bldg', 'Building'],
  ])('should expand street/unit abbreviation %s to %s', (abbreviation, expanded) => {
    const result = normalizeAddressLine(`123 Main ${abbreviation}`);
    expect(result).toBe(`123 main ${expanded.toLowerCase()}`);
  });

  test.each([
    ['N', 'North'],
    ['S', 'South'],
    ['E', 'East'],
    ['W', 'West'],
  ])('should expand standalone directional %s to %s', (abbreviation, expanded) => {
    const result = normalizeAddressLine(`123 ${abbreviation} Main Street`);
    expect(result).toBe(`123 ${expanded.toLowerCase()} main street`);
  });

  test('should expand a # unit marker to suite', () => {
    expect(normalizeAddressLine('123 Main Street #4')).toBe('123 main street suite 4');
  });

  test.each([
    ['Suite', 'suite'],
    ['Apt', 'apartment'],
    ['Floor', 'floor'],
    ['Unit', 'unit'],
    ['Room', 'room'],
  ])(
    'should not duplicate the unit designator when # follows an already-spelled-out %s',
    (spelled, expanded) => {
      expect(normalizeAddressLine(`123 Main St., ${spelled} #4`)).toBe(
        `123 main street ${expanded} 4`,
      );
    },
  );

  test('should expand a leading # with no preceding unit designator to suite', () => {
    expect(normalizeAddressLine('#4 Main St')).toBe('suite 4 main street');
  });

  test('should collapse repeated whitespace', () => {
    expect(normalizeAddressLine('123   Main    Street')).toBe('123 main street');
  });

  test('should return an empty string for undefined input', () => {
    expect(normalizeAddressLine(undefined)).toBe('');
  });

  test('should return an empty string for blank input', () => {
    expect(normalizeAddressLine('   ')).toBe('');
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
    const appointments = [
      makeAppointment({
        courtId: '081',
        divisionCode: '1',
        chapter: appointmentChapter,
        status: 'active',
      }),
    ];
    const score = calculateChapterScore('081', '1', queryChapter, appointments);
    expect(score).toBe(100);
  });

  test('should return 0 when no matching chapter', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '11', status: 'active' }),
    ];
    const score = calculateChapterScore('081', '1', '7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when matching appointment is not active', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'inactive' }),
    ];
    const score = calculateChapterScore('081', '1', '7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when appointments array is empty', () => {
    const score = calculateChapterScore('081', '1', '7', []);
    expect(score).toBe(0);
  });

  test('should return 100 when multiple division-matching appointments and one matches chapter', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '11', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '13', status: 'active' }),
    ];
    const score = calculateChapterScore('081', '1', '7', appointments);
    expect(score).toBe(100);
  });

  test('should return 0 when the trustee has no appointment covering the case division, even if a different-division appointment matches the case chapter', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '2', chapter: '7', status: 'active' }),
    ];
    const score = calculateChapterScore('081', '1', '7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when a division-matching appointment has a different chapter, even though an unrelated-division appointment matches the case chapter', () => {
    const appointments = [
      // Covers the case's division (081/1), but a different chapter (11).
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '11', status: 'active' }),
      // Matches the case's chapter (7), but an unrelated division (2) — must not count.
      makeAppointment({ courtId: '081', divisionCode: '2', chapter: '7', status: 'active' }),
    ];
    const score = calculateChapterScore('081', '1', '7', appointments);
    expect(score).toBe(0);
  });

  test('should return 100 when a division-matching appointment also matches chapter, even alongside an unrelated-division appointment', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', chapter: '7', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '2', chapter: '13', status: 'active' }),
    ];
    const score = calculateChapterScore('081', '1', '7', appointments);
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
      // address1 explicit (matches makeTrustee()'s default) so addressScore=100 is visibly
      // intentional here, not a coincidence of two fixtures' defaults happening to agree.
      {
        ...makeDxtrTrustee('New York, NY 10001', '123 Main St'),
        firstName: 'John',
        lastName: 'Doe',
      },
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

    // addressLinesScore=100 (identical address1, 50%) + zipScore=0 (mismatch, 30%) +
    // cityStateScore=100 (match, 20%) = 70
    expect(score.addressScore).toBe(70); // Address lines + city/state match, zip differs
    expect(score.nameScore).toBe(100); // First and last name match
    expect(score.districtDivisionScore).toBe(50); // Same court, different division
    // The only appointment here (division '2') doesn't cover the case's division ('1'), so
    // chapter cannot be credited even though its chapter value equals the case's chapter.
    expect(score.chapterScore).toBe(0);
    // phone/email null (no phone/email on either side) -> applicableWeight = 0.9
    // weightedSum = 70*0.05 + 100*0.25 + 50*0.3 + 0*0.3 = 3.5 + 25 + 15 + 0 = 43.5
    // 43.5 / 0.9 = 48.3333
    expect(score.totalScore).toBeCloseTo(48.3333, 4);
  });

  test('should return totalScore ~5.56 when only address matches (phone/email null)', () => {
    const score = calculateCandidateScore(
      context,
      // address1 explicit (matches makeTrustee()'s default) so addressScore=100 below is
      // visibly intentional, not a coincidence of two fixtures' defaults happening to agree.
      makeDxtrTrustee('New York, NY 10001', '123 Main St'), // No firstName/lastName - nameScore is 0
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

  test('should return totalScore 0 when court differs, even though the case chapter equals the trustee appointment chapter', () => {
    // A matching chapter value alone must NOT be creditable when no active appointment covers
    // the case's court+division.
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
    expect(score.chapterScore).toBe(0);
    // phone/email null -> applicableWeight = 0.9
    // weightedSum = 0*0.05 + 0*0.25 + 0*0.3 + 0*0.3 = 0
    expect(score.totalScore).toBeCloseTo(0, 10);
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

  test('should return 85 when dxtr first name is a single initial matching cams first name first letter', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'G. Doe',
      firstName: 'G',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'George', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should return 85 when cams first name is a single initial matching dxtr first name first letter', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'George Doe',
      firstName: 'George',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'G', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should return the lower of the first/middle sub-scores when both relax', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'G. Quincy Doe',
      firstName: 'G',
      middleName: 'Quincy',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'George', middleName: 'Robert', lastName: 'Doe' });

    // firstScore=85 (initial-vs-full), middleScore=15 (genuine conflict) - min is 15.
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

  test('should return 0 when first name is missing on one side (unlike a missing middle name)', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Doe',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should return 100 when lastName carries a baked-in generational suffix the other side omits', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Patrick J. Malloy III',
      firstName: 'Patrick',
      middleName: 'J',
      lastName: 'Malloy',
    };
    const camsTrustee = makeTrustee({
      firstName: 'Patrick',
      middleName: 'Joseph',
      lastName: 'Malloy, III',
    });

    // lastName equality holds once the baked-in suffix is stripped; middle is initial-vs-full.
    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
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
    // address=100 (5%), name=0/genuine mismatch (25%), phone=100/email=100 (5%/5%),
    // district=100/chapter=100 (30%/30%) => weighted total = exactly 75. meetsThreshold requires
    // totalScore > FUZZY_MATCH_SCORE_THRESHOLD (75), so this must NOT auto-resolve. district=100
    // and chapter=100 must come from a single division+chapter-matching appointment, not two
    // different ones, so this fixture's one appointment covers both.
    const event = makeEvent({
      courtId: '081',
      courtDivisionCode: '1',
      chapter: '7',
      dxtrTrustee: {
        fullName: 'John Smith',
        firstName: 'John',
        lastName: 'Smith',
        legacy: {
          cityStateZipCountry: 'New York, NY 10001',
          phone: '5555551234',
          email: 'shared@example.com',
        },
      },
    });
    const candidate = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe', // genuine last-name mismatch vs. DXTR's "Smith" => nameScore 0
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phone: { number: '5555551234' },
        email: 'shared@example.com',
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1', // exact court+division+chapter match on this one record
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

  test('remains unresolved because chapterScore is scoped to the division-matching appointment', async () => {
    // Trustee holds two active appointments: one matches the case's division (different
    // chapter), the other matches the case's chapter (different division). Neither appointment
    // alone matches court + division + chapter, so isAppointmentMatch is false for both, and
    // chapterScore is 0 since the division-matching appointment's chapter differs from the
    // case's. Guards the outcome at the resolveNameCollisionByScoring level, on top of
    // calculateChapterScore's own unit coverage of the same scenario.
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
