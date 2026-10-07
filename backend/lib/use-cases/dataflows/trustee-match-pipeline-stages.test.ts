import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  addCandidate,
  addScore,
  ScoreRecord,
  createTrusteeInitialState as createInitialState,
  TrusteePipelineState as PipelineState,
  projectTrustee,
} from './trustee-match-pipeline';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import {
  recallBySurnameExact,
  recallByName,
  recallByTokenIntersection,
  recallByAnchoredLevenshtein,
  resolveByPhone,
  resolveByEmailAddress,
  resolveByPhoneWithTypo,
  resolveByAddress,
  resolveByStateOnly,
  resolveByNameOnly,
  normalizeAcmsSourceName,
  skipAdministrativePlaceholder,
  scoreCandidate,
} from './trustee-match-pipeline-stages';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

/** Adds a generic same-surname candidate whose name is not under test. */
const addSomeoneMoon = (state: PipelineState, overrides: Partial<Trustee> = {}) =>
  addCandidate(
    state,
    projectTrustee(
      makeTrustee({ firstName: 'Someone', lastName: 'Moon', name: 'Someone Moon', ...overrides }),
    ),
    'test',
  );

/** Every multi-word name below is invented. */

const GENERIC_ACMS_FULL_NAME = 'Aldric A Moon';

const TOKEN_INTERSECTION_PAIR = {
  acmsFullName: 'D. Wheeler Cray',
  camsName: 'Desmond Wheeler Cray',
} as const;

const FIRST_NAME_SPELLING_VARIANT_PAIR = {
  acmsFullName: 'Norburt Falk',
  acmsFirstName: 'Norburt',
  acmsLastName: 'Falk',
  camsFirstName: 'Norbert',
  camsLastName: 'Falk',
  camsName: 'Norbert Falk',
} as const;

describe('skipAdministrativePlaceholder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // This stage reads the raw ACMS fullName, so every case passes fullName explicitly.

  // Models names that are a role, office, case-status label, or synthetic test record.
  test.each([
    'NOT ASSIGNED',
    'US TRUSTEE',
    'U.S. TRUSTEE',
    'U. S. TRUSTEE',
    'OFFICE OF THE U.S. TRUSTEE',
    'REOPENED CASE',
    'OLD CASE/NO TR ASSIGNED',
    'INVOLUNTARY TRUSTEE',
    'INVOLUNTARY',
    'INVOLUNTARY PETITION',
    'I. M. FAKE',
    'I.M. FAKE',
    'NONE ASSIGNED (DEBTOR IN POSS)',
    'NO TRUSTEE APPOINTED',
    'INVOLUNTARY PETN. - NO TRUSTEE',
    'DEBTOR IN POSSESSION NO TRUSTEE',
    'NO TRUSTEE/ADMIN PURPOSE',
    'INVOLUNTARY PETITION TRUSTEE UNASSIGNED',
    'TRANSFER CASE',
    'RE-OPENED (JACKSON)',
    'NO TRRUSTEE',
    'EXPUNGED',
    '* TRUSTEE ASSIGNMENT IN PROGRESS',
    'INVOL CH 7',
    'MISSING TRUSTEE',
    'NO TR APT',
    'PRE2004PENDINGCASES CHAPTER13UPLOAD',
    'TRINVOL',
    'REOPENED_CASE TRUSTEE_UNASSIGNED',
  ])('sets state.skip for administrative placeholder "%s"', async (fullName) => {
    const state = createInitialState(makeDxtrTrustee({ fullName }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  // U.S. Trustee staff are never CAMS trustees, so a UST annotation skips even with a real name.
  test.each([
    'JORDAN R DOE - U S TRUSTEE',
    'TAYLOR QUILL (UST)',
    'MORGAN R VELLACOTT - U S TRUSTEE',
  ])('sets state.skip for a UST-annotated name "%s"', async (fullName) => {
    const state = createInitialState(makeDxtrTrustee({ fullName }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  // An ACMS disavowal phrase skips the record even when a real name is present.
  test.each([
    'JORDAN (EC) ROE (DO NOT USE)',
    'TAYLOR DOE/DO NOT USE',
    'MORGAN JONES (DO NOT USE)',
    'N JORDAN SMITH (DO NOT USE)',
    'TAYLOR ROE-JONES DO NOT USE DUPLICATE ENTRY',
  ])('sets state.skip for a disavowed record "%s"', async (fullName) => {
    const state = createInitialState(makeDxtrTrustee({ fullName }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  // The disavowal check reads the legacy address fields as well as the name.
  test('sets state.skip for a disavowed record when "DO NOT USE" is in the address instead of the name', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Jordan Roe',
        firstName: 'Jordan',
        lastName: 'Roe',
        legacy: { address1: 'DO NOT USE' } as never,
      }),
    );

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  test('leaves state unchanged for a real name with a real address containing no disavowal phrase', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Jordan Roe',
        firstName: 'Jordan',
        lastName: 'Roe',
        legacy: { address1: '123 Main St', cityStateZipCountry: 'Anytown CA 90001' } as never,
      }),
    );

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(false);
  });

  // Inactive and deceased trustees still have cases to attribute, so they are not disavowals.
  test.each(['JORDAN R DOE INACTIVE', 'HUGH W DECEASED - ROE, JR.'])(
    'leaves state unchanged for an inactive/deceased trustee "%s"',
    async (fullName) => {
      const state = createInitialState(makeDxtrTrustee({ fullName }));

      const result = await skipAdministrativePlaceholder()(state);

      expect(result.skip).toBe(false);
    },
  );

  // Real initials and real surnames such as "Fake" are not placeholders.
  test.each(['R. SMITH', 'J DOE', 'ISAAC FAKE', 'FAKE', 'MARY FAKE', 'U.S. AGGREGATES'])(
    'leaves state unchanged for a real name "%s"',
    async (fullName) => {
      const state = createInitialState(makeDxtrTrustee({ fullName }));

      const result = await skipAdministrativePlaceholder()(state);

      expect(result.skip).toBe(false);
    },
  );

  // The chapter/role marker strips away and a real name remains. "(UST)" is excluded because it
  // always skips.
  test.each([
    "JORDAN W O'DOE (CHAPTER 12)",
    'TAYLOR Z ROE (CH 11)',
    "JORDAN O'DOE (ACTING CH. 13 TRUSTEE)",
    'MORGAN OKAFOR (LIQ TR)',
    'TACOMACH13 K. JORDAN ROE',
  ])('leaves state unchanged for a real name with a chapter/role suffix "%s"', async (fullName) => {
    const state = createInitialState(makeDxtrTrustee({ fullName }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(false);
  });
});

describe('normalizeAcmsSourceName', () => {
  // Models an office/region code in parentheses inside firstName, which is not part of the name.
  test('strips a parenthetical office/region code from firstName, recovering the real compound given name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          firstName: 'WINONA (BALT) SPENCER',
          middleName: '',
          lastName: 'HOLLOWAY',
        }),
      ),
    );

    expect(state.sourceNormalized.firstName).toBe('winona');
    expect(state.sourceNormalized.middleName).toBe('spencer');
  });

  // Both recoveries detect their shape in raw text ("CH13" digits, an "INC" suffix) that
  // stripAdministrativeMarkers would remove, so they must run before it.
  test.each([
    {
      shape: 'an office name with a glued chapter marker in firstName',
      firstName: 'FICTIONBURGCH13',
      lastName: 'ALDRIC Q VEXMORE',
      expected: { firstName: 'aldric', middleName: 'q', lastName: 'vexmore' },
    },
    {
      shape: 'a solo practice name in lastName with a blank firstName',
      firstName: '',
      lastName: 'TESSARIN Q ORSINO INC',
      expected: { firstName: 'tessarin', middleName: 'q', lastName: 'orsino' },
    },
  ])('recovers the real name from $shape', async ({ firstName, lastName, expected }) => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ fullName: `${firstName} ${lastName}`, firstName, lastName }),
      ),
    );

    expect(state.sourceNormalized).toMatchObject(expected);
  });

  test('leaves a real name with no parenthetical unchanged', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Jordan', middleName: 'T', lastName: 'Doe' }),
      ),
    );

    expect(state.sourceNormalized.firstName).toBe('jordan');
    expect(state.sourceNormalized.middleName).toBe('t');
  });

  // The recovery reads the pre-strip lastName, since stripping removes the comma it depends on.
  test('recovers a LAST, FIRST identity out of lastName when firstName is pure role-phrase noise', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          firstName: 'LIQUIDATING TRUSTEE',
          middleName: '',
          lastName: 'ROE, JORDAN',
        }),
      ),
    );

    expect(state.sourceNormalized.firstName).toBe('jordan');
    expect(state.sourceNormalized.lastName).toBe('roe');
  });
});

