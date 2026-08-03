import { ApplicationContext } from '../../adapters/types/basic';
import { AcsBouncePollState, EmailBounceQueryGateway } from '../gateways.types';
import factory from '../../factory';
import { BounceReconstructionUseCase } from './bounce-reconstruction';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { isNotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'BOUNCE-POLL';
const POLL_STATE_ID = 'ACS_BOUNCE_POLL_STATE';
const MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type BouncePollSummary = {
  found: number;
  reconstructed: number;
  failed: number;
  expired: number;
};

/**
 * Polls Log Analytics for ACS bounce rows and forwards each to the admin. The cursor only
 * advances across a contiguous prefix of rows that succeeded or were permanently
 * unreconstructable (expired archive); it stops at the first other failure so that row and
 * everything behind it retries next run instead of being silently skipped. A persistently
 * failing row blocks newer rows behind it until it succeeds or its archive expires -- traded
 * for never silently dropping a bounce, which is the failure mode this dataflow exists to fix.
 * The lookback fallback is bounded to the archive TTL, since anything older can't be
 * reconstructed regardless of how far back the query reaches. Delivery is at-least-once,
 * not exactly-once: if the cursor upsert itself fails after a batch sends successfully, the
 * next run re-queries from the old cursor and re-forwards the same rows. That's an accepted
 * tradeoff (an occasional duplicate admin email) rather than building per-row checkpointing.
 */
export class BouncePollUseCase {
  private readonly reconstructionUseCase: BounceReconstructionUseCase;
  private readonly bounceQueryGateway: EmailBounceQueryGateway;

  constructor(
    context: ApplicationContext,
    reconstructionUseCase: BounceReconstructionUseCase = new BounceReconstructionUseCase(context),
    bounceQueryGateway: EmailBounceQueryGateway = factory.getEmailBounceQueryGateway(),
  ) {
    this.reconstructionUseCase = reconstructionUseCase;
    this.bounceQueryGateway = bounceQueryGateway;
  }

  async pollAndReconstruct(context: ApplicationContext): Promise<BouncePollSummary> {
    const workspaceId = process.env.ANALYTICS_WORKSPACE_CUSTOMER_ID;
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (!workspaceId || !adminEmail) {
      throw new ServerConfigError(MODULE_NAME, {
        message:
          'ANALYTICS_WORKSPACE_CUSTOMER_ID and ADMIN_NOTIFICATION_EMAIL must both be configured to poll for bounces.',
      });
    }

    const runtimeStateRepo = factory.getRuntimeStateRepository<AcsBouncePollState>(context);
    let pollState: AcsBouncePollState | null = null;
    try {
      pollState = await runtimeStateRepo.read(POLL_STATE_ID);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      pollState = null;
    }
    const maxLookback = new Date(Date.now() - MAX_LOOKBACK_MS).toISOString();
    const since =
      pollState?.lastProcessedTimeGenerated && pollState.lastProcessedTimeGenerated > maxLookback
        ? pollState.lastProcessedTimeGenerated
        : maxLookback;

    const rows = await this.bounceQueryGateway.queryBounces(workspaceId, since);
    const summary: BouncePollSummary = {
      found: rows.length,
      reconstructed: 0,
      failed: 0,
      expired: 0,
    };
    if (rows.length === 0) return summary;

    let latestTimeGenerated = since;

    for (const row of rows) {
      try {
        await this.reconstructionUseCase.reconstructAndForward(context, row.messageId, adminEmail);
        summary.reconstructed++;
        latestTimeGenerated = row.timeGenerated;
      } catch (error) {
        if (isNotFoundError(error)) {
          summary.expired++;
          context.logger.error(
            MODULE_NAME,
            `Archived email expired or was never found for messageId '${row.messageId}'; cannot reconstruct, skipping permanently.`,
            error,
          );
          latestTimeGenerated = row.timeGenerated;
          continue;
        }

        summary.failed++;
        context.logger.error(
          MODULE_NAME,
          `Failed to reconstruct and forward bounce for messageId '${row.messageId}'; will retry starting from this row next run.`,
          error,
        );
        break;
      }
    }

    const updatedState: AcsBouncePollState = {
      id: pollState?.id ?? POLL_STATE_ID,
      documentType: 'ACS_BOUNCE_POLL_STATE',
      lastProcessedTimeGenerated: latestTimeGenerated,
    };
    await runtimeStateRepo.upsert(updatedState);

    return summary;
  }
}
