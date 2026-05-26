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
  parseArgs,
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

  test('Azure AD auth fallback resolves when MSSQL_USER and MSSQL_PASS are unset', async () => {
    delete process.env.MSSQL_USER;
    delete process.env.MSSQL_PASS;

    const result = await generateCaseId(divisionCode);

    expect(result.caseId).toBeTruthy();
    expect(result.caseNumber).toBeTruthy();
    expect(result.csCaseId).toBeTruthy();
  });

  test('reuses the same DXTR connection pool across calls', async () => {
    // Clean slate: ensure no pool from previous test
    resetDxtrPool();

    // Fresh spy that tracks new connections for this test only
    const connectSpy = vi.fn().mockResolvedValue({
      request: () => ({ input: mockInput, query: mockQuery }),
      close: mockClose,
    });
    mockConnect = connectSpy;

    // Two sequential calls with NO intermediate resetDxtrPool()
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

  test('--entity filter includes only matching entity directory and excludes others', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['cams'];
      if (dir === `${baseDir}/cams`) return ['cases', 'orders'];
      if (dir === `${baseDir}/cams/cases`) return ['ch7.ts'];
      if (dir === `${baseDir}/cams/orders`) return ['order1.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, { entity: 'cases' });
    expect(scripts).toContain(`${baseDir}/cams/cases/ch7.ts`);
    expect(scripts).not.toContain(`${baseDir}/cams/orders/order1.ts`);
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

  test('--db filter excludes static scripts from a different db directory', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['cams', 'dxtr'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return ['ch7.ts'];
      if (dir === `${baseDir}/dxtr`) return ['AO_CS'];
      if (dir === `${baseDir}/dxtr/AO_CS`) return ['row.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, { db: 'cams' });
    expect(scripts).toContain(`${baseDir}/cams/cases/ch7.ts`);
    expect(scripts).not.toContain(`${baseDir}/dxtr/AO_CS/row.ts`);
  });

  test('non-.ts files in scenarios/ are silently ignored', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['scenarios'];
      if (dir === `${baseDir}/scenarios`) return ['my-scenario.ts', 'readme.md'];
      return [];
    });

    statSyncMock.mockImplementation(() => makeFile());

    const scripts = discoverScripts(baseDir, {});
    expect(scripts).toContain(`${baseDir}/scenarios/my-scenario.ts`);
    expect(scripts).not.toContain(`${baseDir}/scenarios/readme.md`);
  });

  test('.test.ts files in scenarios/ are excluded from discovered scripts', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['scenarios'];
      if (dir === `${baseDir}/scenarios`) return ['ch7-base.ts', 'scenarios.test.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, {});
    expect(scripts).toContain(`${baseDir}/scenarios/ch7-base.ts`);
    expect(scripts).not.toContain(`${baseDir}/scenarios/scenarios.test.ts`);
  });

  test('.test.ts files in static db directories are excluded from discovered scripts', () => {
    const baseDir = '/fake/db_scripts';

    readdirSyncMock.mockImplementation((dir: string) => {
      if (dir === baseDir) return ['cams'];
      if (dir === `${baseDir}/cams`) return ['cases'];
      if (dir === `${baseDir}/cams/cases`) return ['ch7.ts', 'ch7.test.ts'];
      return [];
    });

    statSyncMock.mockImplementation((p: string) => {
      if (p.endsWith('.ts')) return makeFile();
      return makeDir();
    });

    const scripts = discoverScripts(baseDir, {});
    expect(scripts).toContain(`${baseDir}/cams/cases/ch7.ts`);
    expect(scripts).not.toContain(`${baseDir}/cams/cases/ch7.test.ts`);
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

    const insertOnlyOp: import('./runner.js').SeedOperation[] = [
      {
        db: 'dxtr',
        collectionOrTable: 'AO_CS',
        data: [{ CS_DIV: '081', CASE_ID: '25-90001' }],
        primaryKey: 'CASE_ID',
        insertOnly: true,
      },
    ];

    await runGeneratorScript('test-scenario', insertOnlyOp, mongoUpsertSpy, sqlUpsertSpy);

    expect(sqlUpsertSpy).toHaveBeenCalledWith('dxtr', 'AO_CS', expect.any(Array), 'CASE_ID', true);

    sqlUpsertSpy.mockClear();

    const noInsertOnlyOp: import('./runner.js').SeedOperation[] = [
      {
        db: 'dxtr',
        collectionOrTable: 'AO_CS',
        data: [{ CS_DIV: '081', CASE_ID: '25-90002' }],
        primaryKey: 'CASE_ID',
        // insertOnly not set — distinguishes the two call shapes
      },
    ];

    await runGeneratorScript('test-scenario', noInsertOnlyOp, mongoUpsertSpy, sqlUpsertSpy);

    expect(sqlUpsertSpy).toHaveBeenCalledWith(
      'dxtr',
      'AO_CS',
      expect.any(Array),
      'CASE_ID',
      undefined,
    );
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

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Running scenario:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('operations executed'));
  });
});

