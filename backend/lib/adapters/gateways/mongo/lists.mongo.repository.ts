import { ApplicationContext } from '../../types/basic';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import {
  BankList,
  BankListItem,
  BankruptcySoftwareList,
  BankruptcySoftwareListItem,
  ListItem,
  ListNames,
} from '../../../../../common/src/cams/lists';
import { ListsRepository } from '../../../use-cases/gateways.types';
import { Creatable } from '../../../../../common/src/cams/creatable';

const MODULE_NAME = 'LISTS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'lists';

const { using } = QueryBuilder;

export class ListsMongoRepository extends BaseMongoRepository implements ListsRepository {
  private static referenceCount: number = 0;
  private static instance: ListsMongoRepository;

  private readonly doc = using<ListItem>();

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!ListsMongoRepository.instance) {
      ListsMongoRepository.instance = new ListsMongoRepository(context);
    }
    ListsMongoRepository.referenceCount++;
    return ListsMongoRepository.instance;
  }

  public static dropInstance() {
    if (ListsMongoRepository.referenceCount > 0) {
      ListsMongoRepository.referenceCount--;
    }
    if (ListsMongoRepository.referenceCount < 1) {
      ListsMongoRepository.instance?.client.close().then();
      ListsMongoRepository.instance = null;
    }
  }

  public release() {
    ListsMongoRepository.dropInstance();
  }

  private async getList<T = ListItem[]>(listName: ListNames): Promise<T> {
    const query = this.doc('list').equals(listName);
    try {
      return (await this.getAdapter<ListItem>().find(query)) as T;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async postListItem<T = ListItem>(item: Creatable<T>): Promise<string> {
    try {
      return await this.getAdapter<Creatable<T>>().insertOne(item);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getBankruptcySoftwareList(): Promise<BankruptcySoftwareList> {
    return this.getList<BankruptcySoftwareList>('bankruptcy-software');
  }

  public async postBankruptcySoftware(
    item: Creatable<BankruptcySoftwareListItem>,
  ): Promise<string> {
    return this.postListItem<BankruptcySoftwareListItem>(item);
  }

  public async getBankList(): Promise<BankList> {
    return this.getList<BankList>('banks');
  }

  public async postBank(item: Creatable<BankListItem>): Promise<string> {
    return this.postListItem<BankListItem>(item);
  }
}
