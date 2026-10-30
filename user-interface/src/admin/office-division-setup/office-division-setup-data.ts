import { MAPPED_DIVISIONS, MAPPED_OFFICES } from './office-division-mapping-data';

export type OfficeSetupRow = {
  regionId: string;
  officeName: string;
};

export function officeKey(office: OfficeSetupRow) {
  return `${office.regionId}-${office.officeName.replace(/\W+/g, '-')}`;
}

export function formatOffice(office: OfficeSetupRow | null) {
  return office ? `${office.officeName} (Region ${office.regionId})` : '(unassigned)';
}

export const PROTOTYPE_OFFICES: OfficeSetupRow[] = MAPPED_OFFICES;

export type PrototypeDivision = {
  code: string;
  courtName: string;
  divisionName: string;
  office: OfficeSetupRow | null;
};

export function formatDivision(division: PrototypeDivision) {
  return `${division.courtName} (${division.divisionName})`;
}

export const PROTOTYPE_DIVISIONS: PrototypeDivision[] = MAPPED_DIVISIONS;

export type DivisionMoveHistoryEntry = {
  id: string;
  divisionName: string;
  courtName: string;
  previousOffice: OfficeSetupRow | null;
  newOffice: OfficeSetupRow | null;
  changedBy: string;
  changedOn: string;
};

// The new system starts with no moves recorded.
export const PROTOTYPE_CHANGE_HISTORY: DivisionMoveHistoryEntry[] = [];
