import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { TrusteeDataReportRunState } from '../gateways.types';

// The lock lets one trustee data report run at a time. The start use case (S1.4) claims it,
// following the claim/confirm pattern in trustee-appointment-sync-run.ts; the dataflow checks
// it on every page and releases it when the run completes or fails.
const DOCUMENT_TYPE = 'TRUSTEE_DATA_REPORT_RUN';

async function readLock(context: ApplicationContext): Promise<TrusteeDataReportRunState | null> {
  try {
    return await factory
      .getRuntimeStateRepository<TrusteeDataReportRunState>(context)
      .read(DOCUMENT_TYPE);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

/** True while runId holds the lock; a run that lost it must stop. */
async function isCurrentRun(context: ApplicationContext, runId: string): Promise<boolean> {
  return (await readLock(context))?.runId === runId;
}

/** Releases the lock if runId still holds it; a lock taken over by another run is left alone. */
async function releaseRun(context: ApplicationContext, runId: string): Promise<void> {
  if (await isCurrentRun(context, runId)) {
    await factory
      .getRuntimeStateRepository<TrusteeDataReportRunState>(context)
      .delete(DOCUMENT_TYPE);
  }
}

const TrusteeDataReportLock = { isCurrentRun, releaseRun };

export default TrusteeDataReportLock;
