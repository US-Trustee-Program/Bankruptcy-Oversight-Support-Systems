import { output } from '@azure/functions';

export const DLQ = output.storageQueue({
  queueName: 'import-dataflow-dlq',
  connection: 'AzureWebJobsStorage',
});
