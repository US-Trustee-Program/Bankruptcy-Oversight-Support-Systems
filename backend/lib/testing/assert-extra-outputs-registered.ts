import { expect, vi } from 'vitest';
import { StorageQueueOutput } from '@azure/functions';

type StorageQueueRegistration = {
  extraOutputs?: StorageQueueOutput[];
  handler: unknown;
};

type DataflowModule = {
  default: { setup: () => void };
  [handlerExportName: string]: unknown;
};

/**
 * Drives a dataflow's real setup() export against a fresh mock of `@azure/functions` and
 * asserts that the named handler's own app.storageQueue/app.http registration declares every
 * expectedQueue in its extraOutputs array.
 *
 * Azure Functions' InvocationModel.getResponse() only serializes context.extraOutputs.set()
 * calls for queues the invoking function registered for itself at setup time — any other queue
 * name is silently dropped, with no error. A test that mocks context.extraOutputs as a bare Map
 * cannot catch this class of bug: a Map has no notion of what a given handler actually
 * registered, so it can't distinguish a correctly-wired queue from a silently-dropped one. This
 * helper instead exercises the real registration path and checks the actual invariant.
 *
 * @param loadModule - loads the dataflow module under test, e.g. `() => import('./my-dataflow')`.
 *   Written as a loader (not a path string) so the dynamic import stays a static, analyzable
 *   specifier at its original call site, resolved relative to the caller's own file.
 * @param handlerExportName - the module's named export identifying the handler function to
 *   locate among the captured `app.storageQueue`/`app.http` registrations.
 * @param expectedQueues - the queue objects (imported from storage-queues.ts) that must all
 *   appear in the handler's registered `extraOutputs` array.
 */
export async function assertExtraOutputsRegistered<M extends DataflowModule>(
  loadModule: () => Promise<M>,
  handlerExportName: keyof M & string,
  expectedQueues: StorageQueueOutput[],
): Promise<void> {
  const storageQueueCalls: Array<[string, StorageQueueRegistration]> = [];

  vi.doMock('@azure/functions', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@azure/functions')>();
    return {
      ...actual,
      app: {
        ...actual.app,
        storageQueue: vi.fn((name: string, options: StorageQueueRegistration) => {
          storageQueueCalls.push([name, options]);
        }),
        http: vi.fn(),
        timer: vi.fn(),
      },
    };
  });

  try {
    const dataflowModule = await loadModule();
    const handler = dataflowModule[handlerExportName];
    expect(handler, `Module has no export named "${handlerExportName}"`).toBeDefined();

    dataflowModule.default.setup();

    const registration = storageQueueCalls.find(([, options]) => options.handler === handler);
    expect(
      registration,
      `No app.storageQueue/app.http registration found for handler "${handlerExportName}"`,
    ).toBeDefined();

    const [, options] = registration!;
    for (const expectedQueue of expectedQueues) {
      expect(
        options.extraOutputs,
        `Expected handler "${handlerExportName}" to declare queue "${expectedQueue.queueName}" ` +
          `in its extraOutputs, but registered extraOutputs were: ` +
          `[${(options.extraOutputs ?? []).map((q) => q.queueName).join(', ')}]`,
      ).toContain(expectedQueue);
    }
  } finally {
    vi.doUnmock('@azure/functions');
    vi.resetModules();
  }
}
