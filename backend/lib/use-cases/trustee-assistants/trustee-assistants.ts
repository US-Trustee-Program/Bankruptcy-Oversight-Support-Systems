import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssistantsRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { TrusteeAssistant, TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { validateObject, flatten, ValidatorResult } from '@common/cams/validation';
import { assistantInputSpec } from '@common/cams/trustees-validators';
import { createAuditRecord, Auditable } from '@common/cams/auditable';
import { BadRequestError } from '../../common-errors/bad-request';
import { TrusteeAssistantHistory } from '@common/cams/trustees';

const MODULE_NAME = 'TRUSTEE-ASSISTANTS-USE-CASE';

export class TrusteeAssistantsUseCase {
  private readonly trusteeAssistantsRepository: TrusteeAssistantsRepository;
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteeAssistantsRepository = factory.getTrusteeAssistantsRepository(context);
    this.trusteesRepository = factory.getTrusteesRepository(context);
  }

  private checkValidation(validatorResult: ValidatorResult) {
    if (!validatorResult.valid) {
      const validationErrors = flatten(validatorResult.reasonMap || {});
      const collectedErrors = 'Assistant validation failed: ' + validationErrors.join('. ') + '.';
      throw new BadRequestError(MODULE_NAME, { message: collectedErrors });
    }
  }

  async getTrusteeAssistants(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<TrusteeAssistant[]> {
    try {
      // Verify trustee exists
      await this.trusteesRepository.read(trusteeId);

      // Retrieve assistants for this trustee
      const assistants = await this.trusteeAssistantsRepository.getTrusteeAssistants(trusteeId);

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${assistants.length} assistants for trustee ${trusteeId}`,
      );
      return assistants;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve assistants for trustee with ID ${trusteeId}.`,
        },
      });
    }
  }

  async getAssistant(
    context: ApplicationContext,
    trusteeId: string,
    assistantId: string,
  ): Promise<TrusteeAssistant> {
    try {
      const assistant = await this.trusteeAssistantsRepository.read(trusteeId, assistantId);

      context.logger.info(MODULE_NAME, `Retrieved assistant ${assistantId}`);
      return assistant;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve assistant with ID ${assistantId}.`,
        },
      });
    }
  }

  async createAssistant(
    context: ApplicationContext,
    trusteeId: string,
    input: TrusteeAssistantInput,
  ): Promise<TrusteeAssistant> {
    try {
      // Validate input
      this.checkValidation(validateObject(assistantInputSpec, input));

      // Verify trustee exists
      await this.trusteesRepository.read(trusteeId);

      // Create assistant
      const assistant = await this.trusteeAssistantsRepository.createAssistant(
        trusteeId,
        input,
        context.session.user,
      );

      // Create audit history
      const historyRecord: Omit<TrusteeAssistantHistory, keyof Auditable | 'id'> = {
        documentType: 'AUDIT_ASSISTANT',
        trusteeId,
        assistantId: assistant.id,
        before: undefined,
        after: assistant,
      };
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(historyRecord, context.session.user),
      );

      context.logger.info(
        MODULE_NAME,
        `Created assistant ${assistant.id} for trustee ${trusteeId}`,
      );
      return assistant;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to create assistant for trustee with ID ${trusteeId}.`,
        },
      });
    }
  }

  async updateAssistant(
    context: ApplicationContext,
    trusteeId: string,
    assistantId: string,
    input: TrusteeAssistantInput,
  ): Promise<TrusteeAssistant> {
    try {
      // Validate input
      this.checkValidation(validateObject(assistantInputSpec, input));

      // Verify trustee exists
      await this.trusteesRepository.read(trusteeId);

      // Get existing assistant for audit history
      const existingAssistant = await this.trusteeAssistantsRepository.read(trusteeId, assistantId);

      // Update assistant
      const updatedAssistant = await this.trusteeAssistantsRepository.updateAssistant(
        trusteeId,
        assistantId,
        input,
        context.session.user,
      );

      // Create audit history
      const historyRecord: Omit<TrusteeAssistantHistory, keyof Auditable | 'id'> = {
        documentType: 'AUDIT_ASSISTANT',
        trusteeId,
        assistantId: assistantId,
        before: existingAssistant,
        after: updatedAssistant,
      };
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(historyRecord, context.session.user),
      );

      context.logger.info(MODULE_NAME, `Updated assistant ${assistantId} for trustee ${trusteeId}`);
      return updatedAssistant;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update assistant with ID ${assistantId} for trustee ${trusteeId}.`,
        },
      });
    }
  }

  async deleteAssistant(
    context: ApplicationContext,
    trusteeId: string,
    assistantId: string,
  ): Promise<void> {
    try {
      await this.trusteesRepository.read(trusteeId);
      const existingAssistant = await this.trusteeAssistantsRepository.read(trusteeId, assistantId);
      await this.trusteeAssistantsRepository.deleteAssistant(trusteeId, assistantId);

      const historyRecord: Omit<TrusteeAssistantHistory, keyof Auditable | 'id'> = {
        documentType: 'AUDIT_ASSISTANT',
        trusteeId,
        assistantId,
        before: existingAssistant,
        after: undefined,
      };
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(historyRecord, context.session.user),
      );

      context.logger.info(MODULE_NAME, `Deleted assistant ${assistantId} for trustee ${trusteeId}`);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to delete assistant with ID ${assistantId} for trustee ${trusteeId}.`,
        },
      });
    }
  }
}
