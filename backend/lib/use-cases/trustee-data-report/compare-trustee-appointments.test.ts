import { describe, expect, test } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { DivisionInfo } from '../dataflows/migrate-trustees';
import { compareTrusteeAppointments } from './compare-trustee-appointments';

const COURT_ID = '0752';
const COURT_NAME = 'Southern District of Ohio';

function division(divisionCode: string, courtId = COURT_ID): DivisionInfo {
  return { divisionCode, courtId, courtName: COURT_NAME, courtDivisionName: divisionCode };
}

const DIVISIONS = new Map<string, DivisionInfo[]>([
  [COURT_ID, [division('081'), division('082'), division('083')]],
]);

function todAppointment(override: Partial<TrusteeAppointmentInput> = {}): TrusteeAppointmentInput {
  return {
    chapter: '7',
    appointmentType: 'panel',
    courtId: COURT_ID,
    courtName: COURT_NAME,
    // Differs from the district's divisions on purpose: divisions are never compared with TOD.
    divisionCodes: ['082'],
    appointedDate: '2015-03-01',
    status: 'active',
    effectiveDate: '2015-03-01',
    ...override,
  };
}

const trustee = MockData.getTrustee({ name: 'Pat Example', legacy: { truIds: ['101'] } });

/** A CAMS appointment as the migration would have created it from the given TOD appointment. */
function camsAppointment(
  from: TrusteeAppointmentInput,
  override: Partial<TrusteeAppointment> = {},
): TrusteeAppointment {
  return MockData.getTrusteeAppointment({
    ...from,
    trusteeId: trustee.trusteeId,
    divisionCodes: ['081', '082', '083'],
    ...override,
  });
}

const tod = (appointments: TrusteeAppointmentInput[], todId = '101') =>
  new Map([[todId, appointments]]);

const identity = (appointment: TrusteeAppointmentInput) => ({
  courtId: appointment.courtId,
  courtName: appointment.courtName,
  chapter: appointment.chapter,
  appointmentType: appointment.appointmentType,
});

