import { CamsSession, getCamsUserReference } from './session';
import { CamsUserReference } from './users';

export type Auditable = {
  updatedOn: string;
  updatedBy: CamsUserReference;
};

export const SYSTEM_USER_REFERENCE: CamsUserReference = { id: 'SYSTEM', name: 'SYSTEM' };

export function createAuditRecord<T extends Auditable>(
  record: Omit<T, 'updatedOn' | 'updatedBy'>,
  session?: CamsSession,
  override?: Partial<Auditable>,
): T {
  return {
    updatedOn: new Date().toISOString(),
    updatedBy: session ? getCamsUserReference(session.user) : SYSTEM_USER_REFERENCE,
    ...record,
    ...override,
  } as T;
}
