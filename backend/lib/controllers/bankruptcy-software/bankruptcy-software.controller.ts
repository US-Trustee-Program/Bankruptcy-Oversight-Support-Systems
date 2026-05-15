import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';
import HttpStatusCodes from '@common/api/http-status-codes';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-CONTROLLER';

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
    const body = context.request.body as Record<string, unknown> | null;

    const addBankUpdate = this.parseAddBankBody(body);
    if (addBankUpdate) {
      const software = await this.useCase.updateSoftware(softwareId, addBankUpdate);
      return this.buildSuccessResponse(context, software);
    }

    const bankAssocUpdate = this.parseUpdateBankAssociationBody(body);
    if (bankAssocUpdate) {
      const software = await this.useCase.updateSoftware(softwareId, bankAssocUpdate);
      return this.buildSuccessResponse(context, software);
    }

    const profileUpdate = this.parseProfileUpdateBody(body);
    const software = await this.useCase.updateSoftware(softwareId, profileUpdate);
    return this.buildSuccessResponse(context, software);
  }

  async handleGet(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareProfile[]>> {
    const softwareList = await this.useCase.getSoftwareList();
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: softwareList },
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

  private parseAddBankBody(
    body: Record<string, unknown> | null,
  ): { addBank: { bankId: string; bankName: string } } | null {
    if (!body || !('addBank' in body)) return null;

    const raw = body.addBank as Record<string, unknown> | null;
    if (!raw || typeof raw.bankId !== 'string' || !raw.bankId.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'bankId is required.' });
    }
    if (typeof raw.bankName !== 'string' || !raw.bankName.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'bankName is required.' });
    }

    return {
      addBank: { bankId: raw.bankId.trim(), bankName: raw.bankName.trim() },
    };
  }

  private parseUpdateBankAssociationBody(
    body: Record<string, unknown> | null,
  ): { updateBankAssociation: { bankId: string; status: 'active' | 'inactive' } } | null {
    if (!body || !('updateBankAssociation' in body)) return null;

    const raw = body.updateBankAssociation as Record<string, unknown> | null;
    if (!raw || typeof raw.bankId !== 'string' || !raw.bankId.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'bankId is required.' });
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
    const profileUpdate =
      (body as Partial<Pick<BankruptcySoftwareProfile, 'name' | 'status' | 'contact'>> | null) ??
      {};
    if (profileUpdate.name !== undefined && !profileUpdate.name.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'Software name is required.' });
    }
    return profileUpdate;
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
