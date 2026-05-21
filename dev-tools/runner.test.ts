import { describe, test, expect, vi, beforeEach } from 'vitest';

// Module-level mock references updated in beforeEach
let mockQuery: ReturnType<typeof vi.fn>;
let mockInput: ReturnType<typeof vi.fn>;
let mockClose: ReturnType<typeof vi.fn>;
let mockConnect: ReturnType<typeof vi.fn>;

// vi.mock() is used as a last-resort exception per CAMS conventions.
// mssql's ConnectionPool is a constructor class — vi.spyOn() cannot intercept
// `new ConnectionPool(...)` calls, so there is no other way to prevent real
// network connections in tests.
vi.mock('mssql', () => {
  class MockConnectionPool {
    connect() {
      return (mockConnect as (...args: unknown[]) => unknown)();
    }
  }
  return { ConnectionPool: MockConnectionPool };
});

// vi.mock() is used here as a last-resort exception per CAMS conventions.
// fs functions (readdirSync, statSync) are imported into the production module
// as named imports bound at module-load time. vi.spyOn() cannot intercept them
// after the module has already been loaded, so vi.mock() is the only option.
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    readdirSync: vi.fn(original.readdirSync),
    statSync: vi.fn(original.statSync),
  };
});

import { readdirSync, statSync } from 'fs';

// vi.mock() is used here as a last-resort exception per CAMS conventions.
// mongoUpsert and sqlUpsert are imported as named imports in runner.ts — there is
// no injectable seam in runScript (unlike runGeneratorScript), so vi.mock() is the
// only way to prevent real DB calls.
vi.mock('./db_scripts/lib/mongo-upsert.js', () => ({
  mongoUpsert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./db_scripts/lib/sql-upsert.js', () => ({
  sqlUpsert: vi.fn().mockResolvedValue(undefined),
}));

import { mongoUpsert } from './db_scripts/lib/mongo-upsert.js';
import { sqlUpsert } from './db_scripts/lib/sql-upsert.js';

// Import runner internals via re-exported test hooks. The runner exports these
// for testability when the module is loaded in a test environment.
// We import them dynamically after mocks are in place.
import {
  generateCaseId,
  discoverScripts,
  runGeneratorScript,
  runScript,
  resetDxtrPool,
} from './runner.js';

describe('generateCaseId', () => {
  const divisionCode = '081';

  beforeEach(() => {
    mockQuery = vi.fn().mockResolvedValue({ recordset: [] }); // no collision by default
    mockInput = vi.fn().mockReturnThis();
    mockClose = vi.fn().mockResolvedValue(undefined);
    mockConnect = vi.fn().mockResolvedValue({
      request: () => ({ input: mockInput, query: mockQuery }),
      close: mockClose,
    });

    // Env vars required for DXTR connection
    process.env.MSSQL_HOST = 'localhost';
    process.env.MSSQL_USER = 'sa';
    process.env.MSSQL_PASS = 'pass';
    process.env.MSSQL_DATABASE_DXTR = 'DXTR';

    // Reset shared pool between tests so each test gets a fresh connection
    resetDxtrPool();
  });

  test('returns correctly formatted caseId, caseNumber, csCaseId', async () => {
    const result = await generateCaseId(divisionCode);

    const yy = new Date().getFullYear().toString().slice(-2);
    expect(result.caseId).toMatch(new RegExp(`^081-${yy}-9\\d{4}$`));
    expect(result.caseNumber).toMatch(new RegExp(`^${yy}-9\\d{4}$`));
    expect(result.csCaseId).toMatch(/^SEED9\d{4}$/);
  });

  test('binds division code and case number as parameters', async () => {
    const result = await generateCaseId(divisionCode);

    expect(mockInput).toHaveBeenCalledWith('div', divisionCode);
    expect(mockInput).toHaveBeenCalledWith('caseNumber', result.caseNumber);
  });

  test('retries with new random number when collision detected', async () => {
    // First call returns collision, second returns no collision
    mockQuery
      .mockResolvedValueOnce({ recordset: [{ 1: 1 }] }) // collision
      .mockResolvedValueOnce({ recordset: [] }); // free

    const result = await generateCaseId(divisionCode);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.caseId).toBeTruthy();
  });

  test('throws after 20 consecutive collisions', async () => {
    // Always return a collision
    mockQuery.mockResolvedValue({ recordset: [{ 1: 1 }] });

    await expect(generateCaseId(divisionCode)).rejects.toThrow(
      `Could not find a free case ID in the seed range for division ${divisionCode} after 20 attempts`,
    );

    expect(mockQuery).toHaveBeenCalledTimes(20);
  });

  test('reuses the same DXTR connection pool across calls', async () => {
    await generateCaseId(divisionCode);
    resetDxtrPool(); // This resets for the isolation test — we test reuse by NOT resetting

    // Re-run without resetting to verify connect is called once per test lifecycle
    // Set up fresh mock for this specific test
    const connectSpy = vi.fn().mockResolvedValue({
      request: () => ({ input: mockInput, query: mockQuery }),
      close: mockClose,
    });
    mockConnect = connectSpy;
    resetDxtrPool();

    await generateCaseId(divisionCode);
    await generateCaseId(divisionCode);

    // connect() should only be called once despite two generateCaseId calls
    expect(connectSpy).toHaveBeenCalledOnce();
  });
});

