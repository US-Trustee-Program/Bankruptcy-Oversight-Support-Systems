import { CamsRole, CamsUser } from '../session';
import MockData from './mock-data';

export type MockRole = {
  sub: string;
  label: string;
  user: CamsUser;
  // groups: string[];
};

// TODO: Make some aliases to make managing these relationships easier.
const offices = MockData.getOffices();

const MANHATTAN = offices.filter((office) => office.courtDivisionCode === '081');
const BUFFALO = offices.filter((office) => office.courtDivisionCode === '091');

export const usersWithRole: MockRole[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: { name: 'Jessica Pearson', roles: [CamsRole.TrialAttorney], offices: MANHATTAN },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: { name: 'Jack McCoy', roles: [CamsRole.TrialAttorney], offices: MANHATTAN },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Buffalo)',
    user: { name: 'Saul Goodman', roles: [CamsRole.TrialAttorney], offices: BUFFALO },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Buffalo'],
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Buffalo)',
    user: { name: 'Rachel Zane', roles: [CamsRole.TrialAttorney], offices: BUFFALO },
    // groups: ['USTP CAMS Trial Attorney', 'USTP CAMS Region 2 Office Buffalo'],
  },
  {
    sub: 'paralegal',
    label: 'Bert - Paralegal',
    user: { name: 'Bert', roles: [CamsRole.CaseAssignmentManager], offices: MANHATTAN },
    // groups: ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'aust',
    label: 'Charlie - Assistant US Trustee',
    user: { name: 'Charlie', roles: [], offices: MANHATTAN },
    // groups: ['USTP CAMS Region 2 Office Manhattan'],
  },
  {
    sub: 'user@fake.com',
    label: "Martha's Son - Super User",
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
