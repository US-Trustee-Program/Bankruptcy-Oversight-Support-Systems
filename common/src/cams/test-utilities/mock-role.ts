import { CamsRole, CamsUser } from '../session';

export type MockRole = {
  sub: string;
  label: string;
  user: CamsUser;
  // groups: string[];
};

export const usersWithRole: MockRole[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: { name: 'Jessica Pearson', roles: [CamsRole.TrialAttorney], offices: [] },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: { name: 'Jack McCoy', roles: [CamsRole.TrialAttorney], offices: [] },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Buffalo)',
    user: { name: 'Saul Goodman', roles: [CamsRole.TrialAttorney], offices: [] },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Buffalo'],
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Buffalo)',
    user: { name: 'Rachel Zane', roles: [CamsRole.TrialAttorney], offices: [] },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Buffalo'],
  },
  {
    sub: 'paralegal',
    label: 'Paralegal',
    user: { name: 'Bert', roles: [CamsRole.CaseAssignmentManager], offices: [] },
    // groups: ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'aust',
    label: 'Assistant US Trustee',
    user: { name: 'Charlie', roles: [], offices: [] },
    // groups: ['USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'user@fake.com',
    label: 'Super User',
    user: {
      name: "Martha's Son",
      roles: [CamsRole.CaseAssignmentManager, CamsRole.TrialAttorney],
      offices: [],
    },
    // groups: [
    //   'USTP CAMS Trial Attorney',
    //   'USTP CAMS Case Assignment Manager',
    //   'USTP CAMS Region 2 Office Manhattan',
    // ],
  },
];
