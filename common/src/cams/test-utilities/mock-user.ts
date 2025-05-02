import { MOCKED_USTP_OFFICE_DATA_MAP, MOCKED_USTP_OFFICES_ARRAY } from '../offices';
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
export const REGION_03_GROUP_WL = MOCKED_USTP_OFFICE_DATA_MAP.get(
  'USTP_CAMS_Region_3_Office_Wilmington',
)!;

export type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
  hide?: boolean;
};

function addSuperUserOffices(user: CamsUser) {
  if (user.roles.includes(CamsRole.SuperUser)) {
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
    roles: [CamsRole.SuperUser],
    offices: [],
  },
  hide: false,
};

addSuperUserOffices(SUPERUSER.user);

export const MockUsers: MockUser[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0001',
      name: 'Jessica Pearson',
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
      roles: [],
      offices: [],
    },
  },
  SUPERUSER,
];

export default MockUsers;
