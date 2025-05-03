import { getCamsUserReference } from './session';
import { CamsUserReference } from './users';

export type Auditable = {
  createdBy?: CamsUserReference;
  createdOn?: string;
  updatedBy: CamsUserReference;
  updatedOn: string;
};

export const SYSTEM_USER_REFERENCE: CamsUserReference = { id: 'SYSTEM', name: 'SYSTEM' };
export const ACMS_SYSTEM_USER_REFERENCE: CamsUserReference = { id: 'ACMS', name: 'ACMS' };

/**
 * Decorates and returns the record with the Auditable properties. Any necessary overriding of the properties must be
 * completed after or in lieu of calling this function.
 *
 * @template {T extends Auditable}
 * @param {T extends Auditable} record The record to be decorated.
 * @param {CamsUserReference} [camsUser=SYSTEM_USER_REFERENCE] The user to be assigned to `updatedBy`. Defaults to the
 * system user, so this parameter MUST be provided for user-initiated actions.
 * @returns {T}
 */
export function createAuditRecord<T extends Auditable>(
  record: Omit<T, 'updatedBy' | 'updatedOn'>,
  camsUser: CamsUserReference = SYSTEM_USER_REFERENCE,
): T {
  return {
    ...record,
    updatedBy: getCamsUserReference(camsUser),
    updatedOn: new Date().toISOString(),
  } as T;
}
