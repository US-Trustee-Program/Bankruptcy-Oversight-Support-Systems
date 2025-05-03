import { UstpOfficeDetails } from './offices';
import { CamsRole } from './roles';

export type AttorneyUser = CamsUser & {
  caseLoad?: number;
};

export type CamsUser = CamsUserReference & {
  offices?: UstpOfficeDetails[];
  roles?: CamsRole[];
};

export type CamsUserGroup = {
  id: string;
  name: string;
  users?: CamsUser[];
};

export type CamsUserReference = {
  id: string;
  name: string;
};

export type PrivilegedIdentityUser = CamsUserReference & {
  claims: {
    groups: string[];
  };
  documentType: 'PRIVILEGED_IDENTITY_USER';
  expires: string;
};

export type Staff = CamsUserReference & {
  roles?: CamsRole[];
};

export function getCourtDivisionCodes(user: CamsUser): string[] {
  if (!user.offices) return [];
  const reducer = (divisionCodes: string[], office: UstpOfficeDetails) => {
    office.groups.forEach((group) => {
      group.divisions.forEach((division) => {
        divisionCodes.push(division.divisionCode);
      });
    });
    return divisionCodes;
  };
  return user.offices.reduce(reducer, []);
}

export function getGroupDesignators(user: CamsUser): string[] {
  if (!user.offices) return [];
  const reducer = (groupDesignators: string[], office: UstpOfficeDetails) => {
    office.groups.forEach((group) => {
      groupDesignators.push(group.groupDesignator);
    });
    return groupDesignators;
  };
  return user.offices.reduce(reducer, []);
}
