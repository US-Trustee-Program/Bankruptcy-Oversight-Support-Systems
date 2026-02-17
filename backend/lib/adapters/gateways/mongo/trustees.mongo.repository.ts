import { ApplicationContext } from '../../types/basic';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { CamsUserReference } from '@common/cams/users';
import QueryBuilder from '../../../query/query-builder';
import { Creatable } from '../../types/persistence.gateway';
import {
  Trustee,
  TrusteeHistory,
  TrusteeInput,
  TrusteeOversightAssignment,
} from '@common/cams/trustees';
import { NotFoundError } from '../../../common-errors/not-found-error';

const MODULE_NAME = 'TRUSTEES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { using, and } = QueryBuilder;

export type TrusteeDocument = Trustee & {
  documentType: 'TRUSTEE';
};

// Type augmentation for dot-notation queries on nested fields
type TrusteeDocumentQueryable = TrusteeDocument & {
  'legacy.truId'?: string;
};

type TrusteeOversightAssignmentDocument = TrusteeOversightAssignment & {
  documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT';
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
    const trusteeDocument = createAuditRecord<Creatable<TrusteeDocument>>(
      {
        ...trustee,
        documentType: 'TRUSTEE',
        trusteeId: crypto.randomUUID(),
      },
      user,
    );

    try {
      const id = await this.getAdapter<Creatable<TrusteeDocument>>().insertOne(trusteeDocument);
      return { id, ...trusteeDocument };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee ${trustee.name}.`,
      });
    }
  }

  async createTrusteeHistory(history: Creatable<TrusteeHistory>) {
    try {
      await this.getAdapter<Creatable<TrusteeHistory>>().insertOne(history, {
        useProvidedId: true,
      });
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message:
            'Unable to create trustee history. Please try again later. If the problem persists, please contact USTP support.',
          module: MODULE_NAME,
        },
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

  async findTrusteeByLegacyTruId(truId: string): Promise<Trustee | null> {
    try {
      const doc = using<TrusteeDocumentQueryable>();
      const query = and(doc('documentType').equals('TRUSTEE'), doc('legacy.truId').equals(truId));
      return await this.getAdapter<TrusteeDocumentQueryable>().findOne(query);
    } catch (originalError) {
      if (originalError instanceof NotFoundError) {
        return null;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee by legacy TRU_ID ${truId}.`,
      });
    }
  }

  async listTrusteeHistory(id: string): Promise<TrusteeHistory[]> {
    const doc = using<TrusteeHistory>();
    try {
      const query = and(doc('documentType').regex('^AUDIT_'), doc('trusteeId').equals(id));
      const adapter = this.getAdapter<TrusteeHistory>();
      return await adapter.find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to get trustee history for ${id}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  async read(id: string): Promise<Trustee> {
    try {
      const doc = using<TrusteeDocument>();
      const query = and(doc('documentType').equals('TRUSTEE'), doc('trusteeId').equals(id));
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

  async updateTrustee(
    id: string,
    input: TrusteeDocument,
    userRef: CamsUserReference,
  ): Promise<Trustee> {
    try {
      const doc = using<TrusteeDocument>();
      const query = and(doc('documentType').equals('TRUSTEE'), doc('trusteeId').equals(id));

      const updateData = {
        ...input,
        updatedOn: new Date().toISOString(),
        updatedBy: userRef,
      };

      const result = await this.getAdapter<TrusteeDocument>().replaceOne(query, updateData);

      if (result.modifiedCount === 0) {
        throw new NotFoundError(MODULE_NAME);
      }

      // Return the updated trustee by reading it back
      return await this.read(id);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update trustee with ID ${id}.`,
        },
      });
    }
  }

  async getTrusteeOversightAssignments(trusteeId: string): Promise<TrusteeOversightAssignment[]> {
    try {
      const doc = using<TrusteeOversightAssignmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_OVERSIGHT_ASSIGNMENT'),
        doc('trusteeId').equals(trusteeId),
        doc('unassignedOn').notExists(),
      );
      return await this.getAdapter<TrusteeOversightAssignmentDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve oversight assignments for trustee ${trusteeId}.`,
      });
    }
  }

  async createTrusteeOversightAssignment(
    assignment: Creatable<TrusteeOversightAssignment>,
  ): Promise<TrusteeOversightAssignment> {
    try {
      const id = await this.getAdapter<Creatable<TrusteeOversightAssignmentDocument>>().insertOne({
        documentType: 'TRUSTEE_OVERSIGHT_ASSIGNMENT',
        ...assignment,
      });
      return { id, ...assignment };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create oversight assignment for trustee ${assignment.trusteeId}.`,
      });
    }
  }

  async updateTrusteeOversightAssignment(
    id: string,
    updates: Partial<TrusteeOversightAssignment>,
  ): Promise<TrusteeOversightAssignment> {
    try {
      const doc = using<TrusteeOversightAssignmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_OVERSIGHT_ASSIGNMENT'),
        doc('id').equals(id),
      );

      const updateData = {
        ...updates,
      } as Partial<TrusteeOversightAssignmentDocument>;

      const result = await this.getAdapter<TrusteeOversightAssignmentDocument>().updateOne(
        query,
        updateData,
      );

      if (result.matchedCount === 0) {
        throw new NotFoundError(MODULE_NAME, { message: `Oversight assignment ${id} not found.` });
      }

      const updated = await this.getAdapter<TrusteeOversightAssignmentDocument>().findOne(query);

      return updated;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update oversight assignment ${id}.`,
        },
      });
    }
  }
}
