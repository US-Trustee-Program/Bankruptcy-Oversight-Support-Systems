import { ApplicationContext } from '../../adapters/types/basic';
import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { TrusteeVariation } from '@common/cams/trustee-variation';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';
import { runTrusteeMatchPipeline } from './trustee-match-pipeline-orchestrator';
import { serializeState, TrusteeSerializedState } from './trustee-match-pipeline';
import { TrusteeProfessionalIdsRepository, TrusteeVariationRepository } from '../gateways.types';
import { createLinkedStateWithoutEvidence } from './trustee-professional-ids.types';
import { findByVariant } from './identity-task';

export type IdentifyTrusteeDeps = {
  context: ApplicationContext;
  variationRepo: TrusteeVariationRepository;
  professionalIdsRepo: TrusteeProfessionalIdsRepository;
};

export type IdentifyTrusteeOutcome =
  | {
      kind: 'linked';
      trusteeId: string;
      via: 'fingerprint' | 'name';
      state: TrusteeSerializedState;
    }
  | {
      kind: 'conflict';
      via: 'fingerprint' | 'name';
      existingTrusteeId: string;
      state: TrusteeSerializedState;
    }
  | { kind: 'unresolved'; state: TrusteeSerializedState };

/**
 * Returns the camsTrusteeId of an existing linked record for this ACMS id that belongs to a
 * different trustee, if any.
 */
async function findExistingConflict(
  deps: IdentifyTrusteeDeps,
  acmsProfessionalId: string,
  candidateTrusteeId: string,
): Promise<string | undefined> {
  const existing = await deps.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
  const conflicting = existing.find((link) => link.camsTrusteeId !== candidateTrusteeId);
  return conflicting?.camsTrusteeId;
}

/**
 * Identifies the CAMS trustee for a legacy-system source record: a TrusteeVariation fingerprint
 * lookup first, then the trustee-match pipeline when no fingerprint hit exists, then a conflict
 * check against existing professional-id links for whichever resolved the match. A transient
 * pipeline error rethrows so the caller's retry re-runs from its original bookmark rather than
 * recording a false no-match.
 */
export async function identifyTrustee(
  deps: IdentifyTrusteeDeps,
  source: CanonicalTrusteeSource,
  acmsProfessionalId: string,
  fingerprint: string,
  variant: string,
): Promise<IdentifyTrusteeOutcome> {
  const fingerprintBucket: TrusteeVariation[] =
    await deps.variationRepo.findByFingerprint(fingerprint);
  const fingerprintMatch = findByVariant(fingerprintBucket, variant);

  if (fingerprintMatch) {
    const trusteeId = fingerprintMatch.trusteeId;
    const state = createLinkedStateWithoutEvidence(source, trusteeId);
    const existingTrusteeId = await findExistingConflict(deps, acmsProfessionalId, trusteeId);
    if (existingTrusteeId) {
      return { kind: 'conflict', via: 'fingerprint', existingTrusteeId, state };
    }
    return { kind: 'linked', trusteeId, via: 'fingerprint', state };
  }

  const pipelineState = await runTrusteeMatchPipeline(deps.context, source);
  if (pipelineState.error && isTransientInfraError(pipelineState.error)) {
    throw pipelineState.error;
  }
  const state = serializeState(pipelineState);

  if (state.match) {
    const trusteeId = state.match.trusteeId;
    const existingTrusteeId = await findExistingConflict(deps, acmsProfessionalId, trusteeId);
    if (existingTrusteeId) {
      return { kind: 'conflict', via: 'name', existingTrusteeId, state };
    }
    return { kind: 'linked', trusteeId, via: 'name', state };
  }

  return { kind: 'unresolved', state };
}
