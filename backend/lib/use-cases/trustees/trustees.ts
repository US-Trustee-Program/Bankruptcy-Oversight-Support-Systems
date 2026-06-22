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
import {
  AppointmentStatus,
  Trustee,
  TrusteeHistory,
  TrusteeInput,
  TrusteeListItem,
  ZoomInfo,
} from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteesSearchPredicate } from '@common/api/search';
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
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { TrusteeChangeField, TrusteeChangeSet } from '@common/cams/notifications';
import { TrusteeChangeNotificationUseCase } from '../notifications/trustee-change-notification';

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
  private readonly softwareRepository: BankruptcySoftwareRepository;
  private readonly courtsUseCase: CourtsUseCase;

  constructor(context: ApplicationContext) {
    this.trusteesRepository = factory.getTrusteesRepository(context);
    this.trusteeAssistantsRepository = factory.getTrusteeAssistantsRepository(context);
    this.trusteeAppointmentsRepository = factory.getTrusteeAppointmentsRepository(context);
    this.softwareRepository = factory.getBankruptcySoftwareRepository(context);
    this.courtsUseCase = new CourtsUseCase();
  }

  private static readonly INACTIVE_STATUSES: AppointmentStatus[] = [
    'inactive',
    'voluntarily-suspended',
    'involuntarily-suspended',
    'deceased',
    'resigned',
    'terminated',
    'removed',
  ];

  private getStatusFilterValues(status: string | undefined): AppointmentStatus[] | null {
    if (!status || status === 'all') return null;
    if (status === 'active') return ['active'];
    return [...TrusteesUseCase.INACTIVE_STATUSES];
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

  async listTrustees(
    context: ApplicationContext,
    predicate?: TrusteesSearchPredicate,
  ): Promise<TrusteeListItem[]> {
    try {
      const status = predicate?.status;
      const statusStatuses = this.getStatusFilterValues(status);

      const [allTrustees, courts, filteredTrusteeIds] = await Promise.all([
        this.trusteesRepository.listTrustees(),
        this.courtsUseCase.getCourts(context),
        statusStatuses
          ? this.trusteeAppointmentsRepository.getTrusteeIdsByStatuses(statusStatuses)
          : Promise.resolve(null),
      ]);

      const trustees =
        filteredTrusteeIds === null
          ? allTrustees
          : (() => {
              const idSet = new Set(filteredTrusteeIds);
              return allTrustees.filter((t) => idSet.has(t.trusteeId));
            })();

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

      const software = await this.loadAndValidateSoftware(
        trustee.softwareId,
        patchedTrustee.banks,
        patchedTrustee.softwareId,
      );

      const updatedTrustee = await this.trusteesRepository.updateTrustee(
        trusteeId,
        patchedTrustee,
        userReference,
      );

      const changeSet = await this.recordAuditHistory(
        context,
        trusteeId,
        existingTrustee,
        updatedTrustee,
        userReference,
        software,
      );

      if (changeSet.fields.length > 0) {
        try {
          changeSet.primaryChapter = await this.resolvePrimaryChapter(trusteeId);
          const notificationUseCase = new TrusteeChangeNotificationUseCase(context);
          await notificationUseCase.notify(context, changeSet);
        } catch (originalError) {
          context.logger.error(
            'TRUSTEE-CHANGE-NOTIFICATION',
            'Failed to dispatch trustee change notification.',
            originalError,
          );
          const trace = context.observability.startTrace(context.invocationId);
          context.observability.completeTrace(trace, 'Trustee Change Notification', {
            success: false,
            properties: {},
            measurements: {},
          });
          // Intentional: do not rethrow — notification failure must not fail
          // the save (per CAMS-768 Slice 1 Decision 5: failure isolation).
        }
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

  private async loadAndValidateSoftware(
    incomingSoftwareId: string | undefined | null,
    banks: string[] | undefined,
    effectiveSoftwareId: string | undefined,
  ): Promise<BankruptcySoftwareProfile | undefined> {
    if (!incomingSoftwareId && (!banks || banks.length === 0)) return undefined;

    if (banks && banks.length > 0 && !effectiveSoftwareId) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'A software vendor must be assigned before adding banks.',
      });
    }

    const softwareId = incomingSoftwareId || effectiveSoftwareId;
    if (!softwareId) return undefined;

    let software: BankruptcySoftwareProfile;
    try {
      software = await this.softwareRepository.findSoftwareById(softwareId);
    } catch (error) {
      if (isCamsError(error) && error.status === 404) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Software with ID '${softwareId}' does not exist.`,
        });
      }
      throw error;
    }

    if (banks && banks.length > 0) {
      const validBankIds = new Set(software.associatedBanks?.map((b) => b.bankId) ?? []);
      const invalidBanks = banks.filter((id) => !validBankIds.has(id));
      if (invalidBanks.length > 0) {
        throw new BadRequestError(MODULE_NAME, {
          message: `Banks [${invalidBanks.join(', ')}] are not associated with the selected software.`,
        });
      }
    }

    return software;
  }

  private async recordAuditHistory(
    context: ApplicationContext,
    trusteeId: string,
    before: Trustee,
    after: Trustee,
    userReference: ReturnType<typeof getCamsUserReference>,
    software: BankruptcySoftwareProfile | undefined,
  ): Promise<TrusteeChangeSet> {
    const fields: TrusteeChangeField[] = [];

    if (before.name !== after.name) {
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          { documentType: 'AUDIT_NAME', trusteeId, before: before.name, after: after.name },
          userReference,
        ),
      );
      fields.push({
        label: 'Name',
        before: before.name ?? '',
        after: after.name ?? '',
        category: 'profile',
        section: 'appointment',
      });
      const trace = context.observability.startTrace(context.invocationId);
      const isMigrated = !!(after.legacy?.truIds && after.legacy.truIds.length > 0);
      context.observability.completeTrace(trace, 'Trustee Name Edited', {
        success: true,
        properties: { isMigrated: String(isMigrated) },
        measurements: {},
      });
    }

    if (!deepEqual(before.public, after.public)) {
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          {
            documentType: 'AUDIT_PUBLIC_CONTACT',
            trusteeId,
            before: before.public,
            after: after.public,
          },
          userReference,
        ),
      );
      fields.push({
        label: 'Public Contact',
        before: formatContactInfo(before.public),
        after: formatContactInfo(after.public),
        category: 'profile',
        section: 'appointment',
      });
    }

    if (!deepEqual(before.internal, after.internal)) {
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          {
            documentType: 'AUDIT_INTERNAL_CONTACT',
            trusteeId,
            before: normalizeForUndefined(before.internal),
            after: normalizeForUndefined(after.internal),
          },
          userReference,
        ),
      );
      fields.push({
        label: 'Internal Contact',
        before: formatContactInfo(normalizeForUndefined(before.internal)),
        after: formatContactInfo(normalizeForUndefined(after.internal)),
        category: 'profile',
        section: 'appointment',
      });
    }

    if (!deepEqual(before.banks, after.banks)) {
      const bankNames = this.buildBankNameMap(software, after.softwareId || before.softwareId);
      const beforeNames = before.banks?.map((id) => bankNames.get(id) ?? id);
      const afterNames = after.banks?.map((id) => bankNames.get(id) ?? id);
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          { documentType: 'AUDIT_BANKS', trusteeId, before: beforeNames, after: afterNames },
          userReference,
        ),
      );
      fields.push({
        label: 'Banks',
        before: (beforeNames ?? []).join(', '),
        after: (afterNames ?? []).join(', '),
        category: 'profile',
        section: 'appointment',
      });
    }

    if (before.softwareId !== after.softwareId) {
      const beforeName = before.softwareId
        ? await this.resolveSoftwareName(before.softwareId)
        : undefined;
      const afterName = after.softwareId ? (software?.name ?? after.softwareId) : undefined;
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          { documentType: 'AUDIT_SOFTWARE', trusteeId, before: beforeName, after: afterName },
          userReference,
        ),
      );
      fields.push({
        label: 'Software',
        before: beforeName ?? '',
        after: afterName ?? '',
        category: 'profile',
        section: 'appointment',
      });
    }

    if (!deepEqual(before.zoomInfo, after.zoomInfo)) {
      await this.trusteesRepository.createTrusteeHistory(
        createAuditRecord(
          {
            documentType: 'AUDIT_ZOOM_INFO',
            trusteeId,
            before: before.zoomInfo,
            after: after.zoomInfo,
          },
          userReference,
        ),
      );
      fields.push({
        label: 'Zoom Info',
        before: formatZoomInfo(before.zoomInfo),
        after: formatZoomInfo(after.zoomInfo),
        category: 'zoom-341',
        section: 'meeting',
      });
    }

    return {
      trusteeId,
      trusteeName: after.name,
      fields,
    };
  }

  private async resolvePrimaryChapter(
    trusteeId: string,
  ): Promise<TrusteeChangeSet['primaryChapter']> {
    const appointments = await this.trusteeAppointmentsRepository.getAppointmentsByTrusteeIds([
      trusteeId,
    ]);
    if (appointments.length === 0) return undefined;

    const sorted = [...appointments].sort((a, b) => {
      const aActive = a.status === 'active' ? 1 : 0;
      const bActive = b.status === 'active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.appointedDate.localeCompare(a.appointedDate);
    });

    return sorted[0].chapter;
  }

  private buildBankNameMap(
    software: BankruptcySoftwareProfile | undefined,
    softwareId: string | undefined,
  ): Map<string, string> {
    if (!software || !softwareId) return new Map();
    const nameMap = new Map<string, string>();
    for (const bank of software.associatedBanks ?? []) {
      nameMap.set(bank.bankId, bank.bankName);
    }
    return nameMap;
  }

  private async resolveSoftwareName(softwareId: string): Promise<string> {
    try {
      const software = await this.softwareRepository.findSoftwareById(softwareId);
      return software.name;
    } catch (error) {
      if (isCamsError(error) && error.status === 404) {
        return softwareId;
      }
      throw error;
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

// TODO(CAMS-768 Slice 4): Replace this one-line summary with a richer
// notification-friendly rendering when the editor block + profile link
// land. The Slice 1 form is intentionally minimal — just enough to
// distinguish before/after in the email body.
function formatContactInfo(contact: Partial<ContactInformation> | undefined): string {
  if (!contact) return '';
  const parts: string[] = [];
  if (contact.companyName) parts.push(`company: ${contact.companyName}`);
  if (contact.email) parts.push(`email: ${contact.email}`);
  if (contact.phone?.number) {
    const ext = contact.phone.extension ? ` x${contact.phone.extension}` : '';
    parts.push(`phone: ${contact.phone.number}${ext}`);
  }
  if (contact.website) parts.push(`website: ${contact.website}`);
  if (contact.address) {
    const a = contact.address;
    const lines = [a.address1, a.address2, a.address3]
      .filter((v): v is string => Boolean(v))
      .join(', ');
    const cityState = [a.city, a.state].filter((v): v is string => Boolean(v)).join(', ');
    const addressLine = [lines, cityState, a.zipCode, a.countryCode]
      .filter((v): v is string => Boolean(v))
      .join(' ');
    if (addressLine) parts.push(`address: ${addressLine}`);
  }
  return parts.join('\n');
}

function formatZoomInfo(zoomInfo: ZoomInfo | undefined): string {
  if (!zoomInfo) return '';
  const parts: string[] = [];
  if (zoomInfo.link) parts.push(`link: ${zoomInfo.link}`);
  if (zoomInfo.phone) parts.push(`phone: ${zoomInfo.phone}`);
  if (zoomInfo.meetingId) parts.push(`meetingId: ${zoomInfo.meetingId}`);
  if (zoomInfo.passcode) parts.push(`passcode: ${zoomInfo.passcode}`);
  if (zoomInfo.accountEmail) parts.push(`accountEmail: ${zoomInfo.accountEmail}`);
  return parts.join('\n');
}
