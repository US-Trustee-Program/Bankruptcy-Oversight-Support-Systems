import { CamsRole } from '../../../../../../common/src/cams/roles';
import { StorageGateway } from '../../types/storage';
import { USTP_OFFICES_ARRAY, UstpOfficeDetails } from '../../../../../../common/src/cams/courts';

let roleMapping;

export const ROLE_MAPPING_PATH = '/rolemapping.csv';
const ROLE_MAPPING =
  'ad_group_name,idp_group_name,cams_role\n' +
  'USTP_CAMS_Case_assignment_Manager,USTP CAMS Case Assignment Manager,CaseAssignmentManager\n' +
  'USTP_CAMS_Trial_Attorney,USTP CAMS Trial Attorney,TrialAttorney\n' +
  'USTP_CAMS_Data_Verifier,USTP CAMS Data Verifier,DataVerifier\n';

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

const storage = new Map<string, string>();
storage.set(ROLE_MAPPING_PATH, ROLE_MAPPING);
storage.set(OFFICE_MAPPING_PATH, OFFICE_MAPPING);

function get(path: string): string | null {
  if (!storage.has(path)) {
    return null;
  }
  return storage.get(path);
}

function getUstpOffices(): UstpOfficeDetails[] {
  return USTP_OFFICES_ARRAY;
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

export const LocalStorageGateway: StorageGateway = {
  get,
  getUstpOffices,
  getRoleMapping,
};

export default LocalStorageGateway;
