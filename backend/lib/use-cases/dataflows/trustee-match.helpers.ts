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
import { SyncedCase } from '@common/cams/cases';
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
 * Format: "City, ST zipCode" or "City, ST zipCode COUNTRY"
 * Returns null if parsing fails.
 */
function parseCityStateZip(cityStateZipCountry?: string): {
  city: string;
  state: string;
  zipCode: string;
} | null {
  if (!cityStateZipCountry) return null;

  // Match pattern: "City, ST zipCode" with optional country at end
  // Example: "New York, NY 10001" or "New York, NY 10001 US"
  const match = cityStateZipCountry.match(/^(.+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/i);

  if (!match) return null;

  return {
    city: match[1].trim(),
    state: match[2].trim(),
    zipCode: match[3].trim(),
  };
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
  if (cityMatch && zipMatch) return 100;

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
 * Calculates a comprehensive candidate score for a trustee.
 * Orchestrates address, district/division, and chapter scoring with weighted totals.
 * Weighting: 20% address, 40% district/division, 40% chapter.
 * Logs detailed scoring breakdown at info level.
 */
export function calculateCandidateScore(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
  camsCase: SyncedCase,
  camsTrustee: Trustee,
  appointments: TrusteeAppointment[],
): CandidateScore {
  const addressScore = calculateAddressScore(dxtrTrustee.legacy, camsTrustee.public.address);
  const districtDivisionScore = calculateDistrictDivisionScore(
    camsCase.courtId,
    camsCase.courtDivisionCode,
    appointments,
  );
  const chapterScore = calculateChapterScore(camsCase.chapter, appointments);

  const totalScore = addressScore * 0.2 + districtDivisionScore * 0.4 + chapterScore * 0.4;

  const candidateScore: CandidateScore = {
    trusteeId: camsTrustee.trusteeId,
    trusteeName: camsTrustee.name,
    totalScore,
    addressScore,
    districtDivisionScore,
    chapterScore,
  };

  context.logger.info(
    MODULE_NAME,
    `Scoring candidate ${camsTrustee.trusteeId} ("${camsTrustee.name}"): ` +
      `address=${addressScore}, district=${districtDivisionScore}, chapter=${chapterScore}, total=${totalScore}`,
  );

  return candidateScore;
}

/**
 * Resolves a trustee from multiple candidates using fuzzy matching.
 * Scores each candidate based on address, district/division, and chapter alignment.
 * Winner criteria: score >75% AND 5+ points ahead of next candidate.
 * Returns winning trusteeId or throws enhanced error with candidate scores.
 */
export async function resolveTrusteeWithFuzzyMatching(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  candidateTrusteeIds: string[],
): Promise<string> {
  // Lazy-load case details
  const casesRepo = factory.getCasesRepository(context);
  const syncedCase = await casesRepo.getSyncedCase(event.caseId);

  if (!syncedCase) {
    throw new CamsError(MODULE_NAME, {
      message: `Case ${event.caseId} not found during fuzzy matching.`,
      data: {
        mismatchReason: 'CASE_NOT_FOUND',
        matchCandidates: [],
      },
    });
  }

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
      syncedCase,
      trustee!,
      appointments!,
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
    return winner.trusteeId;
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
      districtDivisionScore: UNSCORED,
      chapterScore: UNSCORED,
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
