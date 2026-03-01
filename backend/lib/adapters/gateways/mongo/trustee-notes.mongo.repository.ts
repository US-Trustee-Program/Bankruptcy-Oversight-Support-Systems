import { TrusteeNote } from '@common/cams/trustee-notes';
import { getCamsErrorWithStack, getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeNotesRepository, UpdateResult } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'TRUSTEE-NOTES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { and, using } = QueryBuilder;
const doc = using<TrusteeNote>();

export class TrusteeNotesMongoRepository
  extends BaseMongoRepository
  implements TrusteeNotesRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeNotesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeNotesMongoRepository.instance) {
      TrusteeNotesMongoRepository.instance = new TrusteeNotesMongoRepository(context);
    }
    TrusteeNotesMongoRepository.referenceCount++;
    return TrusteeNotesMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeNotesMongoRepository.referenceCount > 0) {
      TrusteeNotesMongoRepository.referenceCount--;
    }
    if (TrusteeNotesMongoRepository.referenceCount < 1) {
      TrusteeNotesMongoRepository.instance?.client.close().then();
      TrusteeNotesMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeNotesMongoRepository.dropInstance();
  }

  async create(data: TrusteeNote): Promise<TrusteeNote> {
    try {
      const newId = await this.getAdapter<TrusteeNote>().insertOne(data);
      const query = and(
        doc('documentType').equals('TRUSTEE_NOTE'),
        doc('trusteeId').equals(data.trusteeId),
        doc('id').equals(newId),
      );
      return this.getAdapter<TrusteeNote>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create trustee note.');
    }
  }

  async archiveTrusteeNote(archiveNote: Partial<TrusteeNote>): Promise<UpdateResult> {
    const query = and(
      doc('documentType').equals('TRUSTEE_NOTE'),
      doc('trusteeId').equals(archiveNote.trusteeId),
      doc('id').equals(archiveNote.id),
    );

    const archiveDate = {
      archivedOn: archiveNote.archivedOn,
      archivedBy: archiveNote.archivedBy,
    };

    try {
      return await this.getAdapter<TrusteeNote>().updateOne(query, archiveDate);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to archive trustee note.');
    }
  }

  async getNotesByTrusteeId(trusteeId: string): Promise<TrusteeNote[]> {
    const query = and(
      doc('documentType').equals('TRUSTEE_NOTE'),
      doc('trusteeId').equals(trusteeId),
      doc('archivedOn').notExists(),
    );

    try {
      return await this.getAdapter<TrusteeNote>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve trustee notes.');
    }
  }

  async update(note: Partial<TrusteeNote>): Promise<void> {
    try {
      const query = and(
        doc('documentType').equals('TRUSTEE_NOTE'),
        doc('trusteeId').equals(note.trusteeId),
        doc('id').equals(note.id),
      );

      delete note.trusteeId;
      delete note.id;

      await this.getAdapter<TrusteeNote>().updateOne(query, note);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update trustee note ${note.id}.`,
        },
      });
    }
  }

  async read(id: string): Promise<TrusteeNote> {
    try {
      const query = doc('id').equals(id);
      return await this.getAdapter<TrusteeNote>().findOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to find trustee note ${id}.`,
        },
      });
    }
  }
}
