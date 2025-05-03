import { CaseNote } from '../../../../../common/src/cams/cases';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { CaseNotesRepository, UpdateResult } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'CASE-NOTES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'cases';

const { and, using } = QueryBuilder;
const doc = using<CaseNote>();

export class CaseNotesMongoRepository extends BaseMongoRepository implements CaseNotesRepository {
  private static instance: CaseNotesMongoRepository;
  private static referenceCount: number = 0;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static dropInstance() {
    if (CaseNotesMongoRepository.referenceCount > 0) {
      CaseNotesMongoRepository.referenceCount--;
    }
    if (CaseNotesMongoRepository.referenceCount < 1) {
      CaseNotesMongoRepository.instance.client.close().then();
      CaseNotesMongoRepository.instance = null;
    }
  }

  public static getInstance(context: ApplicationContext) {
    if (!CaseNotesMongoRepository.instance) {
      CaseNotesMongoRepository.instance = new CaseNotesMongoRepository(context);
    }
    CaseNotesMongoRepository.referenceCount++;
    return CaseNotesMongoRepository.instance;
  }

  async archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult> {
    const query = and(
      doc('documentType').equals('NOTE'),
      doc('caseId').equals(archiveNote.caseId),
      doc('id').equals(archiveNote.id),
    );

    const archiveDate = {
      archivedBy: archiveNote.archivedBy,
      archivedOn: archiveNote.archivedOn,
    };

    try {
      return await this.getAdapter<CaseNote>().updateOne(query, archiveDate);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to archive case note.');
    }
  }

  async create(data: CaseNote): Promise<CaseNote> {
    try {
      const newId = await this.getAdapter<CaseNote>().insertOne(data);
      const query = and(
        doc('documentType').equals('NOTE'),
        doc('caseId').equals(data.caseId),
        doc('id').equals(newId),
      );
      return this.getAdapter<CaseNote>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create case note.');
    }
  }

  async getNotesByCaseId(caseId: string): Promise<CaseNote[]> {
    const query = and(
      doc('documentType').equals('NOTE'),
      doc('caseId').equals(caseId),
      doc('archivedOn').notExists(),
    );

    try {
      return await this.getAdapter<CaseNote>().find(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve case note.');
    }
  }

  async read(id: string): Promise<CaseNote> {
    try {
      const query = doc('id').equals(id);
      return await this.getAdapter<CaseNote>().findOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to find case note ${id}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  public release() {
    CaseNotesMongoRepository.dropInstance();
  }

  async update(note: Partial<CaseNote>): Promise<void> {
    try {
      const query = and(
        doc('documentType').equals('NOTE'),
        doc('caseId').equals(note.caseId),
        doc('id').equals(note.id),
      );

      delete note.caseId;
      delete note.id;

      await this.getAdapter<CaseNote>().updateOne(query, note);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to update case note ${note.id}.`,
          module: MODULE_NAME,
        },
      });
    }
  }
}
