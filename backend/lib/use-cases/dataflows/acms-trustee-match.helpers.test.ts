import {
  calculateSetOverlapScore,
  calculateAcmsNameScore,
  calculateAcmsAddressScore,
  calculateAcmsPhoneScore,
  calculateAcmsTotalScore,
  resolveAcmsProfessionalMatch,
  ACMS_AUTO_MATCH_THRESHOLD,
  AcmsMatchOutcome,
} from './acms-trustee-match.helpers';
import * as acmsTrusteeMatchHelpers from './acms-trustee-match.helpers';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import { Trustee } from '@common/cams/trustees';
import { Address, PhoneNumber } from '@common/cams/contact';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { AcmsTrusteeProfessionalRecord } from '../gateways.types';

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

describe('calculateSetOverlapScore', () => {
  test('returns 100 for identical singleton sets', () => {
    const a = new Set(['a']);
    const b = new Set(['a']);
    expect(calculateSetOverlapScore(a, b)).toEqual(100);
  });

  test('returns 0 for disjoint singleton sets', () => {
    const a = new Set(['a']);
    const b = new Set(['b']);
    expect(calculateSetOverlapScore(a, b)).toEqual(0);
  });

  test('returns 100 when a 1-element set is fully contained in a 9-element set (the Jaccard failure case)', () => {
    const a = new Set(['a']);
    const b = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    // Jaccard would score this ~11 (1/9); overlap coefficient must score 100,
    // since the smaller set achieves full containment in the larger.
    expect(calculateSetOverlapScore(a, b)).toEqual(100);
  });

  test('returns 100 when an 8-element set is fully contained in a 9-element superset (the mirror case)', () => {
    const a = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const b = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    // Jaccard would score this ~89 (8/9); overlap coefficient correctly scores
    // it 100 since the smaller set is still fully contained in the larger.
    expect(calculateSetOverlapScore(a, b)).toEqual(100);
  });

  test('returns null when both sets are empty (no data on either side, not evidence of mismatch)', () => {
    const a = new Set<string>();
    const b = new Set<string>();
    expect(calculateSetOverlapScore(a, b)).toBeNull();
  });

  test('returns null when only set A is empty (no data on A -- not comparable, not a confident mismatch)', () => {
    const a = new Set<string>();
    const b = new Set(['a', 'b', 'c']);
    expect(calculateSetOverlapScore(a, b)).toBeNull();
  });

  test('returns null when only set B is empty (no data on B -- not comparable, not a confident mismatch)', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set<string>();
    expect(calculateSetOverlapScore(a, b)).toBeNull();
  });

  test('computes the general formula for a partial overlap (2 shared of min-size-3 set)', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd', 'e', 'f']);
    // |intersection| = 2 ({b, c}); min(|a|, |b|) = min(3, 5) = 3
    // 100 * 2 / 3 = 66.666...
    expect(calculateSetOverlapScore(a, b)).toBeCloseTo((100 * 2) / 3, 10);
  });
});

