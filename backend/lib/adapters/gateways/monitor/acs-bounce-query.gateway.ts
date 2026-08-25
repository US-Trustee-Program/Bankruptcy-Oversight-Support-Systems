import {
  LogsQueryClient,
  LogsQueryResultStatus,
  KnownMonitorLogsQueryAudience,
} from '@azure/monitor-query-logs';
import { DefaultAzureCredential } from '@azure/identity';
import { BounceLogRow, EmailBounceQueryGateway } from '../../../use-cases/gateways.types';
import { ServerConfigError } from '../../../common-errors/server-config-error';

const MODULE_NAME = 'ACS-BOUNCE-QUERY-GATEWAY';

// @azure/monitor-query-logs@1.0.0 hardcodes the managed-identity token scope to the commercial
// cloud and ignores the `audience` option, so in Azure Government the identity endpoint is asked
// for a token it can't issue and throws AuthenticationRequiredError. Passing the Gov endpoint and
// scope explicitly works around it: https://github.com/Azure/azure-sdk-for-js/issues/39506
const GOV_LOG_ANALYTICS_AUDIENCE = KnownMonitorLogsQueryAudience.AzureGovernment;

const BOUNCE_QUERY = `
ACSEmailStatusUpdateOperational
| where DeliveryStatus in ('Failed', 'Bounced', 'Quarantined', 'FilteredSpam', 'Suppressed')
| project TimeGenerated, CorrelationId, DeliveryStatus
| order by TimeGenerated asc
`;

export type LogsQueryClientFactory = () => LogsQueryClient;

export interface QueryLogger {
  info(module: string, message: string, data?: unknown): void;
  error(module: string, message: string, data?: unknown): void;
}

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
  const credential = new DefaultAzureCredential({ managedIdentityClientId: clientId });
  return new LogsQueryClient(credential, {
    endpoint: `${GOV_LOG_ANALYTICS_AUDIENCE}/v1`,
    audience: GOV_LOG_ANALYTICS_AUDIENCE,
    credentials: { scopes: [`${GOV_LOG_ANALYTICS_AUDIENCE}/.default`] },
  });
}

export class AcsBounceQueryGateway implements EmailBounceQueryGateway {
  private readonly clientFactory: LogsQueryClientFactory;
  private readonly logger?: QueryLogger;

  constructor(clientFactory: LogsQueryClientFactory = defaultClientFactory, logger?: QueryLogger) {
    this.clientFactory = clientFactory;
    this.logger = logger;
  }

  async queryBounces(workspaceId: string, since: string): Promise<BounceLogRow[]> {
    const client = this.clientFactory();
    const result = await client.queryWorkspace(workspaceId, BOUNCE_QUERY, {
      startTime: new Date(since),
      endTime: new Date(),
    });

    if (result.status !== LogsQueryResultStatus.Success) {
      const message = `Log Analytics query did not succeed (status: '${result.status}').`;
      this.logger?.error(MODULE_NAME, message, { workspaceId, since });
      throw new ServerConfigError(MODULE_NAME, { message });
    }

    const table = result.tables[0];
    if (!table) {
      this.logger?.info(MODULE_NAME, 'Bounce query returned no result table.', {
        workspaceId,
        since,
      });
      return [];
    }

    const timeGeneratedIdx = table.columnDescriptors.findIndex((c) => c.name === 'TimeGenerated');
    const correlationIdIdx = table.columnDescriptors.findIndex((c) => c.name === 'CorrelationId');
    const deliveryStatusIdx = table.columnDescriptors.findIndex((c) => c.name === 'DeliveryStatus');

    const rows = table.rows
      .map((row) => {
        const rawTime = row[timeGeneratedIdx];
        const timeGenerated = (
          rawTime instanceof Date ? rawTime : new Date(String(rawTime))
        ).toISOString();
        return {
          timeGenerated,
          messageId: String(row[correlationIdIdx]),
          deliveryStatus: String(row[deliveryStatusIdx]),
        };
      })
      .filter((row) => row.timeGenerated > since);

    this.logger?.info(MODULE_NAME, `Bounce query returned ${rows.length} row(s).`, {
      workspaceId,
      since,
    });
    return rows;
  }
}
