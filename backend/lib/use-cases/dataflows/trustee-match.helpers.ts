import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import {
  DxtrTrusteeParty,
  CandidateScore,
  TrusteeAppointmentSyncEvent,
  UNSCORED,
} from '@common/cams/dataflow-events';
import factory from '../../factory';
import { LegacyAddress } from '@common/cams/parties';
import { Address } from '@common/cams/contact';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { Trustee } from '@common/cams/trustees';

const MODULE_NAME = 'TRUSTEE-MATCH';

/**
 * Normalizes a name by trimming whitespace and collapsing multiple spaces.
 * This is the canonical normalization function for trustee name matching.
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Escapes special regex characters in a string for safe use in RegExp.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a legacy cityStateZipCountry string into components.
 * Format: "City, ST zipCode" with segments separated by a comma, whitespace,
 * or both, and an optional trailing country segment in any form (or none).
 * DXTR country data is unreliable/garbage (state abbreviations, zip codes,
 * "United States", phone numbers, etc.), so it is never captured or compared -
 * the parser simply stops matching once it has city, state, and zip.
 * Returns null if parsing fails.
 */
const STATE_TOKEN = /^[A-Za-z]{2}$/;
const ZIP_TOKEN = /^\d{5}(?:-\d{4})?$/;

export function parseCityStateZip(cityStateZipCountry?: string): {
  city: string;
  state: string;
  zipCode: string;
} | null {
  if (!cityStateZipCountry) return null;

  // Segments may be separated by a comma, whitespace, or both, so unify on
  // whitespace and tokenize. Then scan for the first "ST zipCode" token pair -
  // whatever precedes it is the city, and anything after it (e.g. a country
  // segment) is intentionally ignored rather than captured or validated.
  // Examples: "New York, NY 10001", "Corinth, MS, 38834, USA",
  // "Corinth MS 38834 USA", "New York, NY 10001 US"
  const tokens = cityStateZipCountry.replace(/,/g, ' ').trim().split(/\s+/);

  for (let i = 0; i < tokens.length - 1; i++) {
    const state = tokens[i];
    const zipCode = tokens[i + 1];
    if (STATE_TOKEN.test(state) && ZIP_TOKEN.test(zipCode)) {
      const city = tokens.slice(0, i).join(' ');
      if (!city) return null;
      return { city, state, zipCode };
    }
  }

  return null;
}

/**
 * Calculates address match score between DXTR and CAMS addresses.
 * Scoring:
 * - City + State + Zip match: 100 points (perfect match)
 * - Zip match (state implied): 60 points (high confidence - zip is specific)
 * - City match (state implied): 40 points (medium confidence)
 * - State match only: 30 points (low confidence)
 * - No match: 0 points
 * Case-insensitive comparison, missing fields treated as no match.
 */
export function calculateAddressScore(
  dxtrAddress: LegacyAddress | undefined,
  camsAddress: Address,
): number {
  const parsed = parseCityStateZip(dxtrAddress?.cityStateZipCountry);

  if (!parsed) return 0;

  const normalizeField = (field?: string) => field?.trim().toLowerCase() || '';

  const dxtrCity = normalizeField(parsed.city);
  const dxtrState = normalizeField(parsed.state);
  const dxtrZip = normalizeField(parsed.zipCode);

  const camsCity = normalizeField(camsAddress.city);
  const camsState = normalizeField(camsAddress.state);
  const camsZip = normalizeField(camsAddress.zipCode);

  const stateMatch = dxtrState && camsState && dxtrState === camsState;
  const cityMatch = dxtrCity && camsCity && dxtrCity === camsCity;
  const zipMatch = dxtrZip && camsZip && dxtrZip === camsZip;

  // Perfect match: city, state, and zip all match
  if (cityMatch && stateMatch && zipMatch) return 100;

  // High confidence: zip match (zip is more specific than city)
  if (zipMatch) return 60;

  // Medium confidence: city match (zip differs or missing)
  if (cityMatch) return 40;

  // State only (both city and zip missing): low confidence
  if (stateMatch) return 30;

  // No match
  return 0;
}

