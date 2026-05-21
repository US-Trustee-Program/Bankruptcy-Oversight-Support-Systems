import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteesRepository,
  TrusteeAssistantsRepository,
  TrusteeAppointmentsRepository,
  BankruptcySoftwareRepository,
} from '../gateways.types';
import { getCamsUserReference } from '@common/cams/session';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { isCamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import { ValidationSpec, validateObject, flatten, ValidatorResult } from '@common/cams/validation';
import { BadRequestError } from '../../common-errors/bad-request';
import { Trustee, TrusteeHistory, TrusteeInput, TrusteeListItem } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  trusteeFirstName,
  trusteeLastName,
  trusteeMiddleName,
  companyName,
  addressLine1,
  addressLine2,
  addressLine3,
  city,
  state,
  zipCode,
  countryCode,
  phoneNumber,
  phoneExtension,
  email,
  website,
  zoomInfoSpec,
} from '@common/cams/trustees-validators';
import { createAuditRecord } from '@common/cams/auditable';
import { deepEqual } from '@common/object-equality';
import { normalizeForUndefined } from '@common/normalization';
import V from '@common/cams/validators';
import { Address, ContactInformation, PhoneNumber } from '@common/cams/contact';

const MODULE_NAME = 'TRUSTEES-USE-CASE';

const addressSpec: ValidationSpec<Address> = {
  address1: [addressLine1],
  address2: [addressLine2],
  address3: [addressLine3],
  city: [city],
  state: [state],
  zipCode: [zipCode],
  countryCode: [countryCode],
};

const phoneSpec: ValidationSpec<PhoneNumber> = {
  number: [phoneNumber],
  extension: [phoneExtension],
};

const contactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.spec(addressSpec)],
  phone: [V.optional(V.spec(phoneSpec))],
  email: [V.optional(email)],
  website: [website],
  companyName: [companyName],
};

const internalContactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.optional(V.nullable(V.spec(addressSpec)))],
  phone: [V.optional(V.nullable(V.spec(phoneSpec)))],
  email: [V.optional(V.nullable(email))],
};

const trusteeSpec: ValidationSpec<TrusteeInput> = {
  firstName: [trusteeFirstName],
  lastName: [trusteeLastName],
  middleName: [trusteeMiddleName],
  public: [V.optional(V.spec(contactInformationSpec))],
  internal: [V.optional(V.spec(internalContactInformationSpec))],
  banks: [V.optional(V.arrayOf(V.length(1, 100)))],
  softwareId: [V.optional(V.length(1, 50))],
  zoomInfo: [V.optional(V.nullable(V.spec(zoomInfoSpec)))],
};

