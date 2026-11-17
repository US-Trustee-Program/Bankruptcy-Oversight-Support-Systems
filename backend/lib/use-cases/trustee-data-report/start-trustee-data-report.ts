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
  if (claim.replacedStaleRunId) {
    await RunTrusteeDataReport.failRun(
      context,
      claim.replacedStaleRunId,
      'The run did not finish within 2 hours and was replaced by a new run.',
    );
  }

  const run: TrusteeDataReportRun = {
    runId,
    status: 'queued',
    startedBy: getCamsUserReference(context.session.user),
    queuedAt: new Date().toISOString(),
  };
  await factory.getTrusteeDataReportRepository(context).upsertRun(run);

  try {
    await factory.getApiToDataflowsGateway(context).queueTrusteeDataReportStart({ runId });
  } catch (error) {
    await RunTrusteeDataReport.failRun(context, runId, 'The report could not be queued to start.');
    throw error;
  }
  return run;
}
