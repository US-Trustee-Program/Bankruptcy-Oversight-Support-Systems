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
  mergedScore,
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
  resolveByCityAndZipCode,
  resolveByStateAndCity,
  resolveByZipCode,
  resolveByStateOnly,
  resolveByNameOnly,
  normalizeAcmsSourceName,
  skipAdministrativePlaceholder,
  scoreCandidate,
  addAndScoreCandidate,
} from './trustee-match-pipeline-stages';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

/** Shared "Someone Moon" candidate fixture used across the doesStateMatch/doesCityMatch/
 * doesZipCodeMatch describe blocks - a generic, deliberately-unrelated-to-the-ACMS-record surname
 * collision, not a specific name under test. */
const addSomeoneMoon = (state: PipelineState, overrides: Partial<Trustee> = {}) =>
  addCandidate(
    state,
    projectTrustee(
      makeTrustee({ firstName: 'Someone', lastName: 'Moon', name: 'Someone Moon', ...overrides }),
    ),
    'test',
  );

/**
 * Every multi-word name below is INVENTED - none is a real ACMS/CAMS record. Each pair stands in
 * for a real pattern that WAS once observed in a staging backtest (a score collision, a
 * false-positive risk, a discovery-tier edge case), but the specific people named in that backtest
 * are never reproduced here. Named per the CONDITION each pair models, not the people it replaces,
 * so a reader sees why the pair exists from the declaration alone.
 */

/** Generic ACMS-side filler paired with the "Someone Moon" candidate fixture above - an arbitrary
 * name with no distinguishing relationship to its candidate, used where the test only cares that
 * SOME ACMS record exists. */
const GENERIC_ACMS_FULL_NAME = 'Aldric A Moon';

/** ACMS record with a real, comparable, MISMATCHED phone number differing by exactly one digit
 * from an otherwise exact-name CAMS candidate - the digit-hamming-distance typo-tolerance shape. */
const PHONE_TYPO_ONE_DIGIT_PAIR = {
  acmsFullName: 'D. Wheeler Cray',
  camsName: 'Desmond Wheeler Cray',
} as const;

/** ACMS record with no comparable phone/address data on file, recoverable only via anchored
 * Levenshtein against a spelling-variant CAMS candidate. */