/**
 * Normalizes a chapter string for comparison.
 * Removes leading zeros and extracts base chapter from subchapter variants.
 * Examples: "07" → "7", "11-subchapter-v" → "11"
 */
export function normalizeChapter(chapter: string): string {
  // Extract base chapter number (before any dash or subchapter suffix)
  const match = chapter.match(/^0*(\d+)/);
  if (!match) return chapter.toLowerCase();
  return match[1];
}

/**
 * Determines if a trustee is a "perfect match" for a case.
 * A perfect match requires a SINGLE active appointment that matches
 * court + division + chapter on the same record.
 * This is stricter than the individual scoring functions which check
 * these criteria independently across all appointments.
 */
export function isPerfectMatch(
  appointments: TrusteeAppointment[],
  courtId: string,
  divisionCode: string,
  chapter: string,
): boolean {
  const normalizedChapter = normalizeChapter(chapter);
  return appointments.some(
    (a) =>
      a.status === 'active' &&
      a.courtId === courtId &&
      a.divisionCode === divisionCode &&
      normalizeChapter(a.chapter) === normalizedChapter,
  );
}

/**
 * Finds a deterministic inactive appointment matching court + division + chapter.
 * Where the status is NOT 'active'. Used to detect the "perfect match
 * but inactive status" scenario. If multiple inactive appointments match,
 * the most recently created one is returned to ensure predictable, auditable behavior.
 * Returns the matching appointment (for status extraction), or undefined.
 */
export function findInactivePerfectMatch(
  appointments: TrusteeAppointment[],
  courtId: string,
  divisionCode: string,
  chapter: string,
): TrusteeAppointment | undefined {
  const normalizedChapter = normalizeChapter(chapter);
  const matches = appointments.filter(
    (a) =>
      a.status !== 'active' &&
      a.courtId === courtId &&
      a.divisionCode === divisionCode &&
      normalizeChapter(a.chapter) === normalizedChapter,
  );
  if (matches.length === 0) return undefined;
  const sorted = matches.slice().sort((a, b) => {
    return new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime();
  });
  return sorted[0];
}

/**
 * Calculates district/division match score for a trustee.
 * Scoring:
 * - Exact court + division match with active appointment: 100 points
 * - Same court, different division with active appointment: 50 points
 * - No matching court: 0 points
 * Only active appointments count.
 */
export function calculateDistrictDivisionScore(
  caseCourtId: string,
  caseDivisionCode: string,
  appointments: TrusteeAppointment[],
): number {
  const activeAppointments = appointments.filter((a) => a.status === 'active');

  if (activeAppointments.length === 0) return 0;

  // Check for exact court + division match
  const exactMatch = activeAppointments.some((a) => {
    return a.courtId === caseCourtId && a.divisionCode === caseDivisionCode;
  });
  if (exactMatch) return 100;

  // Check for same court, different division
  const courtMatch = activeAppointments.some((a) => a.courtId === caseCourtId);
  if (courtMatch) return 50;

  return 0;
}

/**
 * Calculates chapter match score for a trustee.
 * Scoring:
 * - Exact chapter match with active appointment: 100 points
 * - No match: 0 points
 * Normalizes chapters before comparison (e.g., "7" === "07").
 * Only active appointments count.
 */
export function calculateChapterScore(
  caseChapter: string,
  appointments: TrusteeAppointment[],
): number {
  const activeAppointments = appointments.filter((a) => a.status === 'active');

  if (activeAppointments.length === 0) return 0;

  const normalizedCaseChapter = normalizeChapter(caseChapter);

  const chapterMatch = activeAppointments.some((a) => {
    const normalizedAppointmentChapter = normalizeChapter(a.chapter);
    return normalizedAppointmentChapter === normalizedCaseChapter;
  });

  return chapterMatch ? 100 : 0;
}

/**
 * Normalizes a name part for strict matching: lowercase and strip all
 * non-alphanumeric characters (e.g. "L." -> "l", "O'Brien" -> "obrien").
 * Distinct from `normalizeName`, which only collapses whitespace for
 * full-name lookup matching.
 */
