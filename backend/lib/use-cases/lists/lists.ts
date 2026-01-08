import { ApplicationContext } from '../../adapters/types/basic';
import {
  BankList,
  BankListItem,
  BankruptcySoftwareList,
  BankruptcySoftwareListItem,
} from '@common/cams/lists';
import Factory from '../../factory';
import { Creatable } from '@common/cams/creatable';

class ListsUseCase {
  public async getBankruptcySoftwareList(
    context: ApplicationContext,
  ): Promise<BankruptcySoftwareList> {
    const softwareList = (await Factory.getListsGateway(context).getBankruptcySoftwareList()).sort(
      (a, b) => a.value.localeCompare(b.value),
    );

    return softwareList;
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
