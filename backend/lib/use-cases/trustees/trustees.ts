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
import V, { ValidationSpec, ValidatorResult } from '../../../../common/src/cams/validation';
import { ZIP_REGEX } from '../../../../common/src/cams/regex';
import { Address } from '../../../../common/src/cams/parties';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    // TODO: Use the new validation
    const _newValidatorResult = V.validateObject<TrusteeInput>(trusteeSpec, trustee);

    // Validate trustee creation input including address
    const validationErrors = validateTrusteeCreationInput(trustee);
    if (validationErrors.length > 0) {
      throw getCamsError(
        new Error(`Trustee validation failed: ${validationErrors.join(', ')}`),
        MODULE_NAME,
      );
    }

    try {
      // Prepare trustee for creation with audit fields
      const userReference = getCamsUserReference(context.session.user);
      const trusteeForCreation: TrusteeInput = {
        ...trustee,
        status: trustee.status || 'active',
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

const addressSpec: ValidationSpec<Address> = {
  address1: [V.isString, V.minLength(1)],
  address2: [V.maxLength(50)],
  address3: [V.maxLength(50)],
  city: [V.isString, V.minLength(1)],
  state: [V.isString, V.fixedLength(2)],
  zipCode: [V.isString, V.matches(ZIP_REGEX)],
  countryCode: [V.isString, V.fixedLength(2)],
};

const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: [V.isString, V.minLength(1)],
  address: [
    (value: unknown): ValidatorResult => {
      const resultSet = V.validateObject<Address>(addressSpec, value as Address);
      if (resultSet.valid) {
        return V.validResult;
      } else {
        return {
          valid: false,
          reasons: ['this is temp. we need to support returning result SETs'],
        };
      }
    },
  ],
  address1: [V.notSet],
  address2: [V.notSet],
  address3: [V.notSet],
  cityStateZipCountry: [V.notSet],
};