describe('recallBySurnameExact', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  // Runs normalizeAcmsSourceName first because this stage reads state.sourceNormalized.
  test('adds every surname-exact candidate found to the pipeline state', async () => {
    const jordanVoss = makeTrustee({
      trusteeId: 't1',
      firstName: 'Jordan',
      lastName: 'Voss',
      name: 'Jordan P. Voss',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([jordanVoss]);

    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ fullName: 'Aldric T Voss', lastName: 'Voss' })),
    );

    const result = await recallBySurnameExact(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.get('t1')!.camsRaw.name).toBe('Jordan P. Voss');
  });

  test('evicts a candidate only when its state contradicts and its name does not match', async () => {
    const voss = (trusteeId: string, firstName: string, state: string) =>
      makeTrustee({
        trusteeId,
        firstName,
        lastName: 'Voss',
        name: `${firstName} Voss`,
        public: {
          address: {
            address1: '1 Fictional Ave',
            city: 'Fictionburg',
            state,
            zipCode: '98999',
            countryCode: 'US',
          },
        },
      });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([
      voss('wrong-name-wrong-state', 'Jordan', 'TX'),
      voss('right-name-wrong-state', 'Aldric', 'TX'),
      voss('wrong-name-right-state', 'Jordan', 'WA'),
    ]);
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          fullName: 'Aldric T Voss',
          firstName: 'Aldric',
          lastName: 'Voss',
          legacy: { cityStateZipCountry: 'FICTIONBURG WA 98999' } as never,
        }),
      ),
    );

    const result = await recallBySurnameExact(context)(state);

    expect([...result.candidates.keys()].sort()).toEqual([
      'right-name-wrong-state',
      'wrong-name-right-state',
    ]);
  });

  test('records a gateway failure on state.error as a CamsError with a stack trace, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallBySurnameExact(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallBySurnameExact failed' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('recallByName', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  const stubFindTrusteesByIds = (trustees: Trustee[]) =>
    vi
      .spyOn(MockMongoRepository.prototype, 'findTrusteesByIds')
      .mockImplementation(async (ids: string[]) =>
        trustees.filter((t) => ids.includes(t.trusteeId)),
      );

  test('adds and scores the trustee of a resolved outcome, without resolving', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'exact',
    });
    stubFindTrusteesByIds([
      makeTrustee({ trusteeId: 't1', name: 'John Doe' }),
      makeTrustee({ trusteeId: 't2', name: 'John Doe' }),
    ]);

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByName(context)(state);

    expect(result.match).toBeNull();
    expect([...result.candidates.keys()]).toEqual(['t1']);
    expect(result.candidates.get('t1')?.scores.doesNameMatch).toBeDefined();
  });

  test('adds and scores every candidate of an ambiguous outcome, without resolving', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never, { trusteeId: 't2' } as never],
    });
    stubFindTrusteesByIds([
      makeTrustee({ trusteeId: 't1', name: 'Someone Moon' }),
      makeTrustee({ trusteeId: 't2', name: 'Someone Else' }),
      makeTrustee({ trusteeId: 't3', name: 'Someone Else' }),
    ]);

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByName(context)(state);

    expect(result.match).toBeNull();
    expect([...result.candidates.keys()]).toEqual(['t1', 't2']);
    expect(result.candidates.get('t1')?.scores.doesNameMatch).toBeDefined();
    expect(result.candidates.get('t2')?.scores.doesNameMatch).toBeDefined();
  });

  test('adds nothing when matchTrusteeByName returns no-match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    const findByIdsSpy = vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds');

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByName(context)(state);

    expect(result.match).toBeNull();
    expect(result.candidates.size).toBe(0);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });

  test('records a matchTrusteeByName failure on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByName(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByName failed' }],
    });
    expect(result.match).toBeNull();
  });

  test('records a findTrusteesByIds failure on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'exact',
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByName(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByName failed refetching candidates' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('recallByTokenIntersection', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('adds each token-intersection candidate, recording the intersected token count as a score', async () => {
    const cray = makeTrustee({ trusteeId: 't1', name: TOKEN_INTERSECTION_PAIR.camsName });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'wheeler' || token === 'cray' ? [cray] : []),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: TOKEN_INTERSECTION_PAIR.acmsFullName }),
    );

    const result = await recallByTokenIntersection(context)(state);

    expect(result.candidates.get('t1')!.scores).toMatchObject({
      recallByTokenIntersection: { value: 2, threshold: 2, pass: true },
    });
  });

  test('does not search at all for a single-token ACMS name (nothing to intersect)', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Cray' }));

    await recallByTokenIntersection(context)(state);

    expect(searchSpy).not.toHaveBeenCalled();
  });

  test('records a gateway failure on state.error, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: TOKEN_INTERSECTION_PAIR.acmsFullName }),
    );

    const result = await recallByTokenIntersection(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByTokenIntersection failed' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('recallByAnchoredLevenshtein', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  // Runs normalizeAcmsSourceName first because this stage reads state.sourceNormalized.
  test('adds each anchored-Levenshtein candidate, recording its edit distance as a score', async () => {
    const falk = makeTrustee({
      trusteeId: 't1',
      firstName: FIRST_NAME_SPELLING_VARIANT_PAIR.camsFirstName,
      lastName: FIRST_NAME_SPELLING_VARIANT_PAIR.camsLastName,
      name: FIRST_NAME_SPELLING_VARIANT_PAIR.camsName,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'falk' ? [falk] : []),
    );

    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          fullName: FIRST_NAME_SPELLING_VARIANT_PAIR.acmsFullName,
          firstName: FIRST_NAME_SPELLING_VARIANT_PAIR.acmsFirstName,
          lastName: FIRST_NAME_SPELLING_VARIANT_PAIR.acmsLastName,
        }),
      ),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(result.candidates.get('t1')!.scores).toMatchObject({
      recallByAnchoredLevenshtein: { value: 1, threshold: 2, pass: true },
    });
  });

  test('records a gateway failure on state.error, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(
      makeDxtrTrustee({
        fullName: FIRST_NAME_SPELLING_VARIANT_PAIR.acmsFullName,
        firstName: FIRST_NAME_SPELLING_VARIANT_PAIR.acmsFirstName,
        lastName: FIRST_NAME_SPELLING_VARIANT_PAIR.acmsLastName,
      }),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByAnchoredLevenshtein failed' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('scoreCandidate - name-match facet', () => {
  test('grades an exact doesNameMatch for the same name and a failing one for a different name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ fullName: 'John Doe', firstName: 'John', lastName: 'Doe' }),
      ),
    );
    const t1 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Doe' })),
      'test',
    );
    const t2 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Someone', lastName: 'Else' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, t1);
    scoreCandidate(state.sourceNormalized, t2);

    expect(t1.scores).toMatchObject({ doesNameMatch: { pass: true, quality: 'exact' } });
    expect(t2.scores).toMatchObject({ doesNameMatch: { pass: false } });
  });

  // A CAMS middle name of more than one token glues into a single token, so a source middle
  // initial taken from a later token has nothing to compare against unless the tokens are kept.
  test('matches a middle initial against any token of a multi-token middle name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Della', middleName: 'P', lastName: 'Ostrander' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Adella',
          middleName: 'L. Prue',
          lastName: 'Ostrander',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.camsNormalized.middleNameAlternates).toEqual(['l', 'prue']);
    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  // An exact first name plus a matching surname outweighs a conflicting middle initial - the least
  // reliable name part in this data. The match drops to 'strong' rather than failing outright, so a
  // resolver needing corroboration can still use it while an exact-only resolver declines.
  test('grades a strong match when an exact first name has a conflicting bare middle initial', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Michael', middleName: 'P', lastName: 'Wexford' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Michael',
          middleName: 'E',
          lastName: 'Wexford',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('fails outright when a middle name conflicts AND the first name was only a nickname match', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Cathy', middleName: 'P', lastName: 'Wexford' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Catherine',
          middleName: 'E',
          lastName: 'Wexford',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  test('grades matching bare middle initials on both sides as an exact match', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Michael', middleName: 'P', lastName: 'Wexford' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Michael',
          middleName: 'P',
          lastName: 'Wexford',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });

  test('grades a first/middle swap as a strong match', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Dominic', middleName: 'S', lastName: 'Beaumont' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 's',
          middleName: 'Dominic',
          lastName: 'Beaumont',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  // Two unrelated first names ("Dominic"/"Sylvain") whose leading letters happen to cross-match
  // each other's bare middle initial - coincidence, not a swap.
  test('does not credit two independently-coincidental bare initials as a first/middle swap', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Dominic', middleName: 'S', lastName: 'Beaumont' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Sylvain',
          middleName: 'D',
          lastName: 'Beaumont',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  test('grades two full middle names that are spelling variants as a strong match', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Richard', middleName: 'Jeffery', lastName: 'MacLeod' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Richard',
          middleName: 'Jeffrey',
          lastName: 'MacLeod',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('grades a strong match when two full middle names conflict but the first name is exact', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'John', middleName: 'Alexander', lastName: 'Doe' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'John', middleName: 'Robert', lastName: 'Doe' }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('grades a strong match when only the ACMS side adds a middle initial after a shared middle name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'C. Dabney', middleName: 'L', lastName: 'Vandermoor' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'C. Dabney',
          middleName: undefined,
          lastName: 'Vandermoor',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test("matches a parenthetical alias against the other side's first name", async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: 'RM (RAYMOND)', lastName: 'Ashgrove' })),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Raymond', lastName: 'Ashgrove' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('does not match on a parenthetical office code', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: 'Wendell (TR)', lastName: 'Ashgrove' })),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Marguerite', lastName: 'Ashgrove' }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  test('drops a generational suffix rather than reading it as a middle name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Wendell JR.', middleName: 'F', lastName: 'Ashgrove' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Wendell',
          middleName: 'F.',
          lastName: 'Ashgrove',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    // Joining the fields exposes "JR." where a per-field split kept it hidden; without the
    // suffix filter it would become a middle token and conflict with "f".
    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });

  test('credits a fuzzy (spelling-variant) last name alongside an exact first name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: 'Gina', lastName: 'Stromp' })),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Gina', lastName: 'Strump' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'weak' },
    });
  });

  test('does not credit a fuzzy last name when the first name also differs', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: 'Gina', lastName: 'Stromp' })),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Regina', lastName: 'Strump' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  // Models a CAMS firstName holding a bare initial and a given name in one field.
  test('splits a CAMS firstName with a leading bare initial (full ACMS first name, no ACMS middle)', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Gerald', middleName: 'Theodore', lastName: 'Whitfield' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'G. Theo', lastName: 'Whitfield' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('splits a CAMS firstName with a leading bare initial (ACMS middle initial present)', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Gerald', middleName: 'T', lastName: 'Whitfield' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'G. Theo', lastName: 'Whitfield' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('matches a CAMS firstName of an initial plus the ACMS middle name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Walter', middleName: 'Reid', lastName: 'Abernathy' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'W. Reid', lastName: 'Abernathy' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('matches a compound given name however the two sides divided it', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Robin', middleName: 'Ann', lastName: 'Castellano' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Robin Ann', lastName: 'Castellano' }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });
});

