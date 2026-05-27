import { describe, test, expect, vi, beforeEach } from 'vitest';

// Module-level references updated in beforeEach
let mockQuery: ReturnType<typeof vi.fn>;
let mockInput: ReturnType<typeof vi.fn>;
let mockClose: ReturnType<typeof vi.fn>;

// vi.mock() is used here as a last-resort exception per CAMS conventions.
// mssql's ConnectionPool is a constructor class — vi.spyOn() can only intercept
// methods on existing instances, not intercept `new ConnectionPool(...)` calls.
// There is no other way to prevent real network connections in tests.
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

    // Verify SQL injection protection: all columns are bound as parameters
    expect(mockInput).toHaveBeenCalledWith('CASE_ID', 'ABC123');
    expect(mockInput).toHaveBeenCalledWith('TITLE', 'Test Case');
    expect(mockInput).toHaveBeenCalledWith('STATUS', 'Open');

    // Verify connection is always released
    expect(mockClose).toHaveBeenCalledOnce();
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

    // Verify connection is always released
    expect(mockClose).toHaveBeenCalledOnce();
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

  test('insertOnly: true with single string primaryKey generates MERGE without WHEN MATCHED branch and with single ON condition', async () => {
    const rows = [{ CASE_ID: 'ABC123', TITLE: 'Test Case' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID', true);

    const queryArg: string = mockQuery.mock.calls[0][0];

    expect(queryArg).not.toContain('WHEN MATCHED THEN');
    expect(queryArg).toContain('WHEN NOT MATCHED THEN');
    // Single string primaryKey produces exactly one ON condition (no AND)
    expect(queryArg).toContain('ON target.[CASE_ID] = source.[CASE_ID]');
    expect(queryArg).not.toContain(' AND target.');
  });

  test('missing key column (string) throws error', async () => {
    const rows = [{ TITLE: 'No key here', STATUS: 'Open' }];
    await expect(sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID')).rejects.toThrow(
      "Row missing primary key 'CASE_ID' in table 'AO_CS'",
    );
    // Pool cleanup must happen even when string-key validation fails
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('missing key column (array) throws error for missing key', async () => {
    const rows = [{ CS_CASEID: 'SEED001', VALUE: 'foo' }]; // missing COURT_ID
    await expect(sqlUpsert('dxtr', 'AO_CS', rows, ['CS_CASEID', 'COURT_ID'])).rejects.toThrow(
      "Row missing primary key 'COURT_ID' in table 'AO_CS'",
    );
    // Pool cleanup must happen even when array-key validation fails
    expect(mockClose).toHaveBeenCalledOnce();
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

  test('acms dbPrefix uses ACMS_MSSQL_* env vars and runs without error', async () => {
    process.env.ACMS_MSSQL_HOST = 'acms-host';
    process.env.ACMS_MSSQL_USER = 'acmsUser';
    process.env.ACMS_MSSQL_PASS = 'acmsPass';
    const rows = [{ CASE_ID: 'ACMS001', VALUE: 'test' }];
    await expect(sqlUpsert('acms', 'ACMS_TABLE', rows, 'CASE_ID')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('multi-row: executes one query per row and closes pool exactly once', async () => {
    const rows = [
      { CASE_ID: 'ABC001', TITLE: 'First Case', STATUS: 'Open' },
      { CASE_ID: 'ABC002', TITLE: 'Second Case', STATUS: 'Closed' },
    ];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID');

    // One query per row
    expect(mockQuery).toHaveBeenCalledTimes(2);
    // Pool closed exactly once, not once per row
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('all-key-columns row: WHEN MATCHED branch is omitted when no non-key columns exist', async () => {
    // Row contains only the primary key column — setClause will be empty
    const rows = [{ CASE_ID: 'KEY_ONLY' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID');

    expect(mockQuery).toHaveBeenCalledOnce();
    const queryArg: string = mockQuery.mock.calls[0][0];

    // With no non-key columns the setClause is empty, so MATCHED branch is silently omitted
    expect(queryArg).not.toContain('WHEN MATCHED THEN');
    expect(queryArg).not.toContain('UPDATE SET');
    // The insert branch must still be present
    expect(queryArg).toContain('WHEN NOT MATCHED THEN');
    expect(queryArg).toContain('INSERT');
  });

  test('Azure AD auth fallback when user/pass env vars are unset', async () => {
    delete process.env.MSSQL_USER;
    delete process.env.MSSQL_PASS;
    const rows = [{ CASE_ID: 'AZ001', VALUE: 'test' }];
    await expect(sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('empty rows array completes without error', async () => {
    await expect(sqlUpsert('dxtr', 'AO_CS', [], 'CASE_ID')).resolves.toBeUndefined();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('null values in non-key columns are bound as SQL null', async () => {
    const rows = [{ CASE_ID: 'ABC123', TITLE: null, STATUS: undefined }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID');

    expect(mockInput).toHaveBeenCalledWith('TITLE', null);
    expect(mockInput).toHaveBeenCalledWith('STATUS', null);
    expect(mockQuery).toHaveBeenCalledOnce();
  });
});
