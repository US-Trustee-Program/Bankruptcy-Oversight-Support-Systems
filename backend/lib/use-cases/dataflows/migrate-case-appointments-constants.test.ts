import { describe, test, expect } from 'vitest';
import {
  SAFE_THRESHOLD_MS,
  DEFAULT_FETCH_SIZE,
  WRITE_BATCH_SIZE,
} from './migrate-case-appointments-constants';

describe('migrate-case-appointments constants', () => {
  test('SAFE_THRESHOLD_MS equals 56 minutes (4-minute buffer before 60-min timeout)', () => {
    expect(SAFE_THRESHOLD_MS).toBe(56 * 60 * 1000);
  });

  test('DEFAULT_FETCH_SIZE equals 2,500 rows per ACMS fetch', () => {
    expect(DEFAULT_FETCH_SIZE).toBe(2500);
  });

  test('WRITE_BATCH_SIZE equals 100 records per write queue message', () => {
    expect(WRITE_BATCH_SIZE).toBe(100);
  });

  test('WRITE_BATCH_SIZE fits within 64KB queue message limit with denormalized fields', () => {
    const bytesPerRecord = 280;
    const rawSize = WRITE_BATCH_SIZE * bytesPerRecord;
    const base64Size = Math.ceil((rawSize * 4) / 3);
    expect(rawSize).toBeLessThanOrEqual(28000);
    expect(base64Size).toBeLessThanOrEqual(37334);
  });
});