describe('scoreCandidate - similarity-diagnostics facet', () => {
  test('records fullNameSimilarity and tokenNameMatchRate onto the candidate', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'John Doe' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.memo.get('fullNameSimilarity')).toEqual([
      { key: 'john doe|john doe', value: 1 },
    ]);
    expect(candidate.memo.get('tokenNameMatchRate')).toEqual([
      { key: 'john doe|john doe', value: 1 },
    ]);
  });

  test("normalizes a candidate's name for similarity by dropping apostrophes and splitting hyphens", async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: "O'Brien-Smith" })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.camsNormalized.name).toBe('obrien smith');
  });
});

describe('scoreCandidate - state/city/zip/contact-presence facets', () => {
  // Models an ACMS address with a city and state but no zip.
  test('scores city and state from an ACMS address carrying no zip at all', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric T Moon',
        firstName: 'Aldric',
        lastName: 'Moon',
        legacy: { cityStateZipCountry: 'San Diego CA' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-sd',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'San Diego',
          state: 'CA',
          zipCode: '92101',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesCityMatch: { pass: true },
      doesStateMatch: { pass: true },
    });
  });

  test('records no city/state scores when a zip-less ACMS address has no real state code', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric T Moon',
        firstName: 'Aldric',
        lastName: 'Moon',
        legacy: { cityStateZipCountry: 'Corinth Mississippi' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-ms',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Corinth',
          state: 'MS',
          zipCode: '38834',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesStateMatch).toBeUndefined();
    expect(candidate.scores.doesCityMatch).toBeUndefined();
  });

  test('fails doesCamsTrusteeHaveAddressAndPhone for a candidate with NO address1, city, state, zip, or phone at all', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesCamsTrusteeHaveAddressAndPhone: { pass: false },
    });
  });

  test.each([
    {
      description: 'only a city populated',
      address: {
        address1: '',
        city: 'Seattle',
        state: '',
        zipCode: '',
        countryCode: 'US' as const,
      },
    },
    {
      description: 'only a state populated',
      address: { address1: '', city: '', state: 'WA', zipCode: '', countryCode: 'US' as const },
    },
    {
      description: 'only a zip populated',
      address: {
        address1: '',
        city: '',
        state: '',
        zipCode: '98101',
        countryCode: 'US' as const,
      },
    },
    {
      description: 'only address1 populated',
      address: {
        address1: '1 Elm St',
        city: '',
        state: '',
        zipCode: '',
        countryCode: 'US' as const,
      },
    },
  ])(
    'passes doesCamsTrusteeHaveAddressAndPhone for a candidate with $description, even with nothing else',
    async ({ address }) => {
      const state = createInitialState(makeDxtrTrustee());
      const candidate = addSomeoneMoon(state, { trusteeId: 't1', public: { address } });

      scoreCandidate(state.sourceNormalized, candidate);

      expect(candidate.scores).toMatchObject({
        doesCamsTrusteeHaveAddressAndPhone: { pass: true },
      });
    },
  );

  test('passes doesCamsTrusteeHaveAddressAndPhone for a candidate with no address at all but a phone on file', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' },
        phone: { number: '206-555-0100' },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesCamsTrusteeHaveAddressAndPhone: { pass: true },
    });
  });

  test('treats an ACMS phone of "0" as blank, failing doesAcmsTrusteeHaveAddressAndPhone when no address, phone, or email is on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { address1: '', cityStateZipCountry: '', phone: '0' } }),
    );
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    });
  });

  test.each([
    {
      description: 'address1 populated',
      legacy: { address1: '123 Main St', cityStateZipCountry: '', phone: '0' },
    },
    {
      description: 'cityStateZipCountry populated',
      legacy: { address1: '', cityStateZipCountry: 'Seattle WA 98101', phone: '0' },
    },
    {
      description: 'a real phone number populated',
      legacy: { address1: '', cityStateZipCountry: '', phone: '206-555-0100' },
    },
  ])(
    'passes doesAcmsTrusteeHaveAddressAndPhone when the ACMS record has $description',
    async ({ legacy }) => {
      const state = createInitialState(makeDxtrTrustee({ legacy }));
      const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

      scoreCandidate(state.sourceNormalized, candidate);

      expect(candidate.scores).toMatchObject({
        doesAcmsTrusteeHaveAddressAndPhone: { pass: true },
      });
    },
  );

  test('records a doesStateMatch pass when the candidate state matches, case-insensitively', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'wa',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesStateMatch: { pass: true },
    });
  });

  test('records a doesStateMatch fail when the candidate state differs', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesStateMatch: { pass: false },
    });
  });

  test('adds no doesStateMatch record when the ACMS address is unparseable', async () => {
    const state = createInitialState(makeDxtrTrustee({ legacy: { cityStateZipCountry: '' } }));
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesStateMatch).toBeUndefined();
  });

  test('adds no doesStateMatch record when the candidate has no state on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesStateMatch).toBeUndefined();
  });

  test('records a doesCityMatch pass when the candidate city matches, case-insensitively', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'SEATTLE',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesCityMatch: { pass: true },
    });
  });

  test('records a doesCityMatch fail when the candidate city differs', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Tacoma',
          state: 'WA',
          zipCode: '98402',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesCityMatch: { pass: false },
    });
  });

  test('adds no doesCityMatch record when the ACMS address is unparseable', async () => {
    const state = createInitialState(makeDxtrTrustee({ legacy: { cityStateZipCountry: '' } }));
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesCityMatch).toBeUndefined();
  });

  test('adds no doesCityMatch record when the candidate has no city on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '1 Elm St', city: '', state: 'WA', zipCode: '', countryCode: 'US' },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesCityMatch).toBeUndefined();
  });

  test('records a doesZipCodeMatch pass when the 5-digit zip prefix matches, ignoring a +4 extension', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101-4321',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesZipCodeMatch: { pass: true },
    });
  });

  test('records a doesZipCodeMatch fail when the 5-digit zip prefix differs', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Tacoma',
          state: 'WA',
          zipCode: '98402',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).toMatchObject({
      doesZipCodeMatch: { pass: false },
    });
  });

  test('adds no doesZipCodeMatch record when the candidate has no zip on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GENERIC_ACMS_FULL_NAME,
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesZipCodeMatch).toBeUndefined();
  });
});

