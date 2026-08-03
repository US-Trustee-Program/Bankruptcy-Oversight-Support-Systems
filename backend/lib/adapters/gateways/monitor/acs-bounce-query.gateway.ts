import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query-logs';
import { DefaultAzureCredential } from '@azure/identity';
import { BounceLogRow, EmailBounceQueryGateway } from '../../../use-cases/gateways.types';
import { ServerConfigError } from '../../../common-errors/server-config-error';

const MODULE_NAME = 'ACS-BOUNCE-QUERY-GATEWAY';

const BOUNCE_QUERY = `
ACSEmailStatusUpdateOperational
| where DeliveryStatus in ('Failed', 'Bounced', 'Quarantined', 'FilteredSpam', 'Suppressed')
| project TimeGenerated, CorrelationId
| order by TimeGenerated asc
`;

export type LogsQueryClientFactory = () => LogsQueryClient;

/**
 * Fails closed if ANALYTICS_IDENTITY_CLIENT_ID is unset, rather than falling back to
 * ambiguous ambient credential discovery -- the dataflows Function App can carry more than
 * one user-assigned identity, and Azure's managed-identity endpoint requires an explicit
 * client id in that case.
 */
function defaultClientFactory(): LogsQueryClient {
  const clientId = process.env.ANALYTICS_IDENTITY_CLIENT_ID;
  if (!clientId) {
    throw new ServerConfigError(MODULE_NAME, {
      message: 'ANALYTICS_IDENTITY_CLIENT_ID must be configured to query for ACS bounces.',
    });
  }
  return new LogsQueryClient(new DefaultAzureCredential({ managedIdentityClientId: clientId }));
}

export class AcsBounceQueryGateway implements EmailBounceQueryGateway {
  private readonly clientFactory: LogsQueryClientFactory;

  constructor(clientFactory: LogsQueryClientFactory = defaultClientFactory) {
    this.clientFactory = clientFactory;
  }

  async queryBounces(workspaceId: string, since: string): Promise<BounceLogRow[]> {
    const client = this.clientFactory();
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

    const timeGeneratedIdx = table.columnDescriptors.findIndex((c) => c.name === 'TimeGenerated');
    const correlationIdIdx = table.columnDescriptors.findIndex((c) => c.name === 'CorrelationId');

    return table.rows
      .map((row) => {
        const rawTime = row[timeGeneratedIdx];
        const timeGenerated = (
          rawTime instanceof Date ? rawTime : new Date(String(rawTime))
        ).toISOString();
        return { timeGenerated, messageId: String(row[correlationIdIdx]) };
      })
      .filter((row) => row.timeGenerated > since);
  }
}
