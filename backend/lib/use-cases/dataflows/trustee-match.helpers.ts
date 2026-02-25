import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import {
  TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES,
  DxtrTrusteeParty,
  CandidateScore,
  TrusteeAppointmentSyncEvent,
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
 * - All three match (city, state, zipCode): 100 points
 * - State + city match: 60 points
 * - State only: 30 points
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

  // State must match for any points
  if (!dxtrState || !camsState || dxtrState !== camsState) {
    return 0;
  }

  const cityMatch = dxtrCity && camsCity && dxtrCity === camsCity;
  const zipMatch = dxtrZip && camsZip && dxtrZip === camsZip;

  if (cityMatch && zipMatch) return 100;
  if (cityMatch) return 60;
  return 30; // State-only match
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
    });
  }

  // Score all candidates
  const trusteesRepo = factory.getTrusteesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const candidateScores: CandidateScore[] = [];

  for (const trusteeId of candidateTrusteeIds) {
    // TODO: is getTrustee a function that is going to get implemented in the next step? Or....???
    const trustee = await trusteesRepo.getTrustee(trusteeId);
    const appointments = await appointmentsRepo.getTrusteeAppointments(trusteeId);

    const score = calculateCandidateScore(
      context,
      event.dxtrTrustee,
      syncedCase,
      trustee,
      appointments,
    );

    candidateScores.push(score);
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
      mismatchReason: TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.MULTIPLE_TRUSTEES_MATCH,
      candidateTrusteeIds,
      candidateScores,
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
      data: { mismatchReason: TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.NO_TRUSTEE_MATCH },
    });
  }

  if (matches.length > 1) {
    const candidateTrusteeIds = matches.map((t) => t.trusteeId);
    const candidates = matches.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    throw new CamsError(MODULE_NAME, {
      message: `Multiple CAMS trustees found matching name "${normalized}": ${candidates}.`,
      data: {
        mismatchReason: TRUSTEE_APPOINTMENT_SYNC_ERROR_CODES.MULTIPLE_TRUSTEES_MATCH,
        candidateTrusteeIds,
      },
    });
  }

  return matches[0].trusteeId;
}
