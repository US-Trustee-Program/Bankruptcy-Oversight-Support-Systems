import { CamsRole } from '../roles';
import { CamsUser } from '../users';
import { BUFFALO, MANHATTAN } from './offices.mock';

export type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
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
      roles: [CamsRole.CaseAssignmentManager],
      offices: [MANHATTAN],
    },
  },
  {
    sub: 'aust',
    label: 'Charlie - Assistant US Trustee',
    user: { id: '==MOCKUSER=aust==', name: 'Charlie', roles: [], offices: [MANHATTAN] },
  },
  {
    sub: 'user@fake.com',
    label: "Martha's Son - Super User",
    user: {
      id: '==MOCKUSER=user@fake.com==',
      name: "Martha's Son",
      roles: [CamsRole.SuperUser, CamsRole.CaseAssignmentManager, CamsRole.TrialAttorney],
      offices: [],
    },
  },
];

export default MockUsers;
