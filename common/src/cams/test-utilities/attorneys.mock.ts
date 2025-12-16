import { CamsRole } from '../roles';
import { AttorneyUser } from '../users';
import MockUsers, { REGION_02_GROUP_NY } from './mock-user';

export const MockAttorneys: Record<string, AttorneyUser> = {
  Daisy: { id: '0001', name: 'Daisy', offices: [], roles: [CamsRole.TrialAttorney] },
  Roger: { id: '0002', name: 'Roger', offices: [], roles: [CamsRole.TrialAttorney] },
  Frank: { id: '0003', name: 'Frank', offices: [], roles: [CamsRole.TrialAttorney] },
  MrJones: { id: '0004', name: 'Mr. Jones', offices: [], roles: [CamsRole.TrialAttorney] },
  Diana: { id: '0005', name: 'Diana', offices: [], roles: [CamsRole.TrialAttorney] },
  Joe: { id: '0006', name: 'Joe', offices: [], roles: [CamsRole.TrialAttorney] },
  Carl: { id: '0007', name: 'Carl', offices: [], roles: [CamsRole.TrialAttorney] },
  Brian: { id: '0008', name: 'Brian', offices: [], roles: [CamsRole.TrialAttorney] },
};

const manhattanAttorneys = MockUsers.filter(
  (user) =>
    user.user.offices?.[0] === REGION_02_GROUP_NY &&
    user.user.roles?.[0] === CamsRole.TrialAttorney,
).map((user) => user.user);

export const TRIAL_ATTORNEYS: AttorneyUser[] = [
  ...manhattanAttorneys,
  {
    id: 'ATY001',
    name: 'Linda A Rifkin',
    offices: [REGION_02_GROUP_NY],
  },

  {
    id: 'ATY002',
    name: 'Susan Arbeit',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY003',
    name: 'Mark Bruh',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY004',
    name: 'Shara Cornell',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY005',
    name: 'Brian S Masumoto',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY006',
    name: 'Andrea B Schwartz',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY007',
    name: 'Paul K Schwartzenberg',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY008',
    name: 'Shannon Scott',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY009',
    name: 'Tara Tiantian',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY010',
    name: 'Andy Velez-Rivera',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY011',
    name: 'Daniel Rudewicz',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY012',
    name: 'Annie Wells',
    offices: [REGION_02_GROUP_NY],
  },
  {
    id: 'ATY013',
    name: 'Greg M Zipes',
    offices: [REGION_02_GROUP_NY],
  },
];
