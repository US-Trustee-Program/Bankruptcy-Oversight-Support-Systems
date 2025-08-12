import { ApplicationContext } from '../../types/basic';
import { Trustee, TrusteeInput } from '../../../../../common/src/cams/parties';
import { createAuditRecord } from '../../../../../common/src/cams/auditable';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import * as crypto from 'crypto';

const MODULE_NAME = 'TRUSTEES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

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
    const trusteeId = crypto.randomUUID();
    const trusteeDocument = createAuditRecord<TrusteeDocument>(
      {
        ...trustee,
        id: trusteeId,
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
}
