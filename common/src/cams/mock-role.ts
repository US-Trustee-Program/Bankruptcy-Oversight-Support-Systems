import { CamsUser } from './session';

export type MockRole = {
  sub: string;
  label: string;
  user: CamsUser;
};

export const usersWithRole: MockRole[] = [
  { sub: 'trial-attorney', label: 'Trial Attorney', user: { name: 'Abe' } },
  { sub: 'paralegal', label: 'Paralegal', user: { name: 'Bert' } },
  { sub: 'aust', label: 'Assistant US Trustee', user: { name: 'Charlie' } },
];
