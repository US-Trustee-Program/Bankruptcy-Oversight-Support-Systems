import { CamsRole, CamsRoleType } from '@common/cams/roles';
import { StorageGateway } from '../../types/storage';
import { NotFoundError } from '../../../common-errors/not-found-error';

const MODULE_NAME = 'LOCAL-STORAGE-GATEWAY';

let roleMapping: Map<string, CamsRoleType>;
export const ROLE_MAPPING_PATH = '/rolemapping.csv';
// TODO: Add mappings for the Oversight CamsRoles here once the USTP groups are added
const ROLE_MAPPING =
  'ad_group_name,idp_group_name,cams_role\n' +
  'USTP_CAMS_Super_User,USTP CAMS Super User,SuperUser\n' +
  'USTP_CAMS_Privileged_Identity_Management,USTP CAMS Privileged Identity Management,PrivilegedIdentityUser\n' +
  'USTP_CAMS_Case_Assignment_Manager,USTP CAMS Case Assignment Manager,CaseAssignmentManager\n' +
  'USTP_CAMS_Trial_Attorney,USTP CAMS Trial Attorney,TrialAttorney\n' +
  'USTP_CAMS_Data_Verifier,USTP CAMS Data Verifier,DataVerifier\n' +
  'USTP_CAMS_Trustee_Admin,USTP CAMS Trustee Admin,TrusteeAdmin\n' +
  'USTP_CAMS_Paralegal,USTP CAMS Paralegal,Paralegal\n' +
  'USTP_CAMS_Auditor,USTP CAMS Auditor,Auditor\n';

const storage = new Map<string, string>();
storage.set(ROLE_MAPPING_PATH, ROLE_MAPPING);

function get(path: string): string | null {
  if (!storage.has(path)) {
    return null;
  }
  return storage.get(path);
}

function getRoleMapping(): Map<string, CamsRoleType> {
  if (!roleMapping) {
    const roleArray = ROLE_MAPPING.split('\n');
    roleMapping = roleArray.reduce((roleMap, roleString, idx) => {
      if (idx === 0 || !roleString.length) return roleMap;
      const roleInfo = roleString.split(',');

      roleMap.set(roleInfo[1], CamsRole[roleInfo[2]]);

      return roleMap;
    }, new Map<string, CamsRoleType>());
  }

  return roleMapping;
}

function getPrivilegedIdentityUserRoleGroupName(): string {
  const mapping = getRoleMapping();
  let groupNameToReturn: string | undefined = undefined;

  for (const [groupName, camsRole] of mapping) {
    if (camsRole === CamsRole.PrivilegedIdentityUser) {
      groupNameToReturn = groupName;
    }
  }

  if (!groupNameToReturn) {
    throw new NotFoundError(MODULE_NAME, {
      message: 'Cannot find privileged identity user role group name.',
    });
  }
  return groupNameToReturn;
}

const LocalStorageGateway: StorageGateway = {
  get,
  getRoleMapping,
  getPrivilegedIdentityUserRoleGroupName,
};

export default LocalStorageGateway;
