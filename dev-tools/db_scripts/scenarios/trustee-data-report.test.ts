import { describe, test, expect } from 'vitest';
import type { SeedOperation } from '../../runner.js';
import { generate, MISSING_TOD_ID, todId } from './trustee-data-report.js';
import { TOD_SEED_ID_MAX, TOD_SEED_ID_MIN } from '../lib/tod-seed-ids.js';

type Row = Record<string, unknown>;
type CamsTrustee = { id: string; trusteeId: string; legacy: { truIds: string[] } };
type CamsAppointment = {
  id: string;
  trusteeId: string;
  chapter: string;
  appointmentType: string;
  courtId: string;
  divisionCodes: string[];
  status: string;
  appointedDate: string;
  effectiveDate: string;
};

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

  test('should give every TOD trustee at least one appointment row, and no trustee two rows for a chapter', async () => {
    const ops = await generate();
    const trusteeIds = rowsOf(ops, 'TRUSTEES').map((row) => row.ID);
    const rows = rowsOf(ops, 'CHAPTER_DETAILS');

    expect(new Set(rows.map((row) => row.TRU_ID))).toEqual(new Set(trusteeIds));
    expect(new Set(rows.map((row) => `${row.TRU_ID}-${row.CHAPTER}`)).size).toBe(rows.length);
  });

  test('should give each linked trustee the appointments for one Slice 2 case', async () => {
    const ops = await generate();
    const appointments = rowsOf(ops, 'trustee-appointments') as CamsAppointment[];
    const byTrustee = (slug: string) =>
      appointments
        .filter((a) => a.trusteeId === `seed-trustee-data-report-${slug}`)
        .map(({ chapter, appointmentType, status, appointedDate, effectiveDate, divisionCodes }) =>
          [chapter, appointmentType, status, appointedDate, effectiveDate, divisionCodes].join(' '),
        );
    const todRows = (harnessId: number) =>
      rowsOf(ops, 'CHAPTER_DETAILS')
        .filter((row) => row.TRU_ID === todId(harnessId))
        .map((row) => [row.CHAPTER, row.STATUS, row.DISTRICT, row.SERVING_STATE].join(' '));
    const full = '081,084,087';

    expect(todRows(10)).toEqual(['7 PA Southern New York', '13 S Southern New York']);
    expect(byTrustee('exact-match')).toEqual([
      `7 panel active 2015-03-01 2015-03-01 ${full}`,
      '13 standing active 2015-03-01 2015-03-01 081',
    ]);
    expect(todRows(21)).toEqual(['7 PA Southern New York', '13 S Southern New York']);
    expect(byTrustee('name')).toEqual([`7 panel active 2015-03-01 2015-03-01 ${full}`]);
    expect(todRows(22)).toEqual(['7 PA Nowhere Atlantis']);
    expect(byTrustee('company')).toEqual([`13 standing active 2015-03-01 2015-03-01 ${full}`]);
    expect(byTrustee('public-address')).toEqual([
      `7 off-panel resigned 2015-03-01 2015-03-01 ${full}`,
    ]);
    expect(byTrustee('internal-address')).toEqual([
      `7 panel voluntarily-suspended 2015-03-01 2015-03-01 ${full}`,
    ]);
    expect(byTrustee('phone')).toEqual([`7 panel active 2016-04-02 2015-03-01 ${full}`]);
    expect(byTrustee('email')).toEqual([`7 panel active 2015-03-01 2020-01-15 ${full}`]);
    [23, 24, 25, 26].forEach((id) => expect(todRows(id)).toEqual(['7 PA Southern New York']));
  });

  test('should use seed- ids for CAMS appointments, in Southern New York, on seeded trustees only', async () => {
    const ops = await generate();
    const trusteeIds = new Set((rowsOf(ops, 'trustees') as CamsTrustee[]).map((t) => t.trusteeId));
    const appointments = rowsOf(ops, 'trustee-appointments') as CamsAppointment[];

    expect(appointments.length).toBeGreaterThan(0);
    appointments.forEach((appointment) => {
      expect(appointment.id).toMatch(/^seed-/);
      expect(trusteeIds.has(appointment.trusteeId)).toBe(true);
      expect(appointment.courtId).toBe('0208');
    });
    expect(new Set(appointments.map((a) => a.id)).size).toBe(appointments.length);
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
      ['cams', 'trustee-appointments', undefined],
    ]);
  });
});
