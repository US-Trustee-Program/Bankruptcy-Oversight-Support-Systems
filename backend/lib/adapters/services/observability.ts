import { LoggerImpl, scrubMessage } from './logger.service';
import { TelemetryClient } from '../../../function-apps/azure/app-insights';
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

export function getAppInsightsClient(logger?: LoggerImpl): TelemetryClient | null {
  const MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';

  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      logger?.warn(MODULE_NAME, 'applicationinsights module loaded but is falsy');
      return null;
    }

    if (!appInsights.defaultClient) {
      logger?.warn(
        MODULE_NAME,
        'applicationinsights.defaultClient is null/undefined - SDK not initialized',
      );
      return null;
    }

    return appInsights.defaultClient as TelemetryClient;
  } catch (error) {
    logger?.error(MODULE_NAME, 'Failed to load applicationinsights module', error);
    return null;
  }
}

export class AppInsightsObservability implements ObservabilityGateway {
  private readonly MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';
  private readonly clientFactory: AppInsightsClientFactory;

  constructor(
    private readonly logger?: LoggerImpl,
    clientFactory?: AppInsightsClientFactory,
  ) {
    this.clientFactory = clientFactory ?? getAppInsightsClient;
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

    if (!client) return;

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
