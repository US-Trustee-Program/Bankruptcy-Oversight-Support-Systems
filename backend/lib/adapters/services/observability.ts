import { LoggerImpl, scrubMessage } from './logger.service';
import {
  TelemetryClient,
  getOrInitializeAppInsightsClient as getOrInitializeAppInsightsClientFromAzure,
} from '../../../function-apps/azure/app-insights';
import {
  ObservabilityGateway,
  ObservabilityTrace,
  TraceCompletion,
} from '../../use-cases/gateways.types';

const mongoConnectionStringPattern = /(?:mongodb(?:\+srv)?:\/\/)\S+/gi;
const mssqlConnectionStringPattern =
  /(?:Server|Data Source)=[^'")\]]*?(?:Password|Pwd)=[^\s;'")\]]+[;]?/gi;

export type AppInsightsClientFactory = (logger?: LoggerImpl) => TelemetryClient | null;

export function scrubErrorForTelemetry(error: string): string {
  let scrubbed = scrubMessage(error);
  scrubbed = scrubbed.replace(mongoConnectionStringPattern, '[CONNECTION_STRING_REDACTED]');
  scrubbed = scrubbed.replace(mssqlConnectionStringPattern, '[CONNECTION_STRING_REDACTED]');
  scrubbed = scrubbed.replace(/[\r\n]+/g, ' ').trim();
  return scrubbed;
}

export function getOrInitializeAppInsightsClient(_logger?: LoggerImpl): TelemetryClient | null {
  return getOrInitializeAppInsightsClientFromAzure();
}

export class AppInsightsObservability implements ObservabilityGateway {
  private readonly MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';
  private readonly clientFactory: AppInsightsClientFactory;

  constructor(
    private readonly logger?: LoggerImpl,
    clientFactory?: AppInsightsClientFactory,
  ) {
    this.clientFactory = clientFactory ?? getOrInitializeAppInsightsClient;
  }

  startTrace(invocationId: string): ObservabilityTrace {
    return {
      invocationId,
      instanceId: process.env.WEBSITE_INSTANCE_ID ?? 'local',
      startTime: Date.now(),
    };
  }

  completeTrace(
    trace: ObservabilityTrace,
    eventName: string,
    completion: TraceCompletion,
    metrics?: { name: string; value: number }[],
  ): void {
    const durationMs = Date.now() - trace.startTime;

    const properties: Record<string, string> = {
      instanceId: trace.instanceId,
      invocationId: trace.invocationId,
      success: String(completion.success),
      ...completion.properties,
    };

    if (completion.error) {
      properties.error = scrubErrorForTelemetry(completion.error);
    }

    const measurements: Record<string, number> = {
      durationMs,
      ...completion.measurements,
    };

    const client = this.clientFactory(this.logger);

    if (!client) {
      this.logger?.error(
        this.MODULE_NAME,
        `CRITICAL: Telemetry not sent for ${eventName} - App Insights client unavailable (business reporting impacted)`,
      );
      return;
    }

    client.trackEvent({
      name: eventName,
      properties,
      measurements,
    });

    if (metrics) {
      for (const metric of metrics) {
        client.trackMetric({
          name: metric.name,
          value: metric.value,
          properties,
        });
      }
    }
  }
}
