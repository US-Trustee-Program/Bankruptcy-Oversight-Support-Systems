import { Auditable } from './auditable';
import { Identifiable } from './document';

/**
 * Present when this professional ID could not be auto-linked to a CAMS trustee.
 * `camsTrusteeId` is set to the ACMS variant's fingerprint (a stand-in trusteeId) rather than a
 * real trustee, so the record still lands in the normal trustee-professional-ids collection for
 * later healing instead of a separate review store. `trustees` carries the CAMS trusteeIds
 * relevant to the disposition — the ambiguous name-match candidates, or the two trustees
 * involved in a conflict — for lookup without re-running the match.
 */
export type TrusteeProfessionalIdError = {
  disposition: 'no-match' | 'ambiguous' | 'conflict';
  trustees?: string[];
};

export type TrusteeProfessionalId = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_PROFESSIONAL_ID';
    camsTrusteeId: string;
    /**
     * Format: "{GROUP_DESIGNATOR}-{PROF_CODE}"
     * Example: "NY-00063"
     */
    acmsProfessionalId: string;
    /** The raw (uncanonicalized) ACMS demographic variant string this record was built from. */
    variant?: string;
    error?: TrusteeProfessionalIdError;
  };
