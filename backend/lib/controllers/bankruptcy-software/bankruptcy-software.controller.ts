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

    if (body && 'addBank' in body) {
      const addBank = body.addBank as Record<string, unknown>;
      if (!addBank || typeof addBank.bankId !== 'string' || !addBank.bankId.trim()) {
        throw new BadRequestError(MODULE_NAME, { message: 'bankId is required.' });
      }
      if (typeof addBank.bankName !== 'string' || !addBank.bankName.trim()) {
        throw new BadRequestError(MODULE_NAME, { message: 'bankName is required.' });
      }
      const software = await this.useCase.updateSoftware(softwareId, {
        addBank: { bankId: addBank.bankId.trim(), bankName: addBank.bankName.trim() },
      });
      return httpSuccess({
        statusCode: HttpStatusCodes.OK,
        body: { meta: { self: context.request.url }, data: software },
      });
    }

    if (body && 'updateBankAssociation' in body) {
      const assoc = body.updateBankAssociation as Record<string, unknown>;
      if (!assoc || typeof assoc.bankId !== 'string' || !assoc.bankId.trim()) {
        throw new BadRequestError(MODULE_NAME, { message: 'bankId is required.' });
      }
      if (assoc.status !== 'active' && assoc.status !== 'inactive') {
        throw new BadRequestError(MODULE_NAME, {
          message: "status must be 'active' or 'inactive'.",
        });
      }
      const software = await this.useCase.updateSoftware(softwareId, {
        updateBankAssociation: { bankId: assoc.bankId.trim(), status: assoc.status },
      });
      return httpSuccess({
        statusCode: HttpStatusCodes.OK,
        body: { meta: { self: context.request.url }, data: software },
      });
    }

    const profileUpdate = body as Partial<
      Pick<BankruptcySoftwareProfile, 'name' | 'status' | 'contact'>
    > | null;
    if (profileUpdate?.name !== undefined && !profileUpdate.name.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'Software name is required.' });
    }
    const software = await this.useCase.updateSoftware(softwareId, profileUpdate ?? {});
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: software },
    });
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

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
