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
  createTrusteeInitialState as createInitialState,
  mergedScore,
  TrusteePipelineState as PipelineState,
  projectTrustee,
} from './trustee-match-pipeline';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import {
  recallBySurnameExact,
  recallByNameThenResolveMatch,
  recallByTokenIntersection,
  recallByAnchoredLevenshtein,
  resolveBySoleContactMatch,
  resolveByComparativeCorroboration,
  resolveByPhoneTypoTolerance,
  resolveByExactNameOnly,
  scoreAddressDisqualifiers,
  scoreNameDisqualifiers,
  resolveByStateAndCity,
  resolveByZipCode,
  resolveByCityAndZipCode,
  resolveByAddress,
  resolveByPhone,
  resolveByEmailAddress,
  resolveBySoleFuzzyNameMatchAndState,
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

/** Grossly dissimilar on both first and last name - the clear disqualifying case. */
const GROSSLY_DISSIMILAR_NAME_PAIR = {
  acmsFirstName: 'Irwin',
  acmsLastName: 'Zarth',
  camsFirstName: 'Tam',
  camsLastName: 'Fenwick',
} as const;

/** Near-exact first name, dissimilar last name - a plausible data-entry surname error, not a
 * different person, so this must NOT disqualify. */
const NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR = {
  acmsFirstName: 'Chadwin',
  acmsLastName: 'Sartelli',
  camsFirstName: 'Chadwin',
  camsLastName: 'Pallavo',
} as const;

/** Dissimilar first name, near-exact last name - the mirror image of
 * NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR; must also NOT disqualify. */
const DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR = {
  acmsFirstName: 'Marisol',
  acmsLastName: 'Windemere',
  camsFirstName: 'Percival',
  camsLastName: 'Windemere',
} as const;

/** A close spelling variant on BOTH name parts at once - plausibly the same person, so this must
 * NOT disqualify either. */
const CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR = {
  acmsFirstName: 'Odalys',
  acmsLastName: 'Fennimore',
  camsFirstName: 'Odalis',
  camsLastName: 'Finnamore',
} as const;

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

describe('recallByNameThenResolveMatch', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('resolves state.match directly when matchTrusteeByName resolves an exact unique match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'exact',
    });

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { nameScore: 100, nameMatchQuality: 'exact' },
      resolvedBy: 'recallByNameThenResolveMatch',
    });
    expect(result.candidates.size).toBe(0);
  });

  // Real gap (Jon's review of the 2026-09-25 staging export, CAMS-876 follow-up): 34 auto-linked
  // records with nameMatchQuality 'fuzzy' (matchTrusteeByName's normalizeNameForMatching bridging
  // a punctuation gap - e.g. an apostrophe surname) persisted with evidence.candidates === [],
  // since this stage wrote state.match directly for ANY 'resolved' outcome without ever fetching
  // or scoring the winning trustee - unlike 'exact', which the doc comment above correctly notes
  // has nothing left to score (matchTrusteeByName's literal string match already IS the full
  // evidence), 'fuzzy' resolved via a real trustee record that was never added to state.candidates
  // at all, leaving a reviewer with no way to audit what corroborated the link.
  test('adds and scores the winning candidate when matchTrusteeByName resolves a FUZZY unique match, then resolves on it', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'fuzzy',
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', name: "Jordan O'Doe" }),
    ]);

    const state = createInitialState(makeDxtrTrustee({ fullName: 'Jordan ODoe' }));

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.get('t1')?.scores.doesNameMatch).toBeDefined();
    expect(result.match).toEqual({
      trusteeId: 't1',
      score: result.candidates.get('t1')?.scores,
      resolvedBy: 'recallByNameThenResolveMatch',
    });
  });

  test('records a findTrusteesByIds failure (fuzzy refetch) on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'fuzzy',
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [
        { message: 'recallByNameThenResolveMatch failed refetching fuzzy-matched candidate' },
      ],
    });
    expect(result.match).toBeNull();
  });

  // An empty array is not a repository rejection, so the try/catch above never sees it - guards
  // against projectTrustee(undefined) throwing uncaught.
  test('records a CamsError, rather than throwing, when the fuzzy refetch returns no trustee', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'fuzzy',
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([]);

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [
        { message: 'recallByNameThenResolveMatch failed refetching fuzzy-matched candidate' },
      ],
    });
    expect(result.match).toBeNull();
  });

  test('adds every candidate from an ambiguous result to the pipeline state, without resolving', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never, { trusteeId: 't2' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', name: 'Someone Moon' }),
      makeTrustee({ trusteeId: 't2', name: 'Someone Else' }),
    ]);

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.match).toBeNull();
    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.has('t2')).toBe(true);
  });

  test('adds nothing when matchTrusteeByName returns no-match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    const findByIdsSpy = vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds');

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.match).toBeNull();
    expect(result.candidates.size).toBe(0);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });

  test('records a matchTrusteeByName failure on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByNameThenResolveMatch failed' }],
    });
    expect(result.match).toBeNull();
  });

  test('records a findTrusteesByIds failure (ambiguous refetch) on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveMatch(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [
        { message: 'recallByNameThenResolveMatch failed refetching ambiguous candidates' },
      ],
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

  test("downgrades to 85 when a bare middle initial doesn't match the other side's leading character", async () => {
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
  // reliable name part in this data. The match drops to 85 rather than failing outright, so a
  // resolver needing corroboration can still use it while an exact-only resolver declines.
  test('downgrades to 85 when two DIFFERENT bare middle initials appear on both sides', async () => {
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

describe('scoreAddressDisqualifiers', () => {
  test('records ONE combined disqualifier when city, state, AND zip all actively disagree', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { pass: false });
    addScore(candidate, 'doesStateMatch', { pass: false });
    addScore(candidate, 'doesZipCodeMatch', { pass: false });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([
      expect.objectContaining({ scorer: 'addressDisqualifiers' }),
    ]);
  });

  test.each([
    ['only city disagrees', { doesCityMatch: false, doesStateMatch: true, doesZipCodeMatch: true }],
    [
      'only state disagrees',
      { doesCityMatch: true, doesStateMatch: false, doesZipCodeMatch: true },
    ],
    ['only zip disagrees', { doesCityMatch: true, doesStateMatch: true, doesZipCodeMatch: false }],
    [
      'city and state disagree but zip agrees',
      { doesCityMatch: false, doesStateMatch: false, doesZipCodeMatch: true },
    ],
  ])('does not disqualify on a partial disagreement (%s) - too weak a signal', (_desc, passes) => {
    const state = createInitialState(makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: passes.doesCityMatch });
    addScore(candidate, 'doesStateMatch', {
      value: 0,
      threshold: 100,
      pass: passes.doesStateMatch,
    });
    addScore(candidate, 'doesZipCodeMatch', {
      value: 0,
      threshold: 100,
      pass: passes.doesZipCodeMatch,
    });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when only some fields were even comparable, even if all compared ones disagree', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { pass: false });
    addScore(candidate, 'doesStateMatch', { pass: false });
    // doesZipCodeMatch never ran at all (e.g. no zip on file) - absence, not disagreement.

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('records no disqualifier when no scorer ran at all', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('records no disqualifier when city/state/zip all agree', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { pass: true });
    addScore(candidate, 'doesStateMatch', { pass: true });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });
});

describe('scoreNameDisqualifiers', () => {
  test('records a disqualifier when both first and last name are grossly dissimilar', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: `${GROSSLY_DISSIMILAR_NAME_PAIR.acmsFirstName} ${GROSSLY_DISSIMILAR_NAME_PAIR.acmsLastName}`,
        firstName: GROSSLY_DISSIMILAR_NAME_PAIR.acmsFirstName,
        lastName: GROSSLY_DISSIMILAR_NAME_PAIR.acmsLastName,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: GROSSLY_DISSIMILAR_NAME_PAIR.camsFirstName,
          lastName: GROSSLY_DISSIMILAR_NAME_PAIR.camsLastName,
        }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([
      expect.objectContaining({ scorer: 'nameDisqualifiers' }),
    ]);
  });

  test('does not disqualify when first name is near-exact even though last name is dissimilar', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: `${NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR.acmsFirstName} ${NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR.acmsLastName}`,
        firstName: NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR.acmsFirstName,
        lastName: NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR.acmsLastName,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR.camsFirstName,
          lastName: NEAR_EXACT_FIRST_DISSIMILAR_LAST_PAIR.camsLastName,
        }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when last name is near-exact even though first name is dissimilar', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: `${DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR.acmsFirstName} ${DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR.acmsLastName}`,
        firstName: DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR.acmsFirstName,
        lastName: DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR.acmsLastName,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR.camsFirstName,
          lastName: DISSIMILAR_FIRST_NEAR_EXACT_LAST_PAIR.camsLastName,
        }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify a close spelling variant on both name parts', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: `${CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR.acmsFirstName} ${CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR.acmsLastName}`,
        firstName: CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR.acmsFirstName,
        lastName: CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR.acmsLastName,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR.camsFirstName,
          lastName: CLOSE_SPELLING_VARIANT_BOTH_PARTS_PAIR.camsLastName,
        }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when doesNameMatch has not scored exactly 0', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: `${GROSSLY_DISSIMILAR_NAME_PAIR.acmsFirstName} ${GROSSLY_DISSIMILAR_NAME_PAIR.acmsLastName}`,
        firstName: GROSSLY_DISSIMILAR_NAME_PAIR.acmsFirstName,
        lastName: GROSSLY_DISSIMILAR_NAME_PAIR.acmsLastName,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: GROSSLY_DISSIMILAR_NAME_PAIR.camsFirstName,
          lastName: GROSSLY_DISSIMILAR_NAME_PAIR.camsLastName,
        }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when either side is missing a first or last name', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: GROSSLY_DISSIMILAR_NAME_PAIR.acmsLastName,
        firstName: undefined,
        lastName: GROSSLY_DISSIMILAR_NAME_PAIR.acmsLastName,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: GROSSLY_DISSIMILAR_NAME_PAIR.camsFirstName,
          lastName: GROSSLY_DISSIMILAR_NAME_PAIR.camsLastName,
        }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });
});

