import { CamsRole } from '../../../../../common/src/cams/roles';
import { StorageGateway } from '../../types/storage';
import { UstpDivisionMeta } from '../../../../../common/src/cams/offices';
import { NotFoundError } from '../../../common-errors/not-found-error';

const MODULE_NAME = 'LOCAL-STORAGE-GATEWAY';

let roleMapping: Map<string, CamsRole>;
export const ROLE_MAPPING_PATH = '/rolemapping.csv';
const ROLE_MAPPING =
  'ad_group_name,idp_group_name,cams_role\n' +
  'USTP_CAMS_Super_User,USTP CAMS Super User,SuperUser\n' +
  'USTP_CAMS_Privileged_Identity_Management,USTP CAMS Privileged Identity Management,PrivilegedIdentityUser\n' +
  'USTP_CAMS_Case_Assignment_Manager,USTP CAMS Case Assignment Manager,CaseAssignmentManager\n' +
  'USTP_CAMS_Trial_Attorney,USTP CAMS Trial Attorney,TrialAttorney\n' +
  'USTP_CAMS_Data_Verifier,USTP CAMS Data Verifier,DataVerifier\n';

// TODO: We should delete this. How are we handling AD group from Seattle mapped to SE and AK groups??
// This mapping doesn't include Wilmington, DE which is not soft live. However, we see the office assigned in STG and PRD.
// Did we break the SE+AK mapping to Seattle? We no longer use this mapping table??
export const OFFICE_MAPPING_PATH = '/officemapping.csv';
const OFFICE_MAPPING =
  'ad_group_name,idp_group_name,group_designator\n' +
  'USTP_CAMS_Region_2_Office_Manhattan,USTP CAMS Region 2 Office Manhattan,NY\n' +
  'USTP_CAMS_Region_2_Office_Brooklyn,USTP CAMS Region 2 Office Brooklyn,BR\n' +
  'USTP_CAMS_Region_2_Office_Central_Islip,USTP CAMS Region 2 Office Central Islip,LI\n' +
  'USTP_CAMS_Region_2_Office_Albany,USTP CAMS Region 2 Office Albany,AL\n' +
  'USTP_CAMS_Region_2_Office_Utica,USTP CAMS Region 2 Office Utica,UT\n' +
  'USTP_CAMS_Region_2_Office_Buffalo,USTP CAMS Region 2 Office Buffalo,BU\n' +
  'USTP_CAMS_Region_2_Office_Rochester,USTP CAMS Region 2 Office Rochester,RO\n' +
  'USTP_CAMS_Region_2_Office_New_Haven,USTP CAMS Region 2 Office New Haven,NH\n' +
  'USTP_CAMS_Region_18_Office_Seattle,USTP CAMS Region 18 Office Seattle,SE|AK\n';

let metaMapping: Map<string, UstpDivisionMeta>;
const LEGACY_DIVISION_CODES = [];

const storage = new Map<string, string>();
storage.set(ROLE_MAPPING_PATH, ROLE_MAPPING);
storage.set(OFFICE_MAPPING_PATH, OFFICE_MAPPING);

function get(path: string): string | null {
  if (!storage.has(path)) {
    return null;
  }
  return storage.get(path);
}

function getRoleMapping(): Map<string, CamsRole> {
  if (!roleMapping) {
    const roleArray = ROLE_MAPPING.split('\n');
    roleMapping = roleArray.reduce((roleMap, roleString, idx) => {
      if (idx === 0 || !roleString.length) return roleMap;
      const roleInfo = roleString.split(',');

      roleMap.set(roleInfo[1], CamsRole[roleInfo[2]]);

      return roleMap;
    }, new Map<string, CamsRole>());
  }

  return roleMapping;
}

function getPrivilegedIdentityUserRoleGroupName(): string {
  const mapping = getRoleMapping();
  let groupNameToReturn;
  mapping.forEach((camsRole, groupName) => {
    if (camsRole === CamsRole.PrivilegedIdentityUser.toString()) {
      groupNameToReturn = groupName;
    }
  });
  if (!groupNameToReturn) {
    throw new NotFoundError(MODULE_NAME, {
      message: 'Cannot find privileged identity user role group name.',
    });
  }
  return groupNameToReturn;
}

function addUstpDivisionMetaToMap(
  map: Map<string, UstpDivisionMeta>,
  meta: UstpDivisionMeta,
  divisionCodes: string[],
) {
  divisionCodes.forEach((divisionCode) => {
    if (map.has(divisionCode)) {
      map.set(divisionCode, { ...map.get(divisionCode), ...meta });
    } else {
      map.set(divisionCode, meta);
    }
  });
}

function getUstpDivisionMeta(): Map<string, UstpDivisionMeta> {
  if (!metaMapping) {
    metaMapping = new Map<string, UstpDivisionMeta>();
    addUstpDivisionMetaToMap(metaMapping, { isLegacy: true }, LEGACY_DIVISION_CODES);
  }
  return metaMapping;
}

export const LocalStorageGateway: StorageGateway = {
  get,
  getRoleMapping,
  getUstpDivisionMeta,
  getPrivilegedIdentityUserRoleGroupName,
};

export default LocalStorageGateway;
