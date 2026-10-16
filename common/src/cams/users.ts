import { UstpOfficeDetails } from './offices';
import { CamsRoleType } from './roles';

export type CamsUserReference = {
  id: string;
  name: string;
  email?: string;
};

export type Staff = CamsUserReference & {
  roles?: CamsRoleType[];
};

export type CamsUser = CamsUserReference & {
  offices?: UstpOfficeDetails[];
  roles?: CamsRoleType[];
};

export type AttorneyUser = CamsUser & {
  caseLoad?: number;
};

export type CamsUserGroup = {
  id: string;
  name: string;
  users?: CamsUser[];
};

export type PrivilegedIdentityUser = CamsUserReference & {
  documentType: 'PRIVILEGED_IDENTITY_USER';
  claims: {
    groups: string[];
  };
  expires: string;
};

export type UserGroup = {
  id: string;
  groupName: string;
  users: CamsUserReference[];
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

// Region ids are unpadded ('1'..'21') to match the offices use case. Case-level DXTR data and some
// office records carry padded ids ('04'), so normalize before comparing or sending to LaunchDarkly.
export function normalizeRegionId(regionId: string): string {
  const parsed = parseInt(regionId, 10);
  return Number.isNaN(parsed) ? regionId : parsed.toString();
}

export function getRegionIds(user: CamsUser): string[] {
  if (!user.offices) return [];
  return [...new Set(user.offices.map((office) => normalizeRegionId(office.regionId)))];
}