describe('resolveBySoleContactMatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('resolves the sole name-qualifying candidate when its already-computed contact score corroborates', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveBySoleContactMatch',
    });
  });

  test('resolves via the no-contradiction fallback when there is no comparable phone/email and the ACMS address does not contradict', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', { pass: true });
    // No contactCorroborationPhone/Email at all (uncomparable), and no
    // contactCorroborationAddress recorded either (nothing to contradict).

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveBySoleContactMatch',
    });
  });

  test('refuses the no-contradiction fallback when the ACMS record has no real contact data at all', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { phone: '0', fax: '0' } as never }),
    );
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', { pass: false });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  // Models a real backtest regression (e.g. ACMS "DIANE WEIL (TR)", cityStateZipCountry
  // "WOODLAND HILLS 91367-0000" with no state token at all): pipelineAddressScore now returns null
  // (not a fabricated 0) when the ACMS address doesn't parse, so scoreContactCorroboration never
  // writes a contactCorroborationAddress ScoreRecord at all for this shape - absence, not a low
  // recorded score, means "unparseable," so it must not block the no-contradiction fallback the way
  // an actually-parsed, actually-disagreeing address does. contactCorroborationAddress is
  // deliberately left unset here (not hand-added with value:0) to model exactly what
  // scoreContactCorroboration now produces for an unparseable ACMS address, per the real fix.
  test('resolves via the no-contradiction fallback when the ACMS address is unparseable, not a genuine disagreement', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    // contactCorroborationAddress deliberately absent - the ACMS address never parsed.

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveBySoleContactMatch',
    });
  });

  // A coincidentally matching zip code can push a real state conflict's address score up to
  // exactly NO_CONTRADICTION_ADDRESS_FLOOR, clearing isNoContradictionMatch's address check even
  // though doesStateMatch genuinely disagrees.
  test('does NOT resolve via the no-contradiction fallback when a coincidental zip match masks a real state conflict', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({
          fullName: 'Ronald Larkin',
          legacy: { cityStateZipCountry: 'Anytown DE 26003', phone: '2075551234' } as never,
        }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          name: 'Ronald L. Larkin',
          public: {
            address: {
              address1: '1 Main St',
              state: 'WV',
              city: 'Wheeling',
              zipCode: '26003',
              countryCode: 'US',
            },
          },
        }),
      ),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);
    expect(mergedScore(candidate)).toMatchObject({
      doesStateMatch: { pass: false },
      contactCorroborationAddress: { pass: false },
    });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  test('refuses the no-contradiction fallback when the ACMS address actively contradicts a low addressScore', async () => {
    const state = createInitialState(makeDxtrTrustee());
    // A PARSEABLE ACMS address (state.sourceNormalized.address populated, mirroring what
    // memoizedParseAcmsAddress would set for a real, well-formed cityStateZipCountry) - this is
    // what distinguishes "the address genuinely disagrees" from "the address never parsed at all"
    // (see isNoContradictionMatch's own doc comment for the real regression this distinction fixes).
    state.sourceNormalized.address = { city: 'Anytown', state: 'CA', zipCode: '90001' };
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'contactCorroborationAddress', { value: 5, threshold: 80, pass: false });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  // Real bug, confirmed via pipeline-replay-backtest.ts against the 2026-09-25 export (10 affected
  // records) before this test existed: isNoContradictionMatch used to read
  // state.sourceNormalized.address directly rather than calling memoizedParseAcmsAddress. In
  // runTrusteeMatchPipeline's actual outer-pool resolve pass, the ACMS address is parsed and
  // cached onto a runNestedTier's OWN nested sourceNormalized object during candidate discovery,
  // never onto outerState.sourceNormalized - so this field reads as unset for every outer-pool
  // candidate regardless of whether the ACMS address genuinely parses. The prior test above
  // (hand-setting state.sourceNormalized.address) never caught this, since it bypassed the parse
  // path entirely. This test instead supplies a real, well-formed cityStateZipCountry and leaves
  // state.sourceNormalized.address unset, exactly mirroring the outer-pool condition.
  test('refuses the no-contradiction fallback when a real cityStateZipCountry parses and contradicts, even with state.sourceNormalized.address unset', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        legacy: { cityStateZipCountry: 'WILMINGTON DE 19807-2102' } as never,
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', public: { address: { state: 'PA' } } as never }),
      ),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', { pass: true });
    addScore(candidate, 'contactCorroborationAddress', { value: 5, threshold: 80, pass: false });
    expect(state.sourceNormalized.address).toBeUndefined();

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  // resolveBySoleContactMatch deliberately never auto-links a multi-candidate, same-name pool via
  // a candidate-vs-candidate comparison - the premise that two same-name candidates are likely the
  // same real person filed twice was checked against a real trustees export and found false for
  // real counterexamples. Two name-qualifying candidates must stay unresolved here, regardless of
  // which one might otherwise look more "complete."
  test('leaves state.match null when 2+ candidates qualify on name, never guessing between them', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const first = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    const second = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })), 'test');
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  test('leaves state.match null when the sole name-qualifying candidate has no corroboration and real contact data to contradict it', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', { pass: true });
    addScore(candidate, 'contactCorroborationAddress', { value: 5, threshold: 80, pass: false });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByComparativeCorroboration', () => {
  // Models a real backtest finding (anonymized): an ACMS record for "Marcus Feld" (Seattle WA
  // area, a specific phone number) has two CAMS candidates that both clear calculateNameScore's
  // 85 threshold - "A. Bruce Halden" (a different state, unrelated phone) and "J. Marcus Feld"
  // (same Seattle WA area, an EXACT phone match). resolveBySoleContactMatch refuses to
  // arbitrate between multiple name-qualifying candidates at all - this stage exists specifically
  // to pick up that case when exactly one qualifying candidate has
  // decisive contact evidence the others lack.
  const acmsMarcusFeld = makeDxtrTrustee({
    fullName: 'Marcus Feld',
    firstName: 'Marcus',
    lastName: 'Feld',
    legacy: {
      address1: 'PO Box 100',
      cityStateZipCountry: 'Fictionville, WA 98999',
      phone: '2065551000',
    },
  });

  test('resolves to the sole candidate with an exact phone match among multiple name-qualifying candidates', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const bruceHalden = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-wilson',
          firstName: 'A.',
          middleName: 'Bruce',
          lastName: 'Feld',
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
    addScore(bruceHalden, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(bruceHalden, 'contactCorroborationPhone', { value: 0, threshold: 100, pass: false });
    const marcusFeld = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-marcus-feld',
          firstName: 'J.',
          middleName: 'Marcus',
          lastName: 'Feld',
          name: 'J. Marcus Feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionburg',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
      'test',
    );
    addScore(marcusFeld, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(marcusFeld, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toEqual({
      trusteeId: 'j-marcus-feld',
      score: expect.objectContaining({
        contactCorroborationPhone: expect.objectContaining({ value: 100, pass: true }),
      }),
      resolvedBy: 'resolveByComparativeCorroboration',
    });
  });

  test('does not resolve when more than one qualifying candidate has strong corroboration', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when no qualifying candidate has strong corroboration', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Elm St',
              city: 'Miami',
              state: 'FL',
              zipCode: '33101',
              countryCode: 'US',
            },
            phone: { number: '305-555-1212' },
          },
        }),
      ),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Oak St',
              city: 'Denver',
              state: 'CO',
              zipCode: '80202',
              countryCode: 'US',
            },
            phone: { number: '303-555-1212' },
          },
        }),
      ),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toBeNull();
  });

  test('ignores candidates that never cleared the name-score threshold', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const nameNoMatch = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'jason-wilson-aguilar',
          name: 'Jason Feld-Aguilar',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
      'test',
    );
    addScore(nameNoMatch, 'doesNameMatch', { pass: false });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toBeNull();
  });

  // Models a real backtest finding (anonymized "Jan Johnson"/"Conway" shape): two name-qualifying
  // candidates, neither clears CONTACT_CORROBORATION_ADDRESS_THRESHOLD (calculateAddressScore's
  // 50% address-lines weighting keeps a full-geo-agreement candidate's blended score around 50),
  // but exactly one has full city+state+zip agreement while the other shares nothing but the name.
  test('resolves to the sole candidate with full city+state+zip agreement when no candidate clears the address/phone bar', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const noGeoAgreement = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'no-geo-agreement',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '555-555-9999' },
          },
        }),
      ),
      'test',
    );
    addScore(noGeoAgreement, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(noGeoAgreement, 'doesCityMatch', { pass: false });
    addScore(noGeoAgreement, 'doesStateMatch', { pass: false });
    addScore(noGeoAgreement, 'doesZipCodeMatch', { pass: false });

    const fullGeoAgreement = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'full-geo-agreement',
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Different Building, Suite 9',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-8888' },
          },
        }),
      ),
      'test',
    );
    addScore(fullGeoAgreement, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(fullGeoAgreement, 'doesCityMatch', { pass: true });
    addScore(fullGeoAgreement, 'doesStateMatch', { pass: true });
    addScore(fullGeoAgreement, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toEqual({
      trusteeId: 'full-geo-agreement',
      score: fullGeoAgreement.scores,
      resolvedBy: 'resolveByComparativeCorroboration',
    });
  });

  test('does not resolve via full geo agreement when more than one qualifying candidate has it', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Building A',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-1111' },
          },
        }),
      ),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(first, 'doesCityMatch', { pass: true });
    addScore(first, 'doesStateMatch', { pass: true });
    addScore(first, 'doesZipCodeMatch', { pass: true });

    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Building B',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-2222' },
          },
        }),
      ),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(second, 'doesCityMatch', { pass: true });
    addScore(second, 'doesStateMatch', { pass: true });
    addScore(second, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toBeNull();
  });

  test('prefers strong address/phone corroboration over full geo agreement when both exist', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const geoOnly = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'geo-only',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Different Building',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-1111' },
          },
        }),
      ),
      'test',
    );
    addScore(geoOnly, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(geoOnly, 'doesCityMatch', { pass: true });
    addScore(geoOnly, 'doesStateMatch', { pass: true });
    addScore(geoOnly, 'doesZipCodeMatch', { pass: true });

    const exactPhone = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'exact-phone',
          name: 'J. Marcus Feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionburg',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
      'test',
    );
    addScore(exactPhone, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(exactPhone, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toEqual({
      trusteeId: 'exact-phone',
      score: expect.objectContaining({
        contactCorroborationPhone: expect.objectContaining({ value: 100, pass: true }),
      }),
      resolvedBy: 'resolveByComparativeCorroboration',
    });
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

  test('records contactCorroborationAddress/Phone/Email for a candidate, unconditionally (no pool-size gate)', () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      contactCorroborationPhone: { value: 100, pass: true },
      contactCorroborationEmail: { value: 100, pass: true },
    });
  });

  test('records a non-passing contactCorroborationPhone when the phone genuinely differs', () => {
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

    expect(mergedScore(candidate)).toMatchObject({
      contactCorroborationPhone: { value: 0, pass: false },
    });
  });

  test('does not record contactCorroborationEmail when either side has no email', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'No Email Here' }));
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'No Email Here' })),
      'test',
    );

    expect(candidate.scores).not.toHaveProperty('contactCorroborationEmail');
  });
});

