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
  hide?: boolean;
  label: string;
  sub: string;
  user: CamsUser;
};

function addSuperUserOffices(user: CamsUser) {
  if (user.roles.includes(CamsRole.SuperUser)) {
    user.offices = MOCKED_USTP_OFFICES_ARRAY;
    user.roles = Object.values(CamsRole);
  }
}

export const SUPERUSER = {
  hide: false,
  label: "Martha's Son - Super User",
  sub: 'user@fake.com',
  user: {
    id: '==MOCKUSER=user@fake.com==',
    name: "Martha's Son",
    offices: [],
    roles: [CamsRole.SuperUser],
  },
};

addSuperUserOffices(SUPERUSER.user);

export const MockUsers: MockUser[] = [
  {
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    sub: 'jpearson@fake.com',
    user: {
      id: 'manAtty0001',
      name: 'Jessica Pearson',
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
    },
  },
  {
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    sub: 'jmccoy@fake.com',
    user: {
      id: 'manAtty0002',
      name: 'Jack McCoy',
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrialAttorney],
    },
  },
  {
    label: 'Saul Goodman - Trial Attorney (Seattle)',
    sub: 'sgoodman@fake.com',
    user: {
      id: 'seaAtty0001',
      name: 'Saul Goodman',
      offices: [REGION_02_GROUP_SE],
      roles: [CamsRole.TrialAttorney],
    },
  },
  {
    label: 'Rachel Zane - Trial Attorney (Seattle)',
    sub: 'rzane@fake.com',
    user: {
      id: 'seaAtty0002',
      name: 'Rachel Zane',
      offices: [REGION_02_GROUP_SE],
      roles: [CamsRole.TrialAttorney],
    },
  },
  {
    label: 'Bert - Data Verifier (Manhattan)',
    sub: 'bert@fake.com',
    user: {
      id: 'bert@fake.com',
      name: 'Bert',
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.DataVerifier, CamsRole.PrivilegedIdentityUser],
    },
  },
  {
    label: 'Earnie - Data Verifier (Seattle)',
    sub: 'earnie@fake.com',
    user: {
      id: 'earnie@fake.com',
      name: 'Earnie',
      offices: [REGION_02_GROUP_SE],
      roles: [CamsRole.DataVerifier],
    },
  },
  {
    label: 'Charlie - Assistant US Trustee (Manhattan)',
    sub: 'charlie@fake.com',
    user: {
      id: 'manAUST0001',
      name: 'Charlie',
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager, CamsRole.PrivilegedIdentityUser],
    },
  },
  {
    label: 'Daniel - Assistant US Trustee (Seattle)',
    sub: 'daniel@fake.com',
    user: {
      id: 'bufAUST0001',
      name: 'Daniel',
      offices: [REGION_02_GROUP_SE],
      roles: [CamsRole.CaseAssignmentManager],
    },
  },
  {
    label: 'Emma - Assistant US Trustee (Delaware)',
    sub: 'emma@fake.com',
    user: {
      id: 'delAUST0001',
      name: 'Emma',
      offices: [REGION_03_GROUP_WL],
      roles: [CamsRole.CaseAssignmentManager],
    },
  },
  {
    label: 'Unhoused - No Office',
    sub: 'unhoused@fake.com',
    user: {
      id: 'unhoused',
      name: 'Unhoused',
      offices: [],
      roles: [CamsRole.CaseAssignmentManager, CamsRole.DataVerifier],
    },
  },
  {
    label: 'Nobody - No Role. No Office',
    sub: 'nobody@fake.com',
    user: {
      id: 'nobody',
      name: 'Nobody',
      offices: [],
      roles: [],
    },
  },
  SUPERUSER,
];

export default MockUsers;
