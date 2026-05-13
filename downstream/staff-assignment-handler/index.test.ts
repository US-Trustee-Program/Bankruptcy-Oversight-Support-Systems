import { describe, test, beforeEach, expect, vi } from 'vitest';
import { InvocationContext } from '@azure/functions';

vi.mock('mssql', async () => {
  const mockRequest = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockResolvedValue({}),
  };
  const mockPool = { request: vi.fn().mockReturnValue(mockRequest) };
  return {
    default: {},
    connect: vi.fn().mockResolvedValue(mockPool),
    Char: vi.fn(),
    Numeric: vi.fn(),
    DateTime2: vi.fn(),
    VarChar: vi.fn(),
  };
});

vi.mock('@azure/functions', async () => {
  const handlers: Record<string, (item: unknown, ctx: InvocationContext) => Promise<void>> = {};
  return {
    app: {
      storageQueue: vi.fn((name, options) => {
        handlers[name] = options.handler;
      }),
      _handlers: handlers,
    },
    output: { storageQueue: vi.fn().mockReturnValue({ type: 'storageQueue' }) },
    InvocationContext: vi.fn().mockImplementation(() => ({
      log: vi.fn(),
      extraOutputs: { set: vi.fn(), get: vi.fn() },
    })),
  };
});

vi.mock('@common/queues', () => ({
  buildQueueName: vi.fn((name: string, suffix?: string) =>
    suffix ? `${name}-${suffix}`.toLowerCase() : name.toLowerCase(),
  ),
}));

describe('staff-assignment-handler', () => {
  let mockRequest: { input: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    const sql = await import('mssql');
    mockRequest = { input: vi.fn().mockReturnThis(), query: vi.fn().mockResolvedValue({}) };
    const mockPool = { request: vi.fn().mockReturnValue(mockRequest) };
    vi.mocked(sql.connect).mockResolvedValue(mockPool as unknown as import('mssql').ConnectionPool);
  });

  async function getHandler() {
    await import('./index');
    const { app } = await import('@azure/functions');
    return (
      app as unknown as {
        _handlers: Record<string, (item: unknown, ctx: InvocationContext) => Promise<void>>;
      }
    )._handlers['staff-assignment-handler'];
  }

  function makeContext(): InvocationContext {
    return new InvocationContext();
  }

  const validEvent = {
    caseId: '081-24-12345',
    userId: 'user-abc',
    name: 'John Smith',
    role: 'TrialAttorney',
    assignedOn: '2024-11-15T10:00:00Z',
    documentType: 'ASSIGNMENT',
    acmsProfessionalId: 'NY-00063',
  };

  test('upserts CMMAP_STAGING row for a valid active assignment', async () => {
    const handler = await getHandler();
    const ctx = makeContext();

    await handler(validEvent, ctx);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('parses event when delivered as a JSON string', async () => {
    const handler = await getHandler();
    const ctx = makeContext();

    await handler(JSON.stringify(validEvent), ctx);

    expect(mockRequest.query).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('routes to DLQ when required fields are missing', async () => {
    const handler = await getHandler();
    const ctx = makeContext();

    await handler({ caseId: '081-24-12345' }, ctx);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });

  test('routes to DLQ when SQL upsert throws', async () => {
    const handler = await getHandler();
    const ctx = makeContext();
    mockRequest.query.mockRejectedValueOnce(new Error('SQL timeout'));

    await handler(validEvent, ctx);

    expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(ctx.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR' }),
    );
  });
});
