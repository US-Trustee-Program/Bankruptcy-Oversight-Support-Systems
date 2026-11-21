import { describe, test, expect } from 'vitest';
import type { SeedOperation } from '../../runner.js';
import { generate, MISSING_TOD_ID } from './trustee-data-report.js';
import { TOD_SEED_ID_MAX, TOD_SEED_ID_MIN } from '../lib/tod-seed-ids.js';

type Row = Record<string, unknown>;
type CamsTrustee = { id: string; trusteeId: string; legacy: { truIds: string[] } };

function rowsOf(ops: SeedOperation[], table: string): Row[] {
  return ops.find((op) => op.collectionOrTable === table)?.data ?? [];
}

describe('trustee-data-report scenario', () => {
  test('should keep every TOD row inside the reserved seed ID range, so unseed removes it', async () => {
    const ops = await generate();
    const ids = [
      ...rowsOf(ops, 'TRUSTEES').map((row) => row.ID as number),
      ...rowsOf(ops, 'CHAPTER_DETAILS').map((row) => row.TRU_ID as number),
    ];

    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => {
      expect(id).toBeGreaterThanOrEqual(TOD_SEED_ID_MIN);
      expect(id).toBeLessThanOrEqual(TOD_SEED_ID_MAX);
    });
  });

  test('should give every TOD trustee one appointment row', async () => {
    const ops = await generate();
    const trusteeIds = rowsOf(ops, 'TRUSTEES').map((row) => row.ID);
    const appointmentIds = rowsOf(ops, 'CHAPTER_DETAILS').map((row) => row.TRU_ID);

    expect([...appointmentIds].sort()).toEqual([...trusteeIds].sort());
  });

  test('should link 7 CAMS trustees to TOD, leave 3 TOD trustees unlinked, and add 1 CAMS-only trustee', async () => {
    const ops = await generate();
    const todIds = new Set(rowsOf(ops, 'TRUSTEES').map((row) => String(row.ID)));
    const cams = rowsOf(ops, 'trustees') as CamsTrustee[];
    const linked = cams.filter((trustee) => trustee.legacy.truIds.some((id) => todIds.has(id)));
    const camsOnly = cams.filter((trustee) => !linked.includes(trustee));
    const linkedTodIds = new Set(linked.flatMap((trustee) => trustee.legacy.truIds));

    expect(linked).toHaveLength(7);
    expect([...todIds].filter((id) => !linkedTodIds.has(id))).toHaveLength(3);
    expect(camsOnly.map((trustee) => trustee.legacy.truIds)).toEqual([[String(MISSING_TOD_ID)]]);
  });

  test('should include unlinked TOD trustees that are active, active only on 12CBC, and with an empty status', async () => {
    const ops = await generate();
    const cams = rowsOf(ops, 'trustees') as CamsTrustee[];
    const linkedTodIds = new Set(cams.flatMap((trustee) => trustee.legacy.truIds));
    const unlinked = rowsOf(ops, 'CHAPTER_DETAILS').filter(
      (row) => !linkedTodIds.has(String(row.TRU_ID)),
    );

    expect(unlinked.map(({ CHAPTER, STATUS }) => ({ CHAPTER, STATUS }))).toEqual([
      { CHAPTER: '7', STATUS: 'PA' },
      { CHAPTER: '7', STATUS: '' },
      { CHAPTER: '12CBC', STATUS: '2' },
    ]);
  });

  test('should use seed- ids for CAMS trustees, so unseed removes them', async () => {
    const ops = await generate();
    const cams = rowsOf(ops, 'trustees') as CamsTrustee[];

    cams.forEach((trustee) => {
      expect(trustee.id).toMatch(/^seed-/);
      expect(trustee.trusteeId).toBe(trustee.id);
    });
  });

  test('should seed TOD before CAMS, with keys for the SQL upserts', async () => {
    const ops = await generate();

    expect(
      ops.map(({ db, collectionOrTable, primaryKey }) => [db, collectionOrTable, primaryKey]),
    ).toEqual([
      ['ats', 'TRUSTEES', 'ID'],
      ['ats', 'CHAPTER_DETAILS', ['TRU_ID', 'CHAPTER']],
      ['cams', 'trustees', undefined],
    ]);
  });
});
