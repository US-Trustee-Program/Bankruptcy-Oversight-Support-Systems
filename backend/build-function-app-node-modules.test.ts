import { describe, expect, test } from 'vitest';
// The packaging helper is plain ESM JavaScript shared with pack.sh / Dockerfile.build.
import { resolveDep, computeClosure, installSlotFor } from './build-function-app-node-modules.mjs';

// A minimal lockfile "packages" map modeling the real failure mode: the function app's
// external (mssql) plus its nested dependency (commander). We test that resolution and the
// closure walk behave identically whether mssql is HOISTED to the root node_modules or
// UN-HOISTED under the backend workspace — the hoisting-independence that the previous
// `npm ci --workspaces=false` packaging lacked, which is what broke when a dependency bump
// changed npm's hoisting decision.
function lockfileWithMssqlAt(mssqlKey: string) {
  return {
    '': { name: 'cams', workspaces: ['backend'] },
    backend: { name: 'node', dependencies: { mssql: '12.5.5' } },
    [mssqlKey]: {
      name: 'mssql',
      version: '12.5.5',
      dependencies: { commander: '^11.0.0', tedious: '^19.0.0' },
    },
    [`${mssqlKey}/node_modules/commander`]: { name: 'commander', version: '11.1.0' },
    'node_modules/tedious': { name: 'tedious', version: '19.2.0', dependencies: {} },
    // A different top-level commander (e.g. pulled by tooling) must NOT be chosen for mssql.
    'node_modules/commander': { name: 'commander', version: '14.0.3' },
  };
}

describe('resolveDep', () => {
  test('resolves a dependency hoisted to the root node_modules', () => {
    const pkgs = lockfileWithMssqlAt('node_modules/mssql');
    expect(resolveDep(pkgs, 'backend', 'mssql')).toBe('node_modules/mssql');
  });

  test('resolves a dependency un-hoisted under the backend workspace', () => {
    const pkgs = lockfileWithMssqlAt('backend/node_modules/mssql');
    expect(resolveDep(pkgs, 'backend', 'mssql')).toBe('backend/node_modules/mssql');
  });

  test('prefers a nested dependency over a different top-level version', () => {
    const pkgs = lockfileWithMssqlAt('node_modules/mssql');
    // commander required BY mssql must resolve to mssql's nested 11.x, not top-level 14.x.
    expect(resolveDep(pkgs, 'node_modules/mssql', 'commander')).toBe(
      'node_modules/mssql/node_modules/commander',
    );
  });

  test('walks up node_modules ancestors before falling back to the root', () => {
    const pkgs = lockfileWithMssqlAt('node_modules/mssql');
    // tedious is only at the root; a package nested under mssql still resolves it.
    expect(resolveDep(pkgs, 'node_modules/mssql', 'tedious')).toBe('node_modules/tedious');
  });

  test('returns null for an absent dependency', () => {
    const pkgs = lockfileWithMssqlAt('node_modules/mssql');
    expect(resolveDep(pkgs, 'backend', 'does-not-exist')).toBeNull();
  });
});

describe('computeClosure', () => {
  test('produces the same closure whether mssql is hoisted or un-hoisted', () => {
    const hoisted = computeClosure(lockfileWithMssqlAt('node_modules/mssql'), ['mssql'], 'backend');
    const unhoisted = computeClosure(
      lockfileWithMssqlAt('backend/node_modules/mssql'),
      ['mssql'],
      'backend',
    );

    // Same packages reach the closure in both layouts (only their lockfile keys differ).
    const slots = (set: Set<string>) => [...set].map(installSlotFor).sort();
    expect(slots(hoisted)).toEqual(slots(unhoisted));
    // Both include mssql, its nested commander@11, and tedious.
    expect(slots(hoisted)).toEqual(['mssql', 'mssql/node_modules/commander', 'tedious']);
  });

  test('records unresolved optional dependency edges without throwing', () => {
    const pkgs = {
      backend: { name: 'node', dependencies: { mssql: '12.5.5' } },
      'node_modules/mssql': {
        name: 'mssql',
        version: '12.5.5',
        optionalDependencies: { 'platform-only-thing': '^1.0.0' },
      },
    };
    const unresolved: string[] = [];
    const closure = computeClosure(pkgs, ['mssql'], 'backend', unresolved);
    expect([...closure]).toEqual(['node_modules/mssql']);
    expect(unresolved).toEqual(['platform-only-thing (required by node_modules/mssql)']);
  });

  test('throws when a seed dependency is not in the lockfile', () => {
    const pkgs = { backend: { name: 'node', dependencies: {} } };
    expect(() => computeClosure(pkgs, ['mssql'], 'backend')).toThrow(
      /Seed dependency "mssql" not found/,
    );
  });
});

describe('installSlotFor', () => {
  test('maps a root package to a top-level slot', () => {
    expect(installSlotFor('node_modules/mssql')).toBe('mssql');
  });

  test('preserves nesting under a package', () => {
    expect(installSlotFor('node_modules/mssql/node_modules/commander')).toBe(
      'mssql/node_modules/commander',
    );
  });

  test('flattens a workspace-prefixed package to a top-level slot', () => {
    expect(installSlotFor('backend/node_modules/mssql')).toBe('mssql');
  });

  test('flattens a workspace-prefixed nested package while keeping its nesting', () => {
    expect(installSlotFor('backend/node_modules/mssql/node_modules/commander')).toBe(
      'mssql/node_modules/commander',
    );
  });
});
