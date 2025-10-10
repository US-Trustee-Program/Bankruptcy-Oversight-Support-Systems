import { CamsUserReference } from './users';
import { getCamsUserReference } from './session';
import { Identifiable } from './document';

export type Auditable = {
  updatedOn: string;
  updatedBy: CamsUserReference;
  createdOn?: string;
  createdBy?: CamsUserReference;
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
 * @returns {T extends Auditable}
 */
export function createAuditRecord<T extends Auditable>(
  record: Omit<T, keyof Auditable | keyof Identifiable>,
  camsUser: CamsUserReference = SYSTEM_USER_REFERENCE,
): T {
  const userReference: CamsUserReference = getCamsUserReference(camsUser);
  const timestamp = new Date().toISOString();

  return {
    ...record,
    createdOn: timestamp,
    createdBy: userReference,
    updatedOn: timestamp,
    updatedBy: userReference,
  } as T;
}
