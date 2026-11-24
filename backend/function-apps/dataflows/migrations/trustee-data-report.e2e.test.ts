import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { buildQueueName } from '../dataflows-common';
import factory from '../../../lib/factory';
import { TrusteeDataReportRunState } from '../../../lib/use-cases/gateways.types';
import { TrusteeDataReportPageMessage } from '@common/cams/dataflow-events';
import TrusteeDataReportLock from '../../../lib/use-cases/trustee-data-report/trustee-data-report-lock';
import { handlePage, handleStart } from './trustee-data-report';

// With dbMock=true: the real handlers, use case, in-memory repositories and MockAtsGateway,
// chained the way the page queue chains them. The queued run and its lock are seeded rather than
// created by the start use case, and the queue transport is simulated; the integration harness
// covers the real start. Data: lib/testing/mock-gateways/mock-trustee-data-report.fixtures.ts.

const PAGE_QUEUE_NAME = buildQueueName('TRUSTEE-DATA-REPORT', 'page');

function pageOutput(
  invocationContext: InvocationContext,
): TrusteeDataReportPageMessage | undefined {
  const outputs = invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>;
  for (const [binding, value] of outputs) {
    if (binding.queueName === PAGE_QUEUE_NAME) return value as TrusteeDataReportPageMessage;
  }
  return undefined;
}

describe('trustee-data-report dataflow with dbMock', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
    // createMockApplicationContext itself uses ApplicationContextCreator, so build one context
    // up front and give each invocation a copy that writes to its own outputs.
    const baseContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockImplementation(
      async ({ invocationContext }) => ({
        ...baseContext,
        extraOutputs: invocationContext.extraOutputs,
      }),
    );
  });

  test('should run a seeded queued run to completion and report all three kinds of difference', async () => {
    const context = await createMockApplicationContext();
    expect(context.config.get('dbMock')).toBe(true);
    const runId = `e2e-${Date.now()}`;

    // Seed what the start use case does: create the queued run and claim the lock.
    await factory.getTrusteeDataReportRepository(context).upsertRun({
      runId,
      status: 'queued',
      startedBy: { id: 'user-1', name: 'Test SuperUser' },
      queuedAt: new Date().toISOString(),
    });
    await factory.getRuntimeStateRepository<TrusteeDataReportRunState>(context).upsert({
      documentType: 'TRUSTEE_DATA_REPORT_RUN',
      runId,
      startedAt: new Date().toISOString(),
    });

    const invoke = () =>
      ({
        invocationId: 'e2e',
        extraOutputs: new Map(),
        log: vi.fn(),
      }) as unknown as InvocationContext;

    let invocation = invoke();
    await handleStart({ runId }, invocation);
    let next = pageOutput(invocation);
    let pages = 0;
    // Bounded, so a run that never finishes fails the page-count check instead of hanging.
    while (next && pages < 10) {
      invocation = invoke();
      await handlePage(next, invocation);
      next = pageOutput(invocation);
      pages++;
    }

    const run = await factory.getTrusteeDataReportRepository(context).readRun(runId);
    expect(pages).toBe(2); // One page of the 6 mock TOD trustees, then the empty page.
    expect(run).toEqual(
      expect.objectContaining({
        status: 'completed',
        summary: expect.objectContaining({
          trusteesCompared: 3,
          todOnly: 2,
          camsOnly: 2,
          fieldDifferences: 1,
          fieldDifferencesByField: expect.objectContaining({ phone: 1 }),
          // The mock TOD appointment rows cannot be translated (they have no serving state), so
          // all 8 rows of the 3 compared trustees are counted and none is compared.
          todAppointmentsNotTranslated: 8,
          appointmentsTodOnly: 0,
          appointmentsCamsOnly: 0,
        }),
      }),
    );
    expect(await TrusteeDataReportLock.activeRunId(context)).toBeNull();
  });
});