describe('discoverScripts with scenarios directory', () => {
  const readdirSyncMock = readdirSync as ReturnType<typeof vi.fn>;
  const statSyncMock = statSync as ReturnType<typeof vi.fn>;

  const makeDir = () => ({ isDirectory: () => true, isFile: () => false });
  const makeFile = () => ({ isDirectory: () => false, isFile: () => true });

  beforeEach(() => {
    readdirSyncMock.mockReset();
    statSyncMock.mockReset();
  });

  test('discovers .ts files under db_scripts/scenarios/', () => {
    const baseDir = '/fake/db_scripts';

    // Walk: baseDir → ['scenarios', 'cams'], scenarios/ → ['ch7-base.ts'], cams/ → ['cases'], cams/cases/ → []
    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['scenarios', 'cams'];
      if (dir === `${baseDir}/scenarios`) return ['ch7-base.ts'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return [];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, {});
    expect(scripts).toContain(`${baseDir}/scenarios/ch7-base.ts`);
  });

  test('--scenario filter matches scenario files by filename without extension', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['scenarios'];
      if (dir === `${baseDir}/scenarios`) return ['ch7-base.ts', 'ch11-complex.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, { scenario: 'ch7-base' });
    expect(scripts).toContain(`${baseDir}/scenarios/ch7-base.ts`);
    expect(scripts).not.toContain(`${baseDir}/scenarios/ch11-complex.ts`);
  });

  test('--scenario filter applies to static scripts by filename without extension', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['cams'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return ['ch7-base.ts', 'ch11.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, { scenario: 'ch7-base' });
    expect(scripts).toContain(`${baseDir}/cams/cases/ch7-base.ts`);
    expect(scripts).not.toContain(`${baseDir}/cams/cases/ch11.ts`);
  });

  test('--db filter does not exclude scenario files', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['scenarios', 'cams'];
      if (dir === `${baseDir}/scenarios`) return ['my-scenario.ts'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return ['chapter7.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    // --db=cams should NOT filter out scenario files
    const scripts = discoverScripts(baseDir, { db: 'cams' });
    expect(scripts).toContain(`${baseDir}/scenarios/my-scenario.ts`);
    expect(scripts).toContain(`${baseDir}/cams/cases/chapter7.ts`);
  });

  test('--entity filter does not exclude scenario files', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['scenarios', 'cams'];
      if (dir === `${baseDir}/scenarios`) return ['my-scenario.ts'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return ['chapter7.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, { db: 'cams', entity: 'cases' });
    expect(scripts).toContain(`${baseDir}/scenarios/my-scenario.ts`);
  });

  test('scenario files appear after static db scripts', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['cams', 'scenarios'];
      if (dir === `${baseDir}/scenarios`) return ['my-scenario.ts'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return ['chapter7.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, {});
    const staticIdx = scripts.indexOf(`${baseDir}/cams/cases/chapter7.ts`);
    const scenarioIdx = scripts.indexOf(`${baseDir}/scenarios/my-scenario.ts`);

    // discoverScripts guarantees [...filteredStatic, ...filteredScenarios] ordering
    expect(staticIdx).toBeGreaterThanOrEqual(0);
    expect(scenarioIdx).toBeGreaterThanOrEqual(0);
    expect(staticIdx).toBeLessThan(scenarioIdx);
  });
});

describe('runGeneratorScript', () => {
  let mongoUpsertSpy: ReturnType<typeof vi.fn<typeof mongoUpsert>>;
  let sqlUpsertSpy: ReturnType<typeof vi.fn<typeof sqlUpsert>>;

  beforeEach(() => {
    mongoUpsertSpy = vi.fn<typeof mongoUpsert>().mockResolvedValue(undefined);
    sqlUpsertSpy = vi.fn<typeof sqlUpsert>().mockResolvedValue(undefined);

    process.env.MONGO_CONNECTION_STRING = 'mongodb://localhost:27017';
    process.env.MSSQL_HOST = 'localhost';
    process.env.MSSQL_USER = 'sa';
    process.env.MSSQL_PASS = 'pass';

    resetDxtrPool();
  });

  test('dxtr and acms operations execute before cams operations', async () => {
    const executionOrder: string[] = [];

    mongoUpsertSpy.mockImplementation(async () => {
      executionOrder.push('cams');
    });
    sqlUpsertSpy.mockImplementation(async () => {
      executionOrder.push('dxtr');
    });

    const operations: import('./runner.js').SeedOperation[] = [
      { db: 'cams', collectionOrTable: 'cases', data: [{ id: 'case-1' }] },
      {
        db: 'dxtr',
        collectionOrTable: 'AO_CS',
        data: [{ CS_DIV: '081', CASE_ID: '25-90001' }],
        primaryKey: 'CASE_ID',
      },
    ];

    await runGeneratorScript('test-scenario', operations, mongoUpsertSpy, sqlUpsertSpy);

    expect(executionOrder[0]).toBe('dxtr');
    expect(executionOrder[1]).toBe('cams');
  });

  test('passes insertOnly flag through to sqlUpsert', async () => {
    sqlUpsertSpy.mockResolvedValue(undefined);

    const operations: import('./runner.js').SeedOperation[] = [
      {
        db: 'dxtr',
        collectionOrTable: 'AO_CS',
        data: [{ CS_DIV: '081', CASE_ID: '25-90001' }],
        primaryKey: 'CASE_ID',
        insertOnly: true,
      },
    ];

    await runGeneratorScript('test-scenario', operations, mongoUpsertSpy, sqlUpsertSpy);

    expect(sqlUpsertSpy).toHaveBeenCalledWith('dxtr', 'AO_CS', expect.any(Array), 'CASE_ID', true);
  });

  test('throws when MONGO_CONNECTION_STRING is missing for cams operations', async () => {
    delete process.env.MONGO_CONNECTION_STRING;

    const operations: import('./runner.js').SeedOperation[] = [
      { db: 'cams', collectionOrTable: 'cases', data: [{ id: 'case-1' }] },
    ];

    await expect(
      runGeneratorScript('test-scenario', operations, mongoUpsertSpy, sqlUpsertSpy),
    ).rejects.toThrow('[RUNNER] MONGO_CONNECTION_STRING not set');
  });

  test('throws when SQL operation is missing primaryKey', async () => {
    const operations: import('./runner.js').SeedOperation[] = [
      {
        db: 'dxtr',
        collectionOrTable: 'AO_CS',
        data: [{ CS_DIV: '081', CASE_ID: '25-90001' }],
        // no primaryKey
      },
    ];

    await expect(
      runGeneratorScript('test-scenario', operations, mongoUpsertSpy, sqlUpsertSpy),
    ).rejects.toThrow('[RUNNER] SQL operation missing primaryKey for AO_CS');
  });

  test('logs scenario name and operation count', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const scenarioName = 'my-scenario';

    const operations: import('./runner.js').SeedOperation[] = [
      { db: 'cams', collectionOrTable: 'cases', data: [{ id: 'case-1' }] },
    ];

    await runGeneratorScript(scenarioName, operations, mongoUpsertSpy, sqlUpsertSpy);

    const logMessages = consoleSpy.mock.calls.map((c) => c.join(' '));
    expect(
      logMessages.some((m) => m.includes('Running scenario:') && m.includes(scenarioName)),
    ).toBe(true);
    expect(
      logMessages.some((m) => m.includes(scenarioName) && m.includes('operations executed')),
    ).toBe(true);
  });
});

describe('runScript', () => {
  const mongoUpsertMock = mongoUpsert as ReturnType<typeof vi.fn>;
  const sqlUpsertMock = sqlUpsert as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mongoUpsertMock.mockReset();
    mongoUpsertMock.mockResolvedValue(undefined);
    sqlUpsertMock.mockReset();
    sqlUpsertMock.mockResolvedValue(undefined);

    process.env.MONGO_CONNECTION_STRING = 'mongodb://localhost:27017';
    process.env.MSSQL_HOST = 'localhost';
    process.env.MSSQL_USER = 'sa';
    process.env.MSSQL_PASS = 'pass';

    resetDxtrPool();
  });

  test('generator protocol: calls runGeneratorScript when mod.generate is a function', async () => {
    // Use a data: URL with a literal generate function that returns a cams operation.
    // This exercises the generator branch in runScript without touching the filesystem.
    const scriptPath = `data:text/javascript,export async function generate() { return [{ db: 'cams', collectionOrTable: 'cases', data: [{ id: 'gen-1' }] }]; }`;

    await runScript(scriptPath);

    expect(mongoUpsertMock).toHaveBeenCalledWith(
      'mongodb://localhost:27017',
      'cams',
      'cases',
      expect.any(Array),
    );
  });

  test('static protocol cams branch: throws when MONGO_CONNECTION_STRING is not set', async () => {
    delete process.env.MONGO_CONNECTION_STRING;

    // Synthetic static module: db=cams, no generate export
    const scriptPath = `data:text/javascript,export const db = 'cams'; export const collectionOrTable = 'cases'; export const data = [{ id: 'c1' }];`;

    await expect(runScript(scriptPath)).rejects.toThrow(
      '[SEED-RUNNER] MONGO_CONNECTION_STRING not set',
    );
  });

  test('static protocol dxtr branch: throws when primaryKey is undefined', async () => {
    // Synthetic static module: db=dxtr, no primaryKey
    const scriptPath = `data:text/javascript,export const db = 'dxtr'; export const collectionOrTable = 'AO_CS'; export const data = [{ CS_DIV: '081' }];`;

    await expect(runScript(scriptPath)).rejects.toThrow('[SEED-RUNNER] SQL script');
  });

  test('static protocol: returns without calling upsert when data is empty', async () => {
    const scriptPath = `data:text/javascript,export const db = 'cams'; export const collectionOrTable = 'cases'; export const data = [];`;

    await runScript(scriptPath);

    expect(mongoUpsertMock).not.toHaveBeenCalled();
  });

  test('static protocol: throws for unknown database type', async () => {
    const scriptPath = `data:text/javascript,export const db = 'unknown'; export const collectionOrTable = 'tbl'; export const data = [{ id: 1 }];`;

    await expect(runScript(scriptPath)).rejects.toThrow(
      '[SEED-RUNNER] Unknown database type: unknown',
    );
  });
});
