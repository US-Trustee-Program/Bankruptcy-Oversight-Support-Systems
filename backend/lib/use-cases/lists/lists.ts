import { ApplicationContext } from '../../adapters/types/basic';
import {
  BankList,
  BankListItem,
  BankruptcySoftwareList,
  BankruptcySoftwareListItem,
} from '../../../../common/src/cams/lists';
import Factory from '../../factory';
import { Creatable } from '../../../../common/src/cams/creatable';

class ListsUseCase {
  public async getBankruptcySoftwareList(
    context: ApplicationContext,
  ): Promise<BankruptcySoftwareList> {
    return await Factory.getListsGateway(context).getBankruptcySoftwareList();
  }

  public async createBankruptcySoftware(
    context: ApplicationContext,
    item: Creatable<BankruptcySoftwareListItem>,
  ): Promise<string> {
    return await Factory.getListsGateway(context).postBankruptcySoftware(item);
  }

  public async getBanksList(context: ApplicationContext): Promise<BankList> {
    return await Factory.getListsGateway(context).getBankList();
  }

  public async createBank(
    context: ApplicationContext,
    item: Creatable<BankListItem>,
  ): Promise<string> {
    return await Factory.getListsGateway(context).postBank(item);
  }

  public async deleteBankruptcySoftware(context: ApplicationContext, id: string): Promise<void> {
    return await Factory.getListsGateway(context).deleteBankruptcySoftware(id);
  }
}

export default ListsUseCase;
