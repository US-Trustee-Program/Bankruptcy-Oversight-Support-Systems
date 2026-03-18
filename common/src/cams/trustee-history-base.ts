import { Auditable } from './auditable';
import { Identifiable } from './document';

export type AbstractTrusteeHistory<B, A> = Auditable &
  Identifiable & {
    trusteeId: string;
    before: B | undefined;
    after: A | undefined;
  };