describe('scoreCandidate - address-match facet', () => {
  const camsAddress = (address1: string, city: string, state: string, zipCode: string) => ({
    address1,
    city,
    state,
    zipCode,
    countryCode: 'US' as const,
  });

  const scoresFor = async (
    acms: { address1?: string; cityStateZipCountry: string },
    cams: ReturnType<typeof camsAddress>,
  ) => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ legacy: acms as never })),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', public: { address: cams } })),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);
    return candidate.scores;
  };

  test('grades identical street, city, state and zip as exact', async () => {
    const scores = await scoresFor(
      { address1: '123 Main St', cityStateZipCountry: 'TACOMA WA 98402' },
      camsAddress('123 Main Street', 'Tacoma', 'WA', '98402'),
    );

    expect(scores.doesAddressMatch).toEqual({
      pass: true,
      quality: 'exact',
      points: 6,
      streetCloseness: 1,
    });
  });

  test('grades a matching area with a near-identical street as strong', async () => {
    const scores = await scoresFor(
      { address1: '1601 Jackson St', cityStateZipCountry: 'FORT MYERS FL 33901' },
      camsAddress('1601 Jackson St Suite 200', 'Fort Myers', 'FL', '33901'),
    );

    expect(scores.doesAddressMatch).toMatchObject({ pass: true, quality: 'strong' });
  });

  test('grades city and state agreement as moderate without a zip match', async () => {
    const scores = await scoresFor(
      { address1: '123 Main St', cityStateZipCountry: 'TACOMA WA 98402' },
      camsAddress('PO Box 9', 'Tacoma', 'WA', '98499'),
    );

    expect(scores.doesAddressMatch).toMatchObject({ pass: true, quality: 'moderate', points: 3 });
  });

  test('grades a zip match as moderate even when the city name differs', async () => {
    const scores = await scoresFor(
      { cityStateZipCountry: 'NORTH HOLLYWOOD CA 91607' },
      camsAddress('1 Other Rd', 'Los Angeles', 'CA', '91607'),
    );

    expect(scores.doesAddressMatch).toMatchObject({ pass: true, quality: 'moderate', points: 3 });
  });

  test('grades state agreement alone as weak', async () => {
    const scores = await scoresFor(
      { cityStateZipCountry: 'NEW YORK NY 10018' },
      camsAddress('', '', 'NY', ''),
    );

    expect(scores.doesAddressMatch).toMatchObject({ pass: true, quality: 'weak', points: 1 });
  });

  test('grades the state match as weak even when the city and zip differ', async () => {
    const scores = await scoresFor(
      { address1: '707 Harlow Trust Bldg', cityStateZipCountry: 'SAN ANGELO TX 76903' },
      camsAddress('3200 Pellam Bank Tower', 'Dallas', 'TX', '75202'),
    );

    expect(scores.doesAddressMatch).toMatchObject({ pass: true, quality: 'weak', points: 1 });
  });

  test('grades a no-match when nothing comparable agrees', async () => {
    const scores = await scoresFor(
      { address1: '707 Harlow Trust Bldg', cityStateZipCountry: 'SAN ANGELO TX 76903' },
      camsAddress('3200 Pellam Bank Tower', 'Tulsa', 'OK', '74103'),
    );

    expect(scores.doesAddressMatch).toMatchObject({ pass: false, points: 0 });
  });

  test('compares house numbers exactly, not fuzzily', async () => {
    const scores = await scoresFor(
      { address1: '4210 Oak St', cityStateZipCountry: 'TACOMA WA 98402' },
      camsAddress('4201 Oak Street', 'Tacoma', 'WA', '98402'),
    );

    expect(scores.doesAddressMatch?.streetCloseness).toBeCloseTo(2 / 3);
  });

  test('records nothing when the ACMS record has no address at all', async () => {
    const scores = await scoresFor(
      { cityStateZipCountry: '' },
      camsAddress('123 Main Street', 'Tacoma', 'WA', '98402'),
    );

    expect(scores.doesAddressMatch).toBeUndefined();
  });

  test.each([
    { acms: 'LASVEGAS NV 89101', cams: 'Las Vegas' },
    { acms: 'SAN JUAN PR 00925', cams: 'Old San Juan' },
    { acms: 'FT MYERS FL 33901', cams: 'Fort Myers' },
    { acms: 'EAU CLAIRE WI 54701', cams: 'Eau Clair' },
  ])('treats $acms and $cams as the same city', async ({ acms, cams }) => {
    const scores = await scoresFor({ cityStateZipCountry: acms }, camsAddress('', cams, '', ''));

    expect(scores.doesCityMatch).toEqual({ pass: true });
  });

  test('does not treat different cities as the same', async () => {
    const scores = await scoresFor(
      { cityStateZipCountry: 'KENMORE NY 14217' },
      camsAddress('', 'Kenosha', '', ''),
    );

    expect(scores.doesCityMatch).toEqual({ pass: false });
  });
});