describe('calculateAcmsNameScore', () => {
  test('returns 100 (neutral) when the ACMS side has no middle initial', () => {
    const acmsProfessional = { firstName: 'John', lastName: 'Doe', middleInitial: null };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateAcmsNameScore(acmsProfessional, camsTrustee)).toBe(100);
  });

  test('returns 100 (neutral) when the CAMS side has no middle name, even though ACMS has an initial', () => {
    const acmsProfessional = { firstName: 'John', lastName: 'Doe', middleInitial: 'L' };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateAcmsNameScore(acmsProfessional, camsTrustee)).toBe(100);
  });

  test('lands on the initial-vs-full branch (85), never the full-match branch (100), even when the CAMS full middle name matches the ACMS initial exactly', () => {
    // This is the key structural proof: ACMS's PROF_MI is CHAR(1), always a bare initial, so
    // "both sides have a full identical middle name" can never fire from the ACMS side -- even
    // when the CAMS side's full middle name starts with the same letter as the ACMS initial.
    const acmsProfessional = { firstName: 'John', lastName: 'Doe', middleInitial: 'L' };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Lee', lastName: 'Doe' });

    expect(calculateAcmsNameScore(acmsProfessional, camsTrustee)).toBe(85);
  });

  test('returns 15 (conflict) when the ACMS initial does not match the CAMS middle name first letter', () => {
    const acmsProfessional = { firstName: 'John', lastName: 'Doe', middleInitial: 'Q' };
    const camsTrustee = makeTrustee({ firstName: 'John', middleName: 'Robert', lastName: 'Doe' });

    expect(calculateAcmsNameScore(acmsProfessional, camsTrustee)).toBe(15);
  });

  test('returns 0 when first/last names do not both match', () => {
    const acmsProfessional = { firstName: 'Jane', lastName: 'Doe', middleInitial: null };
    const camsTrustee = makeTrustee({ firstName: 'John', lastName: 'Doe' });

    expect(calculateAcmsNameScore(acmsProfessional, camsTrustee)).toBe(0);
  });
});

