import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { TrusteeAssistantsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeAssistant, TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '../../types/persistence.gateway';

const MODULE_NAME = 'TRUSTEE-ASSISTANTS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { using, and } = QueryBuilder;

type TrusteeAssistantDocument = TrusteeAssistant & {
  documentType: 'TRUSTEE_ASSISTANT';
};

export class TrusteeAssistantsMongoRepository
  extends BaseMongoRepository
  implements TrusteeAssistantsRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeAssistantsMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeAssistantsMongoRepository.instance) {
      TrusteeAssistantsMongoRepository.instance = new TrusteeAssistantsMongoRepository(context);
    }
    TrusteeAssistantsMongoRepository.referenceCount++;
    return TrusteeAssistantsMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeAssistantsMongoRepository.referenceCount > 0) {
      TrusteeAssistantsMongoRepository.referenceCount--;
    }
    if (TrusteeAssistantsMongoRepository.referenceCount < 1) {
      TrusteeAssistantsMongoRepository.instance?.client.close().then();
      TrusteeAssistantsMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeAssistantsMongoRepository.dropInstance();
  }

  async read(id: string): Promise<TrusteeAssistant> {
    try {
      const doc = using<TrusteeAssistantDocument>();
      const query = and(doc('documentType').equals('TRUSTEE_ASSISTANT'), doc('id').equals(id));
      const assistant = await this.getAdapter<TrusteeAssistantDocument>().findOne(query);

      if (!assistant) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee assistant with ID ${id} not found.`,
        });
      }

      return assistant;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee assistant with ID ${id}.`,
      });
    }
  }

  async getTrusteeAssistants(trusteeId: string): Promise<TrusteeAssistant[]> {
    try {
      const doc = using<TrusteeAssistantDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('trusteeId').equals(trusteeId),
      );
      return await this.getAdapter<TrusteeAssistantDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve assistants for trustee ${trusteeId}.`,
      });
    }
  }

  async createAssistant(
    trusteeId: string,
    input: TrusteeAssistantInput,
    user: CamsUserReference,
  ): Promise<TrusteeAssistant> {
    const assistantDocument = createAuditRecord<Creatable<TrusteeAssistantDocument>>(
      {
        ...input,
        trusteeId,
        documentType: 'TRUSTEE_ASSISTANT',
      },
      user,
    );

    try {
      const id =
        await this.getAdapter<Creatable<TrusteeAssistantDocument>>().insertOne(assistantDocument);
      return { id, ...assistantDocument };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee assistant for trustee ${trusteeId}.`,
      });
    }
  }

  async updateAssistant(
    trusteeId: string,
    assistantId: string,
    input: TrusteeAssistantInput,
    user: CamsUserReference,
  ): Promise<TrusteeAssistant> {
    try {
      const doc = using<TrusteeAssistantDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('id').equals(assistantId),
      );

      const existingAssistant = await this.getAdapter<TrusteeAssistantDocument>().findOne(query);

      if (!existingAssistant) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee assistant with ID ${assistantId} not found.`,
        });
      }

      if (existingAssistant.trusteeId !== trusteeId) {
        const error: Error & { code?: string } = new Error(
          `Assistant ${assistantId} does not belong to trustee ${trusteeId}`,
        );
        error.code = 'TRUSTEE_ASSISTANT_FORBIDDEN';
        throw error;
      }

      const updatedAssistant: TrusteeAssistantDocument = {
        ...existingAssistant,
        ...input,
        id: assistantId,
        trusteeId,
        documentType: 'TRUSTEE_ASSISTANT',
        updatedBy: user,
        updatedOn: new Date().toISOString(),
      };

      await this.getAdapter<TrusteeAssistantDocument>().replaceOne(query, updatedAssistant);

      return updatedAssistant;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update trustee assistant ${assistantId}.`,
      });
    }
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    try {
      const doc = using<TrusteeAssistantDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_ASSISTANT'),
        doc('id').equals(assistantId),
      );

      // deleteOne throws NotFoundError if deletedCount !== 1, so no need to check result
      await this.getAdapter<TrusteeAssistantDocument>().deleteOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to delete trustee assistant ${assistantId}.`,
      });
    }
  }
}
