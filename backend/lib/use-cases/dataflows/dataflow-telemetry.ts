import { LoggerImpl } from '../../adapters/services/logger.service';
import { ObservabilityGateway, ObservabilityTrace } from '../gateways.types';

interface DataflowTraceResult {
  documentsWritten: number;
  documentsFailed: number;
  success: boolean;
  error?: string;
  details?: Record<string, string>;
  additionalMetrics?: { name: string; value: number }[];
}

const MODULE_NAME = 'DATAFLOW-OBSERVABILITY';

export function completeDataflowTrace(
  observability: ObservabilityGateway,
  trace: ObservabilityTrace,
  moduleName: string,
  handlerName: string,
  logger: LoggerImpl,
  result: DataflowTraceResult,
): void {
  const durationMs = Date.now() - trace.startTime;

  logger.info(MODULE_NAME, 'DATAFLOW_COMPLETE', {
    moduleName,
    handlerName,
    documentsWritten: result.documentsWritten,
    documentsFailed: result.documentsFailed,
    durationMs,
    instanceId: trace.instanceId,
    success: result.success,
  });

  const properties: Record<string, string> = {
    moduleName,
    handlerName,
    ...result.details,
  };

  const measurements: Record<string, number> = {
    documentsWritten: result.documentsWritten,
    documentsFailed: result.documentsFailed,
  };

  const metrics = [
    { name: 'DataflowDuration', value: durationMs },
    { name: 'DataflowDocumentsWritten', value: result.documentsWritten },
    { name: 'DataflowDocumentsFailed', value: result.documentsFailed },
  ];

  if (result.additionalMetrics) {
    metrics.push(...result.additionalMetrics);
  }

  observability.completeTrace(
    trace,
    'DataflowHandlerComplete',
    {
      success: result.success,
      properties,
      measurements,
      error: result.error,
    },
    metrics,
  );
}
