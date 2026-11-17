import { afterEach, describe, expect, test, vi } from 'vitest';
import { getMigrationFilesContainerName } from './migration-files-container';

describe('getMigrationFilesContainerName', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should default to the migration-files container', () => {
    vi.stubEnv('CAMS_OBJECT_CONTAINER', undefined);

    expect(getMigrationFilesContainerName()).toEqual('migration-files');
  });

  test('should use the container named by CAMS_OBJECT_CONTAINER', () => {
    vi.stubEnv('CAMS_OBJECT_CONTAINER', 'custom-container');

    expect(getMigrationFilesContainerName()).toEqual('custom-container');
  });
});