describe('calculateAcmsAddressScore', () => {
  const camsAddress: Address = {
    address1: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    countryCode: 'US',
  };

  test('returns 100 when city, state, and zip all match', () => {
    const acmsAddress = { city: 'New York', state: 'NY', zip: '10001' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(100);
  });

  test('returns 60 when only zip matches (first 5 digits)', () => {
    const acmsAddress = { city: 'Buffalo', state: 'CA', zip: '10001-1234' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(60);
  });

  test('returns 40 when only city matches', () => {
    const acmsAddress = { city: 'New York', state: 'CA', zip: '99999' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(40);
  });

  test('returns 30 when only state matches', () => {
    const acmsAddress = { city: 'Buffalo', state: 'NY', zip: '99999' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(30);
  });

  test('returns 0 when nothing matches', () => {
    const acmsAddress = { city: 'Buffalo', state: 'CA', zip: '99999' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(0);
  });

  test('returns 0 when ACMS fields are all null', () => {
    const acmsAddress = { city: null, state: null, zip: null };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(0);
  });

  test('compares city and state case-insensitively and trimmed', () => {
    const acmsAddress = { city: '  NEW york  ', state: ' ny ', zip: '10001' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(100);
  });

  test('compares zip on first 5 digits only', () => {
    const acmsAddress = { city: 'New York', state: 'NY', zip: '10001-9999' };
    expect(calculateAcmsAddressScore(acmsAddress, camsAddress)).toBe(100);
  });
});

describe('calculateAcmsPhoneScore', () => {
  test('delegates to calculatePhoneScore and returns 100 for a matching phone', () => {
    const camsPhone: PhoneNumber = { number: '555-123-4567' };
    const spy = vi.spyOn(trusteeMatchHelpers, 'calculatePhoneScore');

    const result = calculateAcmsPhoneScore('5551234567', camsPhone);

    expect(result).toBe(100);
    expect(spy).toHaveBeenCalledWith('5551234567', camsPhone);
  });

  test('returns null when the ACMS phone is null (delegated null-handling, not reimplemented)', () => {
    const camsPhone: PhoneNumber = { number: '555-123-4567' };
    expect(calculateAcmsPhoneScore(null, camsPhone)).toBeNull();
  });

  test('returns 0 when phones have 10+ digits but differ', () => {
    const camsPhone: PhoneNumber = { number: '555-123-4567' };
    expect(calculateAcmsPhoneScore('5559999999', camsPhone)).toBe(0);
  });
});

describe('calculateAcmsTotalScore', () => {
  test('delegates to the existing calculateTotalScore, passing emailScore: null and passing the rest through unchanged (proof of delegation, not reimplementation)', () => {
    const spy = vi.spyOn(trusteeMatchHelpers, 'calculateTotalScore');

    const scores = {
      addressScore: 60,
      nameScore: 85,
      phoneScore: 100,
      districtScore: 100,
      chapterScore: 100,
    };

    calculateAcmsTotalScore(scores);

    expect(spy).toHaveBeenCalledWith({
      addressScore: 60,
      nameScore: 85,
      phoneScore: 100,
      emailScore: null,
      districtDivisionScore: 100,
      chapterScore: 100,
    });
  });

  test('returns the renormalized total when all dimensions (other than email) are comparable', () => {
    // With emailScore permanently null, calculateTotalScore's null-exclusion mechanism
    // renormalizes across the remaining five dimensions using CAMS-809's original weights
    // (address 0.05, name 0.25, phone 0.05, district 0.30, chapter 0.30) divided by 0.95.
    const scores = {
      addressScore: 100,
      nameScore: 100,
      phoneScore: 100,
      districtScore: 100,
      chapterScore: 100,
    };

    expect(calculateAcmsTotalScore(scores)).toBeCloseTo(100, 10);
  });

  test('excludes phone from the weighted sum when phoneScore is null, redistributing its weight rather than penalizing the score', () => {
    const zeroPhone = calculateAcmsTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: 0,
      districtScore: 0,
      chapterScore: 0,
    });
    const nullPhone = calculateAcmsTotalScore({
      addressScore: 100,
      nameScore: 100,
      phoneScore: null,
      districtScore: 0,
      chapterScore: 0,
    });

    // A null phoneScore is "not comparable" and must not be treated the same as a confirmed
    // mismatch (0) -- excluding it from the weighted sum should score strictly higher than
    // counting it as a 0.
    expect(nullPhone).toBeGreaterThan(zeroPhone);
  });
});

describe('resolveAcmsProfessionalMatch', () => {
  // Name (100, exact first/last match, no middle initial on either side), address (100, full
  // city/state/zip match), and chapter (100, exact single-value match) are held fixed for every
  // candidate below; phone is left null on both sides (excluded from the weighted sum, not
  // penalized). Only the district set-overlap dimension varies per candidate, via `districtCourts`
  // below, an exact, predictable overlap-coefficient percentage against a fixed 100-element
  // ACMS-side district set. With name/address/chapter pinned to 100 and phone excluded, the
  // resulting totalScore reduces to `(60 + 0.3 * districtOverlapPercent) / 0.9` -- real
  // production math (calculateAcmsTotalScore -> calculateTotalScore), not a mocked score, chosen
  // from this formula's clean-integer outputs so exact target totals can be hit deterministically:
  // districtOverlapPercent 34 -> 78, 40 -> 80, 70 -> 90, 76 -> 92, 88 -> 96, 100 -> 100.
  const acmsProfessional: AcmsTrusteeProfessionalRecord = {
    acmsProfessionalId: 'AB-00001',
    firstName: 'John',
    lastName: 'Doe',
    middleInitial: null,
    address1: '123 Main St',
    address2: null,
    city: 'New York',
    state: 'NY',
    zip: '10001',
    phone: null,
  };

  // Fixed 100-element ACMS-side district set (so an overlap coefficient of N% is achieved by
  // exactly N shared elements) and a single-value ACMS-side chapter set (always fully matched).
  const acmsAppointmentSets = {
    districts: new Set(Array.from({ length: 100 }, (_, i) => `court-${i}`)),
    chapters: new Set(['7']),
  };

  /**
   * Builds a candidate Trustee plus a full (non-active-filtered) TrusteeAppointment[] achieving
   * exactly `districtOverlapPercent`% district overlap against the fixed 100-element ACMS-side
   * district set, and full (100%) chapter overlap. All appointments are `inactive` -- this is
   * deliberate, not an oversight: it is the no-active-only-filtering regression coverage for this
   * function. If active-only filtering were (re-)introduced, every candidate below would have an
   * empty active-appointment set, district/chapter would score null (not comparable), and none of
   * the target totals below would be reproduced.
   */
  function makeCandidate(trusteeId: string, districtOverlapPercent: number) {
    const trustee = makeTrustee({
      trusteeId,
      firstName: 'John',
      lastName: 'Doe',
    });

    // Generate a candidate-side district set the SAME size as the fixed 100-element ACMS-side
    // set (see acmsAppointmentSets above) -- min(|A|, |B|) = 100 either way, so exactly
    // `districtOverlapPercent` shared courtIds out of 100 produces an overlap coefficient of
    // precisely `districtOverlapPercent`%. (A smaller candidate-side set would be fully contained
    // whenever every one of its elements happens to be shared, forcing the coefficient to 100
    // regardless of the intended percentage -- this is deliberately avoided here.)
    const appointments: TrusteeAppointment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `appointment-${trusteeId}-${i}`,
      trusteeId,
      status: 'inactive',
      chapter: '7',
      appointmentType: 'standing',
      courtId: i < districtOverlapPercent ? `court-${i}` : `no-overlap-court-${i}`,
      appointedDate: '2020-01-01',
      effectiveDate: '2020-01-01',
      createdBy: { id: 'system', name: 'System' },
      createdOn: '2024-01-01T00:00:00Z',
      updatedBy: { id: 'system', name: 'System' },
      updatedOn: '2024-01-01T00:00:00Z',
    }));

    return { trustee, appointments };
  }

  /**
   * Asserts a 'matched' outcome with the expected trusteeId, comparing `score` with
   * `toBeCloseTo` rather than exact equality -- the real weighted-average math involved
   * (calculateAcmsTotalScore -> calculateTotalScore) can produce tiny floating-point residue
   * (e.g. `100.00000000000001`) even when every input score is a clean integer.
   */
  function expectMatched(result: AcmsMatchOutcome, trusteeId: string, score: number) {
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.trusteeId).toBe(trusteeId);
      expect(result.score).toBeCloseTo(score, 9);
    }
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('0 candidates -> unmatched, and no scoring function is ever called', () => {
    const spy = vi.spyOn(acmsTrusteeMatchHelpers, 'calculateAcmsTotalScore');

    const result = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [],
      new Map(),
    );

    expect(result).toEqual({ kind: 'unmatched' });
    expect(spy).not.toHaveBeenCalled();
  });

  test('1 candidate scoring below the unified threshold (80 < 90) -> unmatched', () => {
    const { trustee, appointments } = makeCandidate('trustee-below', 40); // -> total 80
    const appointmentsByTrusteeId = new Map([[trustee.trusteeId, appointments]]);

    const result = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [trustee],
      appointmentsByTrusteeId,
    );

    expect(result).toEqual({ kind: 'unmatched' });
  });

  test('1 candidate scoring at/above the unified threshold (90) -> matched, proving the gap check is skipped entirely for a lone candidate', () => {
    const { trustee, appointments } = makeCandidate('trustee-solo', 70); // -> total 90
    const appointmentsByTrusteeId = new Map([[trustee.trusteeId, appointments]]);

    const result = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [trustee],
      appointmentsByTrusteeId,
    );

    // There is no runner-up for a lone candidate, so ACMS_FUZZY_MATCH_MIN_GAP must not apply --
    // this candidate matches purely on clearing ACMS_AUTO_MATCH_THRESHOLD, with no additional gap
    // scrutiny of any kind.
    expect(result.kind).toBe('matched');
    expectMatched(result, 'trustee-solo', ACMS_AUTO_MATCH_THRESHOLD);
  });

  test('2 candidates, winner clears threshold and the gap over the runner-up -> matched with the winner', () => {
    const winner = makeCandidate('trustee-winner', 88); // -> total 96
    const runnerUp = makeCandidate('trustee-runner-up', 40); // -> total 80 (16-point gap)
    const appointmentsByTrusteeId = new Map([
      [winner.trustee.trusteeId, winner.appointments],
      [runnerUp.trustee.trusteeId, runnerUp.appointments],
    ]);

    const result = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [winner.trustee, runnerUp.trustee],
      appointmentsByTrusteeId,
    );

    expect(result.kind).toBe('matched');
    expectMatched(result, 'trustee-winner', 96);
  });

  test('2 candidates, winner clears the threshold but the gap over the runner-up is insufficient -> unmatched, even though the winner alone clears 90', () => {
    const winner = makeCandidate('trustee-winner', 76); // -> total 92
    const runnerUp = makeCandidate('trustee-runner-up', 70); // -> total 90 (2-point gap, < 5)
    const appointmentsByTrusteeId = new Map([
      [winner.trustee.trusteeId, winner.appointments],
      [runnerUp.trustee.trusteeId, runnerUp.appointments],
    ]);

    const result = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [winner.trustee, runnerUp.trustee],
      appointmentsByTrusteeId,
    );

    expect(result).toEqual({ kind: 'unmatched' });
  });

  test('REGRESSION: the exact inversion the accept-rule shape fix closes -- a lone 78-scoring candidate is unmatched, and stays unmatched when a weaker 70-scoring second candidate appears alongside it', () => {
    // Under the OLD, broken two-threshold shape (an independent single-candidate threshold plus a
    // SEPARATE, lower multi-candidate threshold-and-gap), two candidates scoring 70 and 78 would
    // auto-accept the 78 (it clears a lower multi-candidate bar like 70, with an 8-point gap over
    // the 70), while a LONE candidate scoring 78 would be rejected against a higher
    // single-candidate bar like 90. That is the exact inversion this design closes: the same
    // absolute evidence (a 78) is accepted or rejected purely based on whether a weaker, unrelated
    // second candidate happened to also show up. The fixed, unified-threshold shape must reject 78
    // in BOTH cases, since 78 never clears ACMS_AUTO_MATCH_THRESHOLD (90) regardless of candidate
    // count.
    const soloCandidate = makeCandidate('trustee-78', 34); // -> total 78

    const soloResult = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [soloCandidate.trustee],
      new Map([[soloCandidate.trustee.trusteeId, soloCandidate.appointments]]),
    );
    expect(soloResult).toEqual({ kind: 'unmatched' });

    // Same 78-scoring candidate, now alongside a weaker candidate scoring exactly 70 -- an
    // 8-point gap, which would have cleared a hypothetical old-style lower multi-candidate bar
    // like "70 + a 5-point gap" (the design doc's own worked example of the defect).
    const weakerCandidate = makeCandidate('trustee-70', 10); // -> total 70
    const multiResult = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [soloCandidate.trustee, weakerCandidate.trustee],
      new Map([
        [soloCandidate.trustee.trusteeId, soloCandidate.appointments],
        [weakerCandidate.trustee.trusteeId, weakerCandidate.appointments],
      ]),
    );

    // Must STILL be unmatched: 78 never clears the unified 90 bar, regardless of what a weaker
    // second candidate's presence would have done under the old, broken shape.
    expect(multiResult).toEqual({ kind: 'unmatched' });
  });

  test('does not filter candidate appointments to active-only when building the CAMS-side district set', () => {
    // Every appointment built by makeCandidate() above is `inactive`. This test makes that
    // assumption explicit and load-bearing: a lone candidate whose ONLY appointments are inactive
    // must still be able to clear ACMS_AUTO_MATCH_THRESHOLD via district/chapter overlap. If
    // active-only filtering were (re-)introduced anywhere in this function, this candidate's
    // CAMS-side district set would be empty, districtScore would be null instead of 100, and the
    // resulting total would drop well below 90 -- silently reproducing the CAMS-809 defect this
    // design deliberately avoids.
    const { trustee, appointments } = makeCandidate('trustee-inactive-only', 100); // -> total 100
    expect(appointments.every((a) => a.status === 'inactive')).toBe(true);

    const result = resolveAcmsProfessionalMatch(
      acmsProfessional,
      acmsAppointmentSets,
      [trustee],
      new Map([[trustee.trusteeId, appointments]]),
    );

    expect(result.kind).toBe('matched');
    expectMatched(result, 'trustee-inactive-only', 100);
  });

  describe('onCandidateScored diagnostic hook', () => {
    // This hook is the instrumentation the converged design doc's "Auto-match threshold"
    // validation plan depends on existing: a future lower-environment validation run needs every
    // scored candidate's full breakdown (not just the winner's), to sample across the score
    // distribution and confirm the threshold/gap constants before the production run.

    test('is not invoked at all when there are zero candidates (no scoring attempted)', () => {
      const onCandidateScored = vi.fn();

      resolveAcmsProfessionalMatch(
        acmsProfessional,
        acmsAppointmentSets,
        [],
        new Map(),
        onCandidateScored,
      );

      expect(onCandidateScored).not.toHaveBeenCalled();
    });

    test('is invoked once per scored candidate, with that candidate full score breakdown, regardless of accept-rule outcome', () => {
      const winner = makeCandidate('trustee-winner', 88); // -> total 96
      const runnerUp = makeCandidate('trustee-runner-up', 40); // -> total 80
      const appointmentsByTrusteeId = new Map([
        [winner.trustee.trusteeId, winner.appointments],
        [runnerUp.trustee.trusteeId, runnerUp.appointments],
      ]);
      const onCandidateScored = vi.fn();

      resolveAcmsProfessionalMatch(
        acmsProfessional,
        acmsAppointmentSets,
        [winner.trustee, runnerUp.trustee],
        appointmentsByTrusteeId,
        onCandidateScored,
      );

      // Invoked for BOTH candidates -- not just the eventual winner -- since the validation plan
      // needs visibility into rejected candidates' scores too, not only accepted matches.
      expect(onCandidateScored).toHaveBeenCalledTimes(2);
      expect(onCandidateScored).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          acmsProfessionalId: acmsProfessional.acmsProfessionalId,
          trusteeId: 'trustee-winner',
          nameScore: 100,
          addressScore: 100,
          phoneScore: null,
          chapterScore: 100,
          totalScore: expect.closeTo(96, 9),
        }),
      );
      expect(onCandidateScored).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          acmsProfessionalId: acmsProfessional.acmsProfessionalId,
          trusteeId: 'trustee-runner-up',
          nameScore: 100,
          addressScore: 100,
          phoneScore: null,
          chapterScore: 100,
          totalScore: expect.closeTo(80, 9),
        }),
      );
    });

    test('is invoked for a rejected (unmatched) outcome too, since the validation plan needs visibility into near-miss scores', () => {
      const { trustee, appointments } = makeCandidate('trustee-below', 40); // -> total 80, < 90
      const onCandidateScored = vi.fn();

      const result = resolveAcmsProfessionalMatch(
        acmsProfessional,
        acmsAppointmentSets,
        [trustee],
        new Map([[trustee.trusteeId, appointments]]),
        onCandidateScored,
      );

      expect(result).toEqual({ kind: 'unmatched' });
      expect(onCandidateScored).toHaveBeenCalledTimes(1);
      expect(onCandidateScored).toHaveBeenCalledWith(
        expect.objectContaining({ trusteeId: 'trustee-below', totalScore: expect.closeTo(80, 9) }),
      );
    });

    test('omitting the hook entirely does not change behavior -- it is purely additive, not a dependency', () => {
      const { trustee, appointments } = makeCandidate('trustee-solo', 70); // -> total 90

      const result = resolveAcmsProfessionalMatch(
        acmsProfessional,
        acmsAppointmentSets,
        [trustee],
        new Map([[trustee.trusteeId, appointments]]),
      );

      expect(result.kind).toBe('matched');
      expectMatched(result, 'trustee-solo', ACMS_AUTO_MATCH_THRESHOLD);
    });
  });
});
