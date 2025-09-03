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
import { getTrusteesRepository } from '../../factory';
import V, { ValidationSpec } from '../../../../common/src/cams/validation';
import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  ZIP_REGEX,
} from '../../../../common/src/cams/regex';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    const validatorResult = V.validateObject<TrusteeInput>(trusteeSpec, trustee);

    // Validate trustee creation input including address
    if (validatorResult.valid === false) {
      const validationErrors: string[] = [];
      for (const field in validatorResult.reasonsMap) {
        if (!validatorResult.reasonsMap[field].valid) {
          validationErrors.push(
            `${field}: ${validatorResult.reasonsMap[field].reasons.join(', ')}.`,
          );
        }
      }
      const collectedErrors = 'Trustee validation failed: ' + validationErrors.join(', ');
      throw getCamsError(new Error(collectedErrors), MODULE_NAME);
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

const addressSpec: ValidationSpec<Address> = {
  address1: [V.isString, V.minLength(1)],
  address2: [V.optional(V.maxLength(50))],
  address3: [V.optional(V.maxLength(50))],
  city: [V.isString, V.minLength(1)],
  state: [V.isString, V.fixedLength(2)],
  zipCode: [V.isString, V.matches(ZIP_REGEX)],
  countryCode: [V.isString, V.fixedLength(2)],
};

// TODO: Add the rest of the fields
// const trusteeSpec: ValidationSpec<TrusteeInput> = {
//   name: [V.isString, V.minLength(1)],
//   address: addressSpec,
//   address1: [V.notSet],
//   address2: [V.notSet],
//   address3: [V.notSet],
//   cityStateZipCountry: [V.notSet],
//   email: [V.matches(EMAIL_REGEX, 'Provided email does not match regular expression')],
//   phone: [V.matches(PHONE_REGEX, 'Provided phone number does not match regular expression')],
//   extension: [
//     V.optional(V.matches(EXTENSION_REGEX, 'Provided extension does not match regular expression')),
//   ],
//   status: [V.isInSet<TrusteeStatus>([...TRUSTEE_STATUS_VALUES])],
// };

const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: [V.isString, V.minLength(1)],
  address: [V.optional(V.spec(addressSpec))],
  address1: [V.notSet],
  address2: [V.notSet],
  address3: [V.notSet],
  cityStateZipCountry: [V.notSet],
  email: [V.matches(EMAIL_REGEX, 'Provided email does not match regular expression')],
  phone: [V.matches(PHONE_REGEX, 'Provided phone number does not match regular expression')],
  extension: [
    V.optional(V.matches(EXTENSION_REGEX, 'Provided extension does not match regular expression')),
  ],
  status: [V.isInSet<TrusteeStatus>([...TRUSTEE_STATUS_VALUES])],
};