function normalizeNamePart(namePart?: string): string {
  return (namePart ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates a name match score between DXTR and CAMS trustee parties.
 * Scoring:
 * - First and last name must both normalize-match exactly, or the score is 0
 *   (no partial credit for close-but-not-exact first/last names).
 * - When first and last match, a middle-name sub-score determines the result:
 *   - Missing on either or both sides: 100 (neutral - absence isn't evidence)
 *   - Both present and identical: 100 (full match)
 *   - One side is a single-character initial matching the other side's first
 *     character: 85 (initial-vs-full relationship)
 *   - Both present and genuinely differ: 15 (moderate conflict penalty)
 */
export function calculateNameScore(dxtrTrustee: DxtrTrusteeParty, camsTrustee: Trustee): number {
  const dxtrFirst = normalizeNamePart(dxtrTrustee.firstName);
  const dxtrLast = normalizeNamePart(dxtrTrustee.lastName);
  const camsFirst = normalizeNamePart(camsTrustee.firstName);
  const camsLast = normalizeNamePart(camsTrustee.lastName);

  if (!dxtrFirst || dxtrFirst !== camsFirst || !dxtrLast || dxtrLast !== camsLast) {
    return 0;
  }

  const dxtrMiddle = normalizeNamePart(dxtrTrustee.middleName);
  const camsMiddle = normalizeNamePart(camsTrustee.middleName);

  if (!dxtrMiddle || !camsMiddle) return 100;
  if (dxtrMiddle === camsMiddle) return 100;

  const isInitialOf = (initial: string, full: string) =>
    initial.length === 1 && full[0] === initial;

  if (isInitialOf(dxtrMiddle, camsMiddle) || isInitialOf(camsMiddle, dxtrMiddle)) return 85;

  return 15;
}

/**
 * Calculates the weighted total score from the individual score components.
 * Weighting: 10% address, 30% name, 30% district/division, 30% chapter.
 * Shared by calculateCandidateScore and handleInactivePerfectMatch so the
 * weight distribution only needs to change in one place.
 */
export function calculateTotalScore(scores: {
  addressScore: number;
  nameScore: number;
  districtDivisionScore: number;
  chapterScore: number;
}): number {
  const { addressScore, nameScore, districtDivisionScore, chapterScore } = scores;
  return addressScore * 0.1 + nameScore * 0.3 + districtDivisionScore * 0.3 + chapterScore * 0.3;
}

/**
 * Calculates a comprehensive candidate score for a trustee.
 * Orchestrates address, name, district/division, and chapter scoring with weighted totals.
 * Weighting: 10% address, 30% name, 30% district/division, 30% chapter.
 * Logs detailed scoring breakdown at info level.
 */
export function calculateCandidateScore(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
  courtId: string,
  courtDivisionCode: string,
  chapter: string,
  camsTrustee: Trustee,
  appointments: TrusteeAppointment[],
): CandidateScore {
  const addressScore = calculateAddressScore(dxtrTrustee.legacy, camsTrustee.public.address);
  const nameScore = calculateNameScore(dxtrTrustee, camsTrustee);
  const districtDivisionScore = calculateDistrictDivisionScore(
    courtId,
    courtDivisionCode,
    appointments,
  );
  const chapterScore = calculateChapterScore(chapter, appointments);

  const totalScore = calculateTotalScore({
    addressScore,
    nameScore,
    districtDivisionScore,
    chapterScore,
  });

  const candidateScore: CandidateScore = {
    trusteeId: camsTrustee.trusteeId,
    trusteeName: camsTrustee.name,
    totalScore,
    addressScore,
    nameScore,
    districtDivisionScore,
    chapterScore,
    address: camsTrustee.public.address,
    phone: camsTrustee.public.phone,
    email: camsTrustee.public.email,
    appointments,
  };

  context.logger.info(
    MODULE_NAME,
    `Scoring candidate ${camsTrustee.trusteeId}: ` +
      `address=${addressScore}, name=${nameScore}, district=${districtDivisionScore}, chapter=${chapterScore}, total=${totalScore}`,
  );

  return candidateScore;
}

type FuzzyMatchResult = {
  winnerId: string;
  candidateScores: CandidateScore[];
};

/**
 * Resolves a trustee from multiple candidates using fuzzy matching.
 * Scores each candidate based on address, district/division, and chapter alignment.
 * Winner criteria: score >75% AND 5+ points ahead of next candidate.
 * Returns winning trusteeId with candidate scores, or throws enhanced error.
 */
export async function resolveTrusteeWithFuzzyMatching(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  candidateTrusteeIds: string[],
): Promise<FuzzyMatchResult> {
  // Score all candidates - fetch data in parallel to avoid N+1 queries
  const trusteesRepo = factory.getTrusteesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  const candidateDataPromises = candidateTrusteeIds.map(async (trusteeId) => {
    try {
      const [trustee, appointments] = await Promise.all([
        trusteesRepo.read(trusteeId),
        appointmentsRepo.getTrusteeAppointments(trusteeId),
      ]);
      return { trusteeId, trustee, appointments, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { trusteeId, trustee: null, appointments: null, error: errorMessage };
    }
  });

  const candidateData = await Promise.all(candidateDataPromises);

  const candidateScores: CandidateScore[] = [];
  for (const { trusteeId, trustee, appointments, error } of candidateData) {
    if (error) {
      context.logger.warn(MODULE_NAME, `Skipping candidate ${trusteeId}: ${error}`);
      continue;
    }

    const score = calculateCandidateScore(
      context,
      event.dxtrTrustee,
      event.courtId,
      event.courtDivisionCode,
      event.chapter,
      trustee,
      appointments,
    );

    candidateScores.push(score);
  }

  // Guard against empty results (all candidates failed to load)
  if (candidateScores.length === 0) {
    throw new CamsError(MODULE_NAME, {
      message: `Fuzzy matching failed: no valid candidates could be scored for case ${event.caseId}`,
      data: {
        mismatchReason: 'NO_TRUSTEE_MATCH',
      },
    });
  }

  // Sort by totalScore descending
  candidateScores.sort((a, b) => b.totalScore - a.totalScore);

  const winner = candidateScores[0];
  const runnerUp = candidateScores[1];

  // Apply winner criteria: >75% AND 5+ point gap
  const meetsThreshold = winner.totalScore > 75;
  const hasSignificantGap = !runnerUp || winner.totalScore - runnerUp.totalScore >= 5;

  if (meetsThreshold && hasSignificantGap) {
    context.logger.info(
      MODULE_NAME,
      `Fuzzy matching resolved to ${winner.trusteeId} with score ${winner.totalScore}`,
    );
    return { winnerId: winner.trusteeId, candidateScores };
  }

  // No clear winner - throw error with scores
  const candidateList = candidateScores
    .map((score) => `${score.trusteeId} (${score.totalScore} pts)`)
    .join(', ');

  throw new CamsError(MODULE_NAME, {
    message: `Fuzzy matching failed: no clear winner among ${candidateScores.length} candidates [${candidateList}]`,
    data: {
      mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
      matchCandidates: candidateScores,
    },
  });
}

export async function matchTrusteeByName(
  context: ApplicationContext,
  trusteeName: string,
): Promise<string> {
  const normalized = normalizeName(trusteeName);
  const trusteesRepo = factory.getTrusteesRepository(context);
  const matches = await trusteesRepo.findTrusteesByName(normalized);

  if (matches.length === 0) {
    throw new CamsError(MODULE_NAME, {
      message: `No CAMS trustee found matching name "${normalized}".`,
      data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
    });
  }

  if (matches.length > 1) {
    const candidates = matches.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    const matchCandidates: CandidateScore[] = matches.map((t) => ({
      trusteeId: t.trusteeId,
      trusteeName: t.name,
      totalScore: UNSCORED,
      addressScore: UNSCORED,
      nameScore: UNSCORED,
      districtDivisionScore: UNSCORED,
      chapterScore: UNSCORED,
      address: t.public.address,
      phone: t.public.phone,
      email: t.public.email,
    }));
    throw new CamsError(MODULE_NAME, {
      message: `Multiple CAMS trustees found matching name "${normalized}": ${candidates}.`,
      data: {
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        matchCandidates,
      },
    });
  }

  return matches[0].trusteeId;
}
