import { describe, expect, test } from 'vitest';
import { resolveRun } from './resolve-run.js';

const ENV = {
  GITHUB_RUN_ID: '43955771750',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_REPOSITORY: 'US-Trustee-Program/Bankruptcy-Oversight-Support-Systems',
};

describe('resolveRun', () => {
  test('links to the Actions run when all three variables are set', () => {
    expect(resolveRun(ENV)).toEqual({
      id: '43955771750',
      url: 'https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/actions/runs/43955771750',
    });
  });

  test.each(Object.keys(ENV))('returns undefined when %s is missing', (name) => {
    const env: Record<string, string> = { ...ENV };
    delete env[name];

    expect(resolveRun(env)).toBeUndefined();
  });

  test.each(Object.keys(ENV))('returns undefined when %s is empty', (name) => {
    expect(resolveRun({ ...ENV, [name]: '' })).toBeUndefined();
  });
});
