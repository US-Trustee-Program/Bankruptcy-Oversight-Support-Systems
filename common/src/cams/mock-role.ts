import { CamsUser } from './session';

export type MockRole = {
  sub: string;
  label: string;
  user: CamsUser;
};

export const usersWithRole: MockRole[] = [
  {
    sub: 'jpearson@fake.com',
    label: 'Jessica Pearson - Trial Attorney (Manhattan)',
    user: { name: 'Jessica Pearson' },
  },
  {
    sub: 'jmccoy@fake.com',
    label: 'Jack McCoy - Trial Attorney (Manhattan)',
    user: { name: 'Jack McCoy' },
  },
  {
    sub: 'sgoodman@fake.com',
    label: 'Saul Goodman - Trial Attorney (Boston)',
    user: { name: 'Saul Goodman', offices: [] },
  },
  {
    sub: 'rzane@fake.com',
    label: 'Rachel Zane - Trial Attorney (Boston)',
    user: { name: 'Rachel Zane' },
  },
  { sub: 'paralegal', label: 'Paralegal', user: { name: 'Bert' } },
  { sub: 'aust', label: 'Assistant US Trustee', user: { name: 'Charlie' } },
];
