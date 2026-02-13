import { app, HttpRequest, InvocationContext } from '@azure/functions';
import { buildFunctionName, buildHttpTrigger } from './dataflows-common';
import { SYNC_CASES_PAGE_QUEUE } from './storage-queues';
import { CASE_ID_REGEX } from '@common/cams/regex';

const MODULE_NAME = 'QUEUE-SYNC-CASES-PAGE';
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');
const MAX_CASE_IDS_PER_REQUEST = 500;

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

  if (caseIds.length > MAX_CASE_IDS_PER_REQUEST) {
    throw new Error(
      `Invalid payload - caseIds array exceeds maximum of ${MAX_CASE_IDS_PER_REQUEST} items`,
    );
  }

  // Validate each case ID format (XXX-XX-XXXXX)
  for (const caseId of caseIds) {
    if (typeof caseId !== 'string' || !CASE_ID_REGEX.test(caseId)) {
      throw new Error(`Invalid case ID format: ${caseId}`);
    }
  }

  // Transform to CaseSyncEvent format matching existing queue handler expectations
  const events = caseIds.map((caseId) => ({ caseId }));

  // Write to queue via output binding (matching sync-cases PAGE queue format)
  // Wrap in array because Azure Functions writes each array element as a separate message
  // and handlePage expects a single message containing an array of events
  context.extraOutputs.set(SYNC_CASES_PAGE_QUEUE, [events]);
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
