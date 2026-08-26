/**
 * Integration test harness for ApiToDataflowsGatewayImpl's bridge to Azure Storage Queues.
 *
 * Exercises the real, unmocked gateway class against a real Azurite queue service — no
 * mocks, no Azure Functions host. Guards against a regression class that unit tests (which
 * mock StorageQueueHumbleObject) cannot catch: the gateway migrated off Azure Functions'
 * extraOutputs staging mechanism (CAMS bead cams-w220l) onto a direct, awaited
 * @azure/storage-queue SDK call. extraOutputs only ever staged a message for the Functions
 * host to flush after the invocation returned, with no way to unit-test actual delivery;
 * this harness proves a message enqueued through the gateway is actually retrievable from a
 * real queue afterward, with the exact payload the gateway sent.
 *
 * Usage (from test/integration/):
 *   npm run api-to-dataflows-bridge -- [command]
 *
 * Local workflow:
 *   1. cd api-to-dataflows-bridge/scripts && ./start-services.sh
 *   2. Copy .env.template to .env.local
 *   3. npm run api-to-dataflows-bridge:local -- run
 *   4. npm run api-to-dataflows-bridge:local -- clean
 *   5. cd api-to-dataflows-bridge/scripts && ./stop-services.sh
 *
 * Commands:
 *   run     Send one message per gateway method, then verify each landed on its queue
 *   clean   Delete all four queues (drops any leftover test messages)
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { QueueServiceClient } from '@azure/storage-queue';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { closeDeferred } from '../../../../backend/lib/deferrable/defer-close';
import { ApiToDataflowsGatewayImpl } from '../../../../backend/lib/adapters/gateways/api-to-dataflows/api-to-dataflows.gateway';
import {
  CASE_ASSIGNMENT_EVENT_QUEUE,
  SYNC_CASES_PAGE_QUEUE,
  TRUSTEE_APPOINTMENT_EVENT_QUEUE,
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE,
} from '../../../../backend/lib/storage-queues';
import {
  CaseAssignmentDownstreamEvent,
  TrusteeAppointmentDownstreamEvent,
  TrusteeVerificationRemapMessage,
} from '../../../../common/src/cams/dataflow-events';

const HARNESS_DIR = path.resolve(__dirname, '../');

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} — run start-services.sh first, then copy .env.template to .env.local`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

const ALL_QUEUE_NAMES = [
  CASE_ASSIGNMENT_EVENT_QUEUE.queueName,
  SYNC_CASES_PAGE_QUEUE.queueName,
  TRUSTEE_APPOINTMENT_EVENT_QUEUE.queueName,
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE.queueName,
];

function getConnectionString(): string {
  const cs = process.env.AzureWebJobsDataflowsStorage;
  if (!cs) throw new Error('AzureWebJobsDataflowsStorage must be set');
  return cs;
}

async function getAppContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function pass(msg: string) {
  passCount++;
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string) {
  failCount++;
  console.error(`  ✗ FAIL: ${msg}`);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning api-to-dataflows-bridge queues...\n');
  const queueService = QueueServiceClient.fromConnectionString(getConnectionString());
  for (const queueName of ALL_QUEUE_NAMES) {
    try {
      await queueService.deleteQueue(queueName);
      console.log(`  Deleted queue: ${queueName}`);
    } catch {
      console.log(`  Queue did not exist: ${queueName}`);
    }
  }
  console.log('\nClean complete.\n');
}

// ---------------------------------------------------------------------------
// run — send through the gateway, verify by reading the real queue back
// ---------------------------------------------------------------------------

async function receiveAndDecode(queueName: string): Promise<unknown> {
  const queueService = QueueServiceClient.fromConnectionString(getConnectionString());
  const client = queueService.getQueueClient(queueName);
  const response = await client.receiveMessages({ numberOfMessages: 1, visibilityTimeout: 5 });
  if (response.receivedMessageItems.length === 0) {
    throw new Error(`No message received from queue ${queueName}`);
  }
  const [message] = response.receivedMessageItems;
  const decoded = Buffer.from(message.messageText, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

async function run() {
  console.log('\nRunning api-to-dataflows-bridge assertions...\n');

  const context = await getAppContext();
  const gateway = new ApiToDataflowsGatewayImpl(context);

  try {
    // -------------------------------------------------------------------------
    // Test 1: queueCaseAssignmentEvent — message lands on CASE_ASSIGNMENT_EVENT_QUEUE
    // with the event serialized exactly as sent (no extra array-wrapping leaking through).
    // -------------------------------------------------------------------------
    console.log('Test 1: queueCaseAssignmentEvent sends a retrievable, unwrapped message');
    {
      const event: CaseAssignmentDownstreamEvent = {
        documentType: 'ASSIGNMENT',
        caseId: '081-24-11111',
        userId: 'user-integration-test',
        name: 'Integration Test User',
        role: 'TrialAttorney',
        assignedOn: '2024-01-01T00:00:00.000Z',
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-integration-test', name: 'Integration Test User' },
        acmsProfessionalId: null,
      };
      await gateway.queueCaseAssignmentEvent(event);
      const received = await receiveAndDecode(CASE_ASSIGNMENT_EVENT_QUEUE.queueName);
      if (JSON.stringify(received) === JSON.stringify(event)) {
        pass('case assignment event round-tripped through the real queue unmodified');
      } else {
        fail(
          `case assignment event mismatch: expected ${JSON.stringify(event)}, got ${JSON.stringify(received)}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Test 2: queueTrusteeAppointmentEvent — message lands on TRUSTEE_APPOINTMENT_EVENT_QUEUE.
    // -------------------------------------------------------------------------
    console.log('\nTest 2: queueTrusteeAppointmentEvent sends a retrievable message');
    {
      const event: TrusteeAppointmentDownstreamEvent = {
        caseId: '081-24-22222',
        trusteeId: 'trustee-integration-test',
        acmsProfessionalId: 'NY-00123',
        assignedOn: '2024-01-01T00:00:00.000Z',
        appointedDate: '2024-01-01',
        chapter: '7',
      };
      await gateway.queueTrusteeAppointmentEvent(event);
      const received = await receiveAndDecode(TRUSTEE_APPOINTMENT_EVENT_QUEUE.queueName);
      if (JSON.stringify(received) === JSON.stringify(event)) {
        pass('trustee appointment event round-tripped through the real queue unmodified');
      } else {
        fail(
          `trustee appointment event mismatch: expected ${JSON.stringify(event)}, got ${JSON.stringify(received)}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Test 3: queueCaseReload — the one method that wraps its payload in an array
    // (mirroring the array-nesting the old extraOutputs path required); confirms
    // that wrapping survived the migration off extraOutputs unchanged.
    // -------------------------------------------------------------------------
    console.log('\nTest 3: queueCaseReload sends the case-changed event wrapped in an array');
    {
      const caseId = '081-24-33333';
      await gateway.queueCaseReload(caseId);
      const received = await receiveAndDecode(SYNC_CASES_PAGE_QUEUE.queueName);
      const expected = [{ caseId, type: 'CASE_CHANGED' }];
      if (JSON.stringify(received) === JSON.stringify(expected)) {
        pass('case reload event round-tripped through the real queue, array-wrapped as expected');
      } else {
        fail(
          `case reload event mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(received)}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Test 4: queueTrusteeVerificationRemap — the queue CAMS-886/cams-w220l's fix
    // directly protects (TrusteeMatchVerificationUseCase.approveVerification's remap
    // message, previously at risk of being silently dropped by extraOutputs on a
    // post-DB-write crash).
    // -------------------------------------------------------------------------
    console.log('\nTest 4: queueTrusteeVerificationRemap sends a retrievable message');
    {
      const message: TrusteeVerificationRemapMessage = {
        fingerprint: 'fp-integration-test',
        resolvedTrusteeId: 'trustee-integration-test',
        resolvedTrusteeName: 'Integration Test Trustee',
        verificationId: 'verification-integration-test',
      };
      await gateway.queueTrusteeVerificationRemap(message);
      const received = await receiveAndDecode(TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE.queueName);
      if (JSON.stringify(received) === JSON.stringify(message)) {
        pass('trustee verification remap message round-tripped through the real queue unmodified');
      } else {
        fail(
          `trustee verification remap message mismatch: expected ${JSON.stringify(message)}, got ${JSON.stringify(received)}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Test 5: a send failure (bad connection string) throws instead of silently
    // dropping the message — the entire premise of moving off extraOutputs, which
    // could never signal delivery failure to the caller.
    // -------------------------------------------------------------------------
    console.log('\nTest 5: a send failure propagates instead of silently dropping the message');
    {
      const originalConnectionString = process.env.AzureWebJobsDataflowsStorage;
      // Well-known Azurite default account key — not a secret, publicly documented.
      // Points at an unused port so the send genuinely fails to connect.
      process.env.AzureWebJobsDataflowsStorage =
        'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;QueueEndpoint=http://127.0.0.1:19999/devstoreaccount1;'; // pragma: allowlist secret
      const brokenGateway = new ApiToDataflowsGatewayImpl(context);
      try {
        await brokenGateway.queueCaseReload('081-24-44444');
        fail('expected queueCaseReload to throw when the queue endpoint is unreachable');
      } catch {
        pass('send failure against an unreachable endpoint throws rather than silently dropping');
      } finally {
        process.env.AzureWebJobsDataflowsStorage = originalConnectionString;
      }
    }
  } finally {
    await closeDeferred(context);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.error('\nSome tests failed — see FAIL lines above.');
    process.exitCode = 1;
  } else {
    console.log('\nAll tests passed.');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function help() {
  console.log(`
api-to-dataflows-bridge integration test harness

Usage (from test/integration/):
  npm run api-to-dataflows-bridge -- <command>

Commands:
  run     Send one message per gateway method, then verify each landed on its queue
  clean   Delete all four queues (drops any leftover test messages)
  help    Show this help

Local workflow:
  1. cd api-to-dataflows-bridge/scripts && ./start-services.sh
  2. Copy .env.template to .env.local
  3. npm run api-to-dataflows-bridge:local -- run
  4. npm run api-to-dataflows-bridge:local -- clean
  5. cd api-to-dataflows-bridge/scripts && ./stop-services.sh
`);
}

loadEnv();

const command = process.argv[2] ?? 'help';

(async () => {
  switch (command) {
    case 'run':
      await run();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default:
      help();
  }
})().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