const NO_CONTACT_DATA_SPELLING_VARIANT_PAIR = {
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

  // Runs directly against createInitialState, NOT after normalizeAcmsSourceName - this stage now
  // runs FIRST in the real pipeline (see its own doc comment: it reads state.sourceRaw.fullName,
  // the raw ACMS name exactly as composed by toAcmsTrusteeProfessional, before any
  // recovery/reduction has a chance to redistribute a signal across fields). fullName must be
  // passed explicitly on every case below - makeDxtrTrustee's own default ('John Doe') is fixed,
  // not derived from firstName/lastName overrides.

  // Real shape from a staging backtest - an ACMS record naming no real person at all, only
  // administrative placeholder text.
  test('sets state.skip when the record trips shouldSkipAsNotAPerson', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'NOT ASSIGNED' }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  // Real shapes from a staging backtest survey of the no-match population: every one of these
  // names no real person at all (a role/office name, a case-status label, or a well-known
  // synthetic test record ACMS put in the name field), and none of them previously tripped
  // shouldSkipAsNotAPerson - see ADMINISTRATIVE_MARKER_PHRASES/NON_PERSON_ONLY_WORDS/
  // FAKE_IDENTITY_PATTERN's own doc comments in sync-acms-professional-ids.ts for the full
  // backtest-verified word list/pattern and why each is safe to include.
  test.each([
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
  ])('sets state.skip for administrative placeholder "%s"', async (fullName) => {
    const state = createInitialState(makeDxtrTrustee({ fullName }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  // Brian's correction (2026-09-29), reversing a previous, now-known-wrong assumption: a UST (U.S.
  // Trustee office staff, appointed by the USTP program, leadership over the "private" trustees) is
  // a real person but is NEVER a CAMS trustee record - not in CAMS at all, even though they
  // sometimes step in and work cases directly. A "- U S TRUSTEE"/"(UST)" annotation is therefore an
  // early, unconditional skip signal, not a strip-then-recover-a-real-name shape like "(CHAPTER 12)"
  // or "(TR)" - there is structurally nothing in CAMS to ever match it to, no matter how real the
  // accompanying name looks. This test previously asserted skip===false for this exact shape; see
  // shouldSkipAsUstStaff's own doc comment for the dedicated UST-keywords list this now runs through.
  test.each(['JORDAN R DOE - U S TRUSTEE', 'JUDY ROBBINS (UST)', 'JOHN R STONITSCH - U S TRUSTEE'])(
    'sets state.skip for a UST-annotated name "%s"',
    async (fullName) => {
      const state = createInitialState(makeDxtrTrustee({ fullName }));

      const result = await skipAdministrativePlaceholder()(state);

      expect(result.skip).toBe(true);
    },
  );

  // Real shapes from a staging backtest: ACMS explicitly disavowing a specific professional-code
  // RECORD ("DO NOT USE", "DUPLICATE", "CANCELLED", "DELETE") is skip-worthy even when a real
  // person's name is also present - see isRecordDisavowed's own doc comment for why this is a
  // separate, unconditional check from shouldSkipAsNotAPerson's name-decomposition logic. A real
  // record surfaced this: its sole CAMS candidate even barely cleared doesNameMatch's threshold,
  // yet ACMS is explicitly saying this specific record is a stale duplicate that should never be
  // matched against at all.
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

  // Real bug, confirmed via pipeline-replay-backtest.ts against the 2026-09-25 export:
  // isRecordDisavowed used to check fullName only. A real record (a real shape, name synthesized:
  // ACMS "Jordan Roe" - a genuine person's name, no disavowal phrase in it at all) had "DO NOT USE"
  // placed in legacy.address1 instead of the name field, and auto-linked anyway - a real disavowal
  // signal this check was structurally blind to. Now also checks the concatenated legacy address
  // fields (address1/address2/cityStateZipCountry), independent of the fullName check.
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

  // "inactive" and "deceased" are deliberately NOT disavowal signals (see
  // DISAVOWED_RECORD_PHRASES's own doc comment): an inactive trustee can still have open cases
  // that must stay correctly attributed until reassignment, and a deceased trustee's past cases
  // likewise need their real identity resolved first - both must still reach matching.
  test.each(['JORDAN R DOE INACTIVE', 'HUGH W DECEASED - ROE, JR.'])(
    'leaves state unchanged for an inactive/deceased trustee "%s"',
    async (fullName) => {
      const state = createInitialState(makeDxtrTrustee({ fullName }));

      const result = await skipAdministrativePlaceholder()(state);

      expect(result.skip).toBe(false);
    },
  );

  // Guards against exactly the regression NON_PERSON_ONLY_WORDS/FAKE_IDENTITY_PATTERN's own doc
  // comments describe (sync-acms-professional-ids.ts): a real trustee's genuine single-letter
  // initial, or a real surname that happens to be a word/pattern this stage also uses for
  // placeholder detection, must never be treated as not-a-person. "Fake" in particular is a real
  // surname - the "I. M. FAKE" cases above must never generalize to "any Fake surname skips."
  test.each(['R. SMITH', 'J DOE', 'ISAAC FAKE', 'FAKE', 'MARY FAKE', 'U.S. AGGREGATES'])(
    'leaves state unchanged for a real name "%s"',
    async (fullName) => {
      const state = createInitialState(makeDxtrTrustee({ fullName }));

      const result = await skipAdministrativePlaceholder()(state);

      expect(result.skip).toBe(false);
    },
  );

  // Real shapes found while spot-checking the no-match partition of a staging backtest report:
  // case-status placeholders naming no real person at all.
  test.each([
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

  // Same backtest spot-check: a real trustee's name with an appended chapter/role parenthetical
  // is NOT skip-worthy - the marker strips away, and a real name remains underneath. "(UST)" is
  // deliberately NOT in this group - see the UST-annotation test above for why that shape skips
  // unconditionally instead, unlike a chapter/acting-trustee-role suffix.
  test.each([
    "JORDAN W O'DOE (CHAPTER 12)",
    'TAYLOR Z ROE (CH 11)',
    "JORDAN O'DOE (ACTING CH. 13 TRUSTEE)",
  ])('leaves state unchanged for a real name with a chapter/role suffix "%s"', async (fullName) => {
    const state = createInitialState(makeDxtrTrustee({ fullName }));

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(false);
  });

  // From prompt-cams-876-matching-fixes.md, Problem 3: real ACMS shapes with no CAMS counterpart
  // (correctly no-match) that must still normalize cleanly - not skipped, not crashing, not
  // corrupted into some other wrong identity, even though there is no real link to find for them.
  // Names synthesized from the real staging-export shapes.
  test.each([
    'TIMOTHY ASHFORD (ACTING CH. 13 TRUSTEE)',
    'CLAUDIA Z MERIWETHER (CH 11)',
    'DAVID OKONKWO (LIQ TR)',
    'TACOMACH13 K. MICHAEL DRUMMOND',
  ])(
    'does not skip a real no-CAMS-record name with a chapter/role annotation "%s"',
    async (fullName) => {
      const state = createInitialState(makeDxtrTrustee({ fullName }));

      const result = await skipAdministrativePlaceholder()(state);

      expect(result.skip).toBe(false);
    },
  );
});

describe('normalizeAcmsSourceName', () => {
  // Real shape (2026-09-25 staging export, name synthesized): a parenthetical ACMS office/region
  // code landing mid-firstName, not part of the name. Before this fix, stripAdministrativeMarkers
  // only stripped the PARENTHESES themselves ([-/*.,():_]+), leaving the code's text as a bare
  // surviving word - "WINONA (BALT) SPENCER" reduced to "WINONA BALT SPENCER" (3 words), which
  // splitCompoundFirstName then wrongly split into firstName="Winona", middleName="Balt Spencer"
  // instead of the correct middleName="Spencer" alone.
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

  test('leaves a real name with no parenthetical unchanged', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Jordan', middleName: 'T', lastName: 'Doe' }),
      ),
    );

    expect(state.sourceNormalized.firstName).toBe('jordan');
    expect(state.sourceNormalized.middleName).toBe('t');
  });

  // Real shape (2026-09-25 staging export, name synthesized): firstName "LIQUIDATING TRUSTEE",
  // lastName "PELLETIER, DEVIN" - the whole real identity landed in lastName, LAST, FIRST order,
  // because firstName carries only role-phrase noise. Must run BEFORE stripAdministrativeMarkers'
  // own comma-stripping, which would otherwise destroy the comma this recovery depends on.
  test('recovers a LAST, FIRST identity out of lastName when firstName is pure role-phrase noise', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          firstName: 'LIQUIDATING TRUSTEE',
          middleName: '',
          lastName: 'PELLETIER, DEVIN',
        }),
      ),
    );

    expect(state.sourceNormalized.firstName).toBe('devin');
    expect(state.sourceNormalized.lastName).toBe('pelletier');
  });
});

