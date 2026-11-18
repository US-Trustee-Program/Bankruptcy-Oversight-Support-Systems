import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeDataReportStatus } from '@common/cams/trustee-data-report';
import TrusteeDataReportLock from './trustee-data-report-lock';

/**
 * The run in progress, if any, the latest completed run with its summary counts, and the latest
 * failed run if it failed after that completed run (an older failure has already been superseded).
 */
export async function getLatestTrusteeDataReport(
  context: ApplicationContext,
): Promise<TrusteeDataReportStatus> {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  const activeRunId = await TrusteeDataReportLock.activeRunId(context);
  const [activeRun, latestCompletedRun, latestFailedRun] = await Promise.all([
    activeRunId ? reportRepo.readRun(activeRunId) : null,
    reportRepo.readLatestCompletedRun(),
    reportRepo.readLatestFailedRun(),
  ]);

  const status: TrusteeDataReportStatus = {};
  if (activeRun) status.activeRun = activeRun;
  if (latestCompletedRun) status.latestCompletedRun = latestCompletedRun;
  if (
    latestFailedRun &&
    (latestFailedRun.finishedAt ?? '') > (latestCompletedRun?.finishedAt ?? '')
  ) {
    status.latestFailedRun = latestFailedRun;
  }
  return status;
}
