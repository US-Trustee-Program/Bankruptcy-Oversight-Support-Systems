import { describe, test, expect } from 'vitest';
import { WRITE_BATCH_SIZE } from './migrate-case-appointments-constants';

describe('migrate-case-appointments constants', () => {
  test('WRITE_BATCH_SIZE fits within 64KB queue message limit with denormalized fields', () => {
    const QUEUE_LIMIT_BASE64_BYTES = 64 * 1024;
    const bytesPerRecord = 280;
    const base64Size = Math.ceil((WRITE_BATCH_SIZE * bytesPerRecord * 4) / 3);
    expect(base64Size).toBeLessThanOrEqual(QUEUE_LIMIT_BASE64_BYTES);
  });
});
