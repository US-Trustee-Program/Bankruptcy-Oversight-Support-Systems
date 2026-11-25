import { ApplicationContext } from '../../types/basic';
import QueryBuilder from '../../../query/query-builder';
import { getCamsError } from '../../../common-errors/error-utilities';
import { isNotFoundError } from '../../../common-errors/not-found-error';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import { TrusteeDataReportRepository } from '../../../use-cases/gateways.types';
import {
  TrusteeDataDifference,
  TrusteeDataReportRun,
  TrusteeDataReportSummary,
  StoredTrusteeDataReportSummary,
} from '@common/cams/trustee-data-report';

const MODULE_NAME = 'TRUSTEE-DATA-REPORT-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-data-report';

// Keeps each insertMany request well under Cosmos request-size and RU limits.
const INSERT_BATCH_SIZE = 100;

const { using, and } = QueryBuilder;

type RunDocument = TrusteeDataReportRun & { documentType: 'TRUSTEE_DATA_REPORT_RUN' };
// Difference rows and page counts carry the page that produced them, so a retried page can
// replace its own results instead of adding them a second time.
type DifferenceDocument = TrusteeDataDifference & {
  runId: string;
  pageKey: string;
  documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE';
};
type PageDocument = {
  runId: string;
  pageKey: string;
  documentType: 'TRUSTEE_DATA_REPORT_PAGE';
  summary: StoredTrusteeDataReportSummary;
};
type ReportDocument = RunDocument | DifferenceDocument | PageDocument;

function toRun({
  documentType: _documentType,
  _id,
  ...run
}: RunDocument & { _id?: unknown }): TrusteeDataReportRun {
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
  private readonly resultDoc = using<DifferenceDocument | PageDocument>();

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
   * Completed runs are few: the dataflow deletes older runs when a new one completes,
   * so the newest is chosen here rather than through a separate pointer document.
   */
  public async readLatestCompletedRun(): Promise<TrusteeDataReportRun | null> {
    return this.readLatestRunWithStatus('completed');
  }

  public async readLatestFailedRun(): Promise<TrusteeDataReportRun | null> {
    return this.readLatestRunWithStatus('failed');
  }

  public async listCompletedRunIds(): Promise<string[]> {
    try {
      const runs = await this.getAdapter<RunDocument>().find(
        and(
          this.runDoc('documentType').equals('TRUSTEE_DATA_REPORT_RUN'),
          this.runDoc('status').equals('completed'),
        ),
      );
      return runs.map((run) => run.runId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  private async readLatestRunWithStatus(
    status: TrusteeDataReportRun['status'],
  ): Promise<TrusteeDataReportRun | null> {
    try {
      const query = and(
        this.runDoc('documentType').equals('TRUSTEE_DATA_REPORT_RUN'),
        this.runDoc('status').equals(status),
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

  /**
   * Replaces one page's difference rows and counts. Deleting first makes it safe to repeat when
   * a page is retried. (A replace would not do: the adapter's replaceOne throws when an upsert
   * changes nothing.)
   */
  public async replacePageResults(
    runId: string,
    pageKey: string,
    differences: TrusteeDataDifference[],
    summary: TrusteeDataReportSummary,
  ): Promise<void> {
    try {
      await this.getAdapter<DifferenceDocument | PageDocument>().deleteMany(
        and(this.resultDoc('runId').equals(runId), this.resultDoc('pageKey').equals(pageKey)),
      );
      const rows = this.getAdapter<DifferenceDocument>();
      for (let start = 0; start < differences.length; start += INSERT_BATCH_SIZE) {
        const batch = differences
          .slice(start, start + INSERT_BATCH_SIZE)
          .map<DifferenceDocument>((difference) => ({
            ...difference,
            runId,
            pageKey,
            documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE',
          }));
        await rows.insertMany(batch);
      }
      await this.getAdapter<PageDocument>().insertOne({
        runId,
        pageKey,
        documentType: 'TRUSTEE_DATA_REPORT_PAGE',
        summary,
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async readPageSummaries(runId: string): Promise<StoredTrusteeDataReportSummary[]> {
    try {
      const page = using<PageDocument>();
      const pages = await this.getAdapter<PageDocument>().find(
        and(page('documentType').equals('TRUSTEE_DATA_REPORT_PAGE'), page('runId').equals(runId)),
      );
      return pages.map((doc) => doc.summary);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /** Deletes the run's difference rows and page counts, keeping the run document. */
  public async deleteRunResults(runId: string): Promise<void> {
    try {
      await this.getAdapter<DifferenceDocument | PageDocument>().deleteMany(
        and(
          this.resultDoc('runId').equals(runId),
          this.resultDoc('documentType').contains([
            'TRUSTEE_DATA_REPORT_DIFFERENCE',
            'TRUSTEE_DATA_REPORT_PAGE',
          ]),
        ),
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /** Deletes the run document and all of its results. */
  public async deleteRun(runId: string): Promise<void> {
    try {
      await this.getAdapter<ReportDocument>().deleteMany(this.anyDoc('runId').equals(runId));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
