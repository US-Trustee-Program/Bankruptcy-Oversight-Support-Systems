import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { buildFunctionName, buildHttpTrigger } from './dataflows-common';
import { SYNC_CASES_PAGE_QUEUE } from './storage-queues';

const MODULE_NAME = 'QUEUE-SYNC-CASES-PAGE';
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

/**
 * HTTP trigger to write case IDs directly to sync-cases-page queue.
 * Used by API to queue case reloads when API and Dataflows use separate storage accounts.
 */
async function handleQueueWrite(context: InvocationContext, request: HttpRequest) {
  const payload = await request.json();

  // Validate payload structure
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload - expected JSON object');
  }

  const { caseIds } = payload as { caseIds?: unknown };

  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    throw new Error('Invalid payload - caseIds must be non-empty array');
  }

  // Validate each case ID format (XXX-XX-XXXXX)
  const caseIdPattern = /^\d{3}-\d{2}-\d{5}$/;
  for (const caseId of caseIds) {
    if (typeof caseId !== 'string' || !caseIdPattern.test(caseId)) {
      throw new Error(`Invalid case ID format: ${caseId}`);
    }
  }

  // Transform to CaseSyncEvent format matching existing queue handler expectations
  const events = caseIds.map((caseId) => ({ caseId }));

  // Write to queue via output binding (matching sync-cases PAGE queue format)
  context.extraOutputs.set(SYNC_CASES_PAGE_QUEUE, events);
}

function setup() {
  app.http(HTTP_TRIGGER, {
    route: 'sync-cases-page',
    methods: ['POST'],
    extraOutputs: [SYNC_CASES_PAGE_QUEUE],
    handler: buildHttpTrigger(MODULE_NAME, handleQueueWrite),
  });
}

export default {
  MODULE_NAME,
  setup,
};