describe('scoreCandidate - phone-typo-tolerance facet', () => {
  // Models a real backtest finding (anonymized): an ACMS record for "Terrence Boyle" has a CAMS
  // candidate, "Terrence J. Boyle", an EXACT structured name match (nameScore=100), whose
  // recorded phone differs by exactly the LAST digit - a real, comparable, MISMATCHED number, not
  // a missing one. resolveBySoleContactMatch's isNoContradictionMatch fallback never triggers
  // here - it only relaxes when phoneScore is null (uncomparable), not merely mismatched. A
  // backtest of the real 245-record population sharing this exact shape (sole candidate,
  // nameScore=100, a comparable-but-mismatched phone) found phone numbers differing by 1-2 digits
  // are essentially always a typo (still the same person), while numbers differing by 8-10 digits
  // are genuinely different phone numbers - calculatePhoneScore's binary 100-or-0 can't
  // distinguish the two, so scoreCandidate adds digit-hamming-distance as a new, pipeline-only
  // diagnostic to recover the former without touching the latter. Computed unconditionally for
  // every nameScore=100 candidate - not gated to the pool having exactly one qualifying candidate
  // (see resolveByPhoneTypoTolerance for the still-sole-candidate-gated RESOLVE decision).
  const acmsTerrenceBoyle = makeDxtrTrustee({
    fullName: 'Terrence Boyle',
    firstName: 'Terrence',
    lastName: 'Boyle',
    legacy: {
      cityStateZipCountry: 'Fictionburg, NY 10999',
      phone: '2125550100',
    },
  });

  // Runs normalizeAcmsSourceName first, matching real pipeline stage ordering - scoreNameMatch
  // reads state.sourceNormalized directly (already normalizeNamePart/firstLastNameToken-reduced,
  // lowercase), not state.sourceRaw's original casing.
  test('records phoneTypoToleranceScore for a nameScore=100 candidate whose phone differs by only 1-2 digits', async () => {
    const state = await normalizeAcmsSourceName()(createInitialState(acmsTerrenceBoyle));
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          firstName: 'Terrence',
          middleName: 'J.',
          lastName: 'Boyle',
          name: 'Terrence J. Boyle',
          public: {
            address: {
              address1: '1 Fictional Way',
              city: 'Fictionburg',
              state: 'NY',
              zipCode: '10999',
              countryCode: 'US',
            },
            phone: { number: '212-555-0108' },
          },
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      phoneTypoToleranceScore: expect.objectContaining({
        pass: true,
        phoneDigitDistance: expect.any(Number),
      }),
    });
  });

  const makeTerrenceBoyleCandidate = (state: PipelineState, phone: string) =>
    addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
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

  test("records a non-passing phoneTypoToleranceScore when the candidate's phone is genuinely a different number", async () => {
    const state = await normalizeAcmsSourceName()(createInitialState(acmsTerrenceBoyle));
    const candidate = makeTerrenceBoyleCandidate(state, '425-894-9945');

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      phoneTypoToleranceScore: expect.objectContaining({ pass: false }),
    });
  });

  test('does not record phoneTypoToleranceScore when the candidate phone is not comparable (fewer than 10 digits)', () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = makeTerrenceBoyleCandidate(state, '5550640');

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).not.toHaveProperty('phoneTypoToleranceScore');
  });

  test('does not record phoneTypoToleranceScore when nameScore is 85, not a perfect 100', () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          firstName: 'T',
          lastName: 'Boyle',
          name: 'T. Boyle',
          public: {
            address: {
              address1: '1 Fictional Way',
              city: 'Fictionburg',
              state: 'NY',
              zipCode: '10999',
              countryCode: 'US',
            },
            phone: { number: '212-573-0640' },
          },
        }),
      ),
      'test',
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).not.toHaveProperty('phoneTypoToleranceScore');
  });
});

