import { describe, test, expect } from 'vitest';
import {
  SAFE_THRESHOLD_MS,
  DEFAULT_FETCH_SIZE,
  WRITE_BATCH_SIZE,
} from './migrate-case-appointments-constants';

describe('migrate-case-appointments constants', () => {
  test('SAFE_THRESHOLD_MS equals 56 minutes (4-minute buffer before 60-min timeout)', () => {
    expect(SAFE_THRESHOLD_MS).toBe(3_360_000);
  });

  test('DEFAULT_FETCH_SIZE equals 2,500 rows per ACMS fetch', () => {
    expect(DEFAULT_FETCH_SIZE).toBe(2500);
  });

  test('WRITE_BATCH_SIZE equals 100 records per write queue message', () => {
    expect(WRITE_BATCH_SIZE).toBe(100);
  });

  test('WRITE_BATCH_SIZE fits within 64KB queue message limit with denormalized fields', () => {
    const QUEUE_LIMIT_BASE64_BYTES = 64 * 1024;
    const bytesPerRecord = 280;
    const base64Size = Math.ceil((WRITE_BATCH_SIZE * bytesPerRecord * 4) / 3);
    expect(base64Size).toBeLessThanOrEqual(QUEUE_LIMIT_BASE64_BYTES);
  });
});
