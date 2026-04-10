import { ApplicationContext } from '../../types/basic';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteesRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { CamsUserReference } from '@common/cams/users';
import QueryBuilder from '../../../query/query-builder';
import { Creatable } from '@common/cams/creatable';
import {
  Trustee,
  TrusteeHistory,
  TrusteeInput,
  TrusteeOversightAssignment,
} from '@common/cams/trustees';
import { isNotFoundError, NotFoundError } from '../../../common-errors/not-found-error';
import { normalizeName, escapeRegex } from '../../../use-cases/dataflows/trustee-match.helpers';
import { generateSearchTokens } from '../../utils/phonetic-helper';

const MODULE_NAME = 'TRUSTEES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { using, and } = QueryBuilder;

export type TrusteeDocument = Trustee & {
  documentType: 'TRUSTEE';
};

// Type augmentation for dot-notation queries on nested fields
type TrusteeDocumentQueryable = TrusteeDocument & {
  'legacy.truIds'?: string[]; // truthful type — callers wrap single values in an array before passing to contains()
  'public.address.state'?: string;
  phoneticTokens?: string[];
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
        phoneticTokens: generateSearchTokens(trustee.name),
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

  async findTrusteesByName(name: string): Promise<Trustee[]> {
    try {
      const normalized = normalizeName(name);
      const escaped = escapeRegex(normalized);
      const doc = using<TrusteeDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE'),
        doc('name').regex(new RegExp(`^${escaped}$`, 'i')),
      );
      return await this.getAdapter<TrusteeDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustees by name.`,
      });
    }
  }

  async searchTrusteesByName(name: string): Promise<Trustee[]> {
    try {
      const normalized = normalizeName(name);
      const escaped = escapeRegex(normalized);
      const doc = using<TrusteeDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE'),
        doc('name').regex(new RegExp(escaped, 'i')),
      );
      return await this.getAdapter<TrusteeDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to search trustees by name.`,
      });
    }
  }

  async searchTrusteesByPhoneticTokens(tokens: string[]): Promise<Trustee[]> {
    try {
      const doc = using<TrusteeDocumentQueryable>();
      const query = and(
        doc('documentType').equals('TRUSTEE'),
        doc('phoneticTokens').contains(tokens),
      );
      return await this.getAdapter<TrusteeDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to search trustees by phonetic tokens.`,
      });
    }
  }

  async findTrusteeByNameAndState(
    firstName: string,
    lastName: string,
    state: string,
  ): Promise<Trustee | null> {
    try {
      // Normalize the name components
      const normalizedFirstName = normalizeName(firstName);
      const normalizedLastName = normalizeName(lastName);
      const normalizedState = state.trim().toUpperCase();

      // Escape regex special characters
      const escapedFirstName = escapeRegex(normalizedFirstName);
      const escapedLastName = escapeRegex(normalizedLastName);

      // Build query with word-boundary matching to handle middle names/suffixes
      // Matches "John Smith", "John Q. Smith", "John Smith Jr.", etc.
      const doc = using<TrusteeDocumentQueryable>();
      const query = and(
        doc('documentType').equals('TRUSTEE'),
        doc('name').regex(new RegExp(`\\b${escapedFirstName}\\b.*\\b${escapedLastName}\\b`, 'i')),
        doc('public.address.state').equals(normalizedState),
      );

      return await this.getAdapter<TrusteeDocument>().findOne(query);
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee by name and state.`,
      });
    }
  }

  async findTrusteeByLegacyTruId(trusteeId: string): Promise<Trustee | null> {
    try {
      const doc = using<TrusteeDocumentQueryable>();
      const query = and(
        doc('documentType').equals('TRUSTEE'),
        doc('legacy.truIds').contains([trusteeId]),
      );
      return await this.getAdapter<TrusteeDocumentQueryable>().findOne(query);
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to find trustee by legacy TRU_ID ${trusteeId}.`,
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
        phoneticTokens: generateSearchTokens(input.name),
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

  async setPhoneticTokens(trusteeId: string, tokens: string[]): Promise<void> {
    try {
      const doc = using<TrusteeDocument>();
      const query = and(doc('documentType').equals('TRUSTEE'), doc('trusteeId').equals(trusteeId));
      await this.getAdapter<TrusteeDocument>().updateOne(query, { phoneticTokens: tokens });
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to set phonetic tokens for trustee ${trusteeId}.`,
      });
    }
  }

  async deleteAll(): Promise<number> {
    try {
      const doc = using<TrusteeDocument>();
      const query = doc('documentType').equals('TRUSTEE');
      return await this.getAdapter<TrusteeDocument>().deleteMany(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: 'Failed to delete all trustees.',
      });
    }
  }
}
