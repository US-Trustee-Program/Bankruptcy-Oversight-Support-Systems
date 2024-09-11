import { OfficeDetails } from '../courts';
import { CamsRole } from '../roles';
import { CamsUser } from '../users';
import { BUFFALO, DELAWARE, MANHATTAN, OFFICES, WHITE_PLAINS } from './offices.mock';

const REGION_02_GROUP_NY: OfficeDetails[] = [MANHATTAN, WHITE_PLAINS];
const REGION_02_GROUP_BU: OfficeDetails[] = [BUFFALO];
const REGION_03_GROUP_WL: OfficeDetails[] = [DELAWARE];

export type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
  hide?: boolean;
};

function addSuperUserOffices(user: CamsUser) {
  if (user.roles.includes(CamsRole.SuperUser)) {
    user.offices = OFFICES;
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
  hide: true,
};

addSuperUserOffices(SUPERUSER.user);

export const MockUsers: MockUser[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0001',
      name: 'Jessica Pearson',
      roles: [CamsRole.TrialAttorney],
      offices: REGION_02_GROUP_NY,
    },
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0002',
      name: 'Jack McCoy',
      roles: [CamsRole.TrialAttorney],
      offices: REGION_02_GROUP_NY,
    },
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Buffalo)',
    user: {
      id: 'bufAtty0001',
      name: 'Saul Goodman',
      roles: [CamsRole.TrialAttorney],
      offices: REGION_02_GROUP_BU,
    },
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Buffalo)',
    user: {
      id: 'bufAtty0002',
      name: 'Rachel Zane',
      roles: [CamsRole.TrialAttorney],
      offices: REGION_02_GROUP_BU,
    },
  },
  {
    sub: 'bert@fake.com',
    label: 'Bert - Data Verifier (Manhattan)',
    user: {
      id: 'bert@fake.com',
      name: 'Bert',
      roles: [CamsRole.DataVerifier],
      offices: REGION_02_GROUP_NY,
    },
  },
  {
    sub: 'earnie@fake.com',
    label: 'Earnie - Data Verifier (Buffalo)',
    user: {
      id: 'earnie@fake.com',
      name: 'Earnie',
      roles: [CamsRole.DataVerifier],
      offices: REGION_02_GROUP_BU,
    },
  },
  {
    sub: 'charlie@fake.com',
    label: 'Charlie - Assistant US Trustee (Manhattan)',
    user: {
      id: 'manAUST0001',
      name: 'Charlie',
      roles: [CamsRole.CaseAssignmentManager],
      offices: REGION_02_GROUP_NY,
    },
  },
  {
    sub: 'daniel@fake.com',
    label: 'Daniel - Assistant US Trustee (Buffalo)',
    user: {
      id: 'bufAUST0001',
      name: 'Daniel',
      roles: [CamsRole.CaseAssignmentManager],
      offices: REGION_02_GROUP_BU,
    },
  },
  {
    sub: 'emma@fake.com',
    label: 'Emma - Assistant US Trustee (Delaware)',
    user: {
      id: 'delAUST0001',
      name: 'Emma',
      roles: [CamsRole.CaseAssignmentManager],
      offices: REGION_03_GROUP_WL,
    },
  },
  SUPERUSER,
];

export default MockUsers;
