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
  firstLastNameToken,
  lastNameSurnameCandidates,
  lastNameTokensMatch,
  calculatePhoneScore,
  calculateEmailScore,
  calculateTotalScore,
  resolveNameCollisionByScoring,
  tokenizeNameForIntersection,
  parseCityStateZip,
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
  scoreFirstNamePart,
  scoreMiddleNamePart,
  isKnownNicknamePair,
  isFirstMiddleSwap,
  isOneSidedMiddleNameMatch,
  calculateNumericTokenScore,
  padSingleDigitNumericToken,
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

/**
 * Synthetic name fixtures below stand in for real patterns once observed in a staging backtest -
 * none of these names are real ACMS/CAMS data. Each is named for the CONDITION it models, not the
 * people it replaces, so a reader sees why the fixture exists from the declaration alone.
 */

/** A name-shaped parenthetical alongside a lastName - could carry a real alias/maiden surname
 * rather than a role/status code, so it must be offered as its own surname candidate. */
const PARENTHETICAL_ALIAS_SURNAME = 'DOE (ROE)';

/** A lastName carrying a baked-in generational suffix on one side, omitted on the other - the
 * suffix must be stripped before the two sides compare equal. */
const GENERATIONAL_SUFFIX_NAME_PAIR = {
  dxtrFullName: 'Jordan J. Roe III',
  dxtrFirstName: 'Jordan',
  dxtrMiddleName: 'J',
  dxtrLastName: 'Roe',
  camsFirstName: 'Jordan',
  camsMiddleName: 'Joseph',
  camsLastName: 'Roe, III',
} as const;

/** Two different multi-word surnames sharing the same leading prefix particle ("Van X") - a false
 * positive if the particle alone were trusted as a match. */
const DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR = {
  dxtrFullName: 'William Van Corwyn',
  dxtrFirstName: 'William',
  dxtrLastName: 'Van Corwyn',
  camsFirstName: 'William',
  camsMiddleName: 'A.',
  camsLastName: 'Van Bramlett',
} as const;

/** Both sides use the identical multi-word surname prefix and genuinely match - the positive
 * control for DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR. */
const MATCHING_SHARED_PARTICLE_SURNAME_PAIR = {
  fullName: 'John Van Roeburn',
  firstName: 'John',
  lastName: 'Van Roeburn',
} as const;

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

  describe('first-token-lastName search tier', () => {
    test('should surface a single candidate as ambiguous when found by first-token lastName search', async () => {
      const trustee = MockData.getTrustee({
        firstName: 'Richard',
        lastName: 'Marstock',
        name: 'Richard Marstock',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // full-name search (tiers 1-2)
        .mockResolvedValueOnce([trustee]); // first-token lastName search

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Richard A Marstock (TR)', {
          firstName: 'Richard',
          middleName: 'A',
          lastName: 'Marstock (TR)',
        }),
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
        dxtrNamed('Kc Doheny Trustee', { firstName: 'Kc', lastName: 'Doheny Trustee' }),
      );

      expect(scoredSpy).toHaveBeenNthCalledWith(2, 'doheny');
    });

    test('should surface a candidate with no active appointment in the event court, not exclude it', async () => {
      const trustee = MockData.getTrustee({
        firstName: 'Richard',
        lastName: 'Marstock',
        name: 'Richard Marstock',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([trustee]);

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Richard Marstock (TR)', { firstName: 'Richard', lastName: 'Marstock (TR)' }),
      );

      expect(result).toEqual({
        kind: 'ambiguous',
        matchCandidates: [expect.objectContaining({ trusteeId: trustee.trusteeId })],
      });
    });

    test('should surface every candidate sharing the lastName token', async () => {
      const trustee1 = MockData.getTrustee({ lastName: 'Doheny', name: 'Aaron Doheny' });
      const trustee2 = MockData.getTrustee({ lastName: 'Doheny', name: 'Merrill Doheny' });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([trustee1, trustee2]);

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Kc Doheny Trustee', { firstName: 'Kc', lastName: 'Doheny Trustee' }),
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

      const result = await matchTrusteeByName(context, dxtrNamed('John Quincy Doe'));

      expect(scoredSpy).toHaveBeenCalledTimes(1); // only the tier-2 full-name search, no second call
      expect(result).toEqual({ kind: 'no-match' });
    });

    // Regression coverage: a hyphenated compound lastName where DXTR carries both a maiden and
    // married surname ("Casciato-Rowley") but CAMS only has the second half ("Rowley") - this
    // shape models a real pattern found in a staging trustee-match-verification export. Searching
    // only the first hyphen segment ("casciato") finds nothing, so the second segment must also
    // be tried.
    test('should also search the last hyphen segment of a hyphenated lastName', async () => {
      const trustee = MockData.getTrustee({ lastName: 'Rowley', name: 'Janet S. Rowley' });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const scoredSpy = vi
        .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // tier-2 full-name search
        .mockResolvedValueOnce([]) // first-token lastName search: "casciato"
        .mockResolvedValueOnce([trustee]); // last-token lastName search: "rowley"

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Janet S Casciato-Rowley', {
          firstName: 'Janet',
          middleName: 'S',
          lastName: 'Casciato-Rowley',
        }),
      );

      expect(scoredSpy).toHaveBeenNthCalledWith(2, 'casciato');
      expect(scoredSpy).toHaveBeenNthCalledWith(3, 'rowley');
      expect(result).toEqual({
        kind: 'ambiguous',
        matchCandidates: [expect.objectContaining({ trusteeId: trustee.trusteeId })],
      });
    });

    test('should not issue a redundant last-hyphen-segment search when the lastName has no hyphen', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const scoredSpy = vi
        .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // tier-2 full-name search
        .mockResolvedValueOnce([]); // first-token lastName search

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Richard Marstock (TR)', { firstName: 'Richard', lastName: 'Marstock (TR)' }),
      );

      expect(scoredSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ kind: 'no-match' });
    });

    test('should not issue a redundant search when both hyphen segments reduce to the same token', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      const scoredSpy = vi
        .spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // tier-2 full-name search
        .mockResolvedValueOnce([]); // single deduped lastName-token search: "lee"

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Robert Lee-Lee', { firstName: 'Robert', lastName: 'Lee-Lee' }),
      );

      expect(scoredSpy).toHaveBeenCalledTimes(2);
      expect(scoredSpy).toHaveBeenNthCalledWith(2, 'lee');
      expect(result).toEqual({ kind: 'no-match' });
    });

    test('should dedupe a candidate found by both hyphen segments', async () => {
      const trustee = MockData.getTrustee({
        lastName: 'Garcia-Miranda',
        name: 'Ana Garcia-Miranda',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // tier-2 full-name search
        .mockResolvedValueOnce([trustee]) // first-token lastName search: "garcia"
        .mockResolvedValueOnce([trustee]); // last-token lastName search: "miranda"

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Ana Garcia-Miranda', { firstName: 'Ana', lastName: 'Garcia-Miranda' }),
      );

      expect(result).toEqual({
        kind: 'ambiguous',
        matchCandidates: [expect.objectContaining({ trusteeId: trustee.trusteeId })],
      });
    });

    // Real backtest finding: searchTrusteesByNameScored's bare matchScore > 0 floor lets a
    // single-word lastName-token query surface a candidate whose surname only coincidentally
    // shares a phonetic code, with zero corroborating evidence anywhere else - this becomes a
    // persisted "ambiguous" disposition for a candidate that never had any chance of resolving.
    test('should exclude a candidate whose lastName is not JaroWinkler-close to the searched token', async () => {
      const unrelatedTrustee = MockData.getTrustee({
        lastName: 'Vandelay',
        name: 'Byron Vandelay',
      });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // tier-2 full-name search
        .mockResolvedValueOnce([unrelatedTrustee]); // lastName-token search: "kettering"

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Rex Kettering', { firstName: 'Rex', lastName: 'Kettering' }),
      );

      expect(result).toEqual({ kind: 'no-match' });
    });

    test('should keep a candidate whose lastName is a genuine near-miss of the searched token', async () => {
      const trustee = MockData.getTrustee({ lastName: 'Danielsen', name: 'Pat Danielsen' });
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByNameScored')
        .mockResolvedValueOnce([]) // tier-2 full-name search
        .mockResolvedValueOnce([trustee]); // lastName-token search: "danielson"

      const result = await matchTrusteeByName(
        context,
        dxtrNamed('Pat Danielson', { firstName: 'Pat', lastName: 'Danielson' }),
      );

      expect(result).toEqual({
        kind: 'ambiguous',
        matchCandidates: [expect.objectContaining({ trusteeId: trustee.trusteeId })],
      });
    });
  });
});

