import { describe, test, expect } from 'vitest';
import { buildFunctionName, buildQueueName } from './queue-helpers';

describe('buildFunctionName', () => {
  test('should return empty string for no arguments', () => {
    expect(buildFunctionName()).toEqual('');
  });

  test('should return single argument unchanged', () => {
    expect(buildFunctionName('ONE')).toEqual('ONE');
  });

  test('should join multiple arguments with hyphens', () => {
    expect(buildFunctionName('TWO', 'THREE')).toEqual('TWO-THREE');
  });

  test('should replace underscores with hyphens', () => {
    expect(buildFunctionName('SYNC_CASES')).toEqual('SYNC-CASES');
    expect(buildFunctionName('MIGRATE_TRUSTEES', 'page')).toEqual('MIGRATE-TRUSTEES-page');
  });

  test('should replace spaces with hyphens', () => {
    expect(buildFunctionName('SYNC CASES')).toEqual('SYNC-CASES');
  });

  test('should handle mixed separators', () => {
    expect(buildFunctionName('SYNC_CASES', 'start handler')).toEqual('SYNC-CASES-start-handler');
  });
});

describe('buildQueueName', () => {
  test('should return empty string for no arguments', () => {
    expect(buildQueueName()).toEqual('');
  });

  test('should return lowercase single argument', () => {
    expect(buildQueueName('ONE')).toEqual('one');
  });

  test('should join and lowercase multiple arguments', () => {
    expect(buildQueueName('TWO', 'THREE')).toEqual('two-three');
  });

  test('should replace underscores with hyphens and lowercase', () => {
    expect(buildQueueName('SYNC_CASES')).toEqual('sync-cases');
  });

  test('should create valid queue names from module names', () => {
    // Real examples from CAMS
    expect(buildQueueName('SYNC-CASES', 'start')).toEqual('sync-cases-start');
    expect(buildQueueName('SYNC-CASES', 'page')).toEqual('sync-cases-page');
    expect(buildQueueName('SYNC-CASES', 'dlq')).toEqual('sync-cases-dlq');
    expect(buildQueueName('MIGRATE-TRUSTEES', 'retry')).toEqual('migrate-trustees-retry');
    expect(buildQueueName('DOWNSTREAM-CHAPTER15-ASSIGNMENTS', 'event')).toEqual(
      'downstream-chapter15-assignments-event',
    );
  });

  test('should handle already lowercase inputs', () => {
    expect(buildQueueName('sync-cases', 'start')).toEqual('sync-cases-start');
  });

  test('should handle mixed case inputs', () => {
    expect(buildQueueName('Sync-Cases', 'Start')).toEqual('sync-cases-start');
  });
});
