import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import {
  TrusteeOversightAssignment,
  TrusteeOversightHistory,
} from '../../../../common/src/cams/trustees';
import { CamsRole, OversightRole } from '../../../../common/src/cams/roles';
import { getTrusteesRepository, getUserGroupGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { createAuditRecord } from '../../../../common/src/cams/auditable';
import Validators from '../../../../common/src/cams/validators';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';

const MODULE_NAME = 'TRUSTEE-ASSIGNMENTS-USE-CASE';

/**
 * Use case for managing trustee oversight assignments.
 * Provides business logic for viewing and creating attorney-to-trustee assignments.
 */
export class TrusteeAssignmentsUseCase {
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
  }

  /**
   * Retrieves all oversight assignments for a specific trustee.
   * @param context - Application context containing logger and session
   * @param trusteeId - Unique identifier for the trustee
   * @returns Promise resolving to array of trustee oversight assignments
   * @throws CamsError if retrieval fails
   */
  async getTrusteeOversightAssignments(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<TrusteeOversightAssignment[]> {
    if (!trusteeId?.trim()) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required and cannot be empty.',
      });
    }

    try {
      const assignments = await this.trusteesRepository.getTrusteeOversightAssignments(trusteeId);

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${assignments.length} oversight assignments for trustee ${trusteeId}`,
      );

      return assignments;
    } catch (originalError) {
      if (originalError instanceof BadRequestError) {
        throw originalError;
      }

      const errorMessage = `Failed to retrieve oversight assignments for trustee ${trusteeId}.`;
      context.logger.error(MODULE_NAME, errorMessage, originalError);
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /**
   * Assigns an attorney to oversee a trustee. Enforces business rule of one attorney per trustee.
   * Handles idempotent requests by returning false if same attorney is already assigned.
   * @param context - Application context containing logger and session
   * @param trusteeId - Unique identifier for the trustee
   * @param attorneyUserId - Unique identifier for the attorney to assign
   * @returns Promise resolving to boolean - true if created/replaced, false if idempotent
   * @throws BadRequestError if validation fails or business rules are violated
   * @throws CamsError if assignment creation fails
   */
  async assignAttorneyToTrustee(
    context: ApplicationContext,
    trusteeId: string,
    attorneyUserId: string,
  ): Promise<boolean> {
    if (!context.session.user.roles.includes(CamsRole.TrusteeAdmin)) {
      throw new UnauthorizedError(
        'You do not have permission to assign an attorney to oversee a trustee.',
      );
    }

    if (!Validators.minLength(1)(trusteeId.trim()).valid) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required and cannot be empty.',
      });
    }

    if (!Validators.minLength(1)(attorneyUserId.trim()).valid) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Attorney user ID is required and cannot be empty.',
      });
    }

    try {
      const existingAssignments =
        await this.trusteesRepository.getTrusteeOversightAssignments(trusteeId);

      const existingAttorneyAssignment = existingAssignments.find(
        (assignment) => assignment.role === OversightRole.OversightAttorney,
      );

      if (existingAttorneyAssignment) {
        if (existingAttorneyAssignment.user.id === attorneyUserId) {
          return false;
        }
        const trusteeManager = getCamsUserReference(context.session.user);

        const before = {
          user: existingAttorneyAssignment.user,
          role: existingAttorneyAssignment.role,
        };

        const timestamp = new Date().toISOString();
        const unassignedUpdate: Partial<TrusteeOversightAssignment> = {
          unassignedOn: timestamp,
          updatedOn: timestamp,
          updatedBy: trusteeManager,
        };

        await this.trusteesRepository.updateTrusteeOversightAssignment(
          existingAttorneyAssignment.id,
          unassignedUpdate,
        );

        const userGroupGateway = await getUserGroupGateway(context);
        const assigneeUser = await userGroupGateway.getUserById(context, attorneyUserId);

        const userAndRole = {
          user: getCamsUserReference(assigneeUser),
          role: OversightRole.OversightAttorney,
        };

        await this.trusteesRepository.createTrusteeOversightAssignment(
          createAuditRecord<TrusteeOversightAssignment>(
            {
              trusteeId,
              ...userAndRole,
            },
            trusteeManager,
          ),
        );

        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord<TrusteeOversightHistory>(
            {
              documentType: 'AUDIT_OVERSIGHT' as const,
              trusteeId,
              before,
              after: userAndRole,
            },
            trusteeManager,
          ),
        );

        return true;
      }

      const userGroupGateway = await getUserGroupGateway(context);
      const assigneeUser = await userGroupGateway.getUserById(context, attorneyUserId);

      const trusteeManager = getCamsUserReference(context.session.user);
      const userAndRole = {
        user: getCamsUserReference(assigneeUser),
        role: OversightRole.OversightAttorney,
      };

      await this.trusteesRepository.createTrusteeOversightAssignment(
        createAuditRecord<TrusteeOversightAssignment>(
          {
            trusteeId,
            ...userAndRole,
          },
          trusteeManager,
        ),
      );

      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord<TrusteeOversightHistory>(
          {
            documentType: 'AUDIT_OVERSIGHT' as const,
            trusteeId,
            before: null,
            after: userAndRole,
          },
          trusteeManager,
        ),
      );

      return true;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /**
   * Assigns an auditor to a trustee. Note: Auditors are staff assignments, not oversight in the traditional sense.
   * @param context - Application context containing session and other request metadata
   * @param trusteeId - Unique identifier for the trustee
   * @param auditorUserId - Unique identifier for the auditor to assign
   * @returns Promise resolving to boolean - true if created/replaced, false if idempotent
   */
  async assignAuditorToTrustee(
    context: ApplicationContext,
    trusteeId: string,
    auditorUserId: string,
  ): Promise<boolean> {
    if (!context.session.user.roles.includes(CamsRole.TrusteeAdmin)) {
      throw new UnauthorizedError('You do not have permission to assign an auditor to a trustee.');
    }

    if (!Validators.minLength(1)(trusteeId.trim()).valid) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required and cannot be empty.',
      });
    }

    if (!Validators.minLength(1)(auditorUserId.trim()).valid) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Auditor user ID is required and cannot be empty.',
      });
    }

    try {
      const existingAssignments =
        await this.trusteesRepository.getTrusteeOversightAssignments(trusteeId);

      const existingAuditorAssignment = existingAssignments.find(
        (assignment) => assignment.role === OversightRole.OversightAuditor,
      );

      if (existingAuditorAssignment) {
        if (existingAuditorAssignment.user.id === auditorUserId) {
          return false;
        }
        const trusteeManager = getCamsUserReference(context.session.user);

        const before = {
          user: existingAuditorAssignment.user,
          role: existingAuditorAssignment.role,
        };

        const timestamp = new Date().toISOString();
        const unassignedUpdate: Partial<TrusteeOversightAssignment> = {
          unassignedOn: timestamp,
          updatedOn: timestamp,
          updatedBy: trusteeManager,
        };

        await this.trusteesRepository.updateTrusteeOversightAssignment(
          existingAuditorAssignment.id,
          unassignedUpdate,
        );

        const userGroupGateway = await getUserGroupGateway(context);
        const assigneeUser = await userGroupGateway.getUserById(context, auditorUserId);

        const userAndRole = {
          user: getCamsUserReference(assigneeUser),
          role: OversightRole.OversightAuditor,
        };

        await this.trusteesRepository.createTrusteeOversightAssignment(
          createAuditRecord<TrusteeOversightAssignment>(
            {
              trusteeId,
              ...userAndRole,
            },
            trusteeManager,
          ),
        );

        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord<TrusteeOversightHistory>(
            {
              documentType: 'AUDIT_OVERSIGHT' as const,
              trusteeId,
              before,
              after: userAndRole,
            },
            trusteeManager,
          ),
        );

        return true;
      }

      const userGroupGateway = await getUserGroupGateway(context);
      const assigneeUser = await userGroupGateway.getUserById(context, auditorUserId);

      const trusteeManager = getCamsUserReference(context.session.user);
      const userAndRole = {
        user: getCamsUserReference(assigneeUser),
        role: OversightRole.OversightAuditor,
      };

      await this.trusteesRepository.createTrusteeOversightAssignment(
        createAuditRecord<TrusteeOversightAssignment>(
          {
            trusteeId,
            ...userAndRole,
          },
          trusteeManager,
        ),
      );

      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord<TrusteeOversightHistory>(
          {
            documentType: 'AUDIT_OVERSIGHT' as const,
            trusteeId,
            before: null,
            after: userAndRole,
          },
          trusteeManager,
        ),
      );

      return true;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