describe('compareTrusteeAppointments', () => {
  test('should report nothing when CAMS has exactly the appointments the load would create', () => {
    const appointment = todAppointment();
    expect(
      compareTrusteeAppointments(
        trustee,
        [camsAppointment(appointment)],
        tod([appointment]),
        DIVISIONS,
      ),
    ).toEqual([]);
  });

  test('should list a TOD appointment with no CAMS appointment of the same district, chapter and type as in TOD only', () => {
    const appointment = todAppointment();
    expect(compareTrusteeAppointments(trustee, [], tod([appointment]), DIVISIONS)).toEqual([
      {
        kind: 'appointment-tod-only',
        camsTrusteeId: trustee.trusteeId,
        todIds: ['101'],
        trusteeName: 'Pat Example',
        appointment: identity(appointment),
      },
    ]);
  });

  test('should list a CAMS appointment with no TOD appointment of the same district, chapter and type as in CAMS only', () => {
    const appointment = camsAppointment(
      todAppointment({ chapter: '13', appointmentType: 'standing' }),
    );
    expect(compareTrusteeAppointments(trustee, [appointment], tod([]), DIVISIONS)).toEqual([
      {
        kind: 'appointment-cams-only',
        camsTrusteeId: trustee.trusteeId,
        todIds: ['101'],
        trusteeName: 'Pat Example',
        appointment: identity(appointment),
      },
    ]);
  });

  test.each([
    ['district', { courtId: '0753' }],
    ['chapter', { chapter: '11' }],
    ['appointment type', { appointmentType: 'off-panel' }],
  ] as const)(
    'should report a changed %s as one appointment in TOD only and one in CAMS only',
    (_, change) => {
      const appointment = todAppointment();
      const changed = camsAppointment(appointment, change);

      const rows = compareTrusteeAppointments(
        trustee,
        [changed],
        tod([appointment]),
        DIVISIONS,
      ).map((difference) => [difference.kind, difference.appointment]);

      expect(rows).toEqual([
        ['appointment-tod-only', identity(appointment)],
        ['appointment-cams-only', identity(changed)],
      ]);
    },
  );

  test.each([
    ['status', { status: 'voluntarily-suspended' }, 'voluntarily-suspended', 'active'],
    ['appointedDate', { appointedDate: '2016-04-02' }, '2016-04-02', '2015-03-01'],
    ['effectiveDate', { effectiveDate: '2020-01-15' }, '2020-01-15', '2015-03-01'],
  ] as const)('should report a %s that differs', (field, camsOverride, camsValue, todValue) => {
    const appointment = todAppointment();
    expect(
      compareTrusteeAppointments(
        trustee,
        [camsAppointment(appointment, camsOverride)],
        tod([appointment]),
        DIVISIONS,
      ),
    ).toEqual([
      {
        kind: 'appointment-field',
        camsTrusteeId: trustee.trusteeId,
        todIds: ['101'],
        trusteeName: 'Pat Example',
        appointment: identity(appointment),
        field,
        camsValue,
        todValue,
      },
    ]);
  });

  test('should compare dates as calendar dates and ignore any time part', () => {
    const appointment = todAppointment();
    const cams = camsAppointment(appointment, {
      appointedDate: '2015-03-01T00:00:00.000Z',
      effectiveDate: '2015-03-01T14:30:00.000Z',
    });
    expect(compareTrusteeAppointments(trustee, [cams], tod([appointment]), DIVISIONS)).toEqual([]);
  });

  test('should report differing dates as calendar dates', () => {
    const appointment = todAppointment({ appointedDate: '2015-03-01T00:00:00.000Z' });
    const cams = camsAppointment(appointment, { appointedDate: '2016-04-02T14:30:00.000Z' });

    const [row] = compareTrusteeAppointments(trustee, [cams], tod([appointment]), DIVISIONS);

    expect(row).toEqual(
      expect.objectContaining({ camsValue: '2016-04-02', todValue: '2015-03-01' }),
    );
  });

  test('should not compare divisions with TOD', () => {
    const appointment = todAppointment({ divisionCodes: ['083'] });
    const cams = camsAppointment(appointment, { divisionCodes: ['081', '082', '083'] });
    expect(compareTrusteeAppointments(trustee, [cams], tod([appointment]), DIVISIONS)).toEqual([]);
  });

  test('should note a CAMS appointment covering only some of its district divisions, without a field difference', () => {
    const appointment = todAppointment();
    const narrowed = camsAppointment(appointment, { divisionCodes: ['081', '083'] });

    expect(compareTrusteeAppointments(trustee, [narrowed], tod([appointment]), DIVISIONS)).toEqual([
      {
        kind: 'appointment-divisions-narrowed',
        camsTrusteeId: trustee.trusteeId,
        todIds: ['101'],
        trusteeName: 'Pat Example',
        appointment: identity(appointment),
        camsValue: '081, 083',
        todValue: '081, 082, 083',
      },
    ]);
  });

  test('should not note divisions when the CAMS appointment covers every district division in any order', () => {
    const appointment = todAppointment();
    const full = camsAppointment(appointment, { divisionCodes: ['083', '081', '082'] });
    expect(compareTrusteeAppointments(trustee, [full], tod([appointment]), DIVISIONS)).toEqual([]);
  });

  test.each<[string, Partial<TrusteeAppointment>]>([
    ['a division outside the district', { divisionCodes: ['081', '099'] }],
    ['no divisions', { divisionCodes: [] }],
    ['a district with no known divisions', { courtId: '0999' }],
  ])('should not note divisions for a CAMS appointment with %s', (_, override) => {
    const appointment = todAppointment(override);
    const cams = camsAppointment(appointment, override);
    expect(compareTrusteeAppointments(trustee, [cams], tod([appointment]), DIVISIONS)).toEqual([]);
  });

  test('should note narrowed divisions on an older CAMS appointment that has only a single division code', () => {
    const appointment = todAppointment();
    const legacy = camsAppointment(appointment, { divisionCodes: undefined, divisionCode: '082' });

    const [row] = compareTrusteeAppointments(trustee, [legacy], tod([appointment]), DIVISIONS);

    expect(row).toEqual(
      expect.objectContaining({ kind: 'appointment-divisions-narrowed', camsValue: '082' }),
    );
  });

  test('should note divisions only on appointments that exist in both systems', () => {
    const camsOnly = camsAppointment(todAppointment(), { divisionCodes: ['081'] });
    expect(
      compareTrusteeAppointments(trustee, [camsOnly], tod([]), DIVISIONS).map((row) => row.kind),
    ).toEqual(['appointment-cams-only']);
  });

  test('should report every field difference and the divisions note for one appointment', () => {
    const appointment = todAppointment();
    const cams = camsAppointment(appointment, {
      status: 'voluntarily-suspended',
      effectiveDate: '2021-06-01',
      divisionCodes: ['081'],
    });

    const rows = compareTrusteeAppointments(trustee, [cams], tod([appointment]), DIVISIONS).map(
      (row) => [row.kind, row.field],
    );

    expect(rows).toEqual([
      ['appointment-field', 'status'],
      ['appointment-field', 'effectiveDate'],
      ['appointment-divisions-narrowed', undefined],
    ]);
  });

  test('should keep the first of two TOD appointments with the same key on one TOD record', () => {
    const first = todAppointment({ status: 'active', appointedDate: '2019-01-01' });
    const sameKeyLater = todAppointment({ status: 'resigned', appointedDate: '2010-01-01' });
    expect(
      compareTrusteeAppointments(
        trustee,
        [camsAppointment(first)],
        tod([first, sameKeyLater]),
        DIVISIONS,
      ),
    ).toEqual([]);
  });

  test('should compare a merged trustee with the appointments of every linked TOD record, keeping the first by key in linked TOD ID order', () => {
    const merged = MockData.getTrustee({ name: 'Pat Example', legacy: { truIds: ['202', '101'] } });
    const fromFirstId = todAppointment({ status: 'active', appointedDate: '2019-01-01' });
    const duplicateFromSecondId = todAppointment({
      status: 'resigned',
      appointedDate: '2010-01-01',
    });
    const onlyOnSecondId = todAppointment({ chapter: '13', appointmentType: 'standing' });
    const linked = new Map([
      ['202', [fromFirstId]],
      ['101', [duplicateFromSecondId, onlyOnSecondId]],
    ]);
    const cams = [
      camsAppointment(fromFirstId, { trusteeId: merged.trusteeId }),
      camsAppointment(onlyOnSecondId, { trusteeId: merged.trusteeId }),
    ];

    expect(compareTrusteeAppointments(merged, cams, linked, DIVISIONS)).toEqual([]);
  });

  test('should list every linked TOD ID on each row', () => {
    const merged = MockData.getTrustee({ name: 'Pat Example', legacy: { truIds: ['202', '101'] } });
    const linked = new Map([
      ['202', [todAppointment()]],
      ['101', []],
    ]);

    const [row] = compareTrusteeAppointments(merged, [], linked, DIVISIONS);

    expect(row.todIds).toEqual(['202', '101']);
  });
});
