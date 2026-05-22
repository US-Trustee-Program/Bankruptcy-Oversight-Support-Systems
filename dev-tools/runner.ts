#!/usr/bin/env tsx

/**
 * Database Seeding Runner
 *
 * Discovers and executes seed scripts from db_scripts/ directory.
 * Supports optional filtering via --db, --entity, and --scenario flags.
 *
 * Usage:
 *   tsx --env-file=../backend/.env runner.ts                     # all scripts
 *   tsx --env-file=../backend/.env runner.ts --db=cams           # all cams scripts
 *   tsx --env-file=../backend/.env runner.ts --db=cams --entity=cases  # cams/cases/*.ts
 *   tsx --env-file=../backend/.env runner.ts --scenario=chapter7  # one scenario file
 */

import * as sql from 'mssql';
import { readdirSync, statSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { mongoUpsert } from './db_scripts/lib/mongo-upsert.js';
import { sqlUpsert } from './db_scripts/lib/sql-upsert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MODULE_NAME = 'SEED-RUNNER';

interface CliArgs {
  db?: string;
  entity?: string;
  scenario?: string;
}

interface SeedScript {
  db: 'cams' | 'dxtr' | 'acms';
  collectionOrTable: string;
  data: Record<string, unknown>[];
  primaryKey?: string | string[];
  insertOnly?: boolean;
}

/** Context passed to generator scripts. */
export interface SeedContext {
  generateCaseId: (divisionCode: string) => Promise<GeneratedCaseId>;
}

export interface GeneratedCaseId {
  /** Full CAMS case ID: '{divisionCode}-{YY}-{NNNNN}' (e.g., '081-25-90234') */
  caseId: string;
  /** AO_CS.CASE_ID value: '{YY}-{NNNNN}' (e.g., '25-90234') */
  caseNumber: string;
  /** AO_CS.CS_CASEID internal ID: 'SEED{NNNNN}' (e.g., 'SEED90234'), 9 chars max */
  csCaseId: string;
}

export interface SeedOperation {
  db: 'cams' | 'dxtr' | 'acms';
  collectionOrTable: string;
  data: Record<string, unknown>[];
  primaryKey?: string | string[];
  insertOnly?: boolean;
}

export interface GeneratorScript {
  generate: (ctx: SeedContext) => Promise<SeedOperation[]>;
}

// ---------------------------------------------------------------------------
// Lazily-opened DXTR connection pool for collision checks in generateCaseId.
// Opened on first use, closed in main()'s finally block.
// ---------------------------------------------------------------------------
let dxtrCollisionPool: sql.ConnectionPool | null = null;

/** Exposed for test teardown — resets the module-level pool reference. */
export function resetDxtrPool(): void {
  dxtrCollisionPool = null;
}

function buildDxtrConfig(): sql.config {
  const config: sql.config = {
    server: process.env.MSSQL_HOST || 'localhost',
    database: process.env.MSSQL_DATABASE_DXTR || 'DXTR',
    options: {
      encrypt: process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true',
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };

  const user = process.env.MSSQL_USER;
  const pass = process.env.MSSQL_PASS;

  if (user && pass) {
    config.user = user;
    config.password = pass;
  } else {
    const authType = process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-default';
    const clientId = process.env.MSSQL_CLIENT_ID;
    config.authentication = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mssql auth type is a string literal union
      type: authType as any,
      ...(clientId && { options: { clientId } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting full object to satisfy mssql types
    } as any;
  }

  return config;
}

async function getDxtrPool(): Promise<sql.ConnectionPool> {
  if (!dxtrCollisionPool) {
    // mssql is CJS; namespace import resolves differently between tsx entry point
    // (where ConnectionPool lands on .default) and test mocks (where it is at top level).
    const Pool: typeof sql.ConnectionPool =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sql as any).ConnectionPool ?? (sql as any).default?.ConnectionPool;
    dxtrCollisionPool = await new Pool(buildDxtrConfig()).connect();
  }
  return dxtrCollisionPool;
}

const MAX_RETRIES = 20;
const SEED_MIN = 90000;
const SEED_MAX = 99999;

function randomSeedSeq(): number {
  return Math.floor(Math.random() * (SEED_MAX - SEED_MIN + 1)) + SEED_MIN;
}

/**
 * Generates a unique CAMS case ID in the seed-reserved range 90000–99999.
 * Checks DXTR to avoid collisions. Retries up to MAX_RETRIES times.
 *
 * Exported for testability.
 */
export async function generateCaseId(divisionCode: string): Promise<GeneratedCaseId> {
  const yy = new Date().getFullYear().toString().slice(-2);
  const pool = await getDxtrPool();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const seqNum = randomSeedSeq();
    const caseNumber = `${yy}-${seqNum}`;
    const csCaseId = `SEED${seqNum}`;

    const request = pool.request();
    request.input('div', divisionCode);
    request.input('caseNumber', caseNumber);
    const result = await request.query(
      `SELECT 1 FROM [dbo].[AO_CS] WHERE [CS_DIV] = @div AND [CASE_ID] = @caseNumber`,
    );

    if (result.recordset.length === 0) {
      return {
        caseId: `${divisionCode}-${caseNumber}`,
        caseNumber,
        csCaseId,
      };
    }
  }

  throw new Error(
    `Could not find a free case ID in the seed range for division ${divisionCode} after ${MAX_RETRIES} attempts`,
  );
}

function buildSeedContext(): SeedContext {
  return {
    generateCaseId,
  };
}

export function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--db=')) {
      args.db = arg.split('=')[1];
    } else if (arg.startsWith('--entity=')) {
      args.entity = arg.split('=')[1];
    } else if (arg.startsWith('--scenario=')) {
      args.scenario = arg.split('=')[1];
    }
  }

  return args;
}

