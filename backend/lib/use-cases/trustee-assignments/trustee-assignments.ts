import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import {
  TrusteeOversightAssignment,
  TrusteeOversightHistory,
} from '../../../../common/src/cams/trustees';
import { OversightRole } from '../../../../common/src/cams/roles';
import { getTrusteesRepository, getUserGroupGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { createAuditRecord } from '../../../../common/src/cams/auditable';
import Validators from '../../../../common/src/cams/validators';

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
   * Handles idempotent requests by returning existing assignment if same attorney is already assigned.
   * @param context - Application context containing logger and session
   * @param trusteeId - Unique identifier for the trustee
   * @param attorneyUserId - Unique identifier for the attorney to assign
   * @returns Promise resolving to the trustee oversight assignment
   * @throws BadRequestError if validation fails or business rules are violated
   * @throws CamsError if assignment creation fails
   */
  async assignAttorneyToTrustee(
    context: ApplicationContext,
    trusteeId: string,
    attorneyUserId: string,
  ): Promise<TrusteeOversightAssignment> {
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
      // Check for existing attorney assignments
      const existingAssignments =
        await this.trusteesRepository.getTrusteeOversightAssignments(trusteeId);

      // Check for existing attorney assignment
      const existingAttorneyAssignment = existingAssignments.find(
        (assignment) => assignment.role === OversightRole.OversightAttorney,
      );

      if (existingAttorneyAssignment) {
        // Handle idempotent request - return existing assignment if same attorney
        if (existingAttorneyAssignment.user.id === attorneyUserId) {
          context.logger.info(
            MODULE_NAME,
            `Attorney ${attorneyUserId} already assigned to trustee ${trusteeId}`,
          );
          return existingAttorneyAssignment;
        }

        // Prevent duplicate attorney assignments (business rule: max ${ATTORNEY_ASSIGNMENT_LIMIT} attorney per trustee)
        throw new BadRequestError(MODULE_NAME, {
          message: `Trustee ${trusteeId} already has an attorney assigned.`,
        });
      }

      const userGroupGateway = await getUserGroupGateway(context);
      const assigneeUser = await userGroupGateway.getUserById(context, attorneyUserId);

      const trusteeManager = getCamsUserReference(context.session.user);
      const userAndRole = {
        user: getCamsUserReference(assigneeUser),
        role: OversightRole.OversightAttorney,
      };

      const createdAssignment = await this.trusteesRepository.createTrusteeOversightAssignment(
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

      return createdAssignment;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
