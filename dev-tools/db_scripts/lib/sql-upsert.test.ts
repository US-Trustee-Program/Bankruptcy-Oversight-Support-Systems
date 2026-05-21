import { describe, test, expect, vi, beforeEach } from 'vitest';

// Module-level references updated in beforeEach
let mockQuery: ReturnType<typeof vi.fn>;
let mockInput: ReturnType<typeof vi.fn>;
let mockClose: ReturnType<typeof vi.fn>;

vi.mock('mssql', () => {
  class MockConnectionPool {
    connect() {
      return Promise.resolve({
        request: () => ({ input: mockInput, query: mockQuery }),
        close: mockClose,
      });
    }
  }
  return { ConnectionPool: MockConnectionPool };
});

import { sqlUpsert } from './sql-upsert.js';

describe('sqlUpsert', () => {
  beforeEach(() => {
    mockQuery = vi.fn().mockResolvedValue({});
    mockInput = vi.fn().mockReturnThis();
    mockClose = vi.fn().mockResolvedValue(undefined);
    // Set minimal env vars so buildSqlConfig works
    process.env.MSSQL_HOST = 'localhost';
    process.env.MSSQL_USER = 'sa';
    process.env.MSSQL_PASS = 'pass';
  });

  test('single string primaryKey - backward compat - upserts row', async () => {
    const rows = [{ CASE_ID: 'ABC123', TITLE: 'Test Case', STATUS: 'Open' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID');

    expect(mockQuery).toHaveBeenCalledOnce();
    const queryArg: string = mockQuery.mock.calls[0][0];

    expect(queryArg).toContain('ON target.[CASE_ID] = source.[CASE_ID]');
    expect(queryArg).toContain('WHEN MATCHED THEN');
    expect(queryArg).toContain('UPDATE SET');
    // SET should not include the primary key column
    // Extract just the SET line to check its contents
    const setLine = queryArg.match(/UPDATE SET (.+)/)?.[1] ?? '';
    expect(setLine).not.toContain('[CASE_ID]');
  });

  test('array primaryKey generates correct MERGE ON clause with all keys', async () => {
    const rows = [{ CS_CASEID: 'SEED001', COURT_ID: '081', VALUE: 'foo' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, ['CS_CASEID', 'COURT_ID']);

    expect(mockQuery).toHaveBeenCalledOnce();
    const queryArg: string = mockQuery.mock.calls[0][0];

    // ON clause must join on both keys
    expect(queryArg).toContain(
      'ON target.[CS_CASEID] = source.[CS_CASEID] AND target.[COURT_ID] = source.[COURT_ID]',
    );
    // USING must project both key columns
    expect(queryArg).toContain('@CS_CASEID AS [CS_CASEID]');
    expect(queryArg).toContain('@COURT_ID AS [COURT_ID]');
  });

  test('array primaryKey excludes all key columns from SET clause', async () => {
    const rows = [{ CS_CASEID: 'SEED001', COURT_ID: '081', VALUE: 'foo', OTHER: 'bar' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, ['CS_CASEID', 'COURT_ID']);

    const queryArg: string = mockQuery.mock.calls[0][0];

    // SET clause should include non-key columns
    expect(queryArg).toContain('[VALUE] = @VALUE');
    expect(queryArg).toContain('[OTHER] = @OTHER');
    // SET clause should NOT include either key column
    const setLine = queryArg.match(/UPDATE SET (.+)/)?.[1] ?? '';
    expect(setLine).not.toContain('[CS_CASEID]');
    expect(setLine).not.toContain('[COURT_ID]');
  });

  test('insertOnly: true with array primaryKey generates MERGE without WHEN MATCHED branch', async () => {
    const rows = [{ CS_CASEID: 'SEED001', COURT_ID: '081', VALUE: 'foo' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, ['CS_CASEID', 'COURT_ID'], true);

    const queryArg: string = mockQuery.mock.calls[0][0];

    expect(queryArg).not.toContain('WHEN MATCHED THEN');
    expect(queryArg).not.toContain('UPDATE SET');
    expect(queryArg).toContain('WHEN NOT MATCHED THEN');
    expect(queryArg).toContain('INSERT');
  });

  test('insertOnly: true with single string primaryKey generates MERGE without WHEN MATCHED branch', async () => {
    const rows = [{ CASE_ID: 'ABC123', TITLE: 'Test Case' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID', true);

    const queryArg: string = mockQuery.mock.calls[0][0];

    expect(queryArg).not.toContain('WHEN MATCHED THEN');
    expect(queryArg).toContain('WHEN NOT MATCHED THEN');
  });

  test('missing key column (string) throws error', async () => {
    const rows = [{ TITLE: 'No key here', STATUS: 'Open' }];
    await expect(sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID')).rejects.toThrow(
      "Row missing primary key 'CASE_ID' in table 'AO_CS'",
    );
  });

  test('missing key column (array) throws error for missing key', async () => {
    const rows = [{ CS_CASEID: 'SEED001', VALUE: 'foo' }]; // missing COURT_ID
    await expect(sqlUpsert('dxtr', 'AO_CS', rows, ['CS_CASEID', 'COURT_ID'])).rejects.toThrow(
      "Row missing primary key 'COURT_ID' in table 'AO_CS'",
    );
  });

  test('log line includes all key values for array primaryKey', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const rows = [{ CS_CASEID: 'SEED001', COURT_ID: '081', VALUE: 'foo' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, ['CS_CASEID', 'COURT_ID']);

    const logCalls = consoleSpy.mock.calls.map((c) => c[0] as string);
    const seedLog = logCalls.find((l) => l.includes('[SEED]'));
    expect(seedLog).toContain('CS_CASEID=SEED001');
    expect(seedLog).toContain('COURT_ID=081');
  });
});
