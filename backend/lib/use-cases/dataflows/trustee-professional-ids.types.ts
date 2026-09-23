import { Auditable } from '@common/cams/auditable';
import { Identifiable } from '@common/cams/document';
import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { SerializedCandidate, TrusteeSerializedState } from './trustee-match-pipeline';
import { normalizeAddressLine } from './trustee-match.helpers';

/** Derived once from a TrusteeSerializedState's match/skip/error at write time and stored
 * alongside it, so a query can filter/index on outcome without inspecting the nested pipeline
 * state. 'conflict' overrides an otherwise auto-linked disposition - see
 * TrusteeProfessionalId.evidence.conflictingTrusteeId. Whether the ambiguous candidates look like
 * duplicate CAMS records of one person is a separate signal - see
 * TrusteeProfessionalId.suspectDuplicateCamsTrustee. */
export type TrusteeProfessionalIdDisposition =
  'auto-linked' | 'no-match' | 'ambiguous' | 'skipped' | 'error' | 'conflict';

/**
 * A persisted trustee<->ACMS professional-id link. The pipeline's own serialized evidence graph
 * (sourceRaw, sourceNormalized, memo, candidates, match, skip, error, plus the variant string and
 * conflictingTrusteeId recorded at write time) is nested under `evidence` rather than flattened
 * onto this type, so a caller that only needs the association itself - not why it was reached -
 * never has to fetch or hold the full graph in memory. That graph is large per record (a full
 * candidate pool with each candidate's complete score history) and this collection is read far
 * more often than it is investigated, so TrusteeProfessionalIdSummary (below), NOT this type, is
 * what findAll/findByCamsTrusteeId/findByAcmsProfessionalId return - see
 * TrusteeProfessionalIdsRepository's own doc comment. This full type is reserved for a caller that
 * explicitly wants the evidence (a dedicated repository method, or direct inspection via
 * mongosh/Compass).
 */
export type TrusteeProfessionalId = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_PROFESSIONAL_ID';
    camsTrusteeId: string;
    acmsProfessionalId: string;
    disposition: TrusteeProfessionalIdDisposition;
    /** Set when disposition is 'ambiguous' and 2+ of the genuinely-qualifying candidates share a
     * phone, email, or street address with EACH OTHER - evidence CAMS holds duplicate records for
     * one person rather than the ACMS record genuinely matching several distinct trustees. A CAMS
     * data-quality signal, independent of disposition - see hasSuspectDuplicateCamsTrustee. */
    suspectDuplicateCamsTrustee?: boolean;
    evidence: TrusteeSerializedState & {
      variant?: string;
      /** Set only when disposition is 'conflict': the trusteeId this acmsProfessionalId was
       * already linked to before this run resolved a DIFFERENT trusteeId for it. */
      conflictingTrusteeId?: string;
    };
  };

/**
 * The projected shape every ordinary caller reads - camsTrusteeId, acmsProfessionalId, and
 * disposition are the whole association; `evidence` (see TrusteeProfessionalId's own doc comment)
 * is deliberately excluded, at the Mongo query level via a projection, not merely in this type, so
 * the heavy payload never crosses the wire for the common case of resolving or listing links.
 */
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

/** Street address + city/state/zip, normalized, or undefined if there's no address1 to compare -
 * a bare city/state/zip match alone is too common (an office building, a courthouse) to be
 * duplication evidence on its own. */
function normalizedAddress(
  address: { address1?: string; city?: string; state?: string; zipCode?: string } | undefined,
): string | undefined {
  if (!address?.address1) return undefined;
  const normalized = normalizeAddressLine(
    [address.address1, address.city, address.state, address.zipCode].filter(Boolean).join(' '),
  );
  return normalized.length > 0 ? normalized : undefined;
}

/** Records `value` in `seen`, returning whether it was already present - undefined values are
 * never recorded (an absent phone/email/address is never a duplication signal). */
function isRepeat(seen: Set<string>, value: string | undefined): boolean {
  if (!value) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  return false;
}

/** Whether 2+ name-qualifying candidates share a phone, email, or street address with EACH
 * OTHER - each an independent signal, any one alone sufficient. A CAMS trustee entered twice
 * (a stale record alongside a current one, a data-entry duplicate) commonly shares an address
 * even when phone/email differ or are missing on one side. */
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

/** Whether a name-qualifying candidate represents genuine competing evidence rather than
 * name-shape coincidence: either the name match itself is exact (100, not merely the weakest
 * 85-scored relaxation - an initial, a crossed middle name, a nickname), or the ACMS source
 * actually had comparable address/phone data for corroboration to have a chance to run against
 * (regardless of whether it agreed). A candidate that qualified ONLY via an 85-scored relaxation,
 * with nothing on the ACMS side to ever corroborate against, is not real evidence this candidate
 * is the ACMS person - it is indistinguishable from a coincidence across an entire surname pool
 * (this shows up as, e.g., an ACMS "Jordan Roe" bare-initial-qualifying against three distinct,
 * unrelated "J. Roe" trustees, none reachable any other way). */
function isGenuineAmbiguousEvidence(candidate: SerializedCandidate<unknown>): boolean {
  if (candidate.scores.doesNameMatch?.value === 100) return true;
  return candidate.scores.doesAcmsTrusteeHaveAddressAndPhone?.pass !== false;
}

/** Derives a TrusteeProfessionalIdDisposition from a TrusteeSerializedState - the single place
 * this mapping is made. 'ambiguous' requires at least one candidate with genuine competing
 * evidence (see isGenuineAmbiguousEvidence) - a pool where every candidate either failed name
 * matching outright, or only qualified via name-shape coincidence with no corroboration ever
 * possible, is zero real evidence, not competing candidates, so it derives 'no-match' instead. */
export function deriveDisposition(
  state: Pick<TrusteeSerializedState, 'match' | 'skip' | 'error' | 'candidates'>,
): Exclude<TrusteeProfessionalIdDisposition, 'conflict'> {
  if (state.error) return 'error';
  if (state.skip) return 'skipped';
  if (state.match) return 'auto-linked';
  const hasGenuineAmbiguousCandidate = state.candidates.some(
    (c) => c.scores.doesNameMatch?.pass && isGenuineAmbiguousEvidence(c),
  );
  return hasGenuineAmbiguousCandidate ? 'ambiguous' : 'no-match';
}

/** Whether an 'ambiguous' record's own candidate pool looks like a CAMS data-quality issue - see
 * TrusteeProfessionalId.suspectDuplicateCamsTrustee. Independent of deriveDisposition: a caller
 * runs both against the same state and persists them as separate fields. */
export function deriveSuspectDuplicateCamsTrustee(
  state: Pick<TrusteeSerializedState, 'candidates'>,
): boolean {
  return hasSuspectDuplicateCamsTrustee(state.candidates);
}

/** A resolved-with-no-pipeline-evidence state, for a trusteeId link established outside
 * runTrusteeMatchPipeline (a fingerprint hit, a legacy migration, a manually assigned professional
 * ID) - there is no candidate evaluation to attach, only the fact of the link itself. */
export function createLinkedStateWithoutEvidence(
  sourceRaw: CanonicalTrusteeSource,
  trusteeId: string,
): TrusteeSerializedState {
  return {
    sourceRaw,
    sourceNormalized: {},
    memo: {},
    candidates: [],
    match: { trusteeId, score: {} },
    skip: false,
    error: null,
  };
}
