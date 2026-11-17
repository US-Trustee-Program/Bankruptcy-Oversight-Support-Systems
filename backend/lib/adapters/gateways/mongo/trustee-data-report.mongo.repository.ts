import { ApplicationContext } from '../../types/basic';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { TrusteeDataReportRepository } from '../../../use-cases/gateways.types';
import { TrusteeDataDifference, TrusteeDataReportRun } from '@common/cams/trustee-data-report';

const MODULE_NAME = 'TRUSTEE-DATA-REPORT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-data-report';

// Keeps each insertMany request well under Cosmos request-size and RU limits.
const INSERT_BATCH_SIZE = 100;

const { using, and } = QueryBuilder;

type RunDocument = TrusteeDataReportRun & { documentType: 'TRUSTEE_DATA_REPORT_RUN' };
type DifferenceDocument = TrusteeDataDifference & {
  runId: string;
  documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE';
};
type ReportDocument = RunDocument | DifferenceDocument;

function toRun({ documentType: _documentType, ...run }: RunDocument): TrusteeDataReportRun {
  return run;
}

export class TrusteeDataReportMongoRepository
  extends BaseMongoRepository
  implements TrusteeDataReportRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeDataReportMongoRepository | null;

  private readonly runDoc = using<RunDocument>();
  private readonly anyDoc = using<ReportDocument>();

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeDataReportMongoRepository.instance) {
      TrusteeDataReportMongoRepository.instance = new TrusteeDataReportMongoRepository(context);
    }
    TrusteeDataReportMongoRepository.referenceCount++;
    return TrusteeDataReportMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeDataReportMongoRepository.referenceCount > 0) {
      TrusteeDataReportMongoRepository.referenceCount--;
    }
    if (TrusteeDataReportMongoRepository.referenceCount < 1) {
      TrusteeDataReportMongoRepository.instance?.client.close().then();
      TrusteeDataReportMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeDataReportMongoRepository.dropInstance();
  }

  public async upsertRun(run: TrusteeDataReportRun): Promise<void> {
    try {
      const query = and(
        this.runDoc('documentType').equals('TRUSTEE_DATA_REPORT_RUN'),
        this.runDoc('runId').equals(run.runId),
      );
      await this.getAdapter<RunDocument>().replaceOne(
        query,
        { ...run, documentType: 'TRUSTEE_DATA_REPORT_RUN' },
        true,
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async readRun(runId: string): Promise<TrusteeDataReportRun | null> {
    try {
      const query = and(
        this.runDoc('documentType').equals('TRUSTEE_DATA_REPORT_RUN'),
        this.runDoc('runId').equals(runId),
      );
      return toRun(await this.getAdapter<RunDocument>().findOne(query));
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        return null;
      }
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /**
   * Completed runs are few: the dataflow deletes the previous run when a new one completes,
   * so the newest is chosen here rather than through a separate pointer document.
   */
  public async readLatestCompletedRun(): Promise<TrusteeDataReportRun | null> {
    try {
      const query = and(
        this.runDoc('documentType').equals('TRUSTEE_DATA_REPORT_RUN'),
        this.runDoc('status').equals('completed'),
      );
      const runs = await this.getAdapter<RunDocument>().find(query);
      const latest = runs.reduce<RunDocument | null>(
        (newest, run) =>
          !newest || (run.finishedAt ?? '') > (newest.finishedAt ?? '') ? run : newest,
        null,
      );
      return latest ? toRun(latest) : null;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async insertDifferences(
    runId: string,
    differences: TrusteeDataDifference[],
  ): Promise<void> {
    try {
      const adapter = this.getAdapter<DifferenceDocument>();
      for (let start = 0; start < differences.length; start += INSERT_BATCH_SIZE) {
        const batch = differences
          .slice(start, start + INSERT_BATCH_SIZE)
          .map<DifferenceDocument>((difference) => ({
            ...difference,
            runId,
            documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE',
          }));
        await adapter.insertMany(batch);
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /** Deletes the run document and every difference row for the run. */
  public async deleteRun(runId: string): Promise<void> {
    try {
      await this.getAdapter<ReportDocument>().deleteMany(this.anyDoc('runId').equals(runId));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