export class TrusteesUseCase {
  private readonly trusteesRepository: TrusteesRepository;
  private readonly trusteeAssistantsRepository: TrusteeAssistantsRepository;
  private readonly trusteeAppointmentsRepository: TrusteeAppointmentsRepository;
  private readonly courtsUseCase: CourtsUseCase;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = factory.getTrusteesRepository(context);
    this.trusteeAssistantsRepository = factory.getTrusteeAssistantsRepository(context);
    this.trusteeAppointmentsRepository = factory.getTrusteeAppointmentsRepository(context);
    this.courtsUseCase = new CourtsUseCase();
  }

  private findCourtName(courts: CourtDivisionDetails[], courtId: string): string | undefined {
    return courts.find((c) => c.courtId === courtId)?.courtName;
  }

  private findCourtDivisionName(
    courts: CourtDivisionDetails[],
    divisionCode: string | undefined,
  ): string | undefined {
    if (!divisionCode) return undefined;
    return courts.find((c) => c.courtDivisionCode === divisionCode)?.courtDivisionName;
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

  async listTrustees(context: ApplicationContext): Promise<TrusteeListItem[]> {
    try {
      const [trustees, courts] = await Promise.all([
        this.trusteesRepository.listTrustees(),
        this.courtsUseCase.getCourts(context),
      ]);

      const trusteeIds = trustees.map((t) => t.trusteeId);
      const allAppointments =
        await this.trusteeAppointmentsRepository.getAppointmentsByTrusteeIds(trusteeIds);

      const enrichedAppointments = allAppointments.map((appt) => ({
        ...appt,
        courtName: this.findCourtName(courts, appt.courtId),
        courtDivisionName: this.findCourtDivisionName(courts, appt.divisionCode),
      }));

      const appointmentsByTrusteeId = new Map<string, TrusteeAppointment[]>();
      for (const appt of enrichedAppointments) {
        const existing = appointmentsByTrusteeId.get(appt.trusteeId) ?? [];
        existing.push(appt);
        appointmentsByTrusteeId.set(appt.trusteeId, existing);
      }

      const listItems: TrusteeListItem[] = trustees.map((trustee) => ({
        ...trustee,
        appointments: appointmentsByTrusteeId.get(trustee.trusteeId) ?? [],
      }));

      listItems.sort((a, b) => {
        const lastCmp = (a.lastName ?? '').localeCompare(b.lastName ?? '', undefined, {
          sensitivity: 'base',
        });
        if (lastCmp !== 0) return lastCmp;
        return (a.firstName ?? '').localeCompare(b.firstName ?? '', undefined, {
          sensitivity: 'base',
        });
      });

      context.logger.info(MODULE_NAME, `Retrieved ${listItems.length} trustees`);
      return listItems;
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

      // Fetch and populate assistants array
      const assistants = await this.trusteeAssistantsRepository.getTrusteeAssistants(trusteeId);
      trustee.assistants = assistants;

      context.logger.info(
        MODULE_NAME,
        `Retrieved trustee ${trusteeId} with ${assistants.length} assistants`,
      );
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

      if (trustee.softwareId) {
        await this.validateSoftwareExists(context, trustee.softwareId);
      }

      if (patchedTrustee.banks && patchedTrustee.banks.length > 0) {
        await this.validateBanksForSoftware(
          context,
          patchedTrustee.banks,
          patchedTrustee.softwareId,
        );
      }

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
        const trace = context.observability.startTrace(context.invocationId);
        const isMigrated = !!(
          updatedTrustee.legacy?.truIds && updatedTrustee.legacy.truIds.length > 0
        );
        context.observability.completeTrace(trace, 'Trustee Name Edited', {
          success: true,
          properties: { isMigrated: String(isMigrated) },
          measurements: {},
        });
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
              before: normalizeForUndefined(existingTrustee.internal),
              after: normalizeForUndefined(updatedTrustee.internal),
            },
            userReference,
          ),
        );
      }

      if (!deepEqual(existingTrustee.banks, updatedTrustee.banks)) {
        const softwareIdForBanks = updatedTrustee.softwareId || existingTrustee.softwareId;
        const bankNames = softwareIdForBanks
          ? await this.resolveBankNames(context, softwareIdForBanks)
          : new Map<string, string>();
        const beforeNames = existingTrustee.banks?.map((id) => bankNames.get(id) ?? id);
        const afterNames = updatedTrustee.banks?.map((id) => bankNames.get(id) ?? id);
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_BANKS',
              trusteeId,
              before: beforeNames,
              after: afterNames,
            },
            userReference,
          ),
        );
      }

      if (existingTrustee.softwareId !== updatedTrustee.softwareId) {
        const beforeName = existingTrustee.softwareId
          ? await this.resolveSoftwareName(context, existingTrustee.softwareId)
          : undefined;
        const afterName = updatedTrustee.softwareId
          ? await this.resolveSoftwareName(context, updatedTrustee.softwareId)
          : undefined;
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_SOFTWARE',
              trusteeId,
              before: beforeName,
              after: afterName,
            },
            userReference,
          ),
        );
      }

      if (!deepEqual(existingTrustee.zoomInfo, updatedTrustee.zoomInfo)) {
        await this.trusteesRepository.createTrusteeHistory(
          createAuditRecord(
            {
              documentType: 'AUDIT_ZOOM_INFO',
              trusteeId,
              before: existingTrustee.zoomInfo,
              after: updatedTrustee.zoomInfo,
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

  private async validateSoftwareExists(
    context: ApplicationContext,
    softwareId: string,
  ): Promise<void> {
    const softwareRepository: BankruptcySoftwareRepository =
      factory.getBankruptcySoftwareRepository(context);
    try {
      await softwareRepository.findSoftwareById(softwareId);
    } catch (error) {
      if (isCamsError(error) && error.status === 404) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Software with ID '${softwareId}' does not exist.`,
        });
      }
      throw error;
    }
  }

  private async resolveSoftwareName(
    context: ApplicationContext,
    softwareId: string,
  ): Promise<string> {
    const softwareRepository: BankruptcySoftwareRepository =
      factory.getBankruptcySoftwareRepository(context);
    try {
      const software = await softwareRepository.findSoftwareById(softwareId);
      return software.name;
    } catch (error) {
      if (isCamsError(error) && error.status === 404) {
        return softwareId;
      }
      throw error;
    }
  }

  private async validateBanksForSoftware(
    context: ApplicationContext,
    bankIds: string[],
    softwareId: string | undefined,
  ): Promise<void> {
    if (!softwareId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'A software vendor must be assigned before adding banks.',
      });
    }

    const softwareRepository: BankruptcySoftwareRepository =
      factory.getBankruptcySoftwareRepository(context);
    const software = await softwareRepository.findSoftwareById(softwareId);
    const validBankIds = new Set(software.associatedBanks?.map((b) => b.bankId) ?? []);

    const invalidBanks = bankIds.filter((id) => !validBankIds.has(id));
    if (invalidBanks.length > 0) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Banks [${invalidBanks.join(', ')}] are not associated with the selected software.`,
      });
    }
  }

  private async resolveBankNames(
    context: ApplicationContext,
    softwareId: string,
  ): Promise<Map<string, string>> {
    const softwareRepository: BankruptcySoftwareRepository =
      factory.getBankruptcySoftwareRepository(context);
    try {
      const software = await softwareRepository.findSoftwareById(softwareId);
      const nameMap = new Map<string, string>();
      for (const bank of software.associatedBanks ?? []) {
        nameMap.set(bank.bankId, bank.bankName);
      }
      return nameMap;
    } catch {
      return new Map();
    }
  }
}

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
      // delete the key so it is absent rather than null/undefined
      delete copy[key];
    } else if (
      typeof patch[key] === 'object' &&
      patch[key] !== null &&
      !Array.isArray(patch[key])
    ) {
      // handle nested objects recursively
      const patchedNestedObj = patchNestedObject(patch[key] as Record<string, unknown>);

      if (patchedNestedObj === undefined || Object.keys(patchedNestedObj).length === 0) {
        // delete the key so it is absent rather than undefined/null
        delete copy[key];
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
