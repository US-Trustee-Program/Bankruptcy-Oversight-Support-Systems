import { describe, it, expect } from 'vitest';
import { buildFunctionName, buildQueueName } from './queue-helpers';

describe('buildFunctionName', () => {
  it('should return empty string for no arguments', () => {
    expect(buildFunctionName()).toEqual('');
  });

  it('should return single argument unchanged', () => {
    expect(buildFunctionName('ONE')).toEqual('ONE');
  });

  it('should join multiple arguments with hyphens', () => {
    expect(buildFunctionName('TWO', 'THREE')).toEqual('TWO-THREE');
  });

  it('should replace underscores with hyphens', () => {
    expect(buildFunctionName('SYNC_CASES')).toEqual('SYNC-CASES');
    expect(buildFunctionName('MIGRATE_TRUSTEES', 'page')).toEqual('MIGRATE-TRUSTEES-page');
  });

  it('should replace spaces with hyphens', () => {
    expect(buildFunctionName('SYNC CASES')).toEqual('SYNC-CASES');
  });

  it('should handle mixed separators', () => {
    expect(buildFunctionName('SYNC_CASES', 'start handler')).toEqual('SYNC-CASES-start-handler');
  });
});

describe('buildQueueName', () => {
  it('should return empty string for no arguments', () => {
    expect(buildQueueName()).toEqual('');
  });

  it('should return lowercase single argument', () => {
    expect(buildQueueName('ONE')).toEqual('one');
  });

  it('should join and lowercase multiple arguments', () => {
    expect(buildQueueName('TWO', 'THREE')).toEqual('two-three');
  });

  it('should replace underscores with hyphens and lowercase', () => {
    expect(buildQueueName('SYNC_CASES')).toEqual('sync-cases');
  });

  it('should create valid queue names from module names', () => {
    // Real examples from CAMS
    expect(buildQueueName('SYNC-CASES', 'start')).toEqual('sync-cases-start');
    expect(buildQueueName('SYNC-CASES', 'page')).toEqual('sync-cases-page');
    expect(buildQueueName('SYNC-CASES', 'dlq')).toEqual('sync-cases-dlq');
    expect(buildQueueName('MIGRATE-TRUSTEES', 'retry')).toEqual('migrate-trustees-retry');
    expect(buildQueueName('DOWNSTREAM-CHAPTER15-ASSIGNMENTS', 'event')).toEqual(
      'downstream-chapter15-assignments-event',
    );
  });

  it('should handle already lowercase inputs', () => {
    expect(buildQueueName('sync-cases', 'start')).toEqual('sync-cases-start');
  });

  it('should handle mixed case inputs', () => {
    expect(buildQueueName('Sync-Cases', 'Start')).toEqual('sync-cases-start');
  });
});