describe('tokenizeNameForIntersection', () => {
  test('lowercases, strips punctuation, and dedupes tokens', () => {
    expect(tokenizeNameForIntersection('W. Renwick Doone')).toEqual(['renwick', 'doone']);
  });

  test('drops single-character tokens', () => {
    expect(tokenizeNameForIntersection('C. Selwyn Marchetti')).toEqual(['selwyn', 'marchetti']);
  });

  test('keeps 2-character tokens (e.g. a "Mc" name-particle)', () => {
    expect(tokenizeNameForIntersection('Jordan Mc Allery')).toEqual(['jordan', 'mc', 'allery']);
  });

  test('drops role-suffix stopwords', () => {
    expect(tokenizeNameForIntersection('Jordan Doone, Jr.')).toEqual(['jordan', 'doone']);
  });

  test('drops "do not use" style ACMS annotations', () => {
    expect(tokenizeNameForIntersection('Jordan B Marchetti - Do Not Use')).toEqual([
      'jordan',
      'marchetti',
    ]);
  });

  test('handles a lastName with an internal space (the McLane case)', () => {
    expect(tokenizeNameForIntersection('Frank O Mc Lane')).toEqual(['frank', 'mc', 'lane']);
  });
});
describe('parseCityStateZip', () => {
  test('parses city, state, and zip separated by commas', () => {
    expect(parseCityStateZip('New York, NY 10001')).toEqual({
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
    });
  });

  test('parses city, state, and zip separated by whitespace only', () => {
    expect(parseCityStateZip('Corinth MS 38834')).toEqual({
      city: 'Corinth',
      state: 'MS',
      zipCode: '38834',
    });
  });

  test('ignores a trailing country segment', () => {
    expect(parseCityStateZip('Corinth, MS, 38834, USA')).toEqual({
      city: 'Corinth',
      state: 'MS',
      zipCode: '38834',
    });
  });

  test('parses a ZIP+4 code', () => {
    expect(parseCityStateZip('Corinth, MS 38834-1234')).toEqual({
      city: 'Corinth',
      state: 'MS',
      zipCode: '38834-1234',
    });
  });

  // A literal "-0000" +4 suffix is a placeholder, not real ZIP+4 data (see the dedicated test
  // below), so this zipCode is now the plain 5-digit value.
  test('recovers city and zip with a null state when no state token is present', () => {
    expect(parseCityStateZip('Woodland Hills 91367-0000')).toEqual({
      city: 'Woodland Hills',
      state: null,
      zipCode: '91367',
    });
  });

  // Real backtest finding: the vast majority of ACMS addresses carry a literal "-0000" +4
  // suffix - far too common across that many distinct addresses to be genuine ZIP+4 data, so it
  // is stripped to the plain 5-digit zip rather than persisted as if it were real +4 precision.
  test('strips a literal "-0000" +4 suffix as a placeholder, not real ZIP+4 data', () => {
    expect(parseCityStateZip('Corinth, MS 38834-0000')).toEqual({
      city: 'Corinth',
      state: 'MS',
      zipCode: '38834',
    });
  });

  test('keeps a genuine, non-zero ZIP+4 suffix', () => {
    expect(parseCityStateZip('Corinth, MS 38834-1234')).toEqual({
      city: 'Corinth',
      state: 'MS',
      zipCode: '38834-1234',
    });
  });

  test('recovers a multi-word city with a null state', () => {
    expect(parseCityStateZip('Salt Lake City 84101')).toEqual({
      city: 'Salt Lake City',
      state: null,
      zipCode: '84101',
    });
  });

  test('returns null when no zip-like token exists at all', () => {
    expect(parseCityStateZip('Corinth MS')).toBeNull();
  });

  test('returns null when the string is only a zip with no city', () => {
    expect(parseCityStateZip('91367-0000')).toBeNull();
  });

  test('recovers state and zip with an empty city when the string is only a state and zip', () => {
    expect(parseCityStateZip('MS 38834')).toEqual({
      city: '',
      state: 'MS',
      zipCode: '38834',
    });
  });

  test('returns null when the input is undefined', () => {
    expect(parseCityStateZip(undefined)).toBeNull();
  });

  test('returns null for an empty string', () => {
    expect(parseCityStateZip('')).toBeNull();
  });

  test('uses the rightmost zip-like token when multiple numeric tokens are present', () => {
    // A trailing numeric segment (e.g. a stray extra code) must win over an earlier zip-like
    // token - it also means the earlier "MS 38834" pair no longer reads as state+zip, so the
    // preceding state is folded into the recovered city with a null state.
    expect(parseCityStateZip('Corinth, MS 38834 12345')).toEqual({
      city: 'Corinth MS 38834',
      state: null,
      zipCode: '12345',
    });
  });

  // Real backtest finding (ACMS "FARMINGTON CN 06032-0000" - a data-entry typo for
  // Connecticut's real code, "CT"): a two-letter token in the state position that is NOT a real
  // USPS state/territory code must recover as state: null, the same as if it were absent, rather
  // than as the literal typo'd value - a bogus state then gets compared and scored as an active
  // disagreement downstream (doesStateMatch/doesCityMatch), which is worse than honestly reporting
  // "no state known" for a genuinely uncomparable field. Still excluded from `city` either way,
  // since it was never really part of the city name in this format.
  test('recovers city and zip with a null state when the state-position token is not a real USPS state code', () => {
    expect(parseCityStateZip('Farmington CN 06032-0000')).toEqual({
      city: 'Farmington',
      state: null,
      zipCode: '06032',
    });
  });

  test('accepts a real USPS state code regardless of casing', () => {
    expect(parseCityStateZip('Farmington ct 06032-0000')).toEqual({
      city: 'Farmington',
      state: 'ct',
      zipCode: '06032',
    });
  });
});
describe('calculateAddressScore', () => {
  test.each([
    ['address lines, city, state, and zip all match exactly', '123 Main St', '123 Main St', 100],
    // addressLinesScore=0 (50%) + zipScore=100 (30%) + cityStateScore=100 (20%) = 50 - a complete
    // address-line mismatch caps the total well below what locale-only agreement can reach alone.
    [
      'city/state/zip match but address lines are completely different',
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
    [
      'Pkwy and its expanded Parkway form are treated as an exact address-line match',
      '1052 Highland Colony Pkwy',
      '1052 Highland Colony Parkway',
      100,
    ],
    [
      'PO Box and P.O. Box are treated as an exact address-line match',
      'PO Box 51067',
      'P.O. Box 51067',
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

  // Regression coverage: bigram similarity alone cannot distinguish a single-digit house/suite
  // number, since generateBigrams drops any token shorter than 2 characters. Without the
  // numeric-token handling in calculateAddressScore's address-lines component, two different
  // single-digit suite numbers in the same building would score a false 100 here. Multi-digit
  // numbers already clear generateBigrams's length floor but are still diluted by the word
  // bigrams around them, so a mismatch there must also score below a true match. Expected values
  // are exact (not just "below 100") so this pins the fix's magnitude, not just its direction -
  // a future change that weakens the numeric-token penalty should fail these.
  test.each([
    [
      'a single-digit suite number mismatch in an otherwise-identical address',
      '123 Main St Suite 4',
      '123 Main St Suite 5',
      84,
    ],
    ['a single-digit house number mismatch', '4 Main St', '5 Main St', 70],
    [
      'a multi-digit suite number mismatch, even though bigram overlap alone is high',
      '100 Main Street Suite 100',
      '100 Main Street Suite 200',
      86,
    ],
    // Asymmetric case: a numeric token present on only one side scores a real partial penalty
    // rather than being ignored (see calculateNumericTokenScore's doc comment) - this is the
    // shape a missing suite number in DXTR or CAMS data actually produces.
    [
      'a numeric token present on only one side (missing suite number)',
      '123 Main St Suite 4',
      '123 Main St',
      79,
    ],
  ])('should score exactly %i for %s', (_desc, dxtrAddress1, camsAddress1, expected) => {
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

  test('should treat a number and its leading-zero-padded form as an exact numeric match', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: '123 Main St Suite 4',
    };
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '123 Main St Suite 04',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(100);
  });

  // Neither side has a numeric token at all, so calculateNumericTokenScore returns null and
  // calculateAddressScore must fall back to bigram similarity alone for the address-lines
  // component - if that fallback were broken (e.g. a missing numeric score defaulted to 0
  // instead of being excluded), this would score 50, not 100, since bigram similarity alone is
  // already a perfect match once "St" expands to "Street".
  test('should fall back to bigram-only scoring when neither address line has a numeric token', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: 'Main St',
    };
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: 'Main Street',
      countryCode: 'US',
    };

    expect(calculateAddressScore(dxtrAddress, camsAddress)).toBe(100);
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

describe('calculateNumericTokenScore', () => {
  test.each([
    {
      description: 'neither side has a numeric token',
      dxtrAddress1: 'main street',
      camsAddress1: 'main street',
      expected: null,
    },
    {
      description: 'the sole numeric token on each side matches exactly',
      dxtrAddress1: '123 main street',
      camsAddress1: '123 main street',
      expected: 100,
    },
    {
      description: 'the sole numeric token on each side differs',
      dxtrAddress1: '4 main street',
      camsAddress1: '5 main street',
      expected: 0,
    },
    {
      description: 'a number and its leading-zero-padded form are treated as equal',
      dxtrAddress1: '123 main street suite 4',
      camsAddress1: '123 main street suite 04',
      expected: 100,
    },
    // A numeric token present on only one side scores a real partial penalty rather than being
    // ignored - the shape a missing suite number in DXTR or CAMS data actually produces. Larger
    // side has 2 numeric tokens ({123, 4}), smaller side has 1 ({123}) which is contained in the
    // larger side - 1 match / 2 (larger side size) = 50.
    {
      description: 'a numeric token is present on only one side',
      dxtrAddress1: '123 main street suite 4',
      camsAddress1: '123 main street',
      expected: 50,
    },
    // {100, 100} vs {100, 200} - "100" matches, "200" doesn't - 1 match / 2 (larger side size,
    // tied) = 50.
    {
      description: 'multiple tokens partially agree',
      dxtrAddress1: '100 main street suite 100',
      camsAddress1: '100 main street suite 200',
      expected: 50,
    },
  ])('should score correctly when $description', ({ dxtrAddress1, camsAddress1, expected }) => {
    expect(calculateNumericTokenScore(dxtrAddress1, camsAddress1)).toBe(expected);
  });
});

describe('padSingleDigitNumericToken', () => {
  test.each([
    ['main', 'main'],
    ['4', '04'],
    ['10', '10'],
    ['123', '123'],
  ])('should return "%s" as "%s"', (token, expected) => {
    expect(padSingleDigitNumericToken(token)).toBe(expected);
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
    ['Pkwy', 'Parkway'],
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

  test.each([
    ['P.O. Box 51067', 'po box 51067'],
    ['PO Box 51067', 'po box 51067'],
    ['P.O.Box 51067', 'po box 51067'],
  ])('should normalize %s to the same PO box form', (line, expected) => {
    expect(normalizeAddressLine(line)).toBe(expected);
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
    // address1 explicit (matches makeTrustee()'s default) so addressScore=100 is visibly
    // intentional here, not a coincidence of two fixtures' defaults happening to agree.
    const dxtrTrustee = {
      ...makeDxtrTrustee('New York, NY 10001', '123 Main St'),
      firstName: 'John',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee();
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '081', courtDivisionCode: '1', chapter: '7' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    expect(score.trusteeId).toBe('trustee-1');
    expect(score.trusteeName).toBe('John Doe');
    expect(score.addressScore).toBe(100);
    expect(score.nameScore).toBe(100);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(100);
    // phone/email are null (fixture sets no phone/email on either side), so their weight
    // is excluded and redistributed: applicableWeight = 0.08 + 0.26 + 0.25 + 0.25 = 0.84
    // weightedSum = 100*0.08 + 100*0.26 + 100*0.25 + 100*0.25 = 8 + 26 + 25 + 25 = 84
    // 84 / 0.84 = 100 (toBeCloseTo guards against floating-point division noise)
    expect(score.totalScore).toBeCloseTo(100, 10);
  });

  test('should apply weighted scoring correctly (address 8% / name 26% / district 25% / chapter 25%, phone/email null)', () => {
    const dxtrTrustee = {
      ...makeDxtrTrustee('New York, NY 10001'),
      firstName: 'John',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10002',
          countryCode: 'US',
        },
      },
    });
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '081', courtDivisionCode: '1', chapter: '7' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '2', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    // addressLinesScore=100 (identical address1, 50%) + zipScore=0 (mismatch, 30%) +
    // cityStateScore=100 (match, 20%) = 70
    expect(score.addressScore).toBe(70); // Address lines + city/state match, zip differs
    expect(score.nameScore).toBe(100); // First and last name match
    expect(score.districtDivisionScore).toBe(50); // Same court, different division
    // The only appointment here (division '2') doesn't cover the case's division ('1'), so
    // chapter cannot be credited even though its chapter value equals the case's chapter.
    expect(score.chapterScore).toBe(0);
    // phone/email null (no phone/email on either side) -> applicableWeight = 0.84
    // weightedSum = 70*0.08 + 100*0.26 + 50*0.25 + 0*0.25 = 5.6 + 26 + 12.5 + 0 = 44.1
    // 44.1 / 0.84 = 52.5
    expect(score.totalScore).toBeCloseTo(52.5, 4);
  });

  test('should return totalScore ~9.52 when only address matches (phone/email null)', () => {
    // address1 explicit (matches makeTrustee()'s default) so addressScore=100 below is
    // visibly intentional, not a coincidence of two fixtures' defaults happening to agree.
    const dxtrTrustee = makeDxtrTrustee('New York, NY 10001', '123 Main St'); // No firstName/lastName - nameScore is 0
    const camsTrustee = makeTrustee();
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '082', courtDivisionCode: '1', chapter: '11' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    expect(score.addressScore).toBe(100);
    expect(score.nameScore).toBe(0);
    expect(score.districtDivisionScore).toBe(0);
    expect(score.chapterScore).toBe(0);
    // phone/email null -> applicableWeight = 0.08 + 0.26 + 0.25 + 0.25 = 0.84
    // weightedSum = 100*0.08 + 0*0.26 + 0*0.25 + 0*0.25 = 8
    // 8 / 0.84 = 9.5238
    expect(score.totalScore).toBeCloseTo(9.5238, 4);
  });

  test('should return totalScore ~29.76 when only district matches (phone/email null)', () => {
    const dxtrTrustee = makeDxtrTrustee(); // No address, no firstName/lastName - nameScore is 0
    const camsTrustee = makeTrustee();
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '081', courtDivisionCode: '1', chapter: '11' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    expect(score.addressScore).toBe(0);
    expect(score.nameScore).toBe(0);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(0);
    // phone/email null -> applicableWeight = 0.84
    // weightedSum = 0*0.08 + 0*0.26 + 100*0.25 + 0*0.25 = 25
    // 25 / 0.84 = 29.7619
    expect(score.totalScore).toBeCloseTo(29.7619, 4);
  });

  test('should return totalScore 0 when court differs, even though the case chapter equals the trustee appointment chapter', () => {
    // A matching chapter value alone must NOT be creditable when no active appointment covers
    // the case's court+division.
    const dxtrTrustee = makeDxtrTrustee(); // No address, no firstName/lastName - nameScore is 0
    const camsTrustee = makeTrustee();
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '082', courtDivisionCode: '1', chapter: '7' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    expect(score.addressScore).toBe(0);
    expect(score.nameScore).toBe(0);
    expect(score.districtDivisionScore).toBe(0);
    expect(score.chapterScore).toBe(0);
    // phone/email null -> applicableWeight = 0.84
    // weightedSum = 0*0.08 + 0*0.26 + 0*0.25 + 0*0.25 = 0
    expect(score.totalScore).toBeCloseTo(0, 10);
  });

  test('should populate phoneScore/emailScore as null when DXTR has no phone/email', () => {
    const dxtrTrustee = {
      ...makeDxtrTrustee('New York, NY 10001'),
      firstName: 'John',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({
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
    });
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '081', courtDivisionCode: '1', chapter: '7' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    // DXTR trustee has no legacy.phone/legacy.email, so both are not comparable.
    expect(score.phoneScore).toBeNull();
    expect(score.emailScore).toBeNull();
  });

  // Regression coverage for the sync-professionalIds dataflow: a fuzzy (partial, non-exact)
  // addressScore must flow through calculateCandidateScore's weighting at its documented 8% share
  // like any other sub-score, not just the exact-match/zero-match extremes exercised elsewhere.
  test('should apply an exact 8% weight to a fuzzy (non-exact) address score', () => {
    const dxtrTrustee = {
      ...makeDxtrTrustee('New York, NY 10001', '123 Main Streat'), // typo'd street suffix
      firstName: 'John',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({
      public: {
        address: {
          address1: '123 Main Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      { courtId: '081', courtDivisionCode: '1', chapter: '7' },
      camsTrustee,
      [makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' })],
      calculateNameScore(dxtrTrustee, camsTrustee),
    );

    // "123 main streat" vs "123 main street": bigram Jaccard = 8 shared / 12 union = 66.67%,
    // blended 50/50 with the numeric-token score (both sides share "123" -> 100) per
    // calculateAddressScore's addressLinesScore = 66.67*0.5 + 100*0.5 = 83.33. Rolled up with
    // zipScore=100 (30%) and cityStateScore=100 (20%): round(83.33*0.5 + 100*0.3 + 100*0.2) = 92 -
    // a genuine fuzzy value, not the 0/100 extremes calculateAddressScore's other call sites in
    // this file exercise.
    expect(score.addressScore).toBe(92);
    expect(score.nameScore).toBe(100);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(100);
    // phone/email null -> applicableWeight = 0.08 + 0.26 + 0.25 + 0.25 = 0.84
    // weightedSum = 92*0.08 + 100*0.26 + 100*0.25 + 100*0.25 = 7.36 + 26 + 25 + 25 = 83.36
    // 83.36 / 0.84 = 99.2381
    expect(score.totalScore).toBeCloseTo(99.2381, 4);
  });
});

describe('firstLastNameToken', () => {
  test('should return just the first word for a simple lastName', () => {
    expect(firstLastNameToken('Doe')).toBe('doe');
  });

  test('should strip a trailing role marker', () => {
    expect(firstLastNameToken('Marstock (TR)')).toBe('marstock');
  });

  test('should strip a trailing comma-separated suffix', () => {
    expect(firstLastNameToken('Wallo, Trustee')).toBe('wallo');
    expect(firstLastNameToken('Doe, III')).toBe('doe');
  });

  test('should keep an apostrophe-joined surname as one word', () => {
    expect(firstLastNameToken("O'Brien")).toBe('obrien');
  });

  // Real-world false positive from a staging backtest: two distinct compound surnames sharing a
  // leading particle both reduced to just "van" under the old first-token-only rule, so
  // calculateNameScore's lastName gate treated two different real trustees as the same person.
  // CAMS itself stores these two-word surnames space-separated ("Van Bramlett", not
  // "VanBramlett"), so the fix keeps a known prefix particle joined to the next token rather than
  // truncating after it.
  test.each([
    ['Van Corwyn', 'van corwyn'],
    ['VAN CUREN', 'van curen'],
    ['Mc Lane', 'mc lane'],
    ['MC KAY, SR.', 'mc kay'],
    ['De Verges', 'de verges'],
    ['La Penna', 'la penna'],
    ['Von Eberstein', 'von eberstein'],
    ['Del Piero', 'del piero'],
  ])(
    'should keep a known multi-word surname prefix joined to the next token: %s',
    (input, expected) => {
      expect(firstLastNameToken(input)).toBe(expected);
    },
  );

  test('should NOT join a prefix particle when it is not followed by another token', () => {
    // A bare "Van" with nothing after it isn't a compound surname — nothing to join to.
    expect(firstLastNameToken('Van')).toBe('van');
  });

  test('should treat two different multi-word surnames sharing the same prefix as different', () => {
    expect(firstLastNameToken('Van Corwyn')).not.toBe(firstLastNameToken('Van Bramlett'));
  });
});

describe('lastNameTokensMatch', () => {
  // Real-world false negative from a staging backtest: ACMS's space-separated rendering of a
  // surname vs CAMS's concatenated rendering reduce to two different strings via
  // firstLastNameToken - so calculateNameScore's old strict-equality lastName gate scored a
  // genuine match 0. Rather than guessing whether any given concatenated word IS a split-worthy
  // particle+surname (ambiguous without a space - "Mack"/"Devine"/"Vance" are ordinary
  // single-word surnames that merely start with a particle's letters), this compares BOTH the
  // token as-is AND, when it starts with a known particle, the particle-split variant - a match
  // on EITHER representation counts, so a genuine concatenated/spaced pair matches without
  // requiring "Mack" or "Devine" to ever be force-split in the first place.
  test.each([
    ['McQuillen', 'Mc Quillen'],
    ['MCLANE', 'Mc Lane'],
    ['DeRosa', 'De Rosa'],
    ['McManigle', 'Mc Manigle'],
    ['Dicello', 'Di Cello'],
  ])(
    'should match a concatenated surname against its spaced form: %s vs %s',
    (concatenated, spaced) => {
      expect(
        lastNameTokensMatch(firstLastNameToken(concatenated), firstLastNameToken(spaced)),
      ).toBe(true);
    },
  );

  test('should still match two identical already-spaced multi-word surnames', () => {
    expect(
      lastNameTokensMatch(firstLastNameToken('Van Roeburn'), firstLastNameToken('Van Roeburn')),
    ).toBe(true);
  });

  test('should still match two identical ordinary single-word surnames', () => {
    expect(lastNameTokensMatch(firstLastNameToken('Doe'), firstLastNameToken('Doe'))).toBe(true);
  });

  test('should NOT match an ordinary single-word surname against an unrelated particle-prefixed surname', () => {
    // "Mack" happens to start with letters that could look like a particle, but splitting it
    // must never manufacture a false match against an unrelated "Mc <something>" surname.
    expect(lastNameTokensMatch(firstLastNameToken('Mack'), firstLastNameToken('Mc Kay'))).toBe(
      false,
    );
  });

  test('should NOT match two different multi-word surnames sharing the same prefix', () => {
    expect(
      lastNameTokensMatch(firstLastNameToken('Van Corwyn'), firstLastNameToken('Van Bramlett')),
    ).toBe(false);
  });

  test('should NOT match two genuinely different surnames', () => {
    expect(lastNameTokensMatch(firstLastNameToken('Smith'), firstLastNameToken('Jones'))).toBe(
      false,
    );
  });

  test('should return false when either token is empty', () => {
    expect(lastNameTokensMatch('', firstLastNameToken('Smith'))).toBe(false);
    expect(lastNameTokensMatch(firstLastNameToken('Smith'), '')).toBe(false);
  });

  // Real-world false negatives from a staging backtest: firstLastNameToken always treats the
  // FIRST token as the surname, which is wrong for a prepended maiden/second surname (real
  // surname last, not first) and for a hyphenated compound surname carried inconsistently across
  // systems. Only activates when the caller supplies the raw (pre-firstLastNameToken) lastName
  // fields.
  describe('raw-field fallback', () => {
    test.each([
      ['DE DUNWOODY HALLSTROM', 'Hallstrom'],
      ['Anderson Oakley', 'Oakley'],
      ['Carr Radley', 'Radley'],
      ['Wolf Prentiss', 'Prentiss'],
    ])(
      'should match a prepended-surname compound against the real trailing surname: %s vs %s',
      (compound, real) => {
        expect(
          lastNameTokensMatch(
            firstLastNameToken(compound),
            firstLastNameToken(real),
            compound,
            real,
          ),
        ).toBe(true);
      },
    );

    test.each([
      ['Farraday-Winslow', 'Winslow'],
      ['Kenneally-Ashcombe', 'Ashcombe'],
      ['Lamberti-Blackthorn', 'Blackthorn'],
      ['Williams-Merriwether', 'Merriwether'],
    ])(
      'should match a hyphenated compound against its real trailing segment: %s vs %s',
      (compound, real) => {
        expect(
          lastNameTokensMatch(
            firstLastNameToken(compound),
            firstLastNameToken(real),
            compound,
            real,
          ),
        ).toBe(true);
      },
    );

    test('should NOT match two different compound surnames that merely share one token', () => {
      // Neither side is a bare single-token surname here - "Jones" is not actually either
      // family's real surname alone, so a shared token must not be trusted.
      expect(
        lastNameTokensMatch(
          firstLastNameToken('Smith Jones'),
          firstLastNameToken('Jones Wilson'),
          'Smith Jones',
          'Jones Wilson',
        ),
      ).toBe(false);
    });

    test('should NOT apply the fallback when neither raw field is supplied', () => {
      // Same firstLastNameToken inputs as the first parameterized case above, but without the
      // raw fields - existing callers that never pass them must see unchanged behavior, not a
      // silent new match.
      expect(
        lastNameTokensMatch(
          firstLastNameToken('DE DUNWOODY HALLSTROM'),
          firstLastNameToken('Hallstrom'),
        ),
      ).toBe(false);
    });
  });
});

describe('lastNameSurnameCandidates', () => {
  test('returns just the primary token for an ordinary single-word surname', () => {
    expect(lastNameSurnameCandidates('Smith')).toEqual(['smith']);
  });

  test('returns the prepended-surname primary plus the real trailing surname as an alternate', () => {
    expect(lastNameSurnameCandidates('DE DUNWOODY HALLSTROM')).toEqual([
      'de dunwoody',
      'hallstrom',
    ]);
  });

  test('returns the hyphenated-compound primary plus the whitespace-token and hyphen-segment alternates', () => {
    // "farraday-winslow" (the whole hyphenated compound, kept whole by the whitespace tokenizer
    // since it deliberately preserves hyphens - see its own [^a-z0-9-]+ pattern) is a real, if
    // redundant-with-the-others, third candidate - pre-existing behavior, not something this
    // fix touches.
    expect(lastNameSurnameCandidates('Farraday-Winslow')).toEqual([
      'farraday',
      'farraday-winslow',
      'winslow',
    ]);
  });

  // Real backtest finding: a bracketed role/chapter/status marker must never survive as a bogus
  // fallback candidate - "(TR)" produced "tr" as an alternate, which then genuinely phonetically
  // matched unrelated real CAMS trustees. Inputs are real, isolated lastName field values (never
  // a composite firstName+lastName string) - findSurnameExactCandidatesForAcms/
  // lastNameSurnameCandidates only ever receive the raw lastName on its own.
  test.each([
    ['CURRY (TR)', 'curry'],
    ['ODELL (SBRAV)', 'odell'],
    ['ROJAS (CH 13)', 'rojas'],
    ['DEKALB (CH 12 ONLY)', 'dekalb'],
    ["O'NEAL (CHAPTER 12)", 'oneal'],
    ['WOOD(NA)(INACTIVE)', 'wood'],
  ])(
    'excludes a bracketed role/chapter/status marker as a fallback candidate: %s',
    (input, primary) => {
      const result = lastNameSurnameCandidates(input);
      expect(result[0]).toBe(primary);
      expect(result).not.toContain('tr');
      expect(result).not.toContain('ch');
      expect(result).not.toContain('sbrav');
      expect(result).not.toContain('na');
      expect(result).not.toContain('inactive');
    },
  );

  test('excludes a chapter-number token even though it clears the minimum length check', () => {
    // "11"/"12"/"13" are 2-3 characters, long enough to pass SURNAME_CANDIDATE_MIN_TOKEN_LENGTH
    // on their own - only the "a real surname never contains a digit" check excludes them.
    const result = lastNameSurnameCandidates('ANDERSON (11)');
    expect(result).toEqual(['anderson']);
  });

  test('excludes a bare single-letter fallback token', () => {
    expect(lastNameSurnameCandidates('NEWHOUSE (D)')).toEqual(['newhouse']);
  });

  // A parenthetical is not assumed to always be a role/status code - it could just as easily have
  // carried a real alias/maiden surname instead, so its content is offered as its own candidate
  // (filtered the same as any other fallback) rather than discarded outright.
  test('offers a name-shaped parenthetical as a surname alternate rather than discarding it', () => {
    expect(lastNameSurnameCandidates(PARENTHETICAL_ALIAS_SURNAME)).toEqual(['doe', 'roe']);
  });

  test('excludes a business-entity suffix/title word confirmed leaking from a non-person record', () => {
    expect(lastNameSurnameCandidates('AMJ ADVISORS LLC')).toEqual(['amj']);
    expect(lastNameSurnameCandidates('WHALEY CPA')).toEqual(['whaley']);
    expect(lastNameSurnameCandidates('LEVINE, ESQ.')).toEqual(['levine']);
  });

  test('excludes a generational suffix even after normalizeGenerationalSuffix joins it onto the name', () => {
    expect(lastNameSurnameCandidates('LEONARD, JR.')).toEqual(['leonard']);
    expect(lastNameSurnameCandidates('KIRK,II')).toEqual(['kirk']);
  });

  test('returns just the primary token when there is no usable fallback candidate at all', () => {
    expect(lastNameSurnameCandidates('')).toEqual([]);
    expect(lastNameSurnameCandidates(undefined)).toEqual([]);
  });
});

describe('calculateNameScore', () => {
  // Real-world false negative from a staging backtest: ACMS's space-separated lastName vs CAMS's
  // concatenated rendering scored 0 before lastNameTokensMatch tolerated the formatting
  // difference.
  test('should score 100 for a genuine match where one side concatenates a prefix particle onto the surname', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jordan Mc Allery',
      firstName: 'Jordan',
      lastName: 'Mc Allery',
    };
    const camsTrustee = makeTrustee({
      firstName: 'Jordan',
      lastName: 'McAllery',
      name: 'Jordan McAllery',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

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

  test('should return 100 when dxtr middle name is a single initial matching cams middle name first letter', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John L Doe',
      firstName: 'John',
      middleName: 'L',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Lee', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should return 100 when cams middle name is a single initial matching dxtr middle name first letter', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'John Lee Doe',
      firstName: 'John',
      middleName: 'Lee',
      lastName: 'Doe',
    };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'L', lastName: 'Doe' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
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
      fullName: GENERATIONAL_SUFFIX_NAME_PAIR.dxtrFullName,
      firstName: GENERATIONAL_SUFFIX_NAME_PAIR.dxtrFirstName,
      middleName: GENERATIONAL_SUFFIX_NAME_PAIR.dxtrMiddleName,
      lastName: GENERATIONAL_SUFFIX_NAME_PAIR.dxtrLastName,
    };
    const camsTrustee = makeTrustee({
      firstName: GENERATIONAL_SUFFIX_NAME_PAIR.camsFirstName,
      middleName: GENERATIONAL_SUFFIX_NAME_PAIR.camsMiddleName,
      lastName: GENERATIONAL_SUFFIX_NAME_PAIR.camsLastName,
    });

    // lastName equality holds once the baked-in suffix is stripped; middle is initial-vs-full
    // (a genuine match, scored 100 by scoreMiddleNamePart - see its own doc comment), so nothing
    // caps the overall result below the exact firstName match.
    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
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

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  // Real-world pattern from a staging backtest: a trustee who goes by their middle name has it
  // recorded first in CAMS ("M. Douglas Renfield"), while ACMS's PROF_FIRST_NAME/PROF_MI keep the
  // legal first/middle order ("Douglas"/"M"). Positional-only comparison sees this as two
  // unrelated first names (0) even though every other signal (last name, address, phone) agrees.
  test('should tolerate a first/middle name swap between dxtr and cams', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Douglas M Renfield',
      firstName: 'Douglas',
      middleName: 'M',
      lastName: 'Renfield',
    };
    const camsTrustee = makeTrustee({
      firstName: 'M.',
      middleName: 'Douglas',
      lastName: 'Renfield',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should tolerate a first/middle name swap where the swapped middle name is spelled out on one side', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Calvin J Castellane',
      firstName: 'Calvin',
      middleName: 'J',
      lastName: 'Castellane',
    };
    const camsTrustee = makeTrustee({
      firstName: 'J.',
      middleName: 'Calvin',
      lastName: 'Castellane',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should not treat an unrelated first/middle pair as a swap match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Douglas M Renfield',
      firstName: 'Douglas',
      middleName: 'M',
      lastName: 'Renfield',
    };
    const camsTrustee = makeTrustee({
      firstName: 'Robert',
      middleName: 'Jameson',
      lastName: 'Renfield',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  // Real-world pattern from a staging backtest: unlike the swap cases above (both sides have
  // SOME middle name, just in the "wrong" field), ACMS sometimes never records a middle name at
  // all for a trustee who goes by their middle name - PROF_MI is genuinely empty, not just
  // omitted from this comparison. "Winterbourne Ashwood" (ACMS firstName="Winterbourne", no
  // middle name) vs CAMS "W. Winterbourne Ashwood" (firstName="W.", middleName="Winterbourne") is
  // not a swap between two populated slots; it is ACMS's only name slot landing on what CAMS
  // considers the middle name, with nothing on the ACMS side to contradict the CAMS side's bare
  // initial firstName.
  //
  // Requires an EXACT match (not merely initial-vs-full) on the crossed pair - unlike
  // isFirstMiddleSwap, there is no second, independent direction to cross-check an initial
  // against here (the "empty" side's middle slot has nothing in it to compare), so a mere
  // initial-vs-full relationship is too weak a signal to stand alone. Confirmed via a real
  // backtest regression: allowing initial-vs-full here credited an ACMS record with no middle
  // name against BOTH the correct candidate (exact first-name match, needs no relaxation at all)
  // AND an unrelated candidate (only a bare initial matching, an initial-of relationship with
  // nothing to confirm it), producing two candidates that both qualified and turning a
  // previously-clean single-candidate resolution into a false ambiguity.
  test('should tolerate a first name that EXACTLY matches the CAMS middle name, when ACMS has no middle name recorded', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Winterbourne Ashwood',
      firstName: 'Winterbourne',
      lastName: 'Ashwood',
    };
    const camsTrustee = makeTrustee({
      firstName: 'W.',
      middleName: 'Winterbourne',
      lastName: 'Ashwood',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should tolerate a first name that EXACTLY matches the DXTR middle name, when CAMS has no middle name recorded', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'W. Winterbourne Ashwood',
      firstName: 'W.',
      middleName: 'Winterbourne',
      lastName: 'Ashwood',
    };
    const camsTrustee = makeTrustee({ firstName: 'Winterbourne', lastName: 'Ashwood' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  // Real-world backtest finding: a genuine nickname/formal-name pair (not just an exact string
  // match) crossed into the "wrong" field must also be credited - a bare-initial-plus-crossed-name
  // ACMS record (no middle name) vs a CAMS record with a bare initial firstName unrelated to
  // "Steve" and a middleName that is a plausible nickname/formal-name pair for "Steve" - previously
  // scored 0 because isOneSidedMiddleNameMatch required an EXACT match on the crossed pair. Still
  // refuses a bare-initial relationship (see the Ashgrove test above) - only the nickname/distance
  // relaxation was added, not isInitialOf.
  test('should tolerate a genuine nickname pair crossed into the CAMS middle name, when ACMS has no middle name recorded', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Steve Miller',
      firstName: 'Steve',
      lastName: 'Miller',
    };
    const camsTrustee = makeTrustee({ firstName: 'P.', middleName: 'Stephen', lastName: 'Miller' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should NOT credit a merely initial-vs-full relationship as a one-sided middle-name match', () => {
    // The confirmed real-world false positive: ACMS "JORDAN ASHGROVE" (no middle name) must not
    // match CAMS "Kacey M. Ashgrove" just because "M." is an initial of "Jordan" - with nothing on
    // the ACMS side to independently confirm it, a bare middle initial is too weak (and too likely
    // to coincidentally collide with an unrelated person sharing the same surname) to credit alone.
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jordan Ashgrove',
      firstName: 'Jordan',
      lastName: 'Ashgrove',
    };
    const camsTrustee = makeTrustee({ firstName: 'Kacey', middleName: 'M', lastName: 'Ashgrove' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should still resolve the correct candidate via the ordinary firstName match when one exists, alongside a rejected one-sided lookalike', () => {
    // Companion to the Ashgrove regression: the CORRECT candidate ("Jordan B. Ashgrove") needs no
    // one-sided relaxation at all - dxtrFirst="jordan" equals camsFirst="jordan" directly - so
    // it must keep scoring 100 regardless of how isOneSidedMiddleNameMatch handles other
    // candidates sharing the same surname.
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jordan Ashgrove',
      firstName: 'Jordan',
      lastName: 'Ashgrove',
    };
    const camsTrustee = makeTrustee({ firstName: 'Jordan', middleName: 'B', lastName: 'Ashgrove' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });

  test('should NOT credit a one-sided middle-name match when the other side has ITS OWN middle name that contradicts', () => {
    // "M O Marchbanks" (dxtrFirst=M, dxtrMiddle=O) vs "Watson M. Marchbanks" (camsFirst=Watson,
    // camsMiddle=M): dxtrFirst=M does equal camsMiddle=M, but dxtrMiddle=O is NOT empty, so this
    // must go through the full bidirectional swap check (both sides populated), not the one-sided
    // relaxation - and "O" is not related to "Watson", so it correctly stays unmatched.
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'M O Marchbanks',
      firstName: 'M',
      middleName: 'O',
      lastName: 'Marchbanks',
    };
    const camsTrustee = makeTrustee({
      firstName: 'Weston',
      middleName: 'M',
      lastName: 'Marchbanks',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should not treat an unrelated first name as a one-sided middle-name match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Robert Ashwood',
      firstName: 'Robert',
      lastName: 'Ashwood',
    };
    const camsTrustee = makeTrustee({
      firstName: 'W.',
      middleName: 'Winterbourne',
      lastName: 'Ashwood',
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  // Real-world pattern from a staging backtest: ACMS often carries a nickname ("Jim Halloway") where
  // CAMS has the formal name ("Jim F. Halloway" - itself a nickname, but also the reverse direction:
  // "Liz Brixton" vs CAMS "Elizabeth F. Brixton"). getNameVariations (name-match library, already used
  // by phonetic-helper.ts's candidate-discovery search) is reused here for scoring rather than a
  // new, separately-maintained nickname list.
  test('should recognize a known nickname-to-formal-name relationship', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jim Halloway',
      firstName: 'Jim',
      lastName: 'Halloway',
    };
    const camsTrustee = makeTrustee({ firstName: 'James', lastName: 'Halloway' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should recognize a known formal-to-nickname relationship in the reverse direction', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Liz Brixton',
      firstName: 'Liz',
      lastName: 'Brixton',
    };
    const camsTrustee = makeTrustee({ firstName: 'Elizabeth', lastName: 'Brixton' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(85);
  });

  test('should not treat an unrelated first name as a nickname match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: 'Jim Halloway',
      firstName: 'Jim',
      lastName: 'Halloway',
    };
    const camsTrustee = makeTrustee({ firstName: 'Robert', lastName: 'Halloway' });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  // Real-world false positive from a staging backtest: the old first-token-only
  // firstLastNameToken reduced both surnames to "van", so this scored 100 despite being two
  // different real trustees (coincidentally in the same city/zip too, which would have let a
  // weak address score corroborate a wrong match).
  test('should return 0 for two different multi-word surnames sharing the same prefix particle', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR.dxtrFullName,
      firstName: DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR.dxtrFirstName,
      lastName: DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR.dxtrLastName,
    };
    const camsTrustee = makeTrustee({
      firstName: DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR.camsFirstName,
      middleName: DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR.camsMiddleName,
      lastName: DIFFERENT_SHARED_PARTICLE_SURNAME_PAIR.camsLastName,
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(0);
  });

  test('should return 100 when both sides use the same multi-word surname prefix and match', () => {
    const dxtrTrustee: DxtrTrusteeParty = {
      fullName: MATCHING_SHARED_PARTICLE_SURNAME_PAIR.fullName,
      firstName: MATCHING_SHARED_PARTICLE_SURNAME_PAIR.firstName,
      lastName: MATCHING_SHARED_PARTICLE_SURNAME_PAIR.lastName,
    };
    const camsTrustee = makeTrustee({
      firstName: MATCHING_SHARED_PARTICLE_SURNAME_PAIR.firstName,
      lastName: MATCHING_SHARED_PARTICLE_SURNAME_PAIR.lastName,
    });

    expect(calculateNameScore(dxtrTrustee, camsTrustee)).toBe(100);
  });
});

describe('scoreFirstNamePart', () => {
  test.each([
    { description: 'an exact match', dxtr: 'john', cams: 'john', expected: 100 },
    { description: 'the dxtr side is empty', dxtr: '', cams: 'john', expected: 0 },
    { description: 'the cams side is empty', dxtr: 'john', cams: '', expected: 0 },
    {
      description: 'the dxtr side is a single-character initial of the cams side',
      dxtr: 'g',
      cams: 'george',
      expected: 85,
    },
    {
      description: 'the cams side is a single-character initial of the dxtr side',
      dxtr: 'george',
      cams: 'g',
      expected: 85,
    },
    {
      description: 'a known nickname/formal-name pair',
      dxtr: 'jim',
      cams: 'james',
      expected: 85,
    },
    { description: 'a genuine mismatch', dxtr: 'jane', cams: 'john', expected: 0 },
    // Real backtest finding: a short form of a name close enough by JaroWinkler distance to its
    // formal name, not recognized by the nickname library.
    {
      description: 'a short form close enough by distance to its formal name (rod/rodney)',
      dxtr: 'rod',
      cams: 'rodney',
      expected: 85,
    },
    {
      description: 'a short form close enough by distance to its formal name (randy/randolph)',
      dxtr: 'randy',
      cams: 'randolph',
      expected: 85,
    },
    {
      description: 'a short form close enough by distance to its formal name (kathy/kathryn)',
      dxtr: 'kathy',
      cams: 'kathryn',
      expected: 85,
    },
    {
      description: 'a name variant close enough by distance (antonio/anthony)',
      dxtr: 'antonio',
      cams: 'anthony',
      expected: 85,
    },
    {
      description: 'a spelling variant close enough by distance (jeffrey/jeffry)',
      dxtr: 'jeffrey',
      cams: 'jeffry',
      expected: 85,
    },
    // Confirmed via the same audit: unrelated first names that happened to share a surname in a
    // large candidate pool - real nicknames of DIFFERENT formal names, not of each other, and
    // correctly excluded by distance even though a human might guess otherwise.
    {
      description: 'unrelated names below the distance threshold (al/randall)',
      dxtr: 'al',
      cams: 'randall',
      expected: 0,
    },
    {
      description: 'unrelated names below the distance threshold (samuel/joe)',
      dxtr: 'samuel',
      cams: 'joe',
      expected: 0,
    },
    {
      description: 'unrelated names below the distance threshold (steven/bob)',
      dxtr: 'steven',
      cams: 'bob',
      expected: 0,
    },
  ])('should return $expected for $description', ({ dxtr, cams, expected }) => {
    expect(scoreFirstNamePart(dxtr, cams)).toBe(expected);
  });
});

describe('scoreMiddleNamePart', () => {
  test.each([
    {
      description: 'the dxtr side is missing (neutral, not disqualifying)',
      dxtr: '',
      cams: 'quincy',
      expected: 100,
    },
    {
      description: 'the cams side is missing (neutral, not disqualifying)',
      dxtr: 'quincy',
      cams: '',
      expected: 100,
    },
    {
      description: 'both sides are missing (neutral, not disqualifying)',
      dxtr: '',
      cams: '',
      expected: 100,
    },
    { description: 'an exact match', dxtr: 'quincy', cams: 'quincy', expected: 100 },
    {
      description: 'the dxtr side is an initial of the cams side',
      dxtr: 'l',
      cams: 'lee',
      expected: 100,
    },
    {
      description: 'the cams side is an initial of the dxtr side',
      dxtr: 'lee',
      cams: 'l',
      expected: 100,
    },
    {
      description: 'a genuine conflict between two present middle names',
      dxtr: 'quincy',
      cams: 'robert',
      expected: 15,
    },
  ])('should return $expected for $description', ({ dxtr, cams, expected }) => {
    expect(scoreMiddleNamePart(dxtr, cams)).toBe(expected);
  });
});

describe('isKnownNicknamePair', () => {
  test.each([
    {
      description: 'a known nickname-to-formal-name pair',
      a: 'jim',
      b: 'james',
      expected: true,
    },
    {
      description: 'a known formal-to-nickname pair (order reversed)',
      a: 'elizabeth',
      b: 'liz',
      expected: true,
    },
    { description: 'an unrelated pair', a: 'jim', b: 'robert', expected: false },
    { description: 'the first side is empty', a: '', b: 'james', expected: false },
    { description: 'the second side is empty', a: 'jim', b: '', expected: false },
  ])('should return $expected for $description', ({ a, b, expected }) => {
    expect(isKnownNicknamePair(a, b)).toBe(expected);
  });
});

describe('isFirstMiddleSwap', () => {
  // Real-world pattern: a trustee who goes by their middle name has it recorded first on one
  // side (CAMS "M. Douglas Renfield") while the other side keeps the legal first/middle order
  // (ACMS "Douglas"/"M").
  test.each([
    {
      description:
        'both crossed pairs (dxtr-first/cams-middle, dxtr-middle/cams-first) clear the swap threshold',
      dxtrFirst: 'douglas',
      dxtrMiddle: 'm',
      camsFirst: 'm',
      camsMiddle: 'douglas',
      expected: true,
    },
    {
      description: 'the swapped middle name is spelled out on only one side',
      dxtrFirst: 'calvin',
      dxtrMiddle: 'j',
      camsFirst: 'j',
      camsMiddle: 'calvin',
      expected: true,
    },
    {
      description: 'the dxtr side has no middle name at all',
      dxtrFirst: 'douglas',
      dxtrMiddle: '',
      camsFirst: 'm',
      camsMiddle: 'douglas',
      expected: false,
    },
    {
      description: 'the cams side has no middle name at all',
      dxtrFirst: 'douglas',
      dxtrMiddle: 'm',
      camsFirst: 'm',
      camsMiddle: '',
      expected: false,
    },
    {
      description: 'an unrelated first/middle pair',
      dxtrFirst: 'douglas',
      dxtrMiddle: 'm',
      camsFirst: 'robert',
      camsMiddle: 'james',
      expected: false,
    },
    // dxtrFirst vs camsMiddle matches, but dxtrMiddle vs camsFirst does not - a real swap must
    // agree in both directions, not just one.
    {
      description: 'only one crossed pair matches, not both',
      dxtrFirst: 'douglas',
      dxtrMiddle: 'x',
      camsFirst: 'y',
      camsMiddle: 'douglas',
      expected: false,
    },
  ])(
    'should return $expected when $description',
    ({ dxtrFirst, dxtrMiddle, camsFirst, camsMiddle, expected }) => {
      expect(isFirstMiddleSwap(dxtrFirst, dxtrMiddle, camsFirst, camsMiddle)).toBe(expected);
    },
  );
});

describe('isOneSidedMiddleNameMatch', () => {
  test.each([
    {
      description: 'both sides have a middle name (isFirstMiddleSwap territory instead)',
      dxtrFirst: 'm',
      dxtrMiddle: 'o',
      camsFirst: 'watson',
      camsMiddle: 'm',
      expected: false,
    },
    {
      description:
        'the dxtr side has no middle name and its first name exactly matches the cams middle name',
      dxtrFirst: 'lance',
      dxtrMiddle: '',
      camsFirst: 'w',
      camsMiddle: 'lance',
      expected: true,
    },
    {
      description:
        'the cams side has no middle name and its first name exactly matches the dxtr middle name',
      dxtrFirst: 'w',
      dxtrMiddle: 'lance',
      camsFirst: 'lance',
      camsMiddle: '',
      expected: true,
    },
    // The confirmed real-world false positive: "michael" (no middle name) must not match against
    // a bare middle initial "m" just because "m" is an initial of "michael" - a bare-initial
    // relationship is still refused even after the nickname/distance relaxation below (see
    // isOneSidedCrossedNamePartMatch's own doc comment on why it deliberately never calls
    // isInitialOf, unlike scoreFirstNamePart's other two callers).
    {
      description:
        'a merely initial-vs-full relationship (still refused, unlike scoreFirstNamePart)',
      dxtrFirst: 'michael',
      dxtrMiddle: '',
      camsFirst: 'kathy',
      camsMiddle: 'm',
      expected: false,
    },
    // Real backtest finding: a genuine nickname pair crossed into the wrong field must still be
    // credited, not just an exact string match - "steve"/"stephen" is a plausible nickname/
    // formal-name pair, a fundamentally different, much narrower relationship than the
    // bare-initial case above.
    {
      description: 'a genuine nickname pair crossed into the cams middle name field',
      dxtrFirst: 'steve',
      dxtrMiddle: '',
      camsFirst: 'p',
      camsMiddle: 'stephen',
      expected: true,
    },
    {
      description: 'a genuine nickname pair crossed into the dxtr middle name field',
      dxtrFirst: 'lance',
      dxtrMiddle: 'stephen',
      camsFirst: 'steve',
      camsMiddle: '',
      expected: true,
    },
    {
      description: 'an unrelated first name',
      dxtrFirst: 'robert',
      dxtrMiddle: '',
      camsFirst: 'w',
      camsMiddle: 'lance',
      expected: false,
    },
    {
      description: 'neither side has a middle name',
      dxtrFirst: 'john',
      dxtrMiddle: '',
      camsFirst: 'john',
      camsMiddle: '',
      expected: false,
    },
  ])(
    'should return $expected when $description',
    ({ dxtrFirst, dxtrMiddle, camsFirst, camsMiddle, expected }) => {
      expect(isOneSidedMiddleNameMatch(dxtrFirst, dxtrMiddle, camsFirst, camsMiddle)).toBe(
        expected,
      );
    },
  );
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
    // Only phoneScore (weight 0.08) is excluded; all applicable scores are 100.
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
    // applicableWeight = 0.08 (address) + 0.26 (name) + 0.08 (phone) + 0.25 (district) + 0.25 (chapter) = 0.92
    // weightedSum = 100*0.08 + 100*0.26 + 0*0.08 + 100*0.25 + 100*0.25 = 8 + 26 + 0 + 25 + 25 = 84
    // 84 / 0.92 = 91.3043...
    expect(total).toBeCloseTo(91.3043, 4);
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

  test('should return trusteeId when clear winner found (meets threshold and gap)', async () => {
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

  test('does not resolve a single candidate at exactly the 74-point threshold (boundary: > not >=)', async () => {
    // address=100 (8%), name=0/genuine mismatch (26%), phone=100/email=100 (8%/8%),
    // district=100/chapter=100 (25%/25%) => weighted total = exactly 74. meetsThreshold requires
    // totalScore > FUZZY_MATCH_SCORE_THRESHOLD (74), so this must NOT auto-resolve. district=100
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
          address1: '123 Main St',
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
    expect(result.candidateScores[0].totalScore).toBe(74);
  });

  test('resolves when the winner/runner-up gap is exactly the 8-point minimum (boundary: >= not >)', async () => {
    // Both candidates: address=100, name=100, phone=100, district=100, chapter=100 (same-appointment
    // match on both) — differing only on email: winner matches (100) => total 100, runner-up
    // mismatches (0) => total 92. Gap is exactly 8 == FUZZY_MATCH_MIN_GAP, which hasSignificantGap
    // requires via >=, so this must resolve.
    const event = makeEvent({
      courtId: '081',
      courtDivisionCode: '1',
      chapter: '7',
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: {
          address1: '123 Main St',
          cityStateZipCountry: 'New York, NY 10001',
          phone: '5555550000',
          email: 'shared@example.com',
        },
      },
    });
    const winner = makeTrustee({
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
        phone: { number: '5555550000' },
        email: 'shared@example.com',
      },
    });
    const runnerUp = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phone: { number: '5555550000' },
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
    expect(result.candidateScores.find((c) => c.trusteeId === 'trustee-1')?.totalScore).toBe(100);
    expect(result.candidateScores.find((c) => c.trusteeId === 'trustee-2')?.totalScore).toBe(92);
  });

  test('should return an unresolved outcome when no candidate meets the threshold', async () => {
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

  test('should return an unresolved outcome when both candidates meet the threshold but the gap is too small', async () => {
    const event = makeEvent({
      dxtrTrustee: {
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        legacy: { cityStateZipCountry: 'New York, NY 10001', address1: '123 Main St' },
      },
    });
    const candidate1 = makeTrustee({
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
    // addressLinesScore=0 (completely different line, 50%) + zipScore=100 (30%) +
    // cityStateScore=100 (20%) = 50 - a partial addressScore, not the 0/100 extremes used
    // elsewhere in this describe block, so the resulting 4-point gap is a genuine (not
    // coincidental) consequence of address's fuzzy scoring.
    const candidate2 = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe',
      public: {
        address: {
          address1: '456 Oak Ave',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const appointments1 = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
      }),
    ];
    const appointments2 = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
      }),
    ];

    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(candidate1)
      .mockResolvedValueOnce(candidate2);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(appointments1)
      .mockResolvedValueOnce(appointments2);

    const result = await resolveNameCollisionByScoring(context, event, ['trustee-1', 'trustee-2']);

    expect(result.kind).toBe('unresolved');
    if (result.kind !== 'unresolved') throw new Error('expected unresolved outcome');
    // name=100 (26%) + district=100 (25%) + chapter=100 (25%) tied on both, phone/email null
    // -> applicableWeight = 0.84. candidate1: address=100 -> (100*.08+100*.26+100*.25+100*.25)/.84 = 100
    // candidate2: address=50 -> (50*.08+100*.26+100*.25+100*.25)/.84 = 95.2381. Both clear the 74
    // threshold, but the gap (4.76) is below FUZZY_MATCH_MIN_GAP (8), so this must stay unresolved.
    expect(result.candidateScores.find((c) => c.trusteeId === 'trustee-1')?.totalScore).toBeCloseTo(
      100,
      4,
    );
    expect(result.candidateScores.find((c) => c.trusteeId === 'trustee-2')?.totalScore).toBeCloseTo(
      95.2381,
      4,
    );
  });

  test('should return winner when single candidate meets threshold', async () => {
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
