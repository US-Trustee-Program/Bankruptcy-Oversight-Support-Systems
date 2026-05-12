import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import { BankProfile } from '@common/cams/banks';
import { BanksUseCase } from '../../use-cases/banks/banks';

const MODULE_NAME = 'BANKS-CONTROLLER';

export class BanksController {
  private readonly useCase: BanksUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BanksUseCase(context);
  }

  async handleRequest(
    context: ApplicationContext,
  ): Promise<
    CamsHttpResponseInit | CamsHttpResponseInit<BankProfile> | CamsHttpResponseInit<BankProfile[]>
  > {
    const { method } = context.request;
    const { bankId } = context.request.params;

    if (method === 'GET' && bankId) {
      return this.handleGetOne(context);
    } else if (method === 'GET') {
      return this.handleGet(context);
    } else if (method === 'POST') {
      return this.handlePost(context);
    } else if (method === 'PUT' && bankId) {
      return this.handlePut(context);
    }
    return httpSuccess({ statusCode: 405 });
  }

  async handleGet(context: ApplicationContext): Promise<CamsHttpResponseInit<BankProfile[]>> {
    this.requireSuperUser(context);
    const banks = await this.useCase.getBanks();
    return httpSuccess({
      statusCode: 200,
      body: { meta: { self: context.request.url }, data: banks },
    });
  }

  async handleGetOne(context: ApplicationContext): Promise<CamsHttpResponseInit<BankProfile>> {
    this.requireSuperUser(context);
    const { bankId } = context.request.params;
    if (!bankId) throw new BadRequestError(MODULE_NAME, { message: 'Bank ID is required.' });
    const bank = await this.useCase.getBank(bankId);
    return httpSuccess({
      statusCode: 200,
      body: { meta: { self: context.request.url }, data: bank },
    });
  }

  async handlePut(context: ApplicationContext): Promise<CamsHttpResponseInit<BankProfile>> {
    this.requireSuperUser(context);
    const { bankId } = context.request.params;
    if (!bankId) throw new BadRequestError(MODULE_NAME, { message: 'Bank ID is required.' });
    const body = context.request.body as Partial<Pick<BankProfile, 'name' | 'status'>> | null;
    if (!body || !body.name || !body.name.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'Bank name is required.' });
    }
    if (body.status !== 'active' && body.status !== 'inactive') {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Bank status must be active or inactive.',
      });
    }
    const bank = await this.useCase.updateBank(bankId, {
      name: body.name.trim(),
      status: body.status,
    });
    return httpSuccess({
      statusCode: 200,
      body: { meta: { self: context.request.url }, data: bank },
    });
  }

  async handlePost(context: ApplicationContext): Promise<CamsHttpResponseInit<BankProfile>> {
    this.requireSuperUser(context);
    const body = context.request.body as { name?: string } | null;
    if (!body || !body.name || !body.name.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'Bank name is required.' });
    }
    const bank = await this.useCase.createBank({ name: body.name.trim() });
    return httpSuccess({
      statusCode: 201,
      body: { meta: { self: context.request.url }, data: bank },
    });
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
