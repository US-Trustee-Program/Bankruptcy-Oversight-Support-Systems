import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { Trustee, TRUSTEE_STATUS_VALUES, TrusteeInput } from '../../../../common/src/cams/parties';
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
    const errors = V.validateObject(trusteeSpec, trustee as unknown as Record<string, unknown>);

    // Validate trustee creation input
    if (V.hasErrors(errors)) {
      const errorMessages = V.getErrors(errors);
      const collectedErrors = 'Trustee validation failed: ' + errorMessages.join(', ');
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

const trusteeSpec: ValidationSpec = {
  name: [V.isString(), V.required()],
  email: [V.matches(EMAIL_REGEX, 'Provided email does not match regular expression')],
  phone: [V.matches(PHONE_REGEX, 'Provided phone number does not match regular expression')],
  extension: [
    V.optional(V.matches(EXTENSION_REGEX, 'Provided extension does not match regular expression')),
  ],
  status: [V.oneOf([...TRUSTEE_STATUS_VALUES])],

  // Legacy address fields - these should be empty when using structured address
  address1: [V.optional(V.isString())],
  address2: [V.optional(V.isString())],
  address3: [V.optional(V.isString())],
  cityStateZipCountry: [V.optional(V.isString())],

  // Structured address - optional but if provided should be valid
  address: [
    V.optional((value: unknown) => {
      if (!value || typeof value !== 'object') {
        return { valid: false, error: 'Address must be a valid object if provided' };
      }

      const addr = value as Record<string, unknown>;

      // Validate required address fields
      if (!addr.address1 || typeof addr.address1 !== 'string') {
        return { valid: false, error: 'Address line 1 is required' };
      }

      if (!addr.city || typeof addr.city !== 'string') {
        return { valid: false, error: 'City is required' };
      }

      if (!addr.state || typeof addr.state !== 'string' || addr.state.length !== 2) {
        return { valid: false, error: 'State must be a 2-character code' };
      }

      if (!addr.zipCode || typeof addr.zipCode !== 'string' || !ZIP_REGEX.test(addr.zipCode)) {
        return { valid: false, error: 'ZIP code must be valid (5 digits or 5+4 format)' };
      }

      return V.VALID;
    }),
  ],
};
