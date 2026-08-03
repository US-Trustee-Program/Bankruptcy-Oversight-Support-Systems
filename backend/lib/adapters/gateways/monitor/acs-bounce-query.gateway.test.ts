import { vi } from 'vitest';
import { LogsQueryClient, LogsQueryResultStatus, LogsColumn } from '@azure/monitor-query-logs';
import { AcsBounceQueryGateway } from './acs-bounce-query.gateway';

const COLUMN_DESCRIPTORS: LogsColumn[] = [
  { name: 'TimeGenerated', type: 'datetime' },
  { name: 'CorrelationId', type: 'string' },
];

function mockClient(rows: unknown[][]): LogsQueryClient {
  return {
    queryWorkspace: vi.fn().mockResolvedValue({
      status: LogsQueryResultStatus.Success,
      tables: [{ name: 'PrimaryResult', columnDescriptors: COLUMN_DESCRIPTORS, rows }],
    }),
  } as unknown as LogsQueryClient;
}

describe('AcsBounceQueryGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.ANALYTICS_IDENTITY_CLIENT_ID;
  });

  test('projects CorrelationId, not MessageId, and normalizes a Date TimeGenerated to an ISO string', async () => {
    const client = mockClient([[new Date('2026-02-15T00:00:00.000Z'), 'msg-1']]);
    const gateway = new AcsBounceQueryGateway(() => client);

    const rows = await gateway.queryBounces('workspace-guid', '2026-01-01T00:00:00.000Z');

    expect(rows).toEqual([{ timeGenerated: '2026-02-15T00:00:00.000Z', messageId: 'msg-1' }]);
  });

  test('correctly orders rows whose TimeGenerated is a Date across a month boundary', async () => {
    // A Date.toString() based comparison sorts by weekday/month NAME, so Feb would
    // incorrectly sort below Jan; toISOString() sorts chronologically as intended.
    const client = mockClient([
      [new Date('2026-01-15T00:00:00.000Z'), 'msg-jan'],
      [new Date('2026-02-15T00:00:00.000Z'), 'msg-feb'],
    ]);
    const gateway = new AcsBounceQueryGateway(() => client);

    const rows = await gateway.queryBounces('workspace-guid', '2026-01-01T00:00:00.000Z');

    expect(rows.map((r) => r.messageId)).toEqual(['msg-jan', 'msg-feb']);
    expect(rows[0].timeGenerated < rows[1].timeGenerated).toBe(true);
  });

  test('handles a string TimeGenerated value the same as a Date value', async () => {
    const client = mockClient([['2026-02-15T00:00:00.000Z', 'msg-1']]);
    const gateway = new AcsBounceQueryGateway(() => client);

    const rows = await gateway.queryBounces('workspace-guid', '2026-01-01T00:00:00.000Z');

    expect(rows).toEqual([{ timeGenerated: '2026-02-15T00:00:00.000Z', messageId: 'msg-1' }]);
  });

  test('excludes rows at or before the cursor boundary', async () => {
    const client = mockClient([
      [new Date('2026-01-06T00:00:00.000Z'), 'msg-already-processed'],
      [new Date('2026-01-07T00:00:00.000Z'), 'msg-new'],
    ]);
    const gateway = new AcsBounceQueryGateway(() => client);

    const rows = await gateway.queryBounces('workspace-guid', '2026-01-06T00:00:00.000Z');

    expect(rows).toEqual([{ timeGenerated: '2026-01-07T00:00:00.000Z', messageId: 'msg-new' }]);
  });

  test('returns an empty array when the result has no tables', async () => {
    const client = {
      queryWorkspace: vi
        .fn()
        .mockResolvedValue({ status: LogsQueryResultStatus.Success, tables: [] }),
    } as unknown as LogsQueryClient;
    const gateway = new AcsBounceQueryGateway(() => client);

    const rows = await gateway.queryBounces('workspace-guid', '2026-01-01T00:00:00.000Z');

    expect(rows).toEqual([]);
  });

  test('throws ServerConfigError when the query does not succeed', async () => {
    const client = {
      queryWorkspace: vi
        .fn()
        .mockResolvedValue({ status: LogsQueryResultStatus.Failure, code: 'InternalServerError' }),
    } as unknown as LogsQueryClient;
    const gateway = new AcsBounceQueryGateway(() => client);

    await expect(
      gateway.queryBounces('workspace-guid', '2026-01-01T00:00:00.000Z'),
    ).rejects.toThrow(expect.objectContaining({ status: 500 }));
  });

  test('throws ServerConfigError from the default client factory when ANALYTICS_IDENTITY_CLIENT_ID is unset', async () => {
    const gateway = new AcsBounceQueryGateway();

    await expect(
      gateway.queryBounces('workspace-guid', '2026-01-01T00:00:00.000Z'),
    ).rejects.toThrow(expect.objectContaining({ status: 500 }));
  });
});
