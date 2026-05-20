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
 *   tsx --env-file=../backend/.env runner.ts --db=cams --entity=cases --scenario=chapter7  # one file
 */

import { readdirSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
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
  primaryKey?: string;
}

function parseArgs(): CliArgs {
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

function discoverScripts(baseDir: string, args: CliArgs): string[] {
  const scripts: string[] = [];

  function walk(dir: string, depth: number = 0) {
    if (depth > 3) return; // db/entity/scenario.ts max depth

    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory() && entry !== 'lib') {
        walk(fullPath, depth + 1);
      } else if (stat.isFile() && entry.endsWith('.ts')) {
        scripts.push(fullPath);
      }
    }
  }

  walk(baseDir);

  // Filter by args
  return scripts.filter((scriptPath) => {
    const relativePath = scriptPath.replace(baseDir + '/', '');
    const parts = relativePath.split('/');

    if (args.db && parts[0] !== args.db) return false;
    if (args.entity && parts[1] !== args.entity) return false;
    if (args.scenario) {
      const scenarioName = parts[2]?.replace('.ts', '');
      if (scenarioName !== args.scenario) return false;
    }

    return true;
  });
}

async function runScript(scriptPath: string): Promise<void> {
  console.log(`[${MODULE_NAME}] Running ${scriptPath}`);

  const scriptModule = (await import(scriptPath)) as SeedScript;

  const { db, collectionOrTable, data, primaryKey } = scriptModule;

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
        throw new Error('[${MODULE_NAME}] MONGO_CONNECTION_STRING not set');
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
      await sqlUpsert(db, collectionOrTable, data, primaryKey);
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
  }
}

main();
