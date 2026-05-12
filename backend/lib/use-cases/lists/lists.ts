import { ApplicationContext } from '../../adapters/types/basic';
import { BankList, BankListItem, BankruptcySoftwareList } from '@common/cams/lists';
import factory from '../../factory';
import { Creatable } from '@common/cams/creatable';

class ListsUseCase {
  public async getBankruptcySoftwareList(
    context: ApplicationContext,
  ): Promise<BankruptcySoftwareList> {
    const softwareList = (await factory.getListsGateway(context).getBankruptcySoftwareList()).sort(
      (a, b) => a.value.localeCompare(b.value),
    );

    return softwareList;
  }

  public async getBanksList(context: ApplicationContext): Promise<BankList> {
    return await factory.getListsGateway(context).getBankList();
  }

  public async createBank(
    context: ApplicationContext,
    item: Creatable<BankListItem>,
  ): Promise<string> {
    return await factory.getListsGateway(context).postBank(item);
  }
}

export default ListsUseCase;
