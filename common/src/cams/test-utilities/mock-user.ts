import { CamsRole } from '../roles';
import { CamsUser } from '../users';
import { BUFFALO, DELAWARE, MANHATTAN } from './offices.mock';

export type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
  hide?: boolean;
};

export const SUPERUSER = {
  sub: 'user@fake.com',
  label: "Martha's Son - Super User",
  user: {
    id: '==MOCKUSER=user@fake.com==',
    name: "Martha's Son",
    roles: [CamsRole.SuperUser, CamsRole.CaseAssignmentManager, CamsRole.TrialAttorney],
    offices: [],
  },
  hide: true,
};

export const MockUsers: MockUser[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0001',
      name: 'Jessica Pearson',
      roles: [CamsRole.TrialAttorney],
      offices: [MANHATTAN],
    },
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: {
      id: 'manAtty0002',
      name: 'Jack McCoy',
      roles: [CamsRole.TrialAttorney],
      offices: [MANHATTAN],
    },
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Buffalo)',
    user: {
      id: 'bufAtty0001',
      name: 'Saul Goodman',
      roles: [CamsRole.TrialAttorney],
      offices: [BUFFALO],
    },
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Buffalo)',
    user: {
      id: 'bufAtty0002',
      name: 'Rachel Zane',
      roles: [CamsRole.TrialAttorney],
      offices: [BUFFALO],
    },
  },
  {
    sub: 'paralegal',
    label: 'Bert - Paralegal',
    user: {
      id: '==MOCKUSER=paralegal==',
      name: 'Bert',
      roles: [],
      offices: [MANHATTAN],
    },
  },
  {
    sub: 'charlie@fake.com',
    label: 'Charlie - Assistant US Trustee (Manhattan)',
    user: {
      id: 'manAUST0001',
      name: 'Charlie',
      roles: [CamsRole.CaseAssignmentManager],
      offices: [MANHATTAN],
    },
  },
  {
    sub: 'daniel@fake.com',
    label: 'Daniel - Assistant US Trustee (Buffalo)',
    user: {
      id: 'bufAUST0001',
      name: 'Daniel',
      roles: [CamsRole.CaseAssignmentManager],
      offices: [BUFFALO],
    },
  },
  {
    sub: 'emma@fake.com',
    label: 'Emma - Assistant US Trustee (Delaware)',
    user: {
      id: 'delAUST0001',
      name: 'Emma',
      roles: [CamsRole.CaseAssignmentManager],
      offices: [DELAWARE],
    },
  },
  SUPERUSER,
];

export default MockUsers;
