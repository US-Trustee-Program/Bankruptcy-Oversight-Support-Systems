import {
  DivisionMoveHistoryEntry,
  OfficeSetupRow,
  PrototypeDivision,
  officeKey,
} from './office-division-setup-data';

export type DivisionChange = {
  division: PrototypeDivision;
  previousOffice: OfficeSetupRow | null;
  newOffice: OfficeSetupRow | null;
};

function isAssignedTo(division: PrototypeDivision, office: OfficeSetupRow) {
  return !!division.office && officeKey(division.office) === officeKey(office);
}

/**
 * Compares an office's current divisions with the codes selected for it. Divisions
 * added to the office move from wherever they were (another office or unassigned);
 * divisions removed from it become unassigned. A division never belongs to two offices.
 */
export function planDivisionChanges(
  divisions: PrototypeDivision[],
  office: OfficeSetupRow,
  selectedCodes: string[],
): DivisionChange[] {
  const selected = new Set(selectedCodes);
  return divisions.flatMap((division): DivisionChange[] => {
    const assignedHere = isAssignedTo(division, office);
    if (selected.has(division.code) && !assignedHere) {
      return [{ division, previousOffice: division.office, newOffice: office }];
    }
    if (!selected.has(division.code) && assignedHere) {
      return [{ division, previousOffice: office, newOffice: null }];
    }
    return [];
  });
}

export function applyDivisionChanges(
  divisions: PrototypeDivision[],
  changes: DivisionChange[],
): PrototypeDivision[] {
  const newOfficeByCode = new Map(changes.map((change) => [change.division.code, change]));
  return divisions.map((division) => {
    const change = newOfficeByCode.get(division.code);
    return change ? { ...division, office: change.newOffice } : division;
  });
}

export function toHistoryEntries(
  changes: DivisionChange[],
  changedBy: string,
  changedOn: string,
): DivisionMoveHistoryEntry[] {
  return changes.map((change) => ({
    id: `history-${changedOn}-${change.division.code}`,
    divisionName: change.division.divisionName,
    courtName: change.division.courtName,
    previousOffice: change.previousOffice,
    newOffice: change.newOffice,
    changedBy,
    changedOn,
  }));
}
