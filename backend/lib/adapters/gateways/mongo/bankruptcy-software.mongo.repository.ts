import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
} from '@common/cams/bankruptcy-software';
import { Creatable } from '@common/cams/creatable';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { BankruptcySoftwareRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-MONGO-REPOSITORY';
const COLLECTION_NAME = 'bankruptcy-software';

const { using, orderBy } = QueryBuilder;
const doc = using<BankruptcySoftwareProfile>();

export class BankruptcySoftwareMongoRepository
  extends BaseMongoRepository
  implements BankruptcySoftwareRepository
{
  private static referenceCount: number = 0;
  private static instance: BankruptcySoftwareMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!BankruptcySoftwareMongoRepository.instance) {
      BankruptcySoftwareMongoRepository.instance = new BankruptcySoftwareMongoRepository(context);
    }
    BankruptcySoftwareMongoRepository.referenceCount++;
    return BankruptcySoftwareMongoRepository.instance;
  }

  public static dropInstance() {
    if (BankruptcySoftwareMongoRepository.referenceCount > 0) {
      BankruptcySoftwareMongoRepository.referenceCount--;
    }
    if (BankruptcySoftwareMongoRepository.referenceCount < 1) {
      BankruptcySoftwareMongoRepository.instance?.client.close().then();
      BankruptcySoftwareMongoRepository.instance = null;
    }
  }

  public release() {
    BankruptcySoftwareMongoRepository.dropInstance();
  }

  async getSoftwareList(): Promise<BankruptcySoftwareProfile[]> {
    const query = doc('documentType').equals('BANKRUPTCY_SOFTWARE');
    try {
      return await this.getAdapter<BankruptcySoftwareProfile>().find(
        query,
        orderBy<BankruptcySoftwareProfile>(['name', 'ASCENDING']),
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bankruptcy software.');
    }
  }

  async findSoftwareById(id: string): Promise<BankruptcySoftwareProfile> {
    const query = doc('id').equals(id);
    try {
      return await this.getAdapter<BankruptcySoftwareProfile>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bankruptcy software.');
    }
  }

  async updateSoftware(
    id: string,
    update: BankruptcySoftwareProfile,
  ): Promise<BankruptcySoftwareProfile> {
    const query = doc('id').equals(id);
    try {
      await this.getAdapter<BankruptcySoftwareProfile>().replaceOne(query, update);
      return update;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update bankruptcy software.');
    }
  }

  async createSoftware(
    software: Creatable<BankruptcySoftwareProfile>,
  ): Promise<BankruptcySoftwareProfile> {
    try {
      const newId = await this.getAdapter<BankruptcySoftwareProfile>().insertOne(
        software as BankruptcySoftwareProfile,
      );
      const query = doc('id').equals(newId);
      return await this.getAdapter<BankruptcySoftwareProfile>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create bankruptcy software.');
    }
  }

  async createSoftwareAuditRecord(
    history: Creatable<BankruptcySoftwareAuditHistory>,
  ): Promise<void> {
    try {
      await this.getAdapter<BankruptcySoftwareAuditHistory>().insertOne(
        history as BankruptcySoftwareAuditHistory,
      );
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to create bankruptcy software audit record.',
      );
    }
  }

  async getSoftwareHistory(softwareId: string): Promise<BankruptcySoftwareAuditHistory[]> {
    const auditDoc = using<BankruptcySoftwareAuditHistory>();
    const query = auditDoc('softwareId').equals(softwareId);
    try {
      return await this.getAdapter<BankruptcySoftwareAuditHistory>().find(query);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to retrieve bankruptcy software history.',
      );
    }
  }
}
