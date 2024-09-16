import { CamsUserReference } from './users';
import { getCamsUserReference } from './session';

export type Auditable = {
  updatedOn: string;
  updatedBy: CamsUserReference;
};

export const SYSTEM_USER_REFERENCE: CamsUserReference = { id: 'SYSTEM', name: 'SYSTEM' };

/**
 * Decorates the record with the Auditable properties. Any necessary overriding of the properties must be completed
 * after or in lieu of calling this function.
 * @param record T extends Auditable required The record to be decorated.
 * @param camsUser CamsUserReference optional The user to be assigned to `updatedBy`. Defaults to the system user, so
 * this parameter MUST be provided for user-initiated actions.
 */
export function createAuditRecord<T extends Auditable>(
  record: Omit<T, 'updatedOn' | 'updatedBy'>,
  camsUser: CamsUserReference = SYSTEM_USER_REFERENCE,
): T {
  return {
    ...record,
    updatedOn: new Date().toISOString(),
    updatedBy: getCamsUserReference(camsUser),
  } as T;
}
