import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import {
  Trustee,
  TrusteeInput,
  validateTrusteeCreationInput,
} from '../../../../common/src/cams/parties';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { getCamsError } from '../../common-errors/error-utilities';
import { getTrusteesRepository } from '../../factory';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    try {
      // Validate trustee creation input including address
      const validationErrors = validateTrusteeCreationInput(trustee);
      if (validationErrors.length > 0) {
        throw new Error(`Trustee validation failed: ${validationErrors.join(', ')}`);
      }

      // Prepare trustee for creation with audit fields
      const userReference = getCamsUserReference(context.session.user);
      const trusteeForCreation: TrusteeInput = {
        ...trustee,
        status: trustee.status || 'active',
        districts: trustee.districts || [],
        chapters: trustee.chapters || [],
      };

      // Create trustee in repository
      const createdTrustee = await this.trusteesRepository.createTrustee(
        trusteeForCreation,
        userReference,
      );

      return createdTrustee;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