describe('scoreCandidate - contact-corroboration facet', () => {
  const acmsMarcusFeld = makeDxtrTrustee({
    fullName: 'Marcus Feld',
    firstName: 'Marcus',
    lastName: 'Feld',
    legacy: {
      address1: 'PO Box 100',
      cityStateZipCountry: 'Fictionville, WA 98999',
      phone: '2065551000',
      email: 'marcus.feld@example.com',
    },
  });

  test('records a passing doesEmailMatch when the emails agree', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'marcus-feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            email: 'marcus.feld@example.com',
          },
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesEmailMatch).toEqual({ pass: true });
  });

  test('records a failing doesPhoneMatch when the phone genuinely differs', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-halden',
          public: {
            address: {
              address1: '1400 S. Larkspur Dr. #212',
              city: 'Fictionburg',
              state: 'TX',
              zipCode: '99999',
              countryCode: 'US',
            },
            phone: { number: '555-555-2000' },
          },
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesPhoneMatch).toEqual({ pass: false, phoneDigitDistance: 4 });
  });

  test('records a failing doesEmailMatch when the emails differ', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'marcus-feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            email: 'someone.else@example.com',
          },
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesEmailMatch).toEqual({ pass: false });
  });

  test('does not record doesEmailMatch when either side has no email', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'No Email Here' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'No Email Here' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).not.toHaveProperty('doesEmailMatch');
  });

  test('does not record doesPhoneMatch when the ACMS phone has fewer than 10 digits', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Short Phone', legacy: { phone: '5551000' } as never }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          name: 'Short Phone',
          public: { phone: { number: '206-555-1000' } } as never,
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).not.toHaveProperty('doesPhoneMatch');
  });
});

