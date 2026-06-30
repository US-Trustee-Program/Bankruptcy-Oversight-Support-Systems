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

type AppInsightsClientFactory = (logger?: LoggerImpl) => TelemetryClient | null;

export function scrubErrorForTelemetry(error: string): string {
  let scrubbed = scrubMessage(error);
  scrubbed = scrubbed.replace(mongoConnectionStringPattern, '[CONNECTION_STRING_REDACTED]');
  scrubbed = scrubbed.replace(mssqlConnectionStringPattern, '[CONNECTION_STRING_REDACTED]');
  scrubbed = scrubbed.replace(/[\r\n]+/g, ' ').trim();
  return scrubbed;
}

/**
 * Initializes and returns the Application Insights client.
 * If the client doesn't exist, explicitly initializes the SDK.
 *
 * @param logger - Optional logger for diagnostics
 * @returns TelemetryClient instance or null if initialization fails
 */
function getOrInitializeAppInsightsClient(logger?: LoggerImpl): TelemetryClient | null {
  const MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';

  try {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const appInsights = require('applicationinsights');

    if (!appInsights) {
      logger?.error(MODULE_NAME, 'applicationinsights module loaded but is falsy');
      return null;
    }

    // If defaultClient already exists, return it
    if (appInsights.defaultClient) {
      return appInsights.defaultClient as TelemetryClient;
    }

    // Client doesn't exist - try to initialize it ourselves
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connectionString) {
      logger?.error(
        MODULE_NAME,
        'CRITICAL: APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry unavailable',
      );
      return null;
    }

    logger?.info(MODULE_NAME, 'Initializing Application Insights SDK explicitly');
    appInsights.setup(connectionString).start();

    if (!appInsights.defaultClient) {
      logger?.error(
        MODULE_NAME,
        'CRITICAL: App Insights SDK initialized but defaultClient still null',
      );
      return null;
    }

    logger?.info(MODULE_NAME, 'Application Insights SDK initialized successfully');
    return appInsights.defaultClient as TelemetryClient;
  } catch (error) {
    logger?.error(MODULE_NAME, 'CRITICAL: Failed to initialize Application Insights', error);
    return null;
  }
}

/**
 * Builds a trace. Trace creation is SDK-independent — it records only the
 * invocation identity and a start timestamp — so it is shared by every
 * ObservabilityGateway implementation.
 */
function startTrace(invocationId: string): ObservabilityTrace {
  return {
    invocationId,
    instanceId: process.env.WEBSITE_INSTANCE_ID ?? 'local',
    startTime: Date.now(),
  };
}

/**
 * NoOpObservability
 *
 * A trace recorder that produces traces but emits no telemetry. Used in
 * environments without Application Insights instrumentation (local development
 * and unit tests), where loading the heavyweight `applicationinsights` SDK is
 * both unnecessary and costly. Honors the ObservabilityGateway contract so
 * handlers can start and complete traces uniformly regardless of environment.
 */
export class NoOpObservability implements ObservabilityGateway {
  startTrace = startTrace;

  completeTrace(): void {}
}

export class AppInsightsObservability implements ObservabilityGateway {
  private readonly MODULE_NAME = 'APP-INSIGHTS-OBSERVABILITY';
  private readonly clientFactory: AppInsightsClientFactory;

  startTrace = startTrace;

  constructor(
    private readonly logger?: LoggerImpl,
    clientFactory?: AppInsightsClientFactory,
  ) {
    this.clientFactory = clientFactory ?? getOrInitializeAppInsightsClient;
  }

  completeTrace(
    trace: ObservabilityTrace,
    eventName: string,
    completion: TraceCompletion,
    metrics?: { name: string; value: number }[],
    logger?: LoggerImpl,
  ): void {
    // Prefer the per-invocation logger passed at call time. This gateway is a
    // process-wide singleton, so the constructor-cached logger belongs to the
    // first invocation and would mislabel diagnostics in a warm worker.
    const activeLogger = logger ?? this.logger;
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

    const client = this.clientFactory(activeLogger);

    if (!client) {
      activeLogger?.error(
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
