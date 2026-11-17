import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeDataReportStatus } from '@common/cams/trustee-data-report';
import TrusteeDataReportLock from './trustee-data-report-lock';

/** The run in progress, if any, and the latest completed run with its summary counts. */
export async function getLatestTrusteeDataReport(
  context: ApplicationContext,
): Promise<TrusteeDataReportStatus> {
  const reportRepo = factory.getTrusteeDataReportRepository(context);
  const activeRunId = await TrusteeDataReportLock.activeRunId(context);
  const [activeRun, latestCompletedRun] = await Promise.all([
    activeRunId ? reportRepo.readRun(activeRunId) : null,
    reportRepo.readLatestCompletedRun(),
  ]);

  const status: TrusteeDataReportStatus = {};
  if (activeRun) status.activeRun = activeRun;
  if (latestCompletedRun) status.latestCompletedRun = latestCompletedRun;
  return status;
}
