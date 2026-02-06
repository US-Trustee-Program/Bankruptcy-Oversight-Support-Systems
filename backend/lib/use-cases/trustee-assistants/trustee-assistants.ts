import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssistantsRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { TrusteeAssistant } from '@common/cams/trustee-assistants';

const MODULE_NAME = 'TRUSTEE-ASSISTANTS-USE-CASE';

export class TrusteeAssistantsUseCase {
  private readonly trusteeAssistantsRepository: TrusteeAssistantsRepository;
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteeAssistantsRepository = factory.getTrusteeAssistantsRepository(context);
    this.trusteesRepository = factory.getTrusteesRepository(context);
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
}
