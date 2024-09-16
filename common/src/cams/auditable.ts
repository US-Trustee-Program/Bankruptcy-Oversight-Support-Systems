import { CamsSession, getCamsUserReference } from './session';
import { CamsUserReference } from './users';

export type Auditable = {
  updatedOn: string;
  updatedBy: CamsUserReference;
};

export const SYSTEM_USER_REFERENCE: CamsUserReference = { id: 'SYSTEM', name: 'SYSTEM' };

/**
 * Decorate a record (T) with the updatedOn and updatedBy properties.
 * @param args {record: T; session?: CamsSession; override?: Partial<Auditable>} `session` must be provided for a
 * user-initiated action and not provided for a system-initiated action. `override` may be used to explicitly set
 * either or both of the Auditable properties based on business logic for a particular use case.
 */
export function createAuditRecord<T extends Auditable>(args: {
  record: Omit<T, 'updatedOn' | 'updatedBy'>;
  session?: CamsSession;
  override?: Partial<Auditable>;
}): T {
  return {
    updatedOn: new Date().toISOString(),
    updatedBy: args.session ? getCamsUserReference(args.session.user) : SYSTEM_USER_REFERENCE,
    ...args.record,
    ...args.override,
  } as T;
}