/**
 * Discovers seed scripts under baseDir.
 *
 * - Static scripts:    db_scripts/{db}/{entity}/{scenario}.ts  (filtered by --db/--entity/--scenario)
 * - Scenario scripts:  db_scripts/scenarios/{name}.ts          (filtered only by --scenario; ignored by --db/--entity)
 *
 * Exported for testability.
 */
export function discoverScripts(baseDir: string, args: CliArgs): string[] {
  const staticScripts: string[] = [];
  const scenarioScripts: string[] = [];

  function walkStatic(dir: string, depth: number = 0) {
    if (depth > 3) return; // db/entity/scenario.ts max depth

    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && entry !== 'lib' && entry !== 'scenarios') {
        walkStatic(fullPath, depth + 1);
      } else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        staticScripts.push(fullPath);
      }
    }
  }

  function walkScenarios(scenariosDir: string) {
    let entries: string[];
    try {
      entries = readdirSync(scenariosDir);
    } catch {
      return; // scenarios/ directory doesn't exist yet — that's fine
    }

    for (const entry of entries) {
      const fullPath = join(scenariosDir, entry);
      const stat = statSync(fullPath);
      if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        scenarioScripts.push(fullPath);
      }
    }
  }

  walkStatic(baseDir);
  walkScenarios(join(baseDir, 'scenarios'));

  // Filter static scripts by --db, --entity, --scenario
  const filteredStatic = staticScripts.filter((scriptPath) => {
    const relativePath = relative(baseDir, scriptPath);
    const parts = relativePath.split(sep);

    if (args.db && parts[0] !== args.db) return false;
    if (args.entity && parts[1] !== args.entity) return false;
    if (args.scenario) {
      const scenarioName = parts[2]?.replace('.ts', '');
      if (scenarioName !== args.scenario) return false;
    }

    return true;
  });

  // Filter scenario scripts only by --scenario (not by --db or --entity)
  const filteredScenarios = scenarioScripts.filter((scriptPath) => {
    if (args.scenario) {
      const filename = scriptPath.split(sep).pop()?.replace('.ts', '');
      return filename === args.scenario;
    }
    return true;
  });

  // Static scripts first, then scenario scripts
  return [...filteredStatic, ...filteredScenarios];
}

/**
 * Executes a generator script's operations: dxtr/acms first, then cams.
 *
 * Exported for testability (accepts injectable upsert functions for unit tests).
 */
