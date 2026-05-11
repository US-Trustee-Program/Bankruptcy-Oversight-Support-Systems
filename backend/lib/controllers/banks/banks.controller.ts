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

  async handleGet(context: ApplicationContext): Promise<CamsHttpResponseInit<BankProfile[]>> {
    this.requireSuperUser(context);
    const banks = await this.useCase.getBanks();
    return httpSuccess({
      statusCode: 200,
      body: { meta: { self: context.request.url }, data: banks },
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
