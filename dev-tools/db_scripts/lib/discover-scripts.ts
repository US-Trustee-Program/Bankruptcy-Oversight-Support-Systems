import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/** The runner's --db, --entity and --scenario filters. */
export type ScriptFilters = {
  db?: string;
  entity?: string;
  scenario?: string;
};

function isScript(fullPath: string, entry: string): boolean {
  return statSync(fullPath).isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts');
}

/**
 * Every scenario script in scenariosDir: each .ts file that isn't a test. Returns [] when the
 * directory doesn't exist. The runner and the all-scenarios validation suite both use this, so
 * they always agree on what a scenario is.
 */
export function discoverScenarioScripts(scenariosDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(scenariosDir);
  } catch {
    return []; // scenarios/ directory doesn't exist yet: that's fine
  }
  return entries
    .map((entry) => ({ entry, fullPath: join(scenariosDir, entry) }))
    .filter(({ entry, fullPath }) => isScript(fullPath, entry))
    .map(({ fullPath }) => fullPath);
}

/**
 * Discovers seed scripts under baseDir.
 *
 * - Static scripts:    db_scripts/{db}/{entity}/{scenario}.ts  (filtered by --db/--entity/--scenario)
 * - Scenario scripts:  db_scripts/scenarios/{name}.ts          (filtered only by --scenario; ignored by --db/--entity)
 *
 * Static scripts come first, then scenario scripts.
 */
export function discoverScripts(baseDir: string, args: ScriptFilters): string[] {
  const staticScripts: string[] = [];

  function walkStatic(dir: string, depth: number = 0) {
    if (depth > 3) return; // db/entity/scenario.ts max depth

    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory() && entry !== 'lib' && entry !== 'scenarios') {
        walkStatic(fullPath, depth + 1);
      } else if (isScript(fullPath, entry)) {
        staticScripts.push(fullPath);
      }
    }
  }

  walkStatic(baseDir);
  const scenarioScripts = discoverScenarioScripts(join(baseDir, 'scenarios'));

  // Filter static scripts by --db, --entity, --scenario
  const filteredStatic = staticScripts.filter((scriptPath) => {
    const parts = relative(baseDir, scriptPath).split(sep);

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

  return [...filteredStatic, ...filteredScenarios];
}
