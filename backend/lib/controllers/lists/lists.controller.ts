import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import ListsUseCase from '../../use-cases/lists/lists';
import { BankListItem, BankruptcySoftwareListItem } from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';

const MODULE_NAME = 'LISTS-CONTROLLER';

export class ListsController implements CamsController {
  private readonly useCase: ListsUseCase;

  constructor() {
    this.useCase = new ListsUseCase();
  }

  public async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<object>> {
    const { listName } = context.request.params;
    const { method } = context.request;

    try {
      let data: object;
      if (method === 'GET' && listName === 'banks') {
        data = await this.useCase.getBanksList(context);
      } else if (method === 'GET' && listName === 'bankruptcy-software') {
        data = await this.useCase.getBankruptcySoftwareList(context);
      } else if (method === 'POST' && listName === 'banks') {
        const _id = await this.useCase.createBank(
          context,
          context.request.body as Creatable<BankListItem>,
        );
        data = { _id };
      } else if (method === 'POST' && listName === 'bankruptcy-software') {
        const _id = await this.useCase.createBankruptcySoftware(
          context,
          context.request.body as Creatable<BankruptcySoftwareListItem>,
        );
        data = { _id };
      } else if (method === 'DELETE' && listName === 'bankruptcy-software') {
        const { id } = context.request.params;
        if (typeof id !== 'string' || id.trim() === '') {
          throw new Error('ID is required for deletion');
        }
        this.useCase.deleteBankruptcySoftware(context, id);
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
