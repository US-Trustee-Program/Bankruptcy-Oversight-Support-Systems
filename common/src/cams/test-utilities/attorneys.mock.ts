import { CamsRole } from '../roles';
import { AttorneyUser } from '../users';
import MockUsers from './mock-user';
import { MANHATTAN } from './offices.mock';

const manhattanAttorneys = MockUsers.filter(
  (user) => user.user.offices[0] === MANHATTAN && user.user.roles[0] === CamsRole.TrialAttorney,
).map((user) => user.user);

export const ATTORNEYS: AttorneyUser[] = [
  ...manhattanAttorneys,
  {
    id: 'ATY001',
    name: 'Linda A Rifkin',
    offices: [MANHATTAN],
  },

  {
    id: 'ATY002',
    name: 'Susan Arbeit',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY003',
    name: 'Mark Bruh',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY004',
    name: 'Shara Cornell',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY005',
    name: 'Brian S Masumoto',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY006',
    name: 'Andrea B Schwartz',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY007',
    name: 'Paul K Schwartzenberg',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY008',
    name: 'Shannon Scott',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY009',
    name: 'Tara Tiantian',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY010',
    name: 'Andy Velez-Rivera',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY011',
    name: 'Daniel Rudewicz',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY012',
    name: 'Annie Wells',
    offices: [MANHATTAN],
  },
  {
    id: 'ATY013',
    name: 'Greg M Zipes',
    offices: [MANHATTAN],
  },
];
