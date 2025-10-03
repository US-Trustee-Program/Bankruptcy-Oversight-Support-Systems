import { ApplicationContext } from '../../adapters/types/basic';
import { BankList, BankruptcySoftwareList } from '../../../../common/src/cams/lists';
import Factory from '../../factory';

class ListsUseCase {
  public async getBankruptcySoftwareList(
    context: ApplicationContext,
  ): Promise<BankruptcySoftwareList> {
    return await Factory.getListsGateway(context).getBankruptcySoftwareList();
  }

  public async getBanksList(context: ApplicationContext): Promise<BankList> {
    return await Factory.getListsGateway(context).getBankList();
  }
}

export default ListsUseCase;
