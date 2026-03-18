import { Auditable } from './auditable';
import { Identifiable } from './document';

export type TrusteeProfessionalId = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_PROFESSIONAL_ID';
    camsTrusteeId: string;
    /**
     * Format: "{GROUP_DESIGNATOR}-{PROF_CODE}"
     * Example: "NY-00063"
     */
    acmsProfessionalId: string;
  };
