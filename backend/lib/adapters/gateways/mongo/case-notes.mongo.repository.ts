import { CaseNote } from '../../../../../common/src/cams/cases';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { CaseNotesRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME: string = 'CASE_NOTES_MONGO_REPOSITORY';
const COLLECTION_NAME = 'cases';
const { and, equals } = QueryBuilder;

export class CaseNotesMongoRepository extends BaseMongoRepository implements CaseNotesRepository {
  private static referenceCount: number = 0;
  private static instance: CaseNotesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!CaseNotesMongoRepository.instance)
      CaseNotesMongoRepository.instance = new CaseNotesMongoRepository(context);
    CaseNotesMongoRepository.referenceCount++;
    return CaseNotesMongoRepository.instance;
  }

  public static dropInstance() {
    if (CaseNotesMongoRepository.referenceCount > 0) CaseNotesMongoRepository.referenceCount--;
    if (CaseNotesMongoRepository.referenceCount < 1) {
      CaseNotesMongoRepository.instance.client.close().then();
      CaseNotesMongoRepository.instance = null;
    }
  }

  public release() {
    CaseNotesMongoRepository.dropInstance();
  }

  async create(data: CaseNote): Promise<string> {
    try {
      return await this.getAdapter<CaseNote>().insertOne(data);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create case note.');
    }
  }

  async getNotesByCaseId(caseId: string): Promise<CaseNote[]> {
    const query = QueryBuilder.build(
      and(
        equals<CaseNote['documentType']>('documentType', 'NOTE'),
        equals<string>('caseId', caseId),
      ),
    );
    try {
      const notes = await this.getAdapter<CaseNote>().find(query);
      return notes;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve case note.');
    }
  }
}
