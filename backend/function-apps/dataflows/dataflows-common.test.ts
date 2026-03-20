import { vi } from 'vitest';
import { HttpRequest, InvocationContext, StorageQueueOutput, Timer } from '@azure/functions';
import {
  buildHttpTrigger,
  buildStartQueueHttpTrigger,
  buildStartQueueTimerTrigger,
  buildContainerName,
  ensureContainersExist,
  isAuthorized,
} from './dataflows-common';

describe('Dataflows Common', () => {
  const RIGHT = 'this-is-a-key';
  const WRONG = 'this-is-a-bad-key';

  const { env } = process;
  beforeEach(() => {
    process.env = {
      ADMIN_KEY: RIGHT,
    };
  });

  afterEach(() => {
    process.env = env;
  });

  // Note: buildFunctionName and buildQueueName tests have been moved to
  // common/src/queues/queue-helpers.test.ts
  // Tests for these functions are now in the shared common package

  describe('buildContainerName', () => {
    test('should convert module name with hyphens to lowercase container name with direction suffix', () => {
      expect(buildContainerName('SYNC-OFFICE-STAFF', 'in')).toEqual('sync-office-staff-in');
      expect(buildContainerName('SYNC-OFFICE-STAFF', 'out')).toEqual('sync-office-staff-out');
    });

    test('should convert module name with underscores to lowercase container name with hyphens', () => {
      expect(buildContainerName('MIGRATE_CASE_HISTORY', 'in')).toEqual('migrate-case-history-in');
      expect(buildContainerName('MIGRATE_CASE_HISTORY', 'out')).toEqual('migrate-case-history-out');
    });

    test('should handle mixed case with underscores and hyphens', () => {
      expect(buildContainerName('PROCESS_LARGE-FILE', 'in')).toEqual('process-large-file-in');
    });

    test('should normalize spaces to hyphens', () => {
      expect(buildContainerName('SYNC OFFICE STAFF', 'in')).toEqual('sync-office-staff-in');
    });

    test('should normalize dots to hyphens', () => {
      expect(buildContainerName('MODULE.SUB.NAME', 'out')).toEqual('module-sub-name-out');
    });

    test('should normalize multiple consecutive invalid characters to single hyphen', () => {
      expect(buildContainerName('MODULE___SUB...NAME', 'in')).toEqual('module-sub-name-in');
    });

    test('should remove leading and trailing invalid characters', () => {
      expect(buildContainerName('_MODULE_NAME_', 'out')).toEqual('module-name-out');
      expect(buildContainerName('...MODULE...', 'in')).toEqual('module-in');
    });

    test('should handle module names with mixed punctuation', () => {
      expect(buildContainerName('SYNC_OFFICE-STAFF.V2', 'in')).toEqual('sync-office-staff-v2-in');
    });

    test('should produce valid 3-character minimum container names', () => {
      expect(buildContainerName('A', 'in')).toEqual('a-in'); // 4 chars, valid
      expect(buildContainerName('AB', 'in')).toEqual('ab-in'); // 5 chars, valid
    });

    test('should throw error for invalid container names that are too short', () => {
      // Empty module name would create container name that's too short after normalization
      expect(() => buildContainerName('', 'in')).toThrow(
        /Invalid Azure container name.*Container names must be 3–63 characters/,
      );
    });

    test('should throw error for module names with only invalid characters', () => {
      expect(() => buildContainerName('___', 'in')).toThrow(
        /Invalid Azure container name.*Container names must be 3–63 characters/,
      );
      expect(() => buildContainerName('...', 'out')).toThrow(
        /Invalid Azure container name.*Container names must be 3–63 characters/,
      );
    });

    test('should throw error for container names exceeding 63 characters', () => {
      // Create a module name that would result in >63 char container name
      const longModuleName = 'A'.repeat(62); // 62 + '-' + 2|3 for direction = 65|66 chars
      expect(() => buildContainerName(longModuleName, 'in')).toThrow(
        /Invalid Azure container name.*Container names must be 3–63 characters/,
      );
    });

    test('should accept container names at exactly 63 characters', () => {
      // 60 chars + '-' + 'in' (2 chars) = 63 chars (max allowed)
      const moduleName = 'A'.repeat(60);
      const result = buildContainerName(moduleName, 'in');
      expect(result.length).toEqual(63);
      expect(result).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
    });

    test('should handle numeric module names', () => {
      expect(buildContainerName('12345', 'in')).toEqual('12345-in');
      expect(buildContainerName('V2', 'out')).toEqual('v2-out');
    });
  });

  describe('isAuthorized', () => {
    test('should return true', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', `ApiKey ${RIGHT}`]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeTruthy();
    });

    test('should return false when authorization header is missing', async () => {
      const request = {
        headers: new Map<string, string>(),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });

    test('should return false when authorization header scheme is missing', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', RIGHT]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });

    test('should return false when authorization header scheme is incorrect', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', `Bearer ${RIGHT}`]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });

    test('should return false when api key does not match', async () => {
      const request = {
        headers: new Map<string, string>([['Authorization', `ApiKey ${WRONG}`]]),
      } as unknown as HttpRequest;
      expect(isAuthorized(request)).toBeFalsy();
    });
  });

  describe('buildHttpTrigger', () => {
    test('should return a http trigger that executes the function passed to the build function', async () => {
      const invocationContext = {
        log: vi.fn(),
      } as unknown as InvocationContext;

      const fnArgumentSpy = vi.fn();
      const trigger = buildHttpTrigger('TEST', fnArgumentSpy);

      const goodRequest = {
        headers: new Map<string, string>([['Authorization', `ApiKey ${process.env.ADMIN_KEY}`]]),
      } as unknown as HttpRequest;
      await trigger(goodRequest, invocationContext);
      expect(fnArgumentSpy).toHaveBeenCalledWith(invocationContext, goodRequest);

      fnArgumentSpy.mockClear();
      const badRequest = {
        headers: new Map<string, string>(),
      } as unknown as HttpRequest;
      await trigger(badRequest, invocationContext);
      expect(fnArgumentSpy).not.toHaveBeenCalled();
    });
  });

  describe('buildStartQueueTimerTrigger', () => {
    test('should return a timer trigger that puts a message on a given start queue', async () => {
      const setSpy = vi.fn();
      const invocationContext = {
        extraOutputs: {
          set: setSpy,
        },
      } as unknown as InvocationContext;

      const storageQueue = {} as unknown as StorageQueueOutput;
      const trigger = buildStartQueueTimerTrigger('TEST', storageQueue);

      const timer = {} as unknown as Timer;
      await trigger(timer, invocationContext);

      expect(setSpy).toHaveBeenCalledWith(storageQueue, {});
    });
  });

  describe('buildStartQueueHttpTrigger', () => {
    test('should return a http trigger that puts a message on a given start queue', async () => {
      const setSpy = vi.fn();
      const invocationContext = {
        log: vi.fn(),
        extraOutputs: {
          set: setSpy,
        },
      } as unknown as InvocationContext;

      const storageQueue = {} as unknown as StorageQueueOutput;
      const trigger = buildStartQueueHttpTrigger('TEST', storageQueue);

      const goodRequest = {
        headers: new Map<string, string>([['Authorization', `ApiKey ${process.env.ADMIN_KEY}`]]),
      } as unknown as HttpRequest;
      await trigger(goodRequest, invocationContext);
      expect(setSpy).toHaveBeenCalledWith(storageQueue, {});
    });
  });

  describe('ensureContainersExist', () => {
    test('should return immediately for empty container list', () => {
      // Should not throw
      ensureContainersExist([], 'TEST');
      expect(true).toBeTruthy();
    });

    test('should return immediately for undefined container list', () => {
      // Should not throw
      ensureContainersExist(undefined as unknown as string[], 'TEST');
      expect(true).toBeTruthy();
    });

    test('should schedule async container creation for valid container names', () => {
      // Function should return immediately without throwing
      // The async work happens in background via fire-and-forget IIFE
      expect(() => {
        ensureContainersExist(['test-container-in', 'test-container-out'], 'TEST');
      }).not.toThrow();
    });

    test('should handle single container name', () => {
      // Function should return immediately without throwing
      expect(() => {
        ensureContainersExist(['single-container'], 'TEST');
      }).not.toThrow();
    });
  });
});
