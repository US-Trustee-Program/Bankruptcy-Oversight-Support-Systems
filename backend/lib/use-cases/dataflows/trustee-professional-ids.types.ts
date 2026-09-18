import { Auditable } from '@common/cams/auditable';
import { Identifiable } from '@common/cams/document';
import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { TrusteeSerializedState } from './trustee-match-pipeline';

/** Derived once from a TrusteeSerializedState's match/skip/error at write time and stored
 * alongside it, so a query can filter/index on outcome without inspecting the nested pipeline
 * state. 'conflict' overrides an otherwise auto-linked disposition - see
 * TrusteeProfessionalId.evidence.conflictingTrusteeId. */
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

/** Derives a TrusteeProfessionalIdDisposition from a TrusteeSerializedState - the single place
 * this mapping is made, so a write site and a query never need to duplicate the same
 * match/skip/error/candidates inspection. Any candidate present without a match means at least
 * one was found but none confirmed - ambiguous, not no-match (see pipeline-replay-backtest.ts's
 * identical convention). */
export function deriveDisposition(
  state: Pick<TrusteeSerializedState, 'match' | 'skip' | 'error' | 'candidates'>,
): Exclude<TrusteeProfessionalIdDisposition, 'conflict'> {
  if (state.error) return 'error';
  if (state.skip) return 'skipped';
  if (state.match) return 'auto-linked';
  return state.candidates.length > 0 ? 'ambiguous' : 'no-match';
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