describe('parseArgs', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = originalArgv;
  });

  test('--db flag sets args.db', () => {
    process.argv = ['node', 'runner.ts', '--db=cams'];
    const args = parseArgs();
    expect(args.db).toBe('cams');
  });

  test('--entity flag sets args.entity', () => {
    process.argv = ['node', 'runner.ts', '--entity=cases'];
    const args = parseArgs();
    expect(args.entity).toBe('cases');
  });

  test('--scenario flag sets args.scenario', () => {
    process.argv = ['node', 'runner.ts', '--scenario=ch7-with-assignment'];
    const args = parseArgs();
    expect(args.scenario).toBe('ch7-with-assignment');
  });

  test('multiple flags together parse all three', () => {
    process.argv = ['node', 'runner.ts', '--db=cams', '--entity=cases', '--scenario=ch7'];
    const args = parseArgs();
    expect(args.db).toBe('cams');
    expect(args.entity).toBe('cases');
    expect(args.scenario).toBe('ch7');
  });

  test('unknown flags are ignored without crashing', () => {
    process.argv = ['node', 'runner.ts', '--unknown=value', '--db=cams'];
    const args = parseArgs();
    expect(args.db).toBe('cams');
    expect(args).not.toHaveProperty('unknown');
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
      undefined, // sharedClient (not used in tests)
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

  test('static protocol acms branch: calls sqlUpsert with acms db', async () => {
    const scriptPath = `data:text/javascript,export const db = 'acms'; export const collectionOrTable = 'MY_TABLE'; export const data = [{ ID: '1' }]; export const primaryKey = 'ID';`;
    await runScript(scriptPath);
    expect(sqlUpsertMock).toHaveBeenCalledWith(
      'acms',
      'MY_TABLE',
      expect.any(Array),
      'ID',
      undefined,
    );
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

  test('static protocol: throws when required exports are missing', async () => {
    const scriptPath = `data:text/javascript,export const collectionOrTable = 'cases'; export const data = [{ id: 1 }];`;
    await expect(runScript(scriptPath)).rejects.toThrow('must export: db, collectionOrTable, data');
  });

  test('generator protocol: calls sqlUpsert when generate yields a dxtr operation', async () => {
    const scriptPath = `data:text/javascript,export async function generate() { return [{ db: 'dxtr', collectionOrTable: 'AO_CS', data: [{ CS_DIV: '081', CASE_ID: '25-90001' }], primaryKey: 'CASE_ID' }]; }`;

    await runScript(scriptPath);

    expect(sqlUpsertMock).toHaveBeenCalledWith(
      'dxtr',
      'AO_CS',
      [{ CS_DIV: '081', CASE_ID: '25-90001' }],
      'CASE_ID',
      undefined,
    );
  });

  test('generator protocol: calls sqlUpsert when generate yields an acms operation', async () => {
    const scriptPath = `data:text/javascript,export async function generate() { return [{ db: 'acms', collectionOrTable: 'CMMPR', data: [{ PROF_CODE: 99901, LAST_NAME: 'Doe' }], primaryKey: 'PROF_CODE' }]; }`;

    await runScript(scriptPath);

    expect(sqlUpsertMock).toHaveBeenCalledWith(
      'acms',
      'CMMPR',
      [{ PROF_CODE: 99901, LAST_NAME: 'Doe' }],
      'PROF_CODE',
      undefined,
    );
  });
});
