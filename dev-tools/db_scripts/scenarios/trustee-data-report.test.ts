import { describe, test, expect } from 'vitest';
import type { SeedOperation } from '../../runner.js';
import { generate, MISSING_TOD_ID } from './trustee-data-report.js';
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

  describe('appointment cases', () => {
    // How the load translates the seed's TOD rows: Southern New York maps to 0208, whose
    // divisions are 081, 084 and 087; any other district cannot be translated.
    const LOAD: Record<string, { appointmentType: string; status: string }> = {
      '7 PA': { appointmentType: 'panel', status: 'active' },
      '7 PR': { appointmentType: 'panel', status: 'resigned' },
      '13 S': { appointmentType: 'standing', status: 'active' },
    };
    const SDNY_DIVISION_COUNT = 3;

    /** What the report finds for a seeded trustee, its linked TOD records read in the given order. */
    async function findings(slug: string, todOrder = (ids: string[]) => ids): Promise<string[]> {
      const ops = await generate();
      const trustee = (rowsOf(ops, 'trustees') as CamsTrustee[]).find(
        (t) => t.trusteeId === `seed-trustee-data-report-${slug}`,
      )!;
      const todRows = todOrder(trustee.legacy.truIds).flatMap((id) =>
        rowsOf(ops, 'CHAPTER_DETAILS').filter((row) => String(row.TRU_ID) === id),
      );
      const result: string[] = [];
      const expected = new Map<
        string,
        { status: string; appointed: unknown; effective: unknown }
      >();
      for (const row of todRows) {
        if (row.DISTRICT !== 'Southern' || row.SERVING_STATE !== 'New York') {
          result.push('not translated');
          continue;
        }
        const { appointmentType, status } = LOAD[`${row.CHAPTER} ${row.STATUS}`];
        const key = `${row.CHAPTER} ${appointmentType}`;
        if (!expected.has(key)) {
          expected.set(key, {
            status,
            appointed: row.APPOINTED_DATE,
            effective: row.STATUS_EFF_DATE,
          });
        }
      }
      const cams = (rowsOf(ops, 'trustee-appointments') as CamsAppointment[]).filter(
        (a) => a.trusteeId === trustee.trusteeId,
      );
      const camsKeys = new Set(cams.map((a) => `${a.chapter} ${a.appointmentType}`));
      expected.forEach((_, key) => {
        if (!camsKeys.has(key)) result.push(`tod-only ${key}`);
      });
      for (const appointment of cams) {
        const key = `${appointment.chapter} ${appointment.appointmentType}`;
        const tod = expected.get(key);
        if (!tod) {
          result.push(`cams-only ${key}`);
          continue;
        }
        if (appointment.status !== tod.status) result.push('status');
        if (appointment.appointedDate !== tod.appointed) result.push('appointedDate');
        if (appointment.effectiveDate !== tod.effective) result.push('effectiveDate');
        if (appointment.divisionCodes.length < SDNY_DIVISION_COUNT) result.push(`narrowed ${key}`);
      }
      return result;
    }

    test.each([
      ['exact-match', ['narrowed 13 standing']],
      ['name', ['tod-only 13 standing']],
      ['company', ['not translated', 'cams-only 13 standing']],
      ['public-address', ['tod-only 7 panel', 'cams-only 7 off-panel']],
      ['internal-address', ['status']],
      ['phone', ['appointedDate']],
      ['email', ['effectiveDate']],
      ['merged', []],
    ])('should give the %s trustee exactly the findings %j', async (slug, expected) => {
      expect(await findings(slug)).toEqual(expected);
    });

    test('should seed a merged trustee whose second TOD record would differ, so it shows that the first wins', async () => {
      expect(await findings('merged', (ids) => [...ids].reverse())).toEqual([
        'status',
        'appointedDate',
        'effectiveDate',
      ]);
    });

    test('should put CAMS appointments in Southern New York, on seeded trustees only', async () => {
      const ops = await generate();
      const trusteeIds = new Set(
        (rowsOf(ops, 'trustees') as CamsTrustee[]).map((t) => t.trusteeId),
      );
      const appointments = rowsOf(ops, 'trustee-appointments') as CamsAppointment[];

      expect(appointments.length).toBeGreaterThan(0);
      appointments.forEach((appointment) => {
        expect(trusteeIds.has(appointment.trusteeId)).toBe(true);
        expect(appointment.courtId).toBe('0208');
      });
    });
  });

  test('should link 8 CAMS trustees to TOD, leave 3 TOD trustees unlinked, and add 1 CAMS-only trustee', async () => {
    const ops = await generate();
    const todIds = new Set(rowsOf(ops, 'TRUSTEES').map((row) => String(row.ID)));
    const cams = rowsOf(ops, 'trustees') as CamsTrustee[];
    const linked = cams.filter((trustee) => trustee.legacy.truIds.some((id) => todIds.has(id)));
    const camsOnly = cams.filter((trustee) => !linked.includes(trustee));
    const linkedTodIds = new Set(linked.flatMap((trustee) => trustee.legacy.truIds));

    expect(linked).toHaveLength(8);
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

  test.each(['trustees', 'trustee-appointments'])(
    'should give every %s document a unique seed- id, so unseed removes it',
    async (collection) => {
      const docs = rowsOf(await generate(), collection) as { id: string }[];

      expect(docs.length).toBeGreaterThan(0);
      docs.forEach((doc) => expect(doc.id).toMatch(/^seed-/));
      expect(new Set(docs.map((doc) => doc.id)).size).toBe(docs.length);
    },
  );

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
