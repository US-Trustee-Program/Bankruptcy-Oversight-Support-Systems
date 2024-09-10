import { getCamsUserReference } from './session';
import { CamsUserReference } from './users';

export type Auditable = {
  updatedOn: string;
  updatedBy: CamsUserReference;
};

export const SYSTEM_USER_REFERENCE: CamsUserReference = { id: 'SYSTEM', name: 'SYSTEM' };

export function createAuditRecord<
  T extends Auditable,
  U extends CamsUserReference = CamsUserReference,
>(record: Omit<T, 'updatedOn' | 'updatedBy'>, user?: U, override?: Partial<Auditable>): T {
  return {
    updatedOn: new Date().toISOString(),
    updatedBy: user ? getCamsUserReference(user) : SYSTEM_USER_REFERENCE,
    ...record,
    ...override,
  } as T;
}
