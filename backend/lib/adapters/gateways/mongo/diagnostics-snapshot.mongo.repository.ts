import { ApplicationContext } from '../../types/basic';
import {
  DiagnosticsSnapshot,
  DiagnosticsSnapshotRepository,
} from '../../../use-cases/gateways.types';
import { getCamsError } from '../../../common-errors/error-utilities';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'DIAGNOSTICS-SNAPSHOT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'diagnostics';

export class DiagnosticsSnapshotMongoRepository
  extends BaseMongoRepository
  implements DiagnosticsSnapshotRepository
{
  private static referenceCount: number = 0;
  private static instance: DiagnosticsSnapshotMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!DiagnosticsSnapshotMongoRepository.instance) {
      DiagnosticsSnapshotMongoRepository.instance = new DiagnosticsSnapshotMongoRepository(context);
    }
    DiagnosticsSnapshotMongoRepository.referenceCount++;
    return DiagnosticsSnapshotMongoRepository.instance;
  }

  public static dropInstance() {
    if (DiagnosticsSnapshotMongoRepository.referenceCount > 0) {
      DiagnosticsSnapshotMongoRepository.referenceCount--;
    }
    if (DiagnosticsSnapshotMongoRepository.referenceCount < 1) {
      DiagnosticsSnapshotMongoRepository.instance?.client.close().then();
      DiagnosticsSnapshotMongoRepository.instance = null;
    }
  }

  public release() {
    DiagnosticsSnapshotMongoRepository.dropInstance();
  }

  async create(snapshot: DiagnosticsSnapshot): Promise<void> {
    try {
      await this.getAdapter<DiagnosticsSnapshot>().insertOne(snapshot);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create diagnostics snapshot.');
    }
  }
}
