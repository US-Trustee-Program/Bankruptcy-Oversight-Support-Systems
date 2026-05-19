import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import { BankruptcySoftwareProfile, SoftwareContactInfo } from '@common/cams/bankruptcy-software';
import {
  BankruptcySoftwareUseCase,
  SoftwareUpdate,
} from '../../use-cases/bankruptcy-software/bankruptcy-software';
import HttpStatusCodes from '@common/api/http-status-codes';
import { EMAIL_REGEX, WEBSITE_RELAXED_REGEX } from '@common/cams/regex';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-CONTROLLER';
const MAX_BANK_ID_LENGTH = 50;
const MAX_BANK_NAME_LENGTH = 100;

export class BankruptcySoftwareController {
  private readonly useCase: BankruptcySoftwareUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BankruptcySoftwareUseCase(context);
  }

  async handleRequest(
    context: ApplicationContext,
  ): Promise<
    | CamsHttpResponseInit
    | CamsHttpResponseInit<BankruptcySoftwareProfile>
    | CamsHttpResponseInit<BankruptcySoftwareProfile[]>
  > {
    const { method } = context.request;
    const softwareId = context.request.params?.softwareId;
    if (method === 'GET' && softwareId) return this.handleGetOne(context, softwareId);
    if (method === 'GET') return this.handleGet(context);
    if (method === 'POST') return this.handlePost(context);
    if (method === 'PUT' && softwareId) return this.handlePut(context, softwareId);
    return httpSuccess({ statusCode: HttpStatusCodes.METHOD_NOT_ALLOWED }) as CamsHttpResponseInit;
  }

  async handleGetOne(
    context: ApplicationContext,
    softwareId: string,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareProfile>> {
    const software = await this.useCase.getSoftware(softwareId);
    const isSuperUser = context.session.user.roles?.includes(CamsRole.SuperUser);
    const { contact: _contact, ...safeProfile } = software;
    const responseData = isSuperUser ? software : safeProfile;
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: responseData },
    });
  }

  async handlePut(
    context: ApplicationContext,
    softwareId: string,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareProfile>> {
    this.requireSuperUser(context);
    const update = this.parseUpdate(context.request.body as Record<string, unknown> | null);
    const software = await this.useCase.updateSoftware(softwareId, update);
    return this.buildSuccessResponse(context, software);
  }

  async handleGet(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareProfile[]>> {
    const softwareList = await this.useCase.getSoftwareList();
    const isSuperUser = context.session.user.roles?.includes(CamsRole.SuperUser);
    const data = isSuperUser
      ? softwareList
      : softwareList.map(({ contact: _contact, ...safe }) => safe);
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data },
    });
  }

  async handlePost(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareProfile>> {
    this.requireSuperUser(context);
    const body = context.request.body as { name?: string } | null;
    if (!body || !body.name || !body.name.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'Software name is required.' });
    }
    const software = await this.useCase.createSoftware({ name: body.name.trim() });
    return httpSuccess({
      statusCode: HttpStatusCodes.CREATED,
      body: { meta: { self: context.request.url }, data: software },
    });
  }

  private parseUpdate(body: Record<string, unknown> | null): SoftwareUpdate {
    return (
      this.parseAddBankBody(body) ??
      this.parseUpdateBankAssociationBody(body) ??
      this.parseProfileUpdateBody(body)
    );
  }

  private parseAddBankBody(
    body: Record<string, unknown> | null,
  ): Extract<SoftwareUpdate, { addBank: unknown }> | null {
    if (!body || !('addBank' in body)) return null;

    const raw = body.addBank as Record<string, unknown> | null;
    if (!raw || typeof raw.bankId !== 'string' || !raw.bankId.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'bankId is required.' });
    }
    if (typeof raw.bankName !== 'string' || !raw.bankName.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'bankName is required.' });
    }
    if (raw.bankId.trim().length > MAX_BANK_ID_LENGTH) {
      throw new BadRequestError(MODULE_NAME, {
        message: `bankId must not exceed ${MAX_BANK_ID_LENGTH} characters.`,
      });
    }
    if (raw.bankName.trim().length > MAX_BANK_NAME_LENGTH) {
      throw new BadRequestError(MODULE_NAME, {
        message: `bankName must not exceed ${MAX_BANK_NAME_LENGTH} characters.`,
      });
    }

    return {
      addBank: { bankId: raw.bankId.trim(), bankName: raw.bankName.trim() },
    };
  }

  private parseUpdateBankAssociationBody(
    body: Record<string, unknown> | null,
  ): Extract<SoftwareUpdate, { updateBankAssociation: unknown }> | null {
    if (!body || !('updateBankAssociation' in body)) return null;

    const raw = body.updateBankAssociation as Record<string, unknown> | null;
    if (!raw || typeof raw.bankId !== 'string' || !raw.bankId.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'bankId is required.' });
    }
    if (raw.bankId.trim().length > MAX_BANK_ID_LENGTH) {
      throw new BadRequestError(MODULE_NAME, {
        message: `bankId must not exceed ${MAX_BANK_ID_LENGTH} characters.`,
      });
    }
    if (raw.status !== 'active' && raw.status !== 'inactive') {
      throw new BadRequestError(MODULE_NAME, {
        message: "status must be 'active' or 'inactive'.",
      });
    }

    return {
      updateBankAssociation: { bankId: raw.bankId.trim(), status: raw.status },
    };
  }

  private parseProfileUpdateBody(
    body: Record<string, unknown> | null,
  ): Partial<Pick<BankruptcySoftwareProfile, 'name' | 'status' | 'contact'>> {
    const update: Partial<Pick<BankruptcySoftwareProfile, 'name' | 'status' | 'contact'>> = {};
    if (!body) return update;

    if ('name' in body) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        throw new BadRequestError(MODULE_NAME, { message: 'Software name is required.' });
      }
      update.name = body.name.trim();
    }
    if ('status' in body) {
      if (body.status !== 'active' && body.status !== 'inactive') {
        throw new BadRequestError(MODULE_NAME, {
          message: "status must be 'active' or 'inactive'.",
        });
      }
      update.status = body.status;
    }
    if ('contact' in body) {
      update.contact = this.validateContact(body.contact as SoftwareContactInfo | undefined);
    }
    return update;
  }

  private validateContact(
    contact: SoftwareContactInfo | undefined,
  ): SoftwareContactInfo | undefined {
    if (!contact) return contact;

    if (contact.emails) {
      for (const addr of contact.emails) {
        if (!EMAIL_REGEX.test(addr)) {
          throw new BadRequestError(MODULE_NAME, {
            message: 'One or more email addresses are invalid.',
          });
        }
        if (addr.length > 254) {
          throw new BadRequestError(MODULE_NAME, {
            message: 'Email address must not exceed 254 characters.',
          });
        }
      }
    }

    if (contact.website && !WEBSITE_RELAXED_REGEX.test(contact.website)) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Website URL is invalid.',
      });
    }
    if (contact.website && contact.website.length > 255) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Website URL must not exceed 255 characters.',
      });
    }

    return contact;
  }

  private buildSuccessResponse(
    context: ApplicationContext,
    software: BankruptcySoftwareProfile,
  ): CamsHttpResponseInit<BankruptcySoftwareProfile> {
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: software },
    });
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