describe('resolveByPhoneTypoTolerance', () => {
  const acmsTerrenceBoyle = makeDxtrTrustee({ fullName: 'Terrence Boyle' });

  test('resolves the sole exact-name candidate whose already-computed phoneTypoToleranceScore passes', async () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'terrence-j-boyle', name: 'Terrence J. Boyle' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'phoneTypoToleranceScore', {
      value: 9,
      threshold: 8,
      pass: true,
      phoneDigitDistance: 1,
    });

    const result = await resolveByPhoneTypoTolerance()(state);

    expect(result.match).toEqual({
      trusteeId: 'terrence-j-boyle',
      score: expect.objectContaining({
        phoneTypoToleranceScore: expect.objectContaining({ phoneDigitDistance: 1 }),
      }),
      resolvedBy: 'resolveByPhoneTypoTolerance',
    });
  });

  test.each([
    {
      description: "sole candidate's phoneTypoToleranceScore does not pass",
      nameScore: 100,
      phoneScore: { value: 5, threshold: 8, pass: false, phoneDigitDistance: 5 },
    },
    {
      description: 'nameScore is 85, not a perfect 100',
      nameScore: 85,
      phoneScore: { value: 9, threshold: 8, pass: true, phoneDigitDistance: 1 },
    },
    {
      description: 'no phoneTypoToleranceScore was ever recorded',
      nameScore: 100,
      phoneScore: undefined,
    },
  ])('does not resolve when $description', async ({ nameScore, phoneScore }) => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'terrence-j-boyle', name: 'Marisol B. Quade' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { value: nameScore, threshold: 85, pass: true });
    if (phoneScore) addScore(candidate, 'phoneTypoToleranceScore', phoneScore);

    const result = await resolveByPhoneTypoTolerance()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'candidate-1', name: 'Marisol Quade' })),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(first, 'phoneTypoToleranceScore', {
      value: 9,
      threshold: 8,
      pass: true,
      phoneDigitDistance: 1,
    });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'candidate-2', name: 'Marisol R. Quade' })),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(second, 'phoneTypoToleranceScore', {
      value: 9,
      threshold: 8,
      pass: true,
      phoneDigitDistance: 1,
    });

    const result = await resolveByPhoneTypoTolerance()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByExactNameOnly', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Ronald Larkin' });

  // Run through REAL end-to-end scoring (normalizeAcmsSourceName -> addCandidate ->
  // scoreCandidate), not hand-injected score objects: this stage gates on doesStateMatch, which
  // is only ever recorded when BOTH sides have a comparable state, so hand-injecting it can
  // produce combinations real scoring never would.
  test('resolves a sole exact-name candidate with no state/city/zip evidence at all', async () => {
    // A phone number (but no address) on the ACMS side keeps doesAcmsTrusteeHaveAddressAndPhone
    // true - this test is specifically about the ABSENCE of state/city/zip data, not the
    // absence of all ACMS contact data (a different, already-covered gate - see
    // 'does not resolve when the ACMS record itself has no contact data' below).
    const state = await normalizeAcmsSourceName()(
      createInitialState({ ...acmsRecord, legacy: { phone: '2075551234' } }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Larkin' })),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByExactNameOnly',
    });
  });

  test('resolves an office-relocation case: state matches even though city differs', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState({ ...acmsRecord, legacy: { cityStateZipCountry: 'Bangor ME 04401' } }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          name: 'Ronald L. Larkin',
          public: {
            address: {
              address1: '1 Main St',
              state: 'ME',
              city: 'Portland',
              zipCode: '04101',
              countryCode: 'US',
            },
          },
        }),
      ),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByExactNameOnly',
    });
  });

  // The real regression this stage must now catch: an exact name match with a GENUINE, comparable
  // state disagreement and no contact corroboration. Previously auto-linked; must now be left for
  // ambiguous/no-match instead.
  test('does NOT resolve a sole exact-name candidate with a real, comparable state conflict and no contact corroboration', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState({ ...acmsRecord, legacy: { cityStateZipCountry: 'Wilmington DE 19801' } }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          name: 'Ronald L. Larkin',
          public: {
            address: {
              address1: '1 Main St',
              state: 'WV',
              city: 'Wheeling',
              zipCode: '26003',
              countryCode: 'US',
            },
          },
        }),
      ),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toBeNull();
  });

  // A relaxed given name over an exact surname still resolves here; only a fuzzy SURNAME is held
  // back, since two surnames a typo apart belong to different people often enough to need
  // corroboration.
  test('resolves a relaxed given name over an exact surname', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Larkin' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByExactNameOnly',
    });
  });

  test('does not resolve a fuzzy surname on name alone', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Larkin' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'weak' });

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when more than one candidate has an exact name match', async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Larkin' })),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'exact' });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Ronald L. Larkin' })),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'exact' });

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toBeNull();
  });

  // A real shape (name synthesized): the ACMS record carries an empty address and a "0" phone
  // sentinel, so there is nothing to corroborate WITH - distinct from corroboration having been
  // available and failed. Since this stage runs last, every resolver that could weigh real
  // evidence has already declined.
  test('resolves when the ACMS record has no contact data at all to corroborate with', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState({ ...acmsRecord, legacy: { address1: '', phone: '0', fax: '0' } }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Larkin' })),
      'test',
    );
    scoreCandidate(state.sourceNormalized, candidate);

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByExactNameOnly',
    });
  });

  test('does not resolve when the CAMS trustee itself has no contact data', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Larkin' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'doesCamsTrusteeHaveAddressAndPhone', { pass: false });

    const result = await resolveByExactNameOnly()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByCityAndZipCode', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  test('resolves a sole nameScore=85 candidate when city and zip both agree', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesCityMatch', { pass: true });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByCityAndZipCode()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByCityAndZipCode',
    });
  });

  test('does not resolve when only one of city/zip agrees', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesCityMatch', { pass: false });
    addScore(candidate, 'contactCorroborationAddress', { value: 3, threshold: 80, pass: false });

    const result = await resolveByCityAndZipCode()(state);

    expect(result.match).toBeNull();
  });

  // Real backtest finding (anonymized MI-03298): city and zip both agree even though state does
  // not (a stale state field, or a zip code straddling a state line).
  test('resolves when city and zip both agree even though state does not', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesStateMatch', { pass: false });
    addScore(candidate, 'doesCityMatch', { pass: true });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByCityAndZipCode()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByCityAndZipCode',
    });
  });

  test('does not resolve when no corroborating scorer ran at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });

    const result = await resolveByCityAndZipCode()(state);

    expect(result.match).toBeNull();
    expect(candidate.scores.resolveByCityAndZipCode).toBeUndefined();
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });
    addScore(candidate, 'doesCityMatch', { pass: true });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByCityAndZipCode()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(first, 'doesCityMatch', { pass: true });
    addScore(first, 'doesZipCodeMatch', { pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(second, 'doesCityMatch', { pass: true });
    addScore(second, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByCityAndZipCode()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByStateAndCity', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  test('resolves when state and city both agree', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesStateMatch', { pass: true });
    addScore(candidate, 'doesCityMatch', { pass: true });

    const result = await resolveByStateAndCity()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByStateAndCity',
    });
  });

  // State agreement alone, with no city/zip/contact evidence at all, is deliberately NOT enough -
  // a single-vote dominance case (backtested as genuinely weak evidence).
  test('does not resolve on state agreement alone, with no other evidence at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesStateMatch', { pass: true });

    const result = await resolveByStateAndCity()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });
    addScore(candidate, 'doesStateMatch', { pass: true });
    addScore(candidate, 'doesCityMatch', { pass: true });

    const result = await resolveByStateAndCity()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(first, 'doesStateMatch', { pass: true });
    addScore(first, 'doesCityMatch', { pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(second, 'doesStateMatch', { pass: true });
    addScore(second, 'doesCityMatch', { pass: true });

    const result = await resolveByStateAndCity()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByZipCode', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  test('resolves on a matching zip code alone, with no state/city evidence at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByZipCode()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByZipCode',
    });
  });

  // A matching zip is trusted alone even when state actively disagrees - ACMS commonly has a
  // stale/incorrect state field while zip (sourced separately) is still accurate.
  test('resolves on a matching zip code even when state disagrees', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesStateMatch', { pass: false });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByZipCode()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByZipCode',
    });
  });

  test('does not resolve when zip does not match', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesZipCodeMatch', { pass: false });

    const result = await resolveByZipCode()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });
    addScore(candidate, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByZipCode()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(first, 'doesZipCodeMatch', { pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(second, 'doesZipCodeMatch', { pass: true });

    const result = await resolveByZipCode()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByAddress', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  test('resolves a sole nameScore=85 candidate when address corroborates', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'contactCorroborationAddress', { value: 90, threshold: 80, pass: true });

    const result = await resolveByAddress()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByAddress',
    });
  });

  test('does not resolve when address does not corroborate', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'contactCorroborationAddress', { value: 3, threshold: 80, pass: false });

    const result = await resolveByAddress()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByPhone', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  test('resolves a sole nameScore=85 candidate when phone corroborates', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveByPhone()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByPhone',
    });
  });

  test('does not resolve when phone does not corroborate', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'contactCorroborationPhone', { value: 0, threshold: 100, pass: false });

    const result = await resolveByPhone()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByEmailAddress', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  test('resolves a sole nameScore=85 candidate when email corroborates', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'contactCorroborationEmail', { value: 100, threshold: 100, pass: true });

    const result = await resolveByEmailAddress()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveByEmailAddress',
    });
  });

  test('does not resolve when email does not corroborate', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'contactCorroborationEmail', { value: 0, threshold: 100, pass: false });

    const result = await resolveByEmailAddress()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveBySoleFuzzyNameMatchAndState', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: GENERIC_ACMS_FULL_NAME });

  // This stage trusts state agreement alone, so an exact-name candidate anywhere in the pool
  // outranks anything it could conclude - resolveByExactNameOnly runs after it and would
  // otherwise never get the chance.
  test('declines when an exact-name candidate is in the pool', async () => {
    const state = createInitialState(acmsRecord);
    const fuzzy = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(fuzzy, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(fuzzy, 'doesStateMatch', { pass: true });
    const exact = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Aldric A. Moon' })),
      'test',
    );
    addScore(exact, 'doesNameMatch', { pass: true, quality: 'exact' });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test('resolves a sole strong-name candidate on state agreement alone, with no city/zip/contact evidence', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesStateMatch', { pass: true });
    addScore(candidate, 'doesCityMatch', { pass: false });
    addScore(candidate, 'doesZipCodeMatch', { pass: false });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: candidate.scores,
      resolvedBy: 'resolveBySoleFuzzyNameMatchAndState',
    });
  });

  test("does not resolve a sole EXACT-name (100) candidate - that is resolveByExactNameOnly's job", async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric A. Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'doesStateMatch', { pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when state disagrees', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(candidate, 'doesStateMatch', { pass: false });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when state was never compared at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'strong' });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
      'test',
    );
    addScore(candidate, 'doesNameMatch', { pass: false });
    addScore(candidate, 'doesStateMatch', { pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
      'test',
    );
    addScore(first, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(first, 'doesStateMatch', { pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
      'test',
    );
    addScore(second, 'doesNameMatch', { pass: true, quality: 'strong' });
    addScore(second, 'doesStateMatch', { pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });
});
