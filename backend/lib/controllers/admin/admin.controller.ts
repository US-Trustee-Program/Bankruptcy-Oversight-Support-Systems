import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'ADMIN-CONTROLLER';

export class AdminController implements CamsController {
  private readonly useCase: AdminUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new AdminUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    const procedure = context.request.params.procedure;
    if (procedure !== 'deleteMigrations') {
      throw new BadRequestError(MODULE_NAME, { message: 'Procedure not found' });
    }

    try {
      await this.useCase.deleteMigrations();
      return { statusCode: 204 };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
