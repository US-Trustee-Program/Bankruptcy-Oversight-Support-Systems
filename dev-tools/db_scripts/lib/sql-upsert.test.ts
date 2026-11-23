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

const IDENTITY_LOOKUP = /sys\.identity_columns/;

/** The MERGE statements sent, one per row, leaving out the identity lookup and counter reset. */
const mergeQueries = (): string[] =>
  mockQuery.mock.calls.map(([query]) => query as string).filter((query) => query.includes('MERGE'));

/** Answers the identity lookup as a table with this identity column and last assigned value. */
function withIdentity(identityColumn: string, identCurrent: number | null) {
  mockQuery.mockImplementation(async (query: string) =>
    IDENTITY_LOOKUP.test(query) ? { recordset: [{ identityColumn, identCurrent }] } : {},
  );
}

describe('sqlUpsert', () => {
  beforeEach(() => {
    mockQuery = vi.fn().mockResolvedValue({ recordset: [] });
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

    expect(mergeQueries()).toHaveLength(1);
    const queryArg: string = mergeQueries()[0];

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

    expect(mergeQueries()).toHaveLength(1);
    const queryArg: string = mergeQueries()[0];

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

    const queryArg: string = mergeQueries()[0];

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

    const queryArg: string = mergeQueries()[0];

    expect(queryArg).not.toContain('WHEN MATCHED THEN');
    expect(queryArg).not.toContain('UPDATE SET');
    expect(queryArg).toContain('WHEN NOT MATCHED THEN');
    expect(queryArg).toContain('INSERT');
  });

  test('insertOnly: true with single string primaryKey generates MERGE without WHEN MATCHED branch and with single ON condition', async () => {
    const rows = [{ CASE_ID: 'ABC123', TITLE: 'Test Case' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID', true);

    const queryArg: string = mergeQueries()[0];

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
    expect(mergeQueries()).toHaveLength(1);
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('ats dbPrefix uses the ATS_MSSQL_* env vars and runs without error', async () => {
    process.env.ATS_MSSQL_HOST = 'ats-host';
    process.env.ATS_MSSQL_USER = 'atsUser';
    process.env.ATS_MSSQL_PASS = 'atsPass';
    const rows = [{ ID: 9900010, LAST_NAME: 'Exact' }];
    await expect(sqlUpsert('ats', 'TRUSTEES', rows, 'ID')).resolves.toBeUndefined();
    expect(mergeQueries()).toHaveLength(1);
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('multi-row: executes one query per row and closes pool exactly once', async () => {
    const rows = [
      { CASE_ID: 'ABC001', TITLE: 'First Case', STATUS: 'Open' },
      { CASE_ID: 'ABC002', TITLE: 'Second Case', STATUS: 'Closed' },
    ];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID');

    // One MERGE per row
    expect(mergeQueries()).toHaveLength(2);
    // Pool closed exactly once, not once per row
    expect(mockClose).toHaveBeenCalledOnce();
  });

  test('all-key-columns row: WHEN MATCHED branch is omitted when no non-key columns exist', async () => {
    // Row contains only the primary key column — setClause will be empty
    const rows = [{ CASE_ID: 'KEY_ONLY' }];
    await sqlUpsert('dxtr', 'AO_CS', rows, 'CASE_ID');

    expect(mergeQueries()).toHaveLength(1);
    const queryArg: string = mergeQueries()[0];

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
    expect(mergeQueries()).toHaveLength(1);
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
    expect(mergeQueries()).toHaveLength(1);
  });

  describe('a table with an identity column', () => {
    beforeEach(() => {
      process.env.ATS_MSSQL_HOST = 'ats-host';
      process.env.ATS_MSSQL_USER = 'atsUser';
      process.env.ATS_MSSQL_PASS = 'atsPass';
    });

    test('should look the identity column up once per table, not once per row', async () => {
      await sqlUpsert('ats', 'TRUSTEES', [{ ID: 9900010 }, { ID: 9900021 }], 'ID');

      const lookups = mockQuery.mock.calls.filter(([query]) => IDENTITY_LOOKUP.test(query));
      expect(lookups).toHaveLength(1);
    });

    test('should write rows that supply the identity column with IDENTITY_INSERT on, in the same batch', async () => {
      withIdentity('ID', 27989);

      await sqlUpsert('ats', 'TRUSTEES', [{ ID: 9900010, LAST_NAME: 'Exact' }], 'ID');

      const [merge] = mergeQueries();
      expect(merge.indexOf('SET IDENTITY_INSERT [dbo].[TRUSTEES] ON;')).toBe(0);
      expect(merge.trimEnd()).toMatch(/SET IDENTITY_INSERT \[dbo\]\.\[TRUSTEES\] OFF;$/);
    });

    test('should put the identity counter back where it was after writing', async () => {
      withIdentity('ID', 27989);

      await sqlUpsert('ats', 'TRUSTEES', [{ ID: 9900010 }, { ID: 9900021 }], 'ID');

      const queries = mockQuery.mock.calls.map(([query]) => query as string);
      expect(queries[queries.length - 1]).toBe("DBCC CHECKIDENT ('dbo.TRUSTEES', RESEED, 27989)");
      expect(queries.filter((query) => query.startsWith('DBCC'))).toHaveLength(1);
    });

    test('should still put the identity counter back when a write fails partway', async () => {
      let merges = 0;
      mockQuery.mockImplementation(async (query: string) => {
        if (IDENTITY_LOOKUP.test(query))
          return { recordset: [{ identityColumn: 'ID', identCurrent: 27989 }] };
        if (query.includes('MERGE') && ++merges === 2) throw new Error('MERGE failed');
        return {};
      });

      await expect(
        sqlUpsert('ats', 'TRUSTEES', [{ ID: 9900010 }, { ID: 9900021 }], 'ID'),
      ).rejects.toThrow('MERGE failed');

      const queries = mockQuery.mock.calls.map(([query]) => query as string);
      expect(queries).toContain("DBCC CHECKIDENT ('dbo.TRUSTEES', RESEED, 27989)");
      expect(mockClose).toHaveBeenCalledOnce();
    });

    test('should report the write error, not the reset error, when both fail', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockQuery.mockImplementation(async (query: string) => {
        if (IDENTITY_LOOKUP.test(query))
          return { recordset: [{ identityColumn: 'ID', identCurrent: 27989 }] };
        if (query.includes('MERGE')) throw new Error('MERGE failed');
        throw new Error('RESEED failed');
      });

      await expect(sqlUpsert('ats', 'TRUSTEES', [{ ID: 9900010 }], 'ID')).rejects.toThrow(
        'MERGE failed',
      );

      expect(errorSpy.mock.calls.map(([message]) => String(message)).join('\n')).toContain(
        "DBCC CHECKIDENT ('dbo.TRUSTEES', RESEED, 27989)",
      );
      errorSpy.mockRestore();
    });

    test('should leave IDENTITY_INSERT and the counter alone when no row supplies the identity column', async () => {
      withIdentity('CD_ID', 159);

      await sqlUpsert(
        'ats',
        'CHAPTER_DETAILS',
        [{ TRU_ID: 9900010, CHAPTER: '7', STATUS: 'PA' }],
        ['TRU_ID', 'CHAPTER'],
      );

      const queries = mockQuery.mock.calls.map(([query]) => query as string);
      expect(queries.some((query) => query.includes('IDENTITY_INSERT'))).toBe(false);
      expect(queries.some((query) => query.startsWith('DBCC'))).toBe(false);
    });

    test('should not reset the counter when it cannot be read', async () => {
      withIdentity('ID', null);

      await sqlUpsert('ats', 'TRUSTEES', [{ ID: 9900010 }], 'ID');

      const queries = mockQuery.mock.calls.map(([query]) => query as string);
      expect(queries.some((query) => query.startsWith('DBCC'))).toBe(false);
      expect(mergeQueries()[0]).toContain('SET IDENTITY_INSERT [dbo].[TRUSTEES] ON;');
    });
  });
});
