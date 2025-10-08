import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { TrusteeOversightAssignment } from '../../../../common/src/cams/trustees';
import { OversightRole } from '../../../../common/src/cams/roles';
import { getTrusteesRepository, getUserGroupGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'TRUSTEE-ASSIGNMENTS-USE-CASE';

// Constants
const ATTORNEY_ASSIGNMENT_LIMIT = 1;

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
    // Input validation
    if (!trusteeId?.trim()) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Trustee ID is required and cannot be empty.',
      });
    }

    if (!attorneyUserId?.trim()) {
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
        (assignment) => assignment.role === OversightRole.TrialAttorney,
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
          message: `Trustee ${trusteeId} already has an attorney assigned. Only ${ATTORNEY_ASSIGNMENT_LIMIT} attorney per trustee is allowed.`,
        });
      }

      const userGroupGateway = await getUserGroupGateway(context);
      const user = await userGroupGateway.getUserById(context, attorneyUserId);

      // Create new assignment
      const assignmentInput = {
        trusteeId,
        user,
        role: OversightRole.TrialAttorney,
      };

      const newAssignment =
        await this.trusteesRepository.createTrusteeOversightAssignment(assignmentInput);

      // Create audit trail for the new assignment
      await this.createAssignmentAuditTrail(context, trusteeId, newAssignment, 'CREATED');

      context.logger.info(
        MODULE_NAME,
        `Created attorney assignment for trustee ${trusteeId} with user ${attorneyUserId}`,
      );

      return newAssignment;
    } catch (originalError) {
      if (originalError instanceof BadRequestError) {
        throw originalError;
      }

      const errorMessage = `Failed to assign attorney ${attorneyUserId} to trustee ${trusteeId}.`;
      context.logger.error(MODULE_NAME, errorMessage, originalError);
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /**
   * Creates an audit trail entry for trustee oversight assignment operations
   * @param context - Application context containing logger and session
   * @param trusteeId - Unique identifier for the trustee
   * @param assignment - The assignment that was created, updated, or removed
   * @param action - The action performed on the assignment (CREATED, UPDATED, REMOVED)
   * @private
   */
  private async createAssignmentAuditTrail(
    context: ApplicationContext,
    trusteeId: string,
    assignment: TrusteeOversightAssignment,
    action: 'CREATED' | 'UPDATED' | 'REMOVED',
  ): Promise<void> {
    try {
      // Use the assignment role to determine assignmentType, defaulting to ATTORNEY since that's all we support now
      const assignmentType = 'ATTORNEY';

      const auditRecord = {
        trusteeId,
        documentType: 'AUDIT_OVERSIGHT_ASSIGNMENT' as const,
        assignmentType,
        before: action === 'CREATED' ? null : assignment,
        after: action === 'REMOVED' ? null : assignment,
        // Add required audit properties
        updatedBy: context.session?.user || { id: 'system', name: 'system' },
        updatedOn: new Date().toISOString(),
      };

      await this.trusteesRepository.createTrusteeHistory(auditRecord);

      context.logger.info(
        MODULE_NAME,
        `Created audit trail for ${action} assignment ${assignment.id} for trustee ${trusteeId}`,
      );
    } catch (error) {
      context.logger.error(
        MODULE_NAME,
        `Failed to create audit trail for assignment ${assignment.id}`,
        error,
      );
      // Don't throw - audit failure shouldn't break assignment operation
    }
  }
}
