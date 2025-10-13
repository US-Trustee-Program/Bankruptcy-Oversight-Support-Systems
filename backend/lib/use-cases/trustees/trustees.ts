import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { getCamsError } from '../../common-errors/error-utilities';
import { getTrusteesRepository } from '../../factory';
import {
  ValidationSpec,
  validateObject,
  flatten,
  ValidatorResult,
} from '../../../../common/src/cams/validation';
import V from '../../../../common/src/cams/validators';
import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_REGEX,
  ZIP_REGEX,
} from '../../../../common/src/cams/regex';
import { BadRequestError } from '../../common-errors/bad-request';
import { Address, ContactInformation, PhoneNumber } from '../../../../common/src/cams/contact';
import {
  Trustee,
  TRUSTEE_STATUS_VALUES,
  TrusteeHistory,
  TrusteeInput,
  TrusteeStatus,
} from '../../../../common/src/cams/trustees';
import { createAuditRecord } from '../../../../common/src/cams/auditable';
import { deepEqual } from '../../../../common/src/object-equality';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = getTrusteesRepository(context);
  }

  private checkValidation(validatorResult: ValidatorResult) {
    if (!validatorResult.valid) {
      const validationErrors = flatten(validatorResult.reasonMap || {});
      const collectedErrors = 'Trustee validation failed: ' + validationErrors.join('. ') + '.';
      throw new BadRequestError(MODULE_NAME, { message: collectedErrors });
    }
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    this.checkValidation(validateObject(trusteeSpec, trustee));

    try {
      // Prepare trustee for creation with audit fields
      const userReference = getCamsUserReference(context.session.user);
      const trusteeForCreation: TrusteeInput = {
        ...trustee,
        status: trustee.status,
        districts: trustee.districts || [],
        chapters: trustee.chapters || [],
      };

      const createdTrustee = await this.trusteesRepository.createTrustee(
        trusteeForCreation,
        userReference,
      );

      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          {
            documentType: 'AUDIT_NAME',
            trusteeId: createdTrustee.trusteeId,
            before: undefined,
            after: createdTrustee.name,
          },
          userReference,
        ),
      );

      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          {
            documentType: 'AUDIT_PUBLIC_CONTACT',
            trusteeId: createdTrustee.trusteeId,
            before: undefined,
            after: createdTrustee.public,
          },
          userReference,
        ),
      );

      return createdTrustee;
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

  async listTrusteeHistory(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<TrusteeHistory[]> {
    try {
      const history = await this.trusteesRepository.listTrusteeHistory(trusteeId);

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${history.length} trustee histories for trustee ${trusteeId}`,
      );
      return history;
    } catch (originalError) {
      const errorMessage = `Failed to retrieve trustees list.`;
      context.logger.error(MODULE_NAME, errorMessage, originalError);
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getTrustee(context: ApplicationContext, trusteeId: string): Promise<Trustee> {
    try {
      // Retrieve individual trustee from repository
      const trustee = await this.trusteesRepository.read(trusteeId);

      context.logger.info(MODULE_NAME, `Retrieved trustee ${trusteeId}`);
      return trustee;
    } catch (originalError) {
      const errorMessage = `Failed to retrieve trustee with ID ${trusteeId}.`;
      context.logger.error(MODULE_NAME, errorMessage, originalError);
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async updateTrustee(
    context: ApplicationContext,
    trusteeId: string,
    trustee: Partial<TrusteeInput>,
  ): Promise<Trustee> {
    try {
      const existingTrustee = await this.trusteesRepository.read(trusteeId);

      const userReference = getCamsUserReference(context.session.user);

      const patchedTrustee = patchTrustee(existingTrustee, trustee, [
        'trusteeId',
        'id',
        'createdBy',
        'createdOn',
        'updatedBy',
        'updatedOn',
      ]);
      this.checkValidation(validateObject(trusteeSpec, patchedTrustee));

      const updatedTrustee = await this.trusteesRepository.updateTrustee(
        trusteeId,
        patchedTrustee,
        context.session.user,
      );

      if (existingTrustee.name !== updatedTrustee.name) {
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_NAME',
              trusteeId,
              before: existingTrustee.name,
              after: updatedTrustee.name,
            },
            userReference,
          ),
        );
      }

      if (!deepEqual(existingTrustee.public, updatedTrustee.public)) {
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_PUBLIC_CONTACT',
              trusteeId,
              before: existingTrustee.public,
              after: updatedTrustee.public,
            },
            userReference,
          ),
        );
      }

      if (!deepEqual(existingTrustee.internal, updatedTrustee.internal)) {
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_INTERNAL_CONTACT',
              trusteeId,
              before: deepEqual(existingTrustee.internal, {})
                ? undefined
                : existingTrustee.internal,
              after: deepEqual(updatedTrustee.internal, {}) ? undefined : updatedTrustee.internal,
            },
            userReference,
          ),
        );
      }

      if (!deepEqual(existingTrustee.banks, updatedTrustee.banks)) {
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_BANKS',
              trusteeId,
              before: existingTrustee.banks,
              after: updatedTrustee.banks,
            },
            userReference,
          ),
        );
      }

      if (existingTrustee.software !== updatedTrustee.software) {
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_SOFTWARE',
              trusteeId,
              before: existingTrustee.software,
              after: updatedTrustee.software,
            },
            userReference,
          ),
        );
      }

      return updatedTrustee;
    } catch (originalError) {
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
  website: [
    V.optional(V.matches(WEBSITE_REGEX, 'Provided website does not match regular expression')),
  ],
};

export const internalContactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.optional(V.spec(addressSpec))],
  phone: [V.optional(V.spec(phoneSpec))],
  email: [V.optional(V.matches(EMAIL_REGEX, 'Provided email does not match regular expression'))],
  website: [
    V.optional(V.matches(WEBSITE_REGEX, 'Provided website does not match regular expression')),
  ],
};

export const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: [V.minLength(1)],
  public: [V.optional(V.spec(contactInformationSpec))],
  internal: [V.optional(V.spec(internalContactInformationSpec))],
  status: [V.isInSet<TrusteeStatus>([...TRUSTEE_STATUS_VALUES])],
  banks: [V.optional(V.arrayOf(V.length(1, 100)))],
  software: [V.optional(V.length(0, 100))],
};

function patchTrustee(
  current: Readonly<Trustee>,
  patch: Readonly<Partial<Trustee>>,
  immutable: (keyof Trustee)[] = [],
): Trustee {
  const copy = {
    ...current,
  };
  for (const key of Object.keys(patch)) {
    if (immutable.includes(key as keyof Trustee)) {
      // ignore immutable keys from the patch
      continue;
    }
    if (patch[key] === null || patch[key] === undefined) {
      // remove keys intended to be unset
      delete copy[key];
    } else {
      copy[key] = patch[key as keyof Trustee];
    }
  }
  return copy;
}
