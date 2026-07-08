import { describe, test, expect } from 'vitest';
import {
  DEFAULT_FETCH_SIZE,
  MAX_FETCH_SIZE,
  WRITE_BATCH_SIZE,
} from './migrate-case-appointments-constants';

describe('migrate-case-appointments constants', () => {
  test('DEFAULT_FETCH_SIZE does not exceed MAX_FETCH_SIZE', () => {
    expect(DEFAULT_FETCH_SIZE).toBeLessThanOrEqual(MAX_FETCH_SIZE);
  });

  test('WRITE_BATCH_SIZE fits within 64KB queue message limit with denormalized fields', () => {
    const QUEUE_LIMIT_BASE64_BYTES = 64 * 1024;
    const bytesPerRecord = 280;
    const base64Size = Math.ceil((WRITE_BATCH_SIZE * bytesPerRecord * 4) / 3);
    expect(base64Size).toBeLessThanOrEqual(QUEUE_LIMIT_BASE64_BYTES);
  });
});
