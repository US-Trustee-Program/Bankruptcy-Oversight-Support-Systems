import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import {
  Address,
  Trustee,
  TRUSTEE_STATUS_VALUES,
  TrusteeInput,
  TrusteeStatus,
} from '../../../../common/src/cams/parties';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { getCamsError } from '../../common-errors/error-utilities';
import { getTrusteesRepository, getValidator } from '../../factory';
import { BadRequestError } from '../../common-errors/bad-request';
import { Validator } from '../../../../common/src/cams/validation';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private readonly trusteesRepository: TrusteesRepository;
  private readonly validator: Validator;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
    this.validator = getValidator();
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    const validatorResult = this.validator.validateObject(trusteeSpec, trustee);

    // Validate trustee creation input including address
    if (!validatorResult.valid) {
      const validationErrors = this.validator.flatten(validatorResult.reasonMap || {});
      const collectedErrors = 'Trustee validation failed: ' + validationErrors.join('. ') + '.';
      throw new BadRequestError(MODULE_NAME, { message: collectedErrors });
    }

    try {
      // Prepare trustee for creation with audit fields
      const userReference = getCamsUserReference(context.session.user);
      const trusteeForCreation: TrusteeInput = {
        ...trustee,
        status: trustee.status,
        districts: trustee.districts || [],
        chapters: trustee.chapters || [],
      };

      return await this.trusteesRepository.createTrustee(trusteeForCreation, userReference);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async listTrustees(context: ApplicationContext): Promise<Trustee[]> {
    try {
      // Retrieve trustees list from repository
      const trustees = await this.trusteesRepository.listTrustees();

      context.logger.info(MODULE_NAME, `Retrieved ${trustees.length} trustees`);
      return trustees;
    } catch (originalError) {
      const errorMessage = `Failed to retrieve trustees list.`;
      context.logger.error(MODULE_NAME, errorMessage, originalError);
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getTrustee(context: ApplicationContext, id: string): Promise<Trustee> {
    try {
      // Retrieve individual trustee from repository
      const trustee = await this.trusteesRepository.read(id);

      context.logger.info(MODULE_NAME, `Retrieved trustee ${id}`);
      return trustee;
    } catch (originalError) {
      const errorMessage = `Failed to retrieve trustee with ID ${id}.`;
      context.logger.error(MODULE_NAME, errorMessage, originalError);
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
