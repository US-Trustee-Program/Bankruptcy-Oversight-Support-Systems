import { Auditable } from '@common/cams/auditable';
import { Identifiable } from '@common/cams/document';
import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { SerializedCandidate, TrusteeSerializedState } from './trustee-match-pipeline';
import { normalizeAddressLine } from './trustee-match.helpers';

/** Outcome stored alongside the pipeline state so queries can filter on it. 'conflict' replaces
 * 'linked' when the ACMS id is already linked to a different trustee. */
export type TrusteeProfessionalIdDisposition =
  'linked' | 'no-match' | 'ambiguous' | 'skipped' | 'error' | 'conflict';

/** How a 'linked' record was linked: by the matching pipeline or fingerprint ('auto'), or by a
 * person ('manual'). */
type TrusteeProfessionalIdLinkMethod = 'auto' | 'manual';

/**
 * A persisted trustee<->ACMS professional-id record. evidence holds the serialized pipeline state;
 * ordinary finders return TrusteeProfessionalIdSummary, which omits it at the query level.
 */
export type TrusteeProfessionalId = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_PROFESSIONAL_ID';
    camsTrusteeId: string;
    acmsProfessionalId: string;
    disposition: TrusteeProfessionalIdDisposition;
    /** Set only when disposition is 'linked'. */
    linkMethod?: TrusteeProfessionalIdLinkMethod;
    /** Set when disposition is 'ambiguous': true when 2+ name-qualifying candidates share a phone,
     * email, or street address with each other, suggesting duplicate CAMS records for one person.
     * See hasSuspectDuplicateCamsTrustee. */
    suspectDuplicateCamsTrustee?: boolean;
    /** How many candidates matched on name at any grade - the indexed hint for surfacing
     * unlinked records worth manual review (disposition other than 'linked', count > 0). */
    nameMatchCount: number;
    /** Set only when disposition is 'linked': when heal-sentinel-case-appointments found no
     * sentinel appointments left for this acmsProfessionalId. */
    sentinelsHealedOn?: string;
    evidence: TrusteeSerializedState & {
      variant?: string;
      /** Set only when disposition is 'conflict': the trusteeId this acmsProfessionalId is already
       * linked to. */
      conflictingTrusteeId?: string;
    };
  };

/** TrusteeProfessionalId without evidence (excluded by Mongo projection). */
export type TrusteeProfessionalIdSummary = Omit<TrusteeProfessionalId, 'evidence'>;

/** Last 10 digits of a phone number, or undefined if too short to compare. */
function phoneDigits(phone: string | undefined): string | undefined {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : undefined;
}

function normalizedEmail(email: string | undefined): string | undefined {
  const trimmed = (email ?? '').trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Normalized street address + city/state/zip, or undefined without address1; a bare
 * city/state/zip is too common to count as duplication evidence. */
function normalizedAddress(
  address: { address1?: string; city?: string; state?: string; zipCode?: string } | undefined,
): string | undefined {
  if (!address?.address1) return undefined;
  const normalized = normalizeAddressLine(
    [address.address1, address.city, address.state, address.zipCode].filter(Boolean).join(' '),
  );
  return normalized.length > 0 ? normalized : undefined;
}

/** Records `value` in `seen`, returning whether it was already present; undefined is never
 * recorded. */
function isRepeat(seen: Set<string>, value: string | undefined): boolean {
  if (!value) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  return false;
}

/** Whether 2+ name-qualifying candidates share a phone, email, or street address with each other;
 * any one shared field is sufficient. */
function hasSuspectDuplicateCamsTrustee<
  TCandidate extends {
    phone?: { number?: string };
    email?: string;
    address?: { address1?: string; city?: string; state?: string; zipCode?: string };
  },
>(candidates: SerializedCandidate<TCandidate>[]): boolean {
  const qualifying = candidates.filter((c) => c.scores.doesNameMatch?.pass);
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const seenAddresses = new Set<string>();
  return qualifying.some(
    (candidate) =>
      isRepeat(seenPhones, phoneDigits(candidate.camsRaw.phone?.number)) ||
      isRepeat(seenEmails, normalizedEmail(candidate.camsRaw.email)) ||
      isRepeat(seenAddresses, normalizedAddress(candidate.camsRaw.address)),
  );
}

/** True when the name match is exact, or when the ACMS source has any contact data
 * (doesAcmsTrusteeHaveAddressAndPhone not failed). */
function isGenuineAmbiguousEvidence(candidate: SerializedCandidate<unknown>): boolean {
  const nameMatch = candidate.scores.doesNameMatch;
  if (nameMatch?.pass === true && nameMatch.quality === 'exact') return true;
  return candidate.scores.doesAcmsTrusteeHaveAddressAndPhone?.pass !== false;
}

/** Maps state to a disposition (error > skipped > linked). Without a match, 'ambiguous' requires 2+
 * name-qualifying candidates that each pass isGenuineAmbiguousEvidence; otherwise 'no-match'. */
export function deriveDisposition(
  state: Pick<TrusteeSerializedState, 'match' | 'skip' | 'error' | 'candidates'>,
): Exclude<TrusteeProfessionalIdDisposition, 'conflict'> {
  if (state.error) return 'error';
  if (state.skip) return 'skipped';
  if (state.match) return 'linked';
  const genuinelyQualifyingCount = state.candidates.filter(
    (c) => c.scores.doesNameMatch?.pass && isGenuineAmbiguousEvidence(c),
  ).length;
  return genuinelyQualifyingCount >= 2 ? 'ambiguous' : 'no-match';
}

/** Computes TrusteeProfessionalId.suspectDuplicateCamsTrustee from the candidate pool. */
export function deriveSuspectDuplicateCamsTrustee(
  state: Pick<TrusteeSerializedState, 'candidates'>,
): boolean {
  return hasSuspectDuplicateCamsTrustee(state.candidates);
}

/** See TrusteeProfessionalId.nameMatchCount. */
export function deriveNameMatchCount(state: Pick<TrusteeSerializedState, 'candidates'>): number {
  return state.candidates.filter((c) => c.scores.doesNameMatch?.pass === true).length;
}

/** Linked state for a link made outside the pipeline (a fingerprint hit); no candidates. */
export function createLinkedStateWithoutEvidence(
  sourceRaw: CanonicalTrusteeSource,
  trusteeId: string,
): TrusteeSerializedState {
  return {
    sourceRaw,
    sourceNormalized: {},
    memo: {},
    candidates: [],
    match: { trusteeId, score: {}, resolvedBy: 'linkedWithoutPipelineEvidence' },
    skip: false,
    error: null,
  };
}
