import { Auditable } from './auditable';
import { Identifiable } from './document';
import { ContactInformation } from './contact';

export type TrusteeAssistantInput = {
  name: string;
  title?: string;
  contact?: ContactInformation;
};

export type TrusteeAssistant = Auditable &
  Identifiable & {
    trusteeId: string;
    name: string;
    title?: string;
    contact?: ContactInformation;
  };
