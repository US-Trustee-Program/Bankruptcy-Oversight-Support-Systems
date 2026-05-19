import { BankAuditHistory, BankProfile } from '@common/cams/banks';
import { Creatable } from '@common/cams/creatable';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { BanksRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'BANKS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'banks';

const { using, orderBy } = QueryBuilder;
const doc = using<BankProfile>();

export class BanksMongoRepository extends BaseMongoRepository implements BanksRepository {
  private static referenceCount: number = 0;
  private static instance: BanksMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!BanksMongoRepository.instance) {
      BanksMongoRepository.instance = new BanksMongoRepository(context);
    }
    BanksMongoRepository.referenceCount++;
    return BanksMongoRepository.instance;
  }

  public static dropInstance() {
    if (BanksMongoRepository.referenceCount > 0) {
      BanksMongoRepository.referenceCount--;
    }
    if (BanksMongoRepository.referenceCount < 1) {
      BanksMongoRepository.instance?.client.close().then();
      BanksMongoRepository.instance = null;
    }
  }

  public release() {
    BanksMongoRepository.dropInstance();
  }

  async getBank(id: string): Promise<BankProfile> {
    const query = doc('id').equals(id);
    try {
      return await this.getAdapter<BankProfile>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bank.');
    }
  }

  async getBanks(): Promise<BankProfile[]> {
    const query = doc('documentType').equals('BANK_PROFILE');
    try {
      return await this.getAdapter<BankProfile>().find(
        query,
        orderBy<BankProfile>(['name', 'ASCENDING']),
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve banks.');
    }
  }

  async createBank(bank: Creatable<BankProfile>): Promise<BankProfile> {
    try {
      const newId = await this.getAdapter<BankProfile>().insertOne(bank as BankProfile);
      return { ...bank, id: newId } as BankProfile;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create bank.');
    }
  }

  async updateBank(id: string, bank: BankProfile): Promise<BankProfile> {
    const query = doc('id').equals(id);
    try {
      await this.getAdapter<BankProfile>().replaceOne(query, bank);
      return bank;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update bank.');
    }
  }

  async createBankAuditRecord(history: Creatable<BankAuditHistory>): Promise<void> {
    try {
      await this.getAdapter<BankAuditHistory>().insertOne(history as BankAuditHistory);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create bank audit record.');
    }
  }

  async getBankHistory(bankId: string): Promise<BankAuditHistory[]> {
    const auditDoc = using<BankAuditHistory>();
    const query = auditDoc('bankId').equals(bankId);
    try {
      return await this.getAdapter<BankAuditHistory>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bank history.');
    }
  }
}