describe('recallBySurnameExact', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  // Runs normalizeAcmsSourceName first, matching real pipeline stage ordering -
  // recallBySurnameExact reads state.sourceNormalized directly (already lowercase/
  // firstLastNameToken-reduced), not state.sourceRaw's original casing.
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

  test('does not reset an existing candidate already discovered by a prior stage', async () => {
    const jordanVoss = makeTrustee({ trusteeId: 't1', name: 'Jordan P. Voss' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([jordanVoss]);

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Aldric T Voss', lastName: 'Voss' }),
    );
    const existingCandidate = addCandidate(state, projectTrustee(jordanVoss), 'test');
    addScore(existingCandidate, 'doesNameMatch', { pass: false, quality: 'weak' });

    const result = await recallBySurnameExact(context)(state);

    expect(result.candidates.get('t1')!.scores).toEqual({
      doesNameMatch: { pass: false, quality: 'weak' },
    });
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

  test('adds every token-intersection candidate found to the pipeline state', async () => {
    const cray = makeTrustee({ trusteeId: 't1', name: PHONE_TYPO_ONE_DIGIT_PAIR.camsName });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'wheeler' || token === 'cray' ? [cray] : []),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: PHONE_TYPO_ONE_DIGIT_PAIR.acmsFullName }),
    );

    const result = await recallByTokenIntersection(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
  });

  // Real evidence, not discarded: a candidate surviving intersection matched EVERY ACMS token
  // searched, which this stage records at the moment of discovery.
  test('records the number of ACMS tokens intersected as a SCORE on every candidate found', async () => {
    const cray = makeTrustee({ trusteeId: 't1', name: PHONE_TYPO_ONE_DIGIT_PAIR.camsName });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'wheeler' || token === 'cray' ? [cray] : []),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: PHONE_TYPO_ONE_DIGIT_PAIR.acmsFullName }),
    );

    const result = await recallByTokenIntersection(context)(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
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
      makeDxtrTrustee({ fullName: PHONE_TYPO_ONE_DIGIT_PAIR.acmsFullName }),
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

  // Runs normalizeAcmsSourceName first, matching real pipeline stage ordering -
  // recallByAnchoredLevenshtein reads state.sourceNormalized directly (already
  // firstLastNameToken/normalizeNamePart-reduced), not state.sourceRaw.
  test('adds every anchored-Levenshtein candidate found to the pipeline state', async () => {
    const falk = makeTrustee({
      trusteeId: 't1',
      firstName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.camsFirstName,
      lastName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.camsLastName,
      name: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.camsName,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'falk' ? [falk] : []),
    );

    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          fullName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsFullName,
          firstName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsFirstName,
          lastName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsLastName,
        }),
      ),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
  });

  // Real evidence, not discarded: the edit distance IS the signal (a distance of 1 is stronger
  // evidence than 2), recorded at the moment of discovery.
  test('records the actual edit distance as a SCORE on every candidate found', async () => {
    const falk = makeTrustee({
      trusteeId: 't1',
      firstName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.camsFirstName,
      lastName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.camsLastName,
      name: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.camsName,
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'falk' ? [falk] : []),
    );

    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          fullName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsFullName,
          firstName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsFirstName,
          lastName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsLastName,
        }),
      ),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      recallByAnchoredLevenshtein: { value: 1, threshold: 2, pass: true },
    });
  });

  test('records a gateway failure on state.error, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(
      makeDxtrTrustee({
        fullName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsFullName,
        firstName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsFirstName,
        lastName: NO_CONTACT_DATA_SPELLING_VARIANT_PAIR.acmsLastName,
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
  test('merges a nameScore and a match flag onto every candidate currently in the pipeline', async () => {
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

    expect(mergedScore(t1)).toMatchObject({ doesNameMatch: { pass: true, quality: 'exact' } });
    expect(mergedScore(t2)).toMatchObject({ doesNameMatch: { pass: false } });
  });

  // A CAMS middle name of more than one token glues into a single token, so a source middle
  // initial taken from a later token has nothing to compare against unless the tokens are kept.
  test('matches a middle initial against any token of a multi-token middle name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Kathy', middleName: 'P', lastName: 'Coryell' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Kathryn',
          middleName: 'L. Pry',
          lastName: 'Coryell',
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.camsNormalized.middleNameAlternates).toEqual(['l', 'pry']);
    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test("downgrades to strong when a bare middle initial doesn't match the other side's leading character", async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: 'John', middleName: 'T', lastName: 'Doe' })),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'John', middleName: 'Bruce', lastName: 'Doe' }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  // An exact first name plus a matching surname outweighs a conflicting middle initial - the least
  // reliable name part in this data. The match drops to 'strong' rather than failing outright, so a
  // resolver needing corroboration can still use it while an exact-only resolver declines.
  test('downgrades to strong when two DIFFERENT bare middle initials appear on both sides', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  test('treats two matching bare middle initials on both sides as a full match', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });

  // A genuine swap: the same token ("dominic") is spelled out on one side and reduced to a bare
  // initial on the other.
  test('still credits a genuine first/middle swap as 85, unaffected by the bare-initial-conflict fix', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  test('scores two full middle names that are a plausible spelling variant as 85, not a flat 15', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('downgrades to 85 for two full middle names that are NOT a plausible variant', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  // The two sides split a compound given name on different rules, and each stops splitting once
  // its own side already carries a middle name - so the same "C. David Butler" arrives as
  // first="cdavid" middle="l" from one and first="c" middle="david" from the other.
  test('matches the same given name divided differently between first and middle', async () => {
    // Source keeps "C. Dabney" whole because it already has a middle initial; CAMS has no middle
    // name, so it splits the same text into first="c" middle="dabney".
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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
    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: false },
    });
  });

  // Real shape (2026-09-25 staging export, names synthesized): CAMS trustee stored as
  // firstName="G. Theo" (a single un-split field, no middleName) - the leading "G." is an
  // initial, "Theo" the real given name. Before this fix, normalizeCandidateNameFields ran
  // normalizeNamePart directly on the raw "G. Theo" string, which strips ALL non-alphanumeric
  // characters INCLUDING the space between tokens, gluing them into "gtheo" - unrecognizable as
  // either "gerald" or "theodore" against any ACMS variant, so doesNameMatch scored 0 for several
  // real ACMS records that are clearly the same person (same office address/phone across them).
  test('splits a CAMS firstName with a leading bare initial before scoring (full ACMS first name, no ACMS middle)', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('splits a CAMS firstName with a leading bare initial before scoring (ACMS middle initial present)', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  test('splits a CAMS firstName with a trailing bare initial before scoring', async () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'strong' },
    });
  });

  // Real CAMS records with NO bare-initial token anywhere in a multi-token firstName must NEVER
  // be split - several real trustees carry a compound GIVEN name shape like "Lee Ann"/"Mary Jo"
  // (one person's whole first name), not an initial-plus-given-name shape. Splitting a name like
  // "Lee Ann" into firstName="Lee"/middleName="Ann" would silently corrupt a real trustee's name.
  // Uses makeDxtrTrustee's already-split firstName/middleName fields directly (bypassing
  // normalizeAcmsSourceName's OWN, separate splitCompoundFirstName call on the ACMS side, which is
  // not under test here) so this test isolates ONLY the CAMS-side splitting decision: an ACMS
  // record already carrying firstName="Robin", middleName="Ann" must still match a CAMS
  // firstName="Robin Ann" left correctly whole, not corrupted into some other split.
  // A real compound given name divides the same way on both sides, so it still matches itself -
  // exactly, since neither side is relaxed to get there.
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

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });

  // A non-person role placeholder (real CAMS records are literally stored as "Chapter 13" with
  // lastName "Standing Trustee") divides identically on both sides too, so it neither matches
  // something it shouldn't nor stops matching itself.
  test('matches a two-token role placeholder however the two sides divided it', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Interim', middleName: 'Trustee', lastName: 'Placeholder' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Interim Trustee', lastName: 'Placeholder' }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
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

  test('computes the ACMS-side normalized name once on sourceNormalized rather than recomputing it per candidate', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const t1 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Jane Smith' })),
      'test',
    );
    const t2 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Bob Jones' })),
      'test',
    );

    scoreCandidate(state.sourceNormalized, t1);
    scoreCandidate(state.sourceNormalized, t2);

    expect(state.sourceNormalized.name).toBe('john doe');
  });

  test("computes each candidate's own normalized name once, reused by both fullNameSimilarity and tokenNameMatchRate", async () => {
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
  const dxtrInWashington = makeDxtrTrustee({
    fullName: 'Aldric T Moon',
    firstName: 'Aldric',
    middleName: 'A',
    lastName: 'Moon',
    legacy: { cityStateZipCountry: 'Tacoma, WA 98402' },
  });

  // Real bug, confirmed via pipeline-replay-backtest.ts against the 2026-09-25 export: an ACMS
  // address with no zip token at all never parsed, so a genuine, comparable city+state pair
  // scored ZERO city/state evidence - 71 real records share this shape (a real shape, name
  // synthesized: ACMS "Jordan Roe", "San Diego CA" with no zip ever recorded, matched a real CAMS
  // candidate also in San Diego, CA). parseAcmsCityStateZip recovers it ACMS-side only; the
  // shared parser the DXTR paths use is unchanged.
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate).doesStateMatch).toBeUndefined();
    expect(mergedScore(candidate).doesCityMatch).toBeUndefined();
  });

  test('records doesStateMatch:false for a state-mismatched candidate', async () => {
    const state = createInitialState(dxtrInWashington);
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-fl',
      firstName: 'Nobody',
      name: 'Nobody Moon',
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

    expect(mergedScore(candidate)).toMatchObject({
      doesStateMatch: { pass: false },
    });
  });

  test('records no doesStateMatch at all when the ACMS address has no parseable state', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { cityStateZipCountry: undefined },
    });
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-1',
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

    expect(mergedScore(candidate).doesStateMatch).toBeUndefined();
  });

  test('records no doesStateMatch at all for a candidate with no CAMS state', async () => {
    const state = createInitialState(dxtrInWashington);
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-no-state',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Unknown',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate).doesStateMatch).toBeUndefined();
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

    expect(mergedScore(candidate)).toMatchObject({
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

      expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
      doesCamsTrusteeHaveAddressAndPhone: { pass: true },
    });
  });

  test('fails doesAcmsTrusteeHaveAddressAndPhone when the ACMS record has no address1, cityStateZipCountry, phone, or email at all', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { address1: '', cityStateZipCountry: '', phone: '0', fax: '0' } }),
    );
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    });
  });

  test.each([
    {
      description: 'address1 populated',
      legacy: { address1: '123 Main St', cityStateZipCountry: '', phone: '0', fax: '0' },
    },
    {
      description: 'cityStateZipCountry populated',
      legacy: { address1: '', cityStateZipCountry: 'Seattle WA 98101', phone: '0', fax: '0' },
    },
    {
      description: 'a real phone number populated',
      legacy: { address1: '', cityStateZipCountry: '', phone: '206-555-0100', fax: '0' },
    },
  ])(
    'passes doesAcmsTrusteeHaveAddressAndPhone when the ACMS record has $description',
    async ({ legacy }) => {
      const state = createInitialState(makeDxtrTrustee({ legacy }));
      const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

      scoreCandidate(state.sourceNormalized, candidate);

      expect(mergedScore(candidate)).toMatchObject({
        doesAcmsTrusteeHaveAddressAndPhone: { pass: true },
      });
    },
  );

  test('treats ACMS phone/fax "0" as blank, not a real value for doesAcmsTrusteeHaveAddressAndPhone', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { address1: '', cityStateZipCountry: '', phone: '0', fax: '0' } }),
    );
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    });
  });

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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

    expect(mergedScore(candidate)).toMatchObject({
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

  // Real bug, confirmed via pipeline-replay-backtest.ts against the 2026-09-25 export:
  // pipelineAddressScore used to return a plain 0 (not null) when the ACMS address didn't parse at
  // all, and scoreContactCorroboration wrote that 0 as a REAL, present contactCorroborationAddress
  // ScoreRecord (value:0, pass:false) unconditionally - a fabricated "genuine disagreement"
  // indistinguishable from an actual address mismatch, for a candidate whose address was never
  // compared at all. 2+ real records (a genuinely empty ACMS cityStateZipCountry, a real comparable
  // CAMS address) carried this fabricated conflict. Fixed to follow the same "no record when data
  // unavailable" convention as doesStateMatch/doesCityMatch/doesZipCodeMatch/doesMiddleNameMatch -
  // contactCorroborationAddress must be entirely absent, not a low recorded score, for this shape.
  test('leaves contactCorroborationAddress unset when the ACMS address is unparseable, not fabricated as a low score', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric T Moon',
        firstName: 'Aldric',
        middleName: 'A',
        lastName: 'Moon',
        legacy: { cityStateZipCountry: '' } as never,
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-wa',
      firstName: 'Aldric',
      name: 'Aldric Moon',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Tacoma',
          state: 'WA',
          zipCode: '98402',
          countryCode: 'US',
        },
      },
    } as never);

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.contactCorroborationAddress).toBeUndefined();
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

  test('records doesPhoneMatch and doesEmailMatch for a candidate, unconditionally (no pool-size gate)', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-marcus-feld',
          name: 'J. Marcus Feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
            email: 'marcus.feld@example.com',
          },
        }),
      ),
      'test',
    );

    expect(mergedScore(candidate).doesPhoneMatch).toEqual({ pass: true, quality: 'exact' });
    expect(mergedScore(candidate).doesEmailMatch).toEqual({ pass: true });
  });

  test('records a failing doesPhoneMatch when the phone genuinely differs', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-wilson',
          name: 'A. Bruce Halden',
          public: {
            address: {
              address1: '1300 S. University Dr. #308',
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

    expect(mergedScore(candidate).doesPhoneMatch).toEqual({ pass: false, phoneDigitDistance: 4 });
  });

  test('records a failing doesEmailMatch when the emails differ', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'marcus-feld',
          name: 'Marcus Feld',
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

    expect(mergedScore(candidate).doesEmailMatch).toEqual({ pass: false });
  });

  test('does not record doesEmailMatch when either side has no email', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'No Email Here' }));
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'No Email Here' })),
      'test',
    );

    expect(candidate.scores).not.toHaveProperty('doesEmailMatch');
  });

  test('does not record doesPhoneMatch when either phone has fewer than 10 digits', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Short Phone', legacy: { phone: '5551000' } as never }),
    );
    const candidate = addAndScoreCandidate(
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

    expect(candidate.scores).not.toHaveProperty('doesPhoneMatch');
  });
});

