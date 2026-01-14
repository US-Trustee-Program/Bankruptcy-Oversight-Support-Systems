import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { getCamsUserReference } from '@common/cams/session';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { ValidationSpec, validateObject, flatten, ValidatorResult } from '@common/cams/validation';
import V from '@common/cams/validators';
import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
} from '@common/cams/regex';
import { BadRequestError } from '../../common-errors/bad-request';
import { Address, ContactInformation, PhoneNumber } from '@common/cams/contact';
import { Trustee, TrusteeHistory, TrusteeInput } from '@common/cams/trustees';
import { createAuditRecord } from '@common/cams/auditable';
import { deepEqual } from '@common/object-equality';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

export class TrusteesUseCase {
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = factory.getTrusteesRepository(context);
  }

  private checkValidation(validatorResult: ValidatorResult) {
    if (!validatorResult.valid) {
      const validationErrors = flatten(validatorResult.reasonMap || {});
      const collectedErrors = 'Trustee validation failed: ' + validationErrors.join('. ') + '.';
      throw new BadRequestError(MODULE_NAME, { message: collectedErrors });
    }
  }

  async createTrustee(context: ApplicationContext, trustee: TrusteeInput): Promise<Trustee> {
    try {
      this.checkValidation(validateObject(trusteeSpec, trustee));
      // Prepare trustee for creation with audit fields
      const userReference = getCamsUserReference(context.session.user);
      const trusteeForCreation: TrusteeInput = {
        ...trustee,
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

      // TODO: 12/17/25 We are only using the trusteeId on the front end after creation, so we only need to return the trusteeId, not the full trustee record.
      return createdTrustee;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { module: MODULE_NAME, message: 'Failed to create trustee.' },
      });
    }
  }

  async listTrustees(context: ApplicationContext): Promise<Trustee[]> {
    try {
      // Retrieve trustees list from repository
      const trustees = await this.trusteesRepository.listTrustees();

      context.logger.info(MODULE_NAME, `Retrieved ${trustees.length} trustees`);
      return trustees;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: { module: MODULE_NAME, message: 'Failed to retrieve trustees list.' },
      });
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
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve history for trustee with ID ${trusteeId}.`,
        },
      });
    }
  }

  async getTrustee(context: ApplicationContext, trusteeId: string): Promise<Trustee> {
    try {
      // Retrieve individual trustee from repository
      const trustee = await this.trusteesRepository.read(trusteeId);

      context.logger.info(MODULE_NAME, `Retrieved trustee ${trusteeId}`);
      return trustee;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve trustee with ID ${trusteeId}.`,
        },
      });
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

      const dynamicSpec: Record<string, unknown> = {};
      for (const key of Object.keys(trustee) as Array<keyof TrusteeInput>) {
        if (trusteeSpec[key]) {
          dynamicSpec[key as string] = trusteeSpec[key];
        }
      }

      const specToValidate =
        Object.keys(dynamicSpec).length > 0
          ? (dynamicSpec as ValidationSpec<TrusteeInput>)
          : trusteeSpec;

      this.checkValidation(validateObject(specToValidate, patchedTrustee));

      const updatedTrustee = await this.trusteesRepository.updateTrustee(
        trusteeId,
        patchedTrustee,
        userReference,
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
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update trustee with ID ${trusteeId}.`,
        },
      });
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
    V.optional(
      V.matches(WEBSITE_RELAXED_REGEX, 'Provided website does not match regular expression'),
      V.maxLength(255, 'Website URL must be less than or equal to 255 characters'),
    ),
  ],
};

const internalContactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.optional(V.nullable(V.spec(addressSpec)))],
  phone: [V.optional(V.nullable(V.spec(phoneSpec)))],
  email: [
    V.optional(
      V.nullable(V.matches(EMAIL_REGEX, 'Provided email does not match regular expression')),
    ),
  ],
};

const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: [V.minLength(1)],
  public: [V.optional(V.spec(contactInformationSpec))],
  internal: [V.optional(V.spec(internalContactInformationSpec))],
  banks: [V.optional(V.arrayOf(V.length(1, 100)))],
  software: [V.optional(V.length(0, 100))],
};

function patchTrustee(
  current: Readonly<Trustee>,
  patch: Readonly<Partial<Trustee>>,
  immutable: (keyof Trustee)[],
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
      // set keys to undefined when intended to be unset
      copy[key] = undefined;
    } else if (
      typeof patch[key] === 'object' &&
      patch[key] !== null &&
      !Array.isArray(patch[key])
    ) {
      // handle nested objects recursively
      const patchedNestedObj = patchNestedObject(patch[key] as Record<string, unknown>);

      if (patchedNestedObj === undefined || Object.keys(patchedNestedObj).length === 0) {
        // if the nested object is empty after patching, set parent to undefined
        copy[key] = undefined;
      } else {
        copy[key] = patchedNestedObj as Trustee[keyof Trustee];
      }
    } else {
      copy[key] = patch[key as keyof Trustee];
    }
  }
  return copy;
}

function patchNestedObject(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  let hasValidProperties = false;

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      // skip null/undefined properties - they should be removed
      continue;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // recursively handle nested objects
      const patchedNested = patchNestedObject(value as Record<string, unknown>);
      if (patchedNested !== undefined && Object.keys(patchedNested).length > 0) {
        result[key] = patchedNested;
        hasValidProperties = true;
      }
      // if patchedNested is undefined or empty, the property is omitted
    } else {
      // keep non-null, non-object values
      result[key] = value;
      hasValidProperties = true;
    }
  }

  return hasValidProperties ? result : undefined;
}