export async function runGeneratorScript(
  scenarioName: string,
  operations: SeedOperation[],
  mongoUpsertFn: typeof mongoUpsert = mongoUpsert,
  sqlUpsertFn: typeof sqlUpsert = sqlUpsert,
): Promise<void> {
  // Sort: dxtr/acms operations first, then cams
  const sorted = [
    ...operations.filter((op) => op.db !== 'cams'),
    ...operations.filter((op) => op.db === 'cams'),
  ];

  console.log(`[RUNNER] Running scenario: ${scenarioName}`);
  for (const op of sorted) {
    if (op.db === 'cams') {
      const connectionString = process.env.MONGO_CONNECTION_STRING;
      if (!connectionString) throw new Error('[RUNNER] MONGO_CONNECTION_STRING not set');
      await mongoUpsertFn(connectionString, 'cams', op.collectionOrTable, op.data);
    } else {
      if (!op.primaryKey)
        throw new Error(`[RUNNER] SQL operation missing primaryKey for ${op.collectionOrTable}`);
      await sqlUpsertFn(op.db, op.collectionOrTable, op.data, op.primaryKey, op.insertOnly);
    }
  }
  console.log(`[RUNNER] Scenario ${scenarioName}: ${sorted.length} operations executed`);
}

export async function runScript(scriptPath: string): Promise<void> {
  console.log(`[${MODULE_NAME}] Running ${scriptPath}`);

  const mod = await import(scriptPath);

  if (typeof (mod as GeneratorScript).generate === 'function') {
    const ctx = buildSeedContext();
    const operations = await (mod as GeneratorScript).generate(ctx);
    const scenarioName = scriptPath.split(sep).pop()?.replace('.ts', '') ?? scriptPath;
    await runGeneratorScript(scenarioName, operations);
    return;
  }

  // Static protocol (existing behavior)
  const { db, collectionOrTable, data, primaryKey, insertOnly } = mod as SeedScript;

  if (!db || !collectionOrTable || !data) {
    throw new Error(
      `[${MODULE_NAME}] Script ${scriptPath} must export: db, collectionOrTable, data`,
    );
  }

  if (data.length === 0) {
    console.log(`[${MODULE_NAME}] No data to seed in ${scriptPath}`);
    return;
  }

  switch (db) {
    case 'cams': {
      const connectionString = process.env.MONGO_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error(`[${MODULE_NAME}] MONGO_CONNECTION_STRING not set`);
      }
      await mongoUpsert(connectionString, 'cams', collectionOrTable, data);
      break;
    }

    case 'dxtr':
    case 'acms': {
      if (!primaryKey) {
        throw new Error(
          `[${MODULE_NAME}] SQL script ${scriptPath} must export primaryKey for MERGE upsert`,
        );
      }
      await sqlUpsert(db, collectionOrTable, data, primaryKey, insertOnly);
      break;
    }

    default:
      throw new Error(`[${MODULE_NAME}] Unknown database type: ${db}`);
  }
}

async function main() {
  try {
    const args = parseArgs();
    const baseDir = resolve(__dirname, 'db_scripts');

    console.log(`[${MODULE_NAME}] Starting database seeding...`);
    if (args.db) console.log(`[${MODULE_NAME}] Filter: db=${args.db}`);
    if (args.entity) console.log(`[${MODULE_NAME}] Filter: entity=${args.entity}`);
    if (args.scenario) console.log(`[${MODULE_NAME}] Filter: scenario=${args.scenario}`);

    const scripts = discoverScripts(baseDir, args);

    if (scripts.length === 0) {
      console.log(`[${MODULE_NAME}] No scripts found matching filters.`);
      process.exit(0);
    }

    console.log(`[${MODULE_NAME}] Found ${scripts.length} script(s)\n`);

    for (const scriptPath of scripts) {
      await runScript(scriptPath);
    }

    console.log(`\n[${MODULE_NAME}] Done. ${scripts.length} script(s) executed.`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${MODULE_NAME}] ERROR:`, err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    // Close lazily-opened DXTR collision-check pool if it was opened
    if (dxtrCollisionPool) {
      await dxtrCollisionPool.close();
      dxtrCollisionPool = null;
    }
  }
}

main();
