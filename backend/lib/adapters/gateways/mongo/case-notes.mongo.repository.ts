import { PaginationParameters } from '../../../../../common/src/api/pagination';
import { CaseNote, CaseNoteBackup } from '../../../../../common/src/cams/cases';
import { getCamsError, getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import QueryBuilder, { ConditionOrConjunction, Sort } from '../../../query/query-builder';
import {
  CamsPaginationResponse,
  CaseNotesRepository,
  UpdateResult,
} from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'CASE-NOTES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'cases';

const { paginate, and, using } = QueryBuilder;
const doc = using<CaseNote>();

export class CaseNotesMongoRepository extends BaseMongoRepository implements CaseNotesRepository {
  private static referenceCount: number = 0;
  private static instance: CaseNotesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!CaseNotesMongoRepository.instance) {
      CaseNotesMongoRepository.instance = new CaseNotesMongoRepository(context);
    }
    CaseNotesMongoRepository.referenceCount++;
    return CaseNotesMongoRepository.instance;
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

  public release() {
    CaseNotesMongoRepository.dropInstance();
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

  async createCaseNoteBackup(data: CaseNoteBackup): Promise<void> {
    //TODO: Remove When tested
    try {
      await this.getAdapter<CaseNoteBackup>().insertOne(data);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create case note.');
    }
  }

  async archiveCaseNote(archiveNote: Partial<CaseNote>): Promise<UpdateResult> {
    const query = and(
      doc('documentType').equals('NOTE'),
      doc('caseId').equals(archiveNote.caseId),
      doc('id').equals(archiveNote.id),
    );

    const archiveDate = {
      archivedOn: archiveNote.archivedOn,
      archivedBy: archiveNote.archivedBy,
    };

    try {
      return await this.getAdapter<CaseNote>().updateOne(query, archiveDate);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to archive case note.');
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

  async getLegacyCaseNotesPage(
    //TODO: Remove After migration successful
    pagination: PaginationParameters,
  ): Promise<CamsPaginationResponse<CaseNote>> {
    const doc = using<CaseNote>();

    const conditions: ConditionOrConjunction<CaseNote>[] = [];
    conditions.push(doc('documentType').equals('NOTE'));
    const sortSpec: Sort<CaseNote> = {
      attributes: [['caseId', 'DESCENDING']],
    };
    const query = paginate<CaseNote>(
      pagination.offset,
      pagination.limit,
      [and(...conditions)],
      sortSpec,
    );
    try {
      return await this.getAdapter<CaseNote>().paginatedFind(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: 'Failed retrieving Legacy Case Notes.',
        },
      });
    }
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
          module: MODULE_NAME,
          message: `Failed to update case note ${note.id}.`,
        },
      });
    }
  }

  async read(id: string): Promise<CaseNote> {
    try {
      const query = doc('id').equals(id);
      return await this.getAdapter<CaseNote>().findOne(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to find case note ${id}.`,
        },
      });
    }
  }
}
