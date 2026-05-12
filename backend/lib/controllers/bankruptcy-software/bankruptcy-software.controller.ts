import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { BankruptcySoftwareUseCase } from '../../use-cases/bankruptcy-software/bankruptcy-software';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-CONTROLLER';

export class BankruptcySoftwareController {
  private readonly useCase: BankruptcySoftwareUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new BankruptcySoftwareUseCase(context);
  }

  async handleGet(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<BankruptcySoftwareProfile[]>> {
    this.requireSuperUser(context);
    const softwareList = await this.useCase.getSoftwareList();
    return httpSuccess({
      statusCode: 200,
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
      statusCode: 201,
      body: { meta: { self: context.request.url }, data: software },
    });
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