describe('scoreCandidate - phone-match quality facet', () => {
  const acmsTerrenceBoyle = makeDxtrTrustee({
    fullName: 'Terrence Boyle',
    firstName: 'Terrence',
    lastName: 'Boyle',
    legacy: {
      cityStateZipCountry: 'Fictionburg, NY 10999',
      phone: '2125550100',
    },
  });

  const scoredCandidateWithPhone = async (phone: string) => {
    const state = await normalizeAcmsSourceName()(createInitialState(acmsTerrenceBoyle));
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-boyle',
          firstName: 'Terrence',
          lastName: 'Boyle',
          name: 'Terrence Boyle',
          public: {
            address: {
              address1: '1 Fictional Way',
              city: 'Fictionburg',
              state: 'NY',
              zipCode: '10999',
              countryCode: 'US',
            },
            phone: { number: phone },
          },
        }),
      ),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);
    return candidate;
  };

  test.each([
    {
      description: 'one digit away as a strong match',
      phone: '212-555-0108',
      expected: { pass: true, quality: 'strong', phoneDigitDistance: 1 },
    },
    {
      description: 'two digits away as a strong match',
      phone: '212-555-0111',
      expected: { pass: true, quality: 'strong', phoneDigitDistance: 2 },
    },
    {
      description: 'three digits away as a no-match',
      phone: '212-555-0222',
      expected: { pass: false, phoneDigitDistance: 3 },
    },
  ])('grades a phone $description', async ({ phone, expected }) => {
    const candidate = await scoredCandidateWithPhone(phone);

    expect(candidate.scores.doesPhoneMatch).toEqual(expected);
  });

  test('records an exact doesPhoneMatch when the phones are identical', async () => {
    const candidate = await scoredCandidateWithPhone('212-555-0100');

    expect(candidate.scores.doesPhoneMatch).toEqual({ pass: true, quality: 'exact' });
  });

  test('does not record doesPhoneMatch when the candidate phone has fewer than 10 digits', async () => {
    const candidate = await scoredCandidateWithPhone('5550640');

    expect(candidate.scores).not.toHaveProperty('doesPhoneMatch');
  });
});

