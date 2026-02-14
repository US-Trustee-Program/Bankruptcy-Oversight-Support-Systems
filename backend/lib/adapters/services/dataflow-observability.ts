import { LoggerImpl, scrubMessage } from './logger.service';
import { getAppInsightsClient } from '../../../function-apps/azure/app-insights';

export interface DataflowTrace {
  moduleName: string;
  handlerName: string;
  instanceId: string;
  invocationId: string;
  startTime: number;
  logger: LoggerImpl;
}

export interface TraceResult {
  documentsWritten: number;
  documentsFailed: number;
  success: boolean;
  error?: string;
  details?: Record<string, string>;
}

const MODULE_NAME = 'DATAFLOW-OBSERVABILITY';

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

export function startTrace(
  moduleName: string,
  handlerName: string,
  invocationId: string,
  logger: LoggerImpl,
): DataflowTrace {
  return {
    moduleName,
    handlerName,
    instanceId: process.env.WEBSITE_INSTANCE_ID ?? 'local',
    invocationId,
    startTime: Date.now(),
    logger,
  };
}

export function completeTrace(trace: DataflowTrace, result: TraceResult): void {
  const durationMs = Date.now() - trace.startTime;

  trace.logger.info(
    MODULE_NAME,
    `DATAFLOW_COMPLETE module=${trace.moduleName} handler=${trace.handlerName} docs=${result.documentsWritten} failed=${result.documentsFailed} duration=${durationMs}ms instance=${trace.instanceId} success=${result.success}`,
  );

  const client = getAppInsightsClient() as {
    trackEvent: (event: {
      name: string;
      properties: Record<string, string>;
      measurements: Record<string, number>;
    }) => void;
    trackMetric: (metric: {
      name: string;
      value: number;
      properties: Record<string, string>;
    }) => void;
  } | null;

  if (!client) return;

  const properties: Record<string, string> = {
    moduleName: trace.moduleName,
    handlerName: trace.handlerName,
    instanceId: trace.instanceId,
    invocationId: trace.invocationId,
    success: String(result.success),
    ...result.details,
  };

  if (result.error) {
    properties.error = scrubErrorForTelemetry(result.error);
  }

  const measurements: Record<string, number> = {
    documentsWritten: result.documentsWritten,
    documentsFailed: result.documentsFailed,
    durationMs,
  };

  client.trackEvent({
    name: 'DataflowHandlerComplete',
    properties,
    measurements,
  });

  client.trackMetric({
    name: 'DataflowDuration',
    value: durationMs,
    properties,
  });

  client.trackMetric({
    name: 'DataflowDocumentsWritten',
    value: result.documentsWritten,
    properties,
  });

  client.trackMetric({
    name: 'DataflowDocumentsFailed',
    value: result.documentsFailed,
    properties,
  });
}
