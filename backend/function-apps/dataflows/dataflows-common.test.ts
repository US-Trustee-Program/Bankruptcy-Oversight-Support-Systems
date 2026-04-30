import { vi } from 'vitest';
import { HttpRequest, InvocationContext, StorageQueueOutput, Timer } from '@azure/functions';
import {
  buildFunctionName,
  buildHttpTrigger,
  buildQueueName,
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

  describe('buildFunctionName', () => {
    test('should return a function name according to our naming convention', () => {
      expect(buildFunctionName()).toEqual('');
      expect(buildFunctionName('ONE_FOO')).toEqual('ONE-FOO');
      expect(buildFunctionName('TWO', 'THREE_four')).toEqual('TWO-THREE-four');
    });
  });

  describe('buildQueueName', () => {
    test('should return a queue name conforming to StorageAccount queue name constraints', () => {
      expect(buildQueueName()).toEqual('');
      expect(buildQueueName('ONE')).toEqual('one');
      expect(buildQueueName('TWO', 'THREE')).toEqual('two-three');
    });
  });

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
      const setImmediateSpy = vi.spyOn(global, 'setImmediate');

      ensureContainersExist(['test-container-in', 'test-container-out'], 'TEST');

      expect(setImmediateSpy).toHaveBeenCalledTimes(1);
      setImmediateSpy.mockRestore();
    });

    test('should handle single container name', () => {
      const setImmediateSpy = vi.spyOn(global, 'setImmediate');

      ensureContainersExist(['single-container'], 'TEST');

      expect(setImmediateSpy).toHaveBeenCalledTimes(1);
      setImmediateSpy.mockRestore();
    });
  });
});