describe('scoreCandidate - phone-match quality facet', () => {
  // A backtest of 245 sole, exact-name candidates with a comparable but mismatched phone found
  // numbers 1-2 digits apart were essentially always a typo for the same person, while numbers
  // 8-10 digits apart were genuinely different numbers.
  const acmsTerrenceBoyle = makeDxtrTrustee({
    fullName: 'Terrence Boyle',
    firstName: 'Terrence',
    lastName: 'Boyle',
    legacy: {
      cityStateZipCountry: 'Fictionburg, NY 10999',
      phone: '2125550100',
    },
  });

  const scoredCandidateWithPhone = async (phone: string, firstName = 'Terrence') => {
    const state = await normalizeAcmsSourceName()(createInitialState(acmsTerrenceBoyle));
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-boyle',
          firstName,
          lastName: 'Boyle',
          name: `${firstName} Boyle`,
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

  test('records a strong doesPhoneMatch, with the digit distance, when phones differ by 1-2 digits', async () => {
    const candidate = await scoredCandidateWithPhone('212-555-0108');

    expect(mergedScore(candidate).doesPhoneMatch).toEqual({
      pass: true,
      quality: 'strong',
      phoneDigitDistance: 1,
    });
  });

  test.each([
    { phone: '212-555-0111', expected: { pass: true, quality: 'strong', phoneDigitDistance: 2 } },
    { phone: '212-555-0222', expected: { pass: false, phoneDigitDistance: 3 } },
  ])('records $expected for $phone', async ({ phone, expected }) => {
    const candidate = await scoredCandidateWithPhone(phone);

    expect(mergedScore(candidate).doesPhoneMatch).toEqual(expected);
  });

  test('records a failing doesPhoneMatch when the phone is genuinely a different number', async () => {
    const candidate = await scoredCandidateWithPhone('425-894-9945');

    expect(mergedScore(candidate).doesPhoneMatch).toMatchObject({ pass: false });
  });

  test('records an exact doesPhoneMatch when the phones are identical', async () => {
    const candidate = await scoredCandidateWithPhone('212-555-0100');

    expect(mergedScore(candidate).doesPhoneMatch).toEqual({ pass: true, quality: 'exact' });
  });

  test('does not record doesPhoneMatch when the candidate phone has fewer than 10 digits', async () => {
    const candidate = await scoredCandidateWithPhone('5550640');

    expect(candidate.scores).not.toHaveProperty('doesPhoneMatch');
  });

  test('grades the phone regardless of how well the name matches', async () => {
    const candidate = await scoredCandidateWithPhone('212-555-0108', 'T');

    expect(mergedScore(candidate).doesPhoneMatch).toEqual({
      pass: true,
      quality: 'strong',
      phoneDigitDistance: 1,
    });
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

  const address = (value: number) => ({
    contactCorroborationAddress: { value, threshold: 80, pass: value >= 80 },
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
    { resolver: resolveByAddress, name: 'resolveByAddress', signal: address(90) },
    {
      resolver: resolveByCityAndZipCode,
      name: 'resolveByCityAndZipCode',
      signal: { doesCityMatch: { pass: true }, doesZipCodeMatch: { pass: true } },
    },
    {
      resolver: resolveByStateAndCity,
      name: 'resolveByStateAndCity',
      signal: { doesStateMatch: { pass: true }, doesCityMatch: { pass: true } },
    },
    {
      resolver: resolveByZipCode,
      name: 'resolveByZipCode',
      signal: { doesZipCodeMatch: { pass: true } },
    },
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

  describe('resolveByAddress', () => {
    test('a higher address score outranks a better name', async () => {
      const result = await resolveByAddress()(
        poolOf({ ...EXACT_NAME, ...address(82) }, { ...STRONG_NAME, ...address(96) }),
      );

      expect(result.match).toMatchObject({ trusteeId: 't2' });
    });

    test('does not resolve on an address score below the threshold', async () => {
      const result = await resolveByAddress()(poolOf({ ...EXACT_NAME, ...address(79) }));

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

    test('does not resolve when the state was never compared', async () => {
      const result = await resolveByStateOnly()(poolOf(EXACT_NAME));

      expect(result.match).toBeNull();
    });
  });

  describe('resolveByNameOnly', () => {
    test('resolves the only name-qualifying candidate when its name is exact and nothing contradicts it', async () => {
      const result = await resolveByNameOnly()(poolOf(EXACT_NAME, NO_NAME));

      expect(result.match).toMatchObject({ trusteeId: 't1', resolvedBy: 'resolveByNameOnly' });
    });

    test.each([
      {
        description: 'the phone',
        score: { doesPhoneMatch: { pass: false, phoneDigitDistance: 6 } },
      },
      { description: 'the email', score: { doesEmailMatch: { pass: false } } },
    ])(
      'still resolves when $description does not match - a missing strong signal, not a contradiction',
      async ({ score }) => {
        const result = await resolveByNameOnly()(poolOf({ ...EXACT_NAME, ...score }));

        expect(result.match).toMatchObject({ trusteeId: 't1', resolvedBy: 'resolveByNameOnly' });
      },
    );

    test.each([
      { description: 'a second candidate also matches on name', pool: [EXACT_NAME, WEAK_NAME] },
      { description: 'the name is not exact', pool: [STRONG_NAME] },
      {
        description: 'the state contradicts',
        pool: [{ ...EXACT_NAME, doesStateMatch: { pass: false } }],
      },
      { description: 'the address contradicts', pool: [{ ...EXACT_NAME, ...address(10) }] },
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
