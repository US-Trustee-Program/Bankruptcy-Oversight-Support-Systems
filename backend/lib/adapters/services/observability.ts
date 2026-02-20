import { scrubMessage } from './logger.service';
import { getAppInsightsClient } from '../../../function-apps/azure/app-insights';
import {
  ObservabilityGateway,
  ObservabilityTrace,
  TraceCompletion,
} from '../../use-cases/gateways.types';

const mongoConnectionStringPattern = /(?:mongodb(?:\+srv)?:\/\/)\S+/gi;
const mssqlConnectionStringPattern =
  /(?:Server|Data Source)=[^'")\]]*?(?:Password|Pwd)=[^\s;'")\]]+[;]?/gi;

export function scrubErrorForTelemetry(error: string): string {
  let scrubbed = scrubMessage(error);
  scrubbed = scrubbed.replace(mongoConnectionStringPattern, '[CONNECTION_STRING_REDACTED]');
  scrubbed = scrubbed.replace(mssqlConnectionStringPattern, '[CONNECTION_STRING_REDACTED]');
  scrubbed = scrubbed.replace(/[\r\n]+/g, ' ').trim();
  return scrubbed;
}

export class AppInsightsObservability implements ObservabilityGateway {
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

    const client = getAppInsightsClient();

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
