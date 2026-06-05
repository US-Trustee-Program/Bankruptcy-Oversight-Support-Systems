import { describe, test, beforeEach, expect, vi } from 'vitest';
import { app, InvocationContext } from '@azure/functions';
import AcmsDailySync from './acms-daily-sync';

const mockRequest = {
  input: vi.fn().mockReturnThis(),
  query: vi.fn().mockResolvedValue({ recordset: [] }),
};

const mockPool = {
  connected: true,
  connect: vi.fn().mockResolvedValue(undefined),
  request: vi.fn().mockReturnValue(mockRequest),
  close: vi.fn(),
};

vi.mock('mssql', async () => {
  return {
    default: {},
    ConnectionPool: vi.fn(function () {
      return mockPool;
    }),
    Char: vi.fn(),
    Numeric: vi.fn(),
    DateTime2: vi.fn(),
    VarChar: vi.fn(),
    NVarChar: vi.fn(),
    DateTime: vi.fn(),
  };
});

vi.mock('@azure/functions', async () => {
  const handlers: Record<string, unknown> = {};
  return {
    app: {
      timer: vi.fn(function (name, options) {
        handlers[name] = options.handler;
      }),
      storageQueue: vi.fn(),
      http: vi.fn(),
      _handlers: handlers,
    },
    output: {
      storageQueue: vi.fn().mockReturnValue({ type: 'storageQueue', queueName: 'mock-queue' }),
    },
    InvocationContext: vi.fn().mockImplementation(function () {
      return {
        log: vi.fn(),
        error: vi.fn(),
      };
    }),
  };
});

function makeContext(): InvocationContext {
  return new InvocationContext();
}

describe('AcmsDailySync', () => {
  beforeEach(() => {
    mockRequest.input.mockReset().mockReturnThis();
    mockRequest.query.mockReset().mockResolvedValue({ recordset: [] });
    mockPool.connect.mockReset().mockResolvedValue(undefined);
  });

  describe('registration', () => {
    test('registers a timer trigger', () => {
      AcmsDailySync.setup();
      expect(app.timer).toHaveBeenCalledWith(
        expect.stringContaining('ACMS-CAMS-TRANSITION-DAILY-SYNC'),
        expect.objectContaining({ handler: expect.any(Function) }),
      );
    });
  });

  describe('syncAcmsToAll', () => {
    test('reads watermark from CMMAP_SYNC_CONTROL', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ LAST_SYNC_DATE: new Date('2024-01-01') }] })
        .mockResolvedValueOnce({ recordset: [] }) // ACMS rows query
        .mockResolvedValueOnce({ rowsAffected: [1] }); // watermark update

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      const queries: string[] = mockRequest.query.mock.calls.map(([q]: [string]) => q);
      expect(queries[0]).toContain('CMMAP_SYNC_CONTROL');
      expect(queries[0]).toContain('ACMS_DAILY');
    });

    test('queries CMMAP for rows newer than watermark', async () => {
      const watermark = new Date('2024-06-01');
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ LAST_SYNC_DATE: watermark }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      const queries: string[] = mockRequest.query.mock.calls.map(([q]: [string]) => q);
      expect(queries[1]).toContain('CMMAP');
    });

    test('does not overwrite CAMS-owned rows in CMMAP_ALL', async () => {
      const watermark = new Date('2024-01-01');
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ LAST_SYNC_DATE: watermark }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      const mergeQuery: string = mockRequest.query.mock.calls[1][0];
      expect(mergeQuery).toContain("SOURCE != 'CAMS'");
    });

    test('merges rows into CMMAP_ALL', async () => {
      const watermark = new Date('2024-01-01');
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ LAST_SYNC_DATE: watermark }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      const mergeQuery: string = mockRequest.query.mock.calls[1][0];
      expect(mergeQuery).toContain('CMMAP_ALL');
      expect(mergeQuery).toContain('MERGE INTO CMMAP_ALL');
    });

    test('updates watermark in CMMAP_SYNC_CONTROL after successful sync', async () => {
      const watermark = new Date('2024-01-01');
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ LAST_SYNC_DATE: watermark }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      const updateQuery: string = mockRequest.query.mock.calls[2][0];
      expect(updateQuery).toContain('CMMAP_SYNC_CONTROL');
      expect(updateQuery).toContain('LAST_SYNC_DATE');
    });

    test('logs success with row count', async () => {
      const watermark = new Date('2024-01-01');
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ LAST_SYNC_DATE: watermark }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('logs error and re-throws on SQL failure', async () => {
      mockRequest.query.mockRejectedValueOnce(new Error('connection lost'));

      const ctx = makeContext();
      await expect(AcmsDailySync.syncAcmsToAll(ctx)).rejects.toThrow('connection lost');
      expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    test('throws a clear error when CMMAP_SYNC_CONTROL control row is missing', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] }) // no watermark row — uses default
        .mockResolvedValueOnce({ recordset: [] }) // merge (0 rows affected)
        .mockResolvedValueOnce({ rowsAffected: [0] }); // UPDATE matched nothing

      const ctx = makeContext();
      await expect(AcmsDailySync.syncAcmsToAll(ctx)).rejects.toThrow(
        "CMMAP_SYNC_CONTROL has no 'ACMS_DAILY' row",
      );
      expect(ctx.log).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    test('uses default watermark when CMMAP_SYNC_CONTROL has no row', async () => {
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] }) // no control row
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ rowsAffected: [1] });

      const ctx = makeContext();
      await AcmsDailySync.syncAcmsToAll(ctx);

      // Should still reach the CMMAP query (second call)
      expect(mockRequest.query).toHaveBeenCalledTimes(3);
    });
  });
});
