import {
  applyDivisionChanges,
  planDivisionChanges,
  toHistoryEntries,
} from './office-division-assignments';
import { PrototypeDivision } from './office-division-setup-data';

const ALBANY = { regionId: '2', officeName: 'Albany' };
const MANHATTAN = { regionId: '2', officeName: 'Manhattan' };

const DIVISIONS: PrototypeDivision[] = [
  { code: '061', courtName: 'N.D.N.Y.', divisionName: 'Albany', office: ALBANY },
  { code: '065', courtName: 'N.D.N.Y.', divisionName: 'Syracuse', office: ALBANY },
  { code: '081', courtName: 'S.D.N.Y.', divisionName: 'Manhattan', office: MANHATTAN },
  { code: '616', courtName: 'W.D. Ark.', divisionName: 'Hot Springs', office: null },
];

describe('planDivisionChanges', () => {
  test('should return no changes when the selection matches the current divisions', () => {
    expect(planDivisionChanges(DIVISIONS, ALBANY, ['061', '065'])).toEqual([]);
  });

  test('should move a division from another office', () => {
    const changes = planDivisionChanges(DIVISIONS, ALBANY, ['061', '065', '081']);

    expect(changes).toEqual([
      { division: DIVISIONS[2], previousOffice: MANHATTAN, newOffice: ALBANY },
    ]);
  });

  test('should assign an unassigned division', () => {
    const changes = planDivisionChanges(DIVISIONS, ALBANY, ['061', '065', '616']);

    expect(changes).toEqual([{ division: DIVISIONS[3], previousOffice: null, newOffice: ALBANY }]);
  });

  test('should make a removed division unassigned', () => {
    const changes = planDivisionChanges(DIVISIONS, ALBANY, ['061']);

    expect(changes).toEqual([{ division: DIVISIONS[1], previousOffice: ALBANY, newOffice: null }]);
  });
});

describe('applyDivisionChanges', () => {
  test('should give each changed division its new office and leave the rest alone', () => {
    const changes = planDivisionChanges(DIVISIONS, ALBANY, ['061', '081']);

    const updated = applyDivisionChanges(DIVISIONS, changes);

    expect(updated.map((d) => d.office)).toEqual([ALBANY, null, ALBANY, null]);
  });
});

describe('toHistoryEntries', () => {
  test('should record one entry per changed division with who and when', () => {
    const changes = planDivisionChanges(DIVISIONS, ALBANY, ['061', '081']);

    const entries = toHistoryEntries(changes, 'Pat Lee', '2026-10-29T12:00:00.000Z');

    expect(entries).toEqual([
      expect.objectContaining({
        divisionName: 'Syracuse',
        previousOffice: ALBANY,
        newOffice: null,
        changedBy: 'Pat Lee',
        changedOn: '2026-10-29T12:00:00.000Z',
      }),
      expect.objectContaining({
        divisionName: 'Manhattan',
        previousOffice: MANHATTAN,
        newOffice: ALBANY,
      }),
    ]);
  });
});
