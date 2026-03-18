import { Auditable } from './auditable';
import { Identifiable } from './document';

export type TrusteeProfessionalId = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_PROFESSIONAL_ID';
    camsTrusteeId: string;
    acmsProfessionalId: string; // Format: "{GROUP_DESIGNATOR}-{PROF_CODE}"
  };
