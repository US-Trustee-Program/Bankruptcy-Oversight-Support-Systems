import { CamsRole } from '../../../../../../common/src/cams/roles';
import { StorageGateway } from '../../types/storage';

let roleMapping;
let officeMapping;

export const ROLE_MAPPING_PATH = '/rolemapping.csv';
const ROLE_MAPPING =
  'ad_group_name,idp_group_name,cams_role\n' +
  'USTP_CAMS_Case_assignment_Manager,USTP CAMS Case Assignment Manager,CaseAssignmentManager\n' +
  'USTP_CAMS_Trial_Attorney,USTP CAMS Trial Attorney,TrialAttorney\n';

export const OFFICE_MAPPING_PATH = '/officemapping.csv';
const OFFICE_MAPPING =
  'ad_group_name,idp_group_name,dxtr_court_id,dxtr_office_code\n' +
  'USTP_CAMS_Region_2_Office_Manhattan,USTP CAMS Region 2 Office Manhattan,0208,1\n' +
  'USTP_CAMS_Region_2_Office_Brooklyn,USTP CAMS Region 2 Office Brooklyn,0207,1\n' +
  'USTP_CAMS_Region_2_Office_Central_Islip,USTP CAMS Region 2 Office Central Islip,0207,8\n' +
  'USTP_CAMS_Region_2_Office_Albany,USTP CAMS Region 2 Office Albany,0206,1\n' +
  'USTP_CAMS_Region_2_Office_Utica,USTP CAMS Region 2 Office Utica,0206,6\n' +
  'USTP_CAMS_Region_2_Office_Buffalo,USTP CAMS Region 2 Office Buffalo,0209,1\n' +
  'USTP_CAMS_Region_2_Office_Rochester,USTP CAMS Region 2 Office Rochester,0209,2\n' +
  'USTP_CAMS_Region_2_Office_New_Haven,USTP CAMS Region 2 Office New Haven,0205,3\n';

const storage = new Map<string, string>();
storage.set(ROLE_MAPPING_PATH, ROLE_MAPPING);
storage.set(OFFICE_MAPPING_PATH, OFFICE_MAPPING);

function get(path: string): string | null {
  if (!storage.has(path)) {
    return null;
  }
  return storage.get(path);
}

export type DxtrOfficeKeys = {
  courtId: string;
  officeCode: string;
};

function getOfficeMapping(): Map<string, DxtrOfficeKeys> {
  if (!officeMapping) {
    const officeArray = OFFICE_MAPPING.split('\n');
    officeMapping = officeArray.reduce((officeMap, officeString, idx) => {
      if (idx === 0) return officeMap;
      const officeInfo = officeString.split(',');

      officeMap.set(officeInfo[1], {
        courtId: officeInfo[2],
        officeCode: officeInfo[3],
      });

      return officeMap;
    }, new Map<string, DxtrOfficeKeys>());
  }

  return officeMapping;
}

function getRoleMapping(): Map<string, CamsRole> {
  if (!roleMapping) {
    const roleArray = ROLE_MAPPING.split('\n');
    roleMapping = roleArray.reduce((roleMap, roleString, idx) => {
      if (idx === 0) return roleMap;
      const roleInfo = roleString.split(',');

      roleMap.set(roleInfo[1], CamsRole[roleInfo[2]]);

      return roleMap;
    }, new Map<string, CamsRole>());
  }

  return roleMapping;
}

export const LocalStorageGateway: StorageGateway = {
  get,
  getOfficeMapping,
  getRoleMapping,
};

export default LocalStorageGateway;
