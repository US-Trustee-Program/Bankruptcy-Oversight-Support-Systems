import { ApplicationContext } from '../../types/basic';
import { Trustee, TrusteeInput } from '../../../../../common/src/cams/parties';
import { createAuditRecord } from '../../../../../common/src/cams/auditable';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import QueryBuilder from '../../../query/query-builder';
import * as crypto from 'crypto';

const MODULE_NAME = 'TRUSTEES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { using, and } = QueryBuilder;

export type TrusteeDocument = Trustee & {
  documentType: 'TRUSTEE';
};

export class TrusteesMongoRepository extends BaseMongoRepository implements TrusteesRepository {
  private static referenceCount: number = 0;
  private static instance: TrusteesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteesMongoRepository.instance) {
      TrusteesMongoRepository.instance = new TrusteesMongoRepository(context);
    }
    TrusteesMongoRepository.referenceCount++;
    return TrusteesMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteesMongoRepository.referenceCount > 0) {
      TrusteesMongoRepository.referenceCount--;
    }
    if (TrusteesMongoRepository.referenceCount < 1) {
      TrusteesMongoRepository.instance?.client.close().then();
      TrusteesMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteesMongoRepository.dropInstance();
  }

  async createTrustee(trustee: TrusteeInput, user: CamsUserReference): Promise<Trustee> {
    const id = crypto.randomUUID();
    const trusteeDocument = createAuditRecord<TrusteeDocument>(
      {
        ...trustee,
        id,
        documentType: 'TRUSTEE',
      },
      user,
    );

    try {
      await this.getAdapter<TrusteeDocument>().insertOne(trusteeDocument);
      return trusteeDocument;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee ${trustee.name}.`,
      });
    }
  }

  async listTrustees(): Promise<Trustee[]> {
    try {
      const doc = using<TrusteeDocument>();
      const query = doc('documentType').equals('TRUSTEE');
      return await this.getAdapter<TrusteeDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to retrieve trustees list.',
      });
    }
  }

  async read(id: string): Promise<Trustee> {
    try {
      const doc = using<TrusteeDocument>();
      const query = and(doc('documentType').equals('TRUSTEE'), doc('id').equals(id));
      const trustee = await this.getAdapter<TrusteeDocument>().findOne(query);

      if (!trustee) {
        throw new Error(`Trustee with ID ${id} not found.`);
      }

      return trustee;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee with ID ${id}.`,
      });
    }
  }
}
