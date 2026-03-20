import { vi } from 'vitest';
import { HttpRequest, InvocationContext, StorageQueueOutput, Timer } from '@azure/functions';
import {
  buildHttpTrigger,
  buildStartQueueHttpTrigger,
  buildStartQueueTimerTrigger,
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
});
