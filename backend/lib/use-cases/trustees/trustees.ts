import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { getCamsError } from '../../common-errors/error-utilities';
import { getTrusteesRepository } from '../../factory';
import { ValidationSpec, validateObject, flatten } from '../../../../common/src/cams/validation';
import V from '../../../../common/src/cams/validators';
import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  ZIP_REGEX,
} from '../../../../common/src/cams/regex';
import { BadRequestError } from '../../common-errors/bad-request';
import { Address, ContactInformation, PhoneNumber } from '../../../../common/src/cams/contact';
import { LegacyAddress } from '../../../../common/src/cams/parties';
import {
  Trustee,
  TRUSTEE_STATUS_VALUES,
  TrusteeInput,
  TrusteeStatus,
} from '../../../../common/src/cams/trustees';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    const validatorResult = validateObject(trusteeSpec, trustee);

    // Validate trustee creation input including address
    if (!validatorResult.valid) {
      const validationErrors = flatten(validatorResult.reasonMap || {});
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

const addressSpec: ValidationSpec<Address> = {
  address1: [V.minLength(1)],
  address2: [V.optional(V.maxLength(50))],
  address3: [V.optional(V.maxLength(50))],
  city: [V.minLength(1)],
  state: [V.exactLength(2)],
  zipCode: [V.matches(ZIP_REGEX, 'Must be valid zip code')],
  countryCode: [V.exactLength(2)],
};

const phoneSpec: ValidationSpec<PhoneNumber> = {
  number: [V.matches(PHONE_REGEX, 'Provided phone number does not match regular expression')],
  extension: [
    V.optional(V.matches(EXTENSION_REGEX, 'Provided extension does not match regular expression')),
  ],
};

const contactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.spec(addressSpec)],
  phone: [V.optional(V.spec(phoneSpec))],
  email: [V.optional(V.matches(EMAIL_REGEX, 'Provided email does not match regular expression'))],
};

const legacyAddressSpec: ValidationSpec<LegacyAddress> = {
  address1: [V.optional(V.minLength(1))],
  address2: [V.optional(V.maxLength(50))],
  address3: [V.optional(V.maxLength(50))],
  cityStateZipCountry: [V.optional(V.minLength(1))],
};

const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: [V.minLength(1)],
  legacy: [V.optional(V.spec(legacyAddressSpec))],
  public: [V.optional(V.spec(contactInformationSpec))],
  private: [V.optional(V.spec(contactInformationSpec))],
  status: [V.isInSet<TrusteeStatus>([...TRUSTEE_STATUS_VALUES])],
};

// TODO: Add these sets to validators.
// export function isValidChapterType(chapter: string): chapter is ChapterType {
//   return ['7', '7-panel', '7-non-panel', '11', '11-subchapter-v', '12', '13'].includes(chapter);
// }
//
// export function isValidTrusteeStatus(status: string): status is TrusteeStatus {
//   return ['active', 'not active', 'suspended'].includes(status);
// }
//
// Districts array!!

// TODO: AND TESTS
// describe('ChapterType validation', () => {
//   test('should validate correct chapter types', () => {
//     expect(isValidChapterType('7')).toBe(true);
//     expect(isValidChapterType('7-panel')).toBe(true);
//     expect(isValidChapterType('7-non-panel')).toBe(true);
//     expect(isValidChapterType('11')).toBe(true);
//     expect(isValidChapterType('11-subchapter-v')).toBe(true);
//     expect(isValidChapterType('12')).toBe(true);
//     expect(isValidChapterType('13')).toBe(true);
//   });
//
//   test('should reject invalid chapter types', () => {
//     expect(isValidChapterType('8')).toBe(false);
//     expect(isValidChapterType('14')).toBe(false);
//     expect(isValidChapterType('invalid')).toBe(false);
//     expect(isValidChapterType('')).toBe(false);
//   });
// });
//
// describe('TrusteeStatus validation', () => {
//   test('should validate correct trustee status values', () => {
//     expect(isValidTrusteeStatus('active')).toBe(true);
//     expect(isValidTrusteeStatus('not active')).toBe(true);
//     expect(isValidTrusteeStatus('suspended')).toBe(true);
//   });
//
//   test('should reject invalid trustee status values', () => {
//     expect(isValidTrusteeStatus('pending')).toBe(false);
//     expect(isValidTrusteeStatus('inactive')).toBe(false);
//     expect(isValidTrusteeStatus('')).toBe(false);
//     expect(isValidTrusteeStatus('ACTIVE')).toBe(false);
//   });
// });
