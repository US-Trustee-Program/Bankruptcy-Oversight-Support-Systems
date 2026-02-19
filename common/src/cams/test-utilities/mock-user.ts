import { MOCKED_USTP_OFFICE_DATA_MAP, MOCKED_USTP_OFFICES_ARRAY } from './offices.mock';
import { CamsRole } from '../roles';
import { CamsUser } from '../users';

export const REGION_02_GROUP_NY = MOCKED_USTP_OFFICE_DATA_MAP.get(
  'USTP_CAMS_Region_2_Office_Manhattan',
)!;
export const REGION_02_GROUP_BU = MOCKED_USTP_OFFICE_DATA_MAP.get(
  'USTP_CAMS_Region_2_Office_Buffalo',
)!;
export const REGION_02_GROUP_SE = MOCKED_USTP_OFFICE_DATA_MAP.get(
  'USTP_CAMS_Region_18_Office_Seattle',
)!;
const REGION_03_GROUP_WL = MOCKED_USTP_OFFICE_DATA_MAP.get('USTP_CAMS_Region_3_Office_Wilmington')!;

export type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
  hide?: boolean;
};

function addSuperUserOffices(user: CamsUser) {
  if (user.roles?.includes(CamsRole.SuperUser)) {
    user.offices = MOCKED_USTP_OFFICES_ARRAY;
    user.roles = Object.values(CamsRole);
  }
}

export const SUPERUSER = {
  sub: 'user@fake.com',
  label: "Martha's Son - Super User",
  user: {
    id: '==MOCKUSER=user@fake.com==',
    name: "Martha's Son",
    email: 'user@fake.com',
    roles: [CamsRole.SuperUser],
    offices: [],
  },
  hide: false,
};

addSuperUserOffices(SUPERUSER.user);

const MockUsers: MockUser[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0001',
      name: 'Jessica Pearson',
      email: 'jpearson@fake.com',
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      offices: [REGION_02_GROUP_NY],
    },
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0002',
      name: 'Jack McCoy',
      email: 'jmccoy@fake.com',
      roles: [CamsRole.TrialAttorney],
      offices: [REGION_02_GROUP_NY],
    },
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Seattle)',
    user: {
      id: 'seaAtty0001',
      name: 'Saul Goodman',
      email: 'sgoodman@fake.com',
      roles: [CamsRole.TrialAttorney],
      offices: [REGION_02_GROUP_SE],
    },
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Seattle)',
    user: {
      id: 'seaAtty0002',
      name: 'Rachel Zane',
      email: 'rzane@fake.com',
      roles: [CamsRole.TrialAttorney],
      offices: [REGION_02_GROUP_SE],
    },
  },
  {
    sub: 'bert@fake.com',
    label: 'Bert - Data Verifier (Manhattan)',
    user: {
      id: 'bert@fake.com',
      name: 'Bert',
      email: 'bert@fake.com',
      roles: [CamsRole.DataVerifier, CamsRole.PrivilegedIdentityUser],
      offices: [REGION_02_GROUP_NY],
    },
  },
  {
    sub: 'earnie@fake.com',
    label: 'Earnie - Data Verifier (Seattle)',
    user: {
      id: 'earnie@fake.com',
      name: 'Earnie',
      email: 'earnie@fake.com',
      roles: [CamsRole.DataVerifier],
      offices: [REGION_02_GROUP_SE],
    },
  },
  {
    sub: 'charlie@fake.com',
    label: 'Charlie - Assistant US Trustee (Manhattan)',
    user: {
      id: 'manAUST0001',
      name: 'Charlie',
      email: 'charlie@fake.com',
      roles: [CamsRole.CaseAssignmentManager, CamsRole.PrivilegedIdentityUser],
      offices: [REGION_02_GROUP_NY],
    },
  },
  {
    sub: 'daniel@fake.com',
    label: 'Daniel - Assistant US Trustee (Seattle)',
    user: {
      id: 'bufAUST0001',
      name: 'Daniel',
      email: 'daniel@fake.com',
      roles: [CamsRole.CaseAssignmentManager],
      offices: [REGION_02_GROUP_SE],
    },
  },
  {
    sub: 'emma@fake.com',
    label: 'Emma - Assistant US Trustee (Delaware)',
    user: {
      id: 'delAUST0001',
      name: 'Emma',
      email: 'emma@fake.com',
      roles: [CamsRole.CaseAssignmentManager],
      offices: [REGION_03_GROUP_WL],
    },
  },
  {
    sub: 'unhoused@fake.com',
    label: 'Unhoused - No Office',
    user: {
      id: 'unhoused',
      name: 'Unhoused',
      email: 'unhoused@fake.com',
      roles: [CamsRole.CaseAssignmentManager, CamsRole.DataVerifier],
      offices: [],
    },
  },
  {
    sub: 'nobody@fake.com',
    label: 'Nobody - No Role. No Office',
    user: {
      id: 'nobody',
      name: 'Nobody',
      email: 'nobody@fake.com',
      roles: [],
      offices: [],
    },
  },
  {
    sub: 'trusteeadmin@fake.com',
    label: 'Terry - Trustee Admin (Manhattan)',
    user: {
      id: 'trusteeadmin',
      name: 'Terry',
      email: 'trusteeadmin@fake.com',
      roles: [CamsRole.TrusteeAdmin],
      offices: [REGION_02_GROUP_NY],
    },
  },
  SUPERUSER,
];

export default MockUsers;
