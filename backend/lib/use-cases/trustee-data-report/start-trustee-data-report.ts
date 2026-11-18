import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { ConflictError } from '../../common-errors/conflict-error';
import { getCamsUserReference } from '@common/cams/session';
import { TrusteeDataReportRun } from '@common/cams/trustee-data-report';
import TrusteeDataReportLock from './trustee-data-report-lock';
import RunTrusteeDataReport from './run-trustee-data-report';

const MODULE_NAME = 'START-TRUSTEE-DATA-REPORT';

/**
 * Starts a trustee data report: claims the run lock, records the run as queued, and asks the
 * dataflows app (the only app that can reach TOD) to run it. Refuses with 409 while another run
 * is active.
 */
export async function startTrusteeDataReport(
  context: ApplicationContext,
): Promise<TrusteeDataReportRun> {
  const runId = randomUUID();
  const claim = await TrusteeDataReportLock.claimRun(context, runId);
  if (!claim.claimed) {
    throw new ConflictError(MODULE_NAME, {
      message: 'A trustee data report is already running.',
    });
  }
  const run: TrusteeDataReportRun = {
    runId,
    status: 'queued',
    startedBy: getCamsUserReference(context.session.user),
    queuedAt: new Date().toISOString(),
  };
  try {
    if (claim.replacedStaleRunId) {
      await RunTrusteeDataReport.failRun(
        context,
        claim.replacedStaleRunId,
        'The run did not finish within 2 hours and was replaced by a new run.',
      );
    }
    await factory.getTrusteeDataReportRepository(context).upsertRun(run);
    await factory.getApiToDataflowsGateway(context).queueTrusteeDataReportStart({ runId });
  } catch (error) {
    // This start holds the lock, so it must give it back (and fail its run, if it was saved);
    // otherwise every start would be refused until the lock goes stale.
    try {
      await RunTrusteeDataReport.failRun(context, runId, 'The report could not be started.');
    } catch (cleanupError) {
      context.logger.error(
        MODULE_NAME,
        `Could not release the lock after a failed start: ${(cleanupError as Error).message}`,
      );
    }
    throw error;
  }
  return run;
}
