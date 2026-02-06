import { describe, test, expect } from 'vitest';
import QueueSyncCasesPage from './queue-sync-cases-page';

describe('QueueSyncCasesPage', () => {
  test('should export MODULE_NAME', () => {
    expect(QueueSyncCasesPage.MODULE_NAME).toBe('QUEUE-SYNC-CASES-PAGE');
  });

  test('should export setup function', () => {
    expect(typeof QueueSyncCasesPage.setup).toBe('function');
  });
});
