import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import ListsUseCase from '../../use-cases/lists/lists';

const MODULE_NAME = 'COURTS-CONTROLLER';

export class ListsController implements CamsController {
  private readonly useCase: ListsUseCase;

  constructor() {
    this.useCase = new ListsUseCase();
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<unknown[]>> {
    const { listName } = context.request.params;

    try {
      let data: unknown[] = [];
      if (listName === 'banks') {
        data = await this.useCase.getBanksList(context);
      } else if (listName === 'bankruptcy-software') {
        data = await this.useCase.getBankruptcySoftwareList(context);
      } else {
        throw new Error('Invalid list name');
      }
      return httpSuccess({
        body: {
          meta: {
            self: context.request.url,
          },
          data,
        },
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
