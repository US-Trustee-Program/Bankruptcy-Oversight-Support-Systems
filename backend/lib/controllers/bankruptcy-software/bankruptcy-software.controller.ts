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
    if (method === 'GET') {
      return this.handleGet(context);
    } else if (method === 'POST') {
      return this.handlePost(context);
    }
    return httpSuccess({ statusCode: HttpStatusCodes.METHOD_NOT_ALLOWED }) as CamsHttpResponseInit;
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
