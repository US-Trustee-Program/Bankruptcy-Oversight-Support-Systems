import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { ArchivedCasesRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'ARCHIVED-CASES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'archived-cases';

interface ArchivedDocument {
  archivedOn: string;
  archivedBy: { id: string; name: string };
  archivedReason: string;
  originalCollection: string;
  caseId: string;
}

const { using } = QueryBuilder;
const doc = using<ArchivedDocument>();

export class ArchivedCasesMongoRepository
  extends BaseMongoRepository
  implements ArchivedCasesRepository
{
  private static referenceCount: number = 0;
  private static instance: ArchivedCasesMongoRepository | null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!ArchivedCasesMongoRepository.instance) {
      ArchivedCasesMongoRepository.instance = new ArchivedCasesMongoRepository(context);
    }
    ArchivedCasesMongoRepository.referenceCount++;
    return ArchivedCasesMongoRepository.instance;
  }

  public static dropInstance() {
    if (ArchivedCasesMongoRepository.referenceCount > 0) {
      ArchivedCasesMongoRepository.referenceCount--;
    }
    if (ArchivedCasesMongoRepository.referenceCount < 1) {
      ArchivedCasesMongoRepository.instance?.client.close().then();
      ArchivedCasesMongoRepository.instance = null;
    }
  }

  public release() {
    ArchivedCasesMongoRepository.dropInstance();
  }

  async archiveDocument<T>(document: T, originalCollection: string, caseId: string): Promise<void> {
    try {
      const archiveData = {
        ...document,
        archivedOn: new Date().toISOString(),
        archivedBy: SYSTEM_USER_REFERENCE,
        archivedReason: 'DELETED_IN_ACMS',
        originalCollection,
        caseId,
      };

      await this.getAdapter<ArchivedDocument>().insertOne(archiveData);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to archive document from ${originalCollection}.`,
        },
      });
    }
  }

  async getCaseArchives<T>(caseId: string): Promise<T[]> {
    try {
      const query = doc('caseId').equals(caseId);
      return await this.getAdapter<T>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve archived documents for case ${caseId}.`,
        },
      });
    }
  }
}
