import { CamsRole, CamsUser } from '../session';
import { BUFFALO, MANHATTAN } from './mock-data';

export type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
};

export const MockUsers: MockUser[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: { name: 'Jessica Pearson', roles: [CamsRole.TrialAttorney], offices: [MANHATTAN] },
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: { name: 'Jack McCoy', roles: [CamsRole.TrialAttorney], offices: [MANHATTAN] },
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Buffalo)',
    user: { name: 'Saul Goodman', roles: [CamsRole.TrialAttorney], offices: [BUFFALO] },
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Buffalo)',
    user: { name: 'Rachel Zane', roles: [CamsRole.TrialAttorney], offices: [BUFFALO] },
  },
  {
    sub: 'paralegal',
    label: 'Bert - Paralegal',
    user: { name: 'Bert', roles: [CamsRole.CaseAssignmentManager], offices: [MANHATTAN] },
  },
  {
    sub: 'aust',
    label: 'Charlie - Assistant US Trustee',
    user: { name: 'Charlie', roles: [], offices: [MANHATTAN] },
  },
  {
    sub: 'user@fake.com',
    label: "Martha's Son - Super User",
    user: {
      name: "Martha's Son",
      roles: [CamsRole.SuperUser, CamsRole.CaseAssignmentManager, CamsRole.TrialAttorney],
      offices: [],
    },
  },
];

export default MockUsers;
