import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeStaffRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { TrusteeStaff, TrusteeStaffInput } from '@common/cams/trustee-staff';
import { validateObject, flatten, ValidatorResult } from '@common/cams/validation';
import { staffInputSpec } from '@common/cams/trustees-validators';
import { createAuditRecord, Auditable } from '@common/cams/auditable';
import { BadRequestError } from '../../common-errors/bad-request';
import { TrusteeStaffHistory } from '@common/cams/trustees';
import { getCamsUserReference } from '@common/cams/session';

const MODULE_NAME = 'TRUSTEE-STAFF-USE-CASE';

export class TrusteeStaffUseCase {
  private readonly trusteeStaffRepository: TrusteeStaffRepository;
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteeStaffRepository = factory.getTrusteeStaffRepository(context);
    this.trusteesRepository = factory.getTrusteesRepository(context);
  }

  private checkValidation(validatorResult: ValidatorResult) {
    if (!validatorResult.valid) {
      const validationErrors = flatten(validatorResult.reasonMap || {});
      const collectedErrors = 'Staff validation failed: ' + validationErrors.join('. ') + '.';
      throw new BadRequestError(MODULE_NAME, { message: collectedErrors });
    }
  }

  async getTrusteeStaff(context: ApplicationContext, trusteeId: string): Promise<TrusteeStaff[]> {
    try {
      // Verify trustee exists
      await this.trusteesRepository.read(trusteeId);

      // Retrieve staff for this trustee
      const staff = await this.trusteeStaffRepository.getTrusteeStaff(trusteeId);

      context.logger.info(MODULE_NAME, `Retrieved ${staff.length} staff for trustee ${trusteeId}`);
      return staff;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve staff for trustee with ID ${trusteeId}.`,
        },
      });
    }
  }

  async getStaffMember(
    context: ApplicationContext,
    trusteeId: string,
    staffId: string,
  ): Promise<TrusteeStaff> {
    try {
      const staffMember = await this.trusteeStaffRepository.readStaffMember(trusteeId, staffId);

      context.logger.info(MODULE_NAME, `Retrieved staff member ${staffId}`);
      return staffMember;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve staff member with ID ${staffId}.`,
        },
      });
    }
  }

  async createStaffMember(
    context: ApplicationContext,
    trusteeId: string,
    input: TrusteeStaffInput,
  ): Promise<TrusteeStaff> {
    try {
      // Validate input
      this.checkValidation(validateObject(staffInputSpec, input));

      // Verify trustee exists
      await this.trusteesRepository.read(trusteeId);

      const userReference = getCamsUserReference(context.session.user);

      // Create staff member
      const staffMember = await this.trusteeStaffRepository.createStaffMember(
        trusteeId,
        input,
        userReference,
      );

      // Create audit history
      const historyRecord: Omit<TrusteeStaffHistory, keyof Auditable | 'id'> = {
        documentType: 'AUDIT_STAFF',
        trusteeId,
        staffId: staffMember.id,
        before: undefined,
        after: staffMember,
      };
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(historyRecord, userReference),
      );

      context.logger.info(
        MODULE_NAME,
        `Created staff member ${staffMember.id} for trustee ${trusteeId}`,
      );
      return staffMember;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to create staff member for trustee with ID ${trusteeId}.`,
        },
      });
    }
  }

  async updateStaffMember(
    context: ApplicationContext,
    trusteeId: string,
    staffId: string,
    input: TrusteeStaffInput,
  ): Promise<TrusteeStaff> {
    try {
      // Validate input
      this.checkValidation(validateObject(staffInputSpec, input));

      // Verify trustee exists
      await this.trusteesRepository.read(trusteeId);

      const userReference = getCamsUserReference(context.session.user);

      // Get existing staff member for audit history
      const existingStaffMember = await this.trusteeStaffRepository.readStaffMember(
        trusteeId,
        staffId,
      );

      // Update staff member
      const updatedStaffMember = await this.trusteeStaffRepository.updateStaffMember(
        trusteeId,
        staffId,
        input,
        userReference,
      );

      // Create audit history
      const historyRecord: Omit<TrusteeStaffHistory, keyof Auditable | 'id'> = {
        documentType: 'AUDIT_STAFF',
        trusteeId,
        staffId: staffId,
        before: existingStaffMember,
        after: updatedStaffMember,
      };
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(historyRecord, userReference),
      );

      context.logger.info(MODULE_NAME, `Updated staff member ${staffId} for trustee ${trusteeId}`);
      return updatedStaffMember;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update staff member with ID ${staffId} for trustee ${trusteeId}.`,
        },
      });
    }
  }

  async deleteStaffMember(
    context: ApplicationContext,
    trusteeId: string,
    staffId: string,
  ): Promise<void> {
    try {
      await this.trusteesRepository.read(trusteeId);
      const userReference = getCamsUserReference(context.session.user);
      const existingStaffMember = await this.trusteeStaffRepository.readStaffMember(
        trusteeId,
        staffId,
      );
      await this.trusteeStaffRepository.deleteStaffMember(trusteeId, staffId);

      const historyRecord: Omit<TrusteeStaffHistory, keyof Auditable | 'id'> = {
        documentType: 'AUDIT_STAFF',
        trusteeId,
        staffId,
        before: existingStaffMember,
        after: undefined,
      };
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(historyRecord, userReference),
      );

      context.logger.info(MODULE_NAME, `Deleted staff member ${staffId} for trustee ${trusteeId}`);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to delete staff member with ID ${staffId} for trustee ${trusteeId}.`,
        },
      });
    }
  }
}
