import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query-logs';
import { DefaultAzureCredential } from '@azure/identity';
import { ApplicationContext } from '../../adapters/types/basic';
import { AcsBouncePollState } from '../gateways.types';
import factory from '../../factory';
import { BounceReconstructionUseCase } from './bounce-reconstruction';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { isNotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'BOUNCE-POLL';
const POLL_STATE_ID = 'ACS_BOUNCE_POLL_STATE';
// First-run fallback: don't reach back further than this when no cursor exists yet.
const DEFAULT_LOOKBACK_START = '2026-01-01T00:00:00.000Z';

const BOUNCE_QUERY = `
ACSEmailStatusUpdateOperational
| where DeliveryStatus in ('Failed', 'Bounced', 'Quarantined', 'FilteredSpam', 'Suppressed')
| project TimeGenerated, MessageId, RecipientId, DeliveryStatus
| order by TimeGenerated asc
`;

type BounceRow = {
  TimeGenerated: string;
  MessageId: string;
  RecipientId?: string;
  DeliveryStatus: string;
};

export type BouncePollSummary = {
  found: number;
  reconstructed: number;
  failed: number;
};

export class BouncePollUseCase {
  /**
   * Queries Log Analytics for ACS bounce rows newer than the last processed cursor,
   * reconstructs and forwards each one to the admin, then advances the cursor to the
   * latest TimeGenerated observed. Never rewinds the cursor to now() -- always to the
   * latest row actually seen, so a partial/failed run doesn't skip records on retry.
   */
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
    const since = pollState?.lastProcessedTimeGenerated ?? DEFAULT_LOOKBACK_START;

    const rows = await this.queryBounceRows(workspaceId, since);
    const summary: BouncePollSummary = { found: rows.length, reconstructed: 0, failed: 0 };
    if (rows.length === 0) return summary;

    const reconstructionUseCase = new BounceReconstructionUseCase(context);
    let latestTimeGenerated = since;

    for (const row of rows) {
      try {
        await reconstructionUseCase.reconstructAndForward(context, row.MessageId, adminEmail);
        summary.reconstructed++;
      } catch (error) {
        summary.failed++;
        context.logger.error(
          MODULE_NAME,
          `Failed to reconstruct and forward bounce for messageId '${row.MessageId}'.`,
          error,
        );
      }
      if (row.TimeGenerated > latestTimeGenerated) {
        latestTimeGenerated = row.TimeGenerated;
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

  private async queryBounceRows(workspaceId: string, since: string): Promise<BounceRow[]> {
    const clientId = process.env.ANALYTICS_IDENTITY_CLIENT_ID;
    const credential = new DefaultAzureCredential(
      clientId ? { managedIdentityClientId: clientId } : undefined,
    );
    const client = new LogsQueryClient(credential);

    const result = await client.queryWorkspace(workspaceId, BOUNCE_QUERY, {
      startTime: new Date(since),
      endTime: new Date(),
    });

    if (result.status !== LogsQueryResultStatus.Success) {
      throw new ServerConfigError(MODULE_NAME, {
        message: `Log Analytics query did not succeed (status: '${result.status}').`,
      });
    }

    const table = result.tables[0];
    if (!table) return [];

    const columnIndex = (name: string) => table.columnDescriptors.findIndex((c) => c.name === name);
    const timeGeneratedIdx = columnIndex('TimeGenerated');
    const messageIdIdx = columnIndex('MessageId');
    const recipientIdIdx = columnIndex('RecipientId');
    const deliveryStatusIdx = columnIndex('DeliveryStatus');

    return (
      table.rows
        .map((row) => ({
          TimeGenerated: String(row[timeGeneratedIdx]),
          MessageId: String(row[messageIdIdx]),
          RecipientId: recipientIdIdx >= 0 ? String(row[recipientIdIdx]) : undefined,
          DeliveryStatus: String(row[deliveryStatusIdx]),
        }))
        // Exclude the row exactly at the cursor boundary so we never reprocess the last row from the previous run.
        .filter((row) => row.TimeGenerated > since)
    );
  }
}
