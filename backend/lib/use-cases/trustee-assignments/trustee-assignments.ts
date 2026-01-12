import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { TrusteeOversightAssignment, TrusteeOversightHistory } from '@common/cams/trustees';
import { CamsRole, OversightRoles, OversightRoleType } from '@common/cams/roles';
import { getTrusteesRepository, getUserGroupGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsUserReference } from '@common/cams/session';
import { createAuditRecord } from '@common/cams/auditable';
import Validators from '@common/cams/validators';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';

const MODULE_NAME = 'TRUSTEE-ASSIGNMENTS-USE-CASE';

/**
 * Use case for managing trustee oversight assignments.
 * Provides business logic for viewing and creating oversight staff assignments to trustees.
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
   * Assigns oversight staff to oversee a trustee. Enforces business rule of one staff member per role per trustee.
   * Handles idempotent requests by returning false if same staff member with same role is already assigned.
   * @param context - Application context containing logger and session
   * @param trusteeId - Unique identifier for the trustee
   * @param staffUserId - Unique identifier for the oversight staff member to assign
   * @param role - The oversight role (attorney or auditor) for the assignment
   * @returns Promise resolving to boolean - true if created/replaced, false if idempotent
   * @throws BadRequestError if validation fails or business rules are violated
   * @throws UnauthorizedError if user lacks TrusteeAdmin role
   * @throws CamsError if assignment creation fails
   */
  async assignOversightStaffToTrustee(
    context: ApplicationContext,
    trusteeId: string,
    staffUserId: string,
    role: OversightRoleType,
  ): Promise<boolean> {
    if (!context.session.user.roles.includes(CamsRole.TrusteeAdmin)) {
      throw new UnauthorizedError(
        'You do not have permission to assign oversight staff to oversee a trustee.',
      );
    }

    if (!Validators.minLength(1)(trusteeId.trim()).valid) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required and cannot be empty.',
      });
    }

    if (!Validators.minLength(1)(staffUserId.trim()).valid) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Staff user ID is required and cannot be empty.',
      });
    }

    if (!OversightRoles.includes(role)) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Role must be a valid oversight role. Received: ${role}`,
      });
    }

    try {
      const existingAssignments =
        await this.trusteesRepository.getTrusteeOversightAssignments(trusteeId);

      const existingRoleAssignment = existingAssignments.find(
        (assignment) => assignment.role === role,
      );

      if (existingRoleAssignment) {
        if (existingRoleAssignment.user.id === staffUserId) {
          return false;
        }
        const trusteeManager = getCamsUserReference(context.session.user);

        const before = {
          user: existingRoleAssignment.user,
          role: existingRoleAssignment.role,
        };

        const timestamp = new Date().toISOString();
        const unassignedUpdate: Partial<TrusteeOversightAssignment> = {
          unassignedOn: timestamp,
          updatedOn: timestamp,
          updatedBy: trusteeManager,
        };

        await this.trusteesRepository.updateTrusteeOversightAssignment(
          existingRoleAssignment.id,
          unassignedUpdate,
        );

        const userGroupGateway = await getUserGroupGateway(context);
        const assigneeUser = await userGroupGateway.getUserById(context, staffUserId);

        const userAndRole = {
          user: getCamsUserReference(assigneeUser),
          role,
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
      const assigneeUser = await userGroupGateway.getUserById(context, staffUserId);

      const trusteeManager = getCamsUserReference(context.session.user);
      const userAndRole = {
        user: getCamsUserReference(assigneeUser),
        role,
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