describe('resolvers', () => {
  const EXACT_NAME = { doesNameMatch: { pass: true, quality: 'exact' } };
  const STRONG_NAME = { doesNameMatch: { pass: true, quality: 'strong' } };
  const WEAK_NAME = { doesNameMatch: { pass: true, quality: 'weak' } };
  const NO_NAME = { doesNameMatch: { pass: false } };

  const poolOf = (...candidates: Record<string, ScoreRecord>[]) => {
    const state = createInitialState(makeDxtrTrustee());
    candidates.forEach((scores, i) => {
      const candidate = addCandidate(
        state,
        projectTrustee(makeTrustee({ trusteeId: `t${i + 1}` })),
        'test',
      );
      for (const [key, score] of Object.entries(scores)) addScore(candidate, key, score);
    });
    return state;
  };

  const address = (points: number) => ({
    doesAddressMatch:
      points <= 0
        ? { pass: false, points }
        : {
            pass: true,
            quality:
              points >= 6 ? 'exact' : points > 3 ? 'strong' : points === 3 ? 'moderate' : 'weak',
            points,
          },
  });

  describe.each([
    {
      resolver: resolveByPhone,
      name: 'resolveByPhone',
      signal: { doesPhoneMatch: { pass: true, quality: 'exact' } },
    },
    {
      resolver: resolveByEmailAddress,
      name: 'resolveByEmailAddress',
      signal: { doesEmailMatch: { pass: true } },
    },
    { resolver: resolveByAddress, name: 'resolveByAddress', signal: address(3) },
    {
      resolver: resolveByStateOnly,
      name: 'resolveByStateOnly',
      signal: { doesStateMatch: { pass: true } },
    },
  ])('$name', ({ resolver, name, signal }) => {
    test('does not resolve when no candidate has the signal', async () => {
      const result = await resolver()(poolOf(EXACT_NAME, EXACT_NAME));

      expect(result.match).toBeNull();
    });

    test('resolves the only candidate with the signal, whatever the pool size', async () => {
      const result = await resolver()(
        poolOf(EXACT_NAME, { ...EXACT_NAME, ...signal }, STRONG_NAME),
      );

      expect(result.match).toMatchObject({ trusteeId: 't2', resolvedBy: name });
    });

    test('does not resolve when two candidates tie on the signal and name', async () => {
      const result = await resolver()(
        poolOf({ ...EXACT_NAME, ...signal }, { ...EXACT_NAME, ...signal }),
      );

      expect(result.match).toBeNull();
    });

    test('resolves the better name when two candidates share the signal', async () => {
      const result = await resolver()(
        poolOf({ ...STRONG_NAME, ...signal }, { ...EXACT_NAME, ...signal }),
      );

      expect(result.match).toMatchObject({ trusteeId: 't2', resolvedBy: name });
    });

    test('never resolves a candidate whose name does not match', async () => {
      const result = await resolver()(poolOf({ ...NO_NAME, ...signal }));

      expect(result.match).toBeNull();
    });
  });

  describe('resolveByPhone', () => {
    test('does not resolve on a strong (typo) phone match', async () => {
      const result = await resolveByPhone()(
        poolOf({
          ...EXACT_NAME,
          doesPhoneMatch: { pass: true, quality: 'strong', phoneDigitDistance: 1 },
        }),
      );

      expect(result.match).toBeNull();
    });
  });

  describe('resolveByAddress', () => {
    test('a better address outranks a better name', async () => {
      const result = await resolveByAddress()(
        poolOf({ ...EXACT_NAME, ...address(3.6) }, { ...STRONG_NAME, ...address(5.4) }),
      );

      expect(result.match).toMatchObject({ trusteeId: 't2' });
    });

    test('does not resolve on a weak address', async () => {
      const result = await resolveByAddress()(poolOf({ ...EXACT_NAME, ...address(2) }));

      expect(result.match).toBeNull();
    });
  });

  describe('resolveByPhoneWithTypo', () => {
    const strongPhone = {
      doesPhoneMatch: { pass: true, quality: 'strong', phoneDigitDistance: 1 },
    };

    test('resolves the only exact-name candidate whose phone is a typo away', async () => {
      const result = await resolveByPhoneWithTypo()(
        poolOf(EXACT_NAME, { ...EXACT_NAME, ...strongPhone }),
      );

      expect(result.match).toMatchObject({ trusteeId: 't2', resolvedBy: 'resolveByPhoneWithTypo' });
    });

    test('does not resolve a typo phone on a name that is not exact', async () => {
      const result = await resolveByPhoneWithTypo()(poolOf({ ...STRONG_NAME, ...strongPhone }));

      expect(result.match).toBeNull();
    });

    test('does not resolve when two exact-name candidates have a typo phone', async () => {
      const result = await resolveByPhoneWithTypo()(
        poolOf({ ...EXACT_NAME, ...strongPhone }, { ...EXACT_NAME, ...strongPhone }),
      );

      expect(result.match).toBeNull();
    });
  });

  describe('resolveByStateOnly', () => {
    test('never resolves a weak name', async () => {
      const result = await resolveByStateOnly()(
        poolOf({ ...WEAK_NAME, doesStateMatch: { pass: true } }),
      );

      expect(result.match).toBeNull();
    });

    // Exact first and last names plus an agreeing state outweigh a conflicting middle initial.
    test('resolves an exact first and last name with a conflicting middle initial when the state agrees', async () => {
      const state = await normalizeAcmsSourceName()(
        createInitialState(
          makeDxtrTrustee({
            firstName: 'Aldric',
            middleName: 'P',
            lastName: 'Vexmore',
            legacy: { cityStateZipCountry: 'FICTIONBURG DE 19801' } as never,
          }),
        ),
      );
      const candidate = addCandidate(
        state,
        projectTrustee(
          makeTrustee({
            trusteeId: 't1',
            firstName: 'Aldric',
            middleName: 'E',
            lastName: 'Vexmore',
            public: {
              address: {
                address1: '1 Elm St',
                city: 'Hallowmere',
                state: 'DE',
                zipCode: '19901',
                countryCode: 'US',
              },
            },
          }),
        ),
        'test',
      );
      scoreCandidate(state.sourceNormalized, candidate);

      const result = await resolveByStateOnly()(state);

      expect(result.match).toMatchObject({ trusteeId: 't1', resolvedBy: 'resolveByStateOnly' });
    });
  });

  describe('resolveByNameOnly', () => {
    test('resolves the only exact-name candidate when nothing contradicts it', async () => {
      const result = await resolveByNameOnly()(poolOf(EXACT_NAME, NO_NAME));

      expect(result.match).toMatchObject({ trusteeId: 't1', resolvedBy: 'resolveByNameOnly' });
    });

    test('resolves the only exact name even when weaker names also match', async () => {
      const result = await resolveByNameOnly()(poolOf(STRONG_NAME, EXACT_NAME, WEAK_NAME));

      expect(result.match).toMatchObject({ trusteeId: 't2', resolvedBy: 'resolveByNameOnly' });
    });

    test.each([
      {
        description: 'the phone',
        score: { doesPhoneMatch: { pass: false, phoneDigitDistance: 6 } },
      },
      { description: 'the email', score: { doesEmailMatch: { pass: false } } },
      { description: 'the address', score: address(0) },
    ])(
      'still resolves when $description does not match - a missing strong signal, not a contradiction',
      async ({ score }) => {
        const result = await resolveByNameOnly()(poolOf({ ...EXACT_NAME, ...score }));

        expect(result.match).toMatchObject({ trusteeId: 't1', resolvedBy: 'resolveByNameOnly' });
      },
    );

    test.each([
      { description: 'a second candidate also has an exact name', pool: [EXACT_NAME, EXACT_NAME] },
      { description: 'the name is not exact', pool: [STRONG_NAME] },
      {
        description: 'the state contradicts',
        pool: [{ ...EXACT_NAME, doesStateMatch: { pass: false } }],
      },
      {
        description: 'the CAMS trustee has no address or phone',
        pool: [{ ...EXACT_NAME, doesCamsTrusteeHaveAddressAndPhone: { pass: false } }],
      },
    ])('does not resolve when $description', async ({ pool }) => {
      const result = await resolveByNameOnly()(poolOf(...pool));

      expect(result.match).toBeNull();
    });
  });
});
